import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Drawer, Empty, Spin, Button, Space, Tooltip, message } from 'antd';
import { ZoomInOutlined, ZoomOutOutlined, ReloadOutlined } from '@ant-design/icons';
import { GraphData, GraphNode, GraphEdge, Note } from '../../types';
import { getNotes } from '../../services/noteService';
import { getAllTags } from '../../services/tagService';

interface KnowledgeGraphProps {
  visible: boolean;
  onClose: () => void;
  onSelectNote: (noteId: string) => void;
}

const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({ visible, onClose, onSelectNote }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [dragging, setDragging] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const didDragRef = useRef(false);
  const transformRef = useRef(transform);
  transformRef.current = transform;

  // 构建图谱数据
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoading(true);

    const loadData = async () => {
    let notes, tags;
    try {
      notes = await getNotes({ isDeleted: false });
      tags = await getAllTags();
    } catch (error) {
      if (!cancelled) {
        console.error('加载知识图谱数据失败:', error);
        message.error('加载知识图谱数据失败');
        setLoading(false);
      }
      return;
    }

    if (cancelled) return;

    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    // 添加笔记节点
    for (const note of notes) {
      nodes.push({
        id: note.id,
        label: note.title || '无标题',
        type: 'note',
        size: Math.max(8, Math.min(20, note.wordCount / 100)),
        color: note.isFavorite ? '#faad14' : '#1890ff',
      });
    }

    // 通过标签索引建立边，避免 O(n²) 遍历
    const edgeSet = new Set<string>();
    const tagToNoteIds = new Map<string, string[]>();
    for (const note of notes) {
      for (const tag of note.tags) {
        let list = tagToNoteIds.get(tag);
        if (!list) {
          list = [];
          tagToNoteIds.set(tag, list);
        }
        list.push(note.id);
      }
    }
    for (const noteIds of tagToNoteIds.values()) {
      for (let i = 0; i < noteIds.length; i++) {
        for (let j = i + 1; j < noteIds.length; j++) {
          const a = noteIds[i];
          const b = noteIds[j];
          const key = a < b ? `${a}:${b}` : `${b}:${a}`;
          if (!edgeSet.has(key)) {
            edgeSet.add(key);
            edges.push({ source: a, target: b, weight: 1 });
          }
        }
      }
    }

    // 添加标签节点并复用 tagToNoteIds 建立连接
    for (const tag of tags.slice(0, 15)) {
      nodes.push({
        id: `tag-${tag.id}`,
        label: tag.name,
        type: 'tag',
        size: 6,
        color: tag.color,
      });

      const noteIds = tagToNoteIds.get(tag.name) || [];
      for (const noteId of noteIds) {
        edges.push({
          source: `tag-${tag.id}`,
          target: noteId,
          weight: 1,
        });
      }
    }

    // 初始化节点位置（圆形布局）
    const centerX = 400;
    const centerY = 300;
    const radius = 200;
    const positionedNodes = nodes.map((node, i) => {
      const angle = (2 * Math.PI * i) / nodes.length;
      return {
        ...node,
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      };
    });

    setGraphData({ nodes: positionedNodes, edges });
    setLoading(false);
    };
    loadData();
    return () => { cancelled = true; };
  }, [visible]);

  // 绘制图谱
  useEffect(() => {
    if (!canvasRef.current || !graphData) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    if (canvas.clientWidth === 0 || canvas.clientHeight === 0) return;
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    ctx.scale(dpr, dpr);

    // 清空画布
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    ctx.save();
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.scale, transform.scale);

    const isDark = document.body.getAttribute('data-theme') === 'dark';

    // 绘制边
    const nodeMap = new Map(graphData.nodes.map((n) => [n.id, n]));
    for (const edge of graphData.edges) {
      const source = nodeMap.get(edge.source);
      const target = nodeMap.get(edge.target);
      if (!source || !target || !source.x || !source.y || !target.x || !target.y) continue;

      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);
      const edgeAlpha = 0.2 + edge.weight * 0.2;
      ctx.strokeStyle = isDark ? `rgba(120, 120, 120, ${edgeAlpha})` : `rgba(200, 200, 200, ${edgeAlpha})`;
      ctx.lineWidth = 0.5 + edge.weight * 0.5;
      ctx.stroke();
    }

    // 绘制节点
    for (const node of graphData.nodes) {
      if (!node.x || !node.y) continue;

      const isHovered = hoveredNode?.id === node.id;
      const nodeSize = node.size * (isHovered ? 1.3 : 1);

      // 节点圆圈
      ctx.beginPath();
      ctx.arc(node.x, node.y, nodeSize, 0, 2 * Math.PI);
      ctx.fillStyle = node.color;
      ctx.fill();

      if (isHovered) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // 节点标签
      ctx.fillStyle = isDark ? '#ddd' : '#333';
      ctx.font = `${node.type === 'tag' ? '11' : '12'}px -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(node.label.substring(0, 8), node.x, node.y + nodeSize + 4);
    }

    ctx.restore();
  }, [graphData, transform, hoveredNode]);

  // 鼠标事件处理
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      setDragging(true);
      didDragRef.current = false;
      dragStartRef.current = { x: e.clientX - transformRef.current.x, y: e.clientY - transformRef.current.y };
    },
    [],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (dragging) {
        const dx = e.clientX - dragStartRef.current.x - transformRef.current.x;
        const dy = e.clientY - dragStartRef.current.y - transformRef.current.y;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDragRef.current = true;
        setTransform((prev) => ({
          ...prev,
          x: e.clientX - dragStartRef.current.x,
          y: e.clientY - dragStartRef.current.y,
        }));
      } else if (graphData) {
        // 检测悬停节点
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const t = transformRef.current;
        const x = (e.clientX - rect.left - t.x) / t.scale;
        const y = (e.clientY - rect.top - t.y) / t.scale;

        const hovered = graphData.nodes.find((node) => {
          if (!node.x || !node.y) return false;
          const dx = x - node.x;
          const dy = y - node.y;
          return Math.sqrt(dx * dx + dy * dy) < node.size + 5;
        });
        setHoveredNode(hovered || null);
      }
    },
    [dragging, graphData],
  );

  const handleMouseUp = useCallback(() => {
    setDragging(false);
  }, []);

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setTransform((prev) => ({
      ...prev,
      scale: Math.max(0.3, Math.min(3, prev.scale * delta)),
    }));
  }, []);

  // 使用 addEventListener 绑定 wheel 事件以支持 passive: false
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // 点击节点
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (didDragRef.current) return;
      if (hoveredNode && hoveredNode.type === 'note') {
        onSelectNote(hoveredNode.id);
        onClose();
      }
    },
    [hoveredNode, onSelectNote, onClose],
  );

  // 重置视图
  const handleReset = useCallback(() => {
    setTransform({ x: 0, y: 0, scale: 1 });
  }, []);

  return (
    <Drawer
      title="知识图谱"
      placement="right"
      width={800}
      onClose={onClose}
      open={visible}
      extra={
        <Space>
          <Tooltip title="放大">
            <Button
              icon={<ZoomInOutlined />}
              onClick={() => setTransform((p) => ({ ...p, scale: p.scale * 1.2 }))}
            />
          </Tooltip>
          <Tooltip title="缩小">
            <Button
              icon={<ZoomOutOutlined />}
              onClick={() => setTransform((p) => ({ ...p, scale: p.scale * 0.8 }))}
            />
          </Tooltip>
          <Tooltip title="重置视图">
            <Button icon={<ReloadOutlined />} onClick={handleReset} />
          </Tooltip>
        </Space>
      }
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 100 }}>
          <Spin tip="构建知识图谱中..." />
        </div>
      ) : !graphData || graphData.nodes.length === 0 ? (
        <Empty description="暂无足够数据构建知识图谱" />
      ) : (
        <div style={{ position: 'relative', height: '100%' }}>
          <canvas
            ref={canvasRef}
            style={{ width: '100%', height: '100%', cursor: dragging ? 'grabbing' : 'grab' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onClick={handleClick}
          />
          {hoveredNode && (
            <div
              style={{
                position: 'absolute',
                bottom: 16,
                left: 16,
                background: 'rgba(0,0,0,0.7)',
                color: '#fff',
                padding: '8px 12px',
                borderRadius: 4,
                fontSize: 12,
              }}
            >
              {hoveredNode.type === 'note' ? '笔记' : '标签'}: {hoveredNode.label}
              {hoveredNode.type === 'note' && ' (点击查看)'}
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
};

export default KnowledgeGraph;
