import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Tabs, Form, Switch, InputNumber, Select, Input, Button, message } from 'antd';

interface SettingsDialogProps {
  visible: boolean;
  onClose: () => void;
  isDark: boolean;
  onThemeChange: (isDark: boolean) => void;
}

const SettingsDialog: React.FC<SettingsDialogProps> = ({ visible, onClose, isDark, onThemeChange }) => {
  const [autoSave, setAutoSave] = useState(true);
  const [autoSaveInterval, setAutoSaveInterval] = useState(3);
  const [aiEndpoint, setAiEndpoint] = useState('');
  const [aiModel, setAiModel] = useState('');
  const [aiHasKey, setAiHasKey] = useState(false);
  const [aiApiKey, setAiApiKey] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setAutoSave(localStorage.getItem('nm-auto-save') !== 'false');
    setAutoSaveInterval(Number(localStorage.getItem('nm-auto-save-interval')) || 3);
    window.electronAPI.getAIConfig().then((cfg) => {
      if (cfg) {
        setAiEndpoint(cfg.endpoint);
        setAiModel(cfg.model);
        setAiHasKey(cfg.hasKey);
      }
    }).catch(console.error);
    setAiApiKey('');
  }, [visible]);

  const handleSaveGeneral = useCallback(() => {
    localStorage.setItem('nm-auto-save', String(autoSave));
    localStorage.setItem('nm-auto-save-interval', String(autoSaveInterval));
    message.success('设置已保存');
  }, [autoSave, autoSaveInterval]);

  const handleSaveAI = useCallback(async () => {
    if (!aiApiKey && !aiHasKey) {
      message.warning('请输入API密钥');
      return;
    }
    setSaving(true);
    try {
      await window.electronAPI.saveAIConfig({
        apiKey: aiApiKey,
        endpoint: aiEndpoint,
        model: aiModel,
      });
      setAiHasKey(true);
      setAiApiKey('');
      message.success('AI配置已保存');
    } catch {
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  }, [aiApiKey, aiEndpoint, aiModel, aiHasKey]);

  return (
    <Modal title="设置" open={visible} onCancel={onClose} footer={null} width={500}>
      <Tabs
        items={[
          {
            key: 'general',
            label: '通用',
            children: (
              <Form layout="vertical">
                <Form.Item label="主题">
                  <Select
                    value={isDark ? 'dark' : 'light'}
                    onChange={(v) => onThemeChange(v === 'dark')}
                    options={[
                      { label: '浅色', value: 'light' },
                      { label: '深色', value: 'dark' },
                    ]}
                  />
                </Form.Item>
                <Form.Item label="自动保存">
                  <Switch checked={autoSave} onChange={setAutoSave} style={{ marginRight: 8 }} />
                  {autoSave && (
                    <InputNumber
                      value={autoSaveInterval}
                      onChange={(v) => setAutoSaveInterval(v || 3)}
                      min={1}
                      max={60}
                      addonAfter="秒"
                    />
                  )}
                </Form.Item>
                <Form.Item>
                  <Button type="primary" onClick={handleSaveGeneral}>
                    保存
                  </Button>
                </Form.Item>
              </Form>
            ),
          },
          {
            key: 'ai',
            label: 'AI配置',
            children: (
              <Form layout="vertical">
                <Form.Item label="API端点">
                  <Input
                    value={aiEndpoint}
                    onChange={(e) => setAiEndpoint(e.target.value)}
                    placeholder="https://api.openai.com/v1/chat/completions"
                  />
                </Form.Item>
                <Form.Item label="模型">
                  <Input
                    value={aiModel}
                    onChange={(e) => setAiModel(e.target.value)}
                    placeholder="gpt-3.5-turbo"
                  />
                </Form.Item>
                <Form.Item label="API密钥">
                  <Input.Password
                    value={aiApiKey}
                    onChange={(e) => setAiApiKey(e.target.value)}
                    placeholder={aiHasKey ? '已设置（留空保持不变）' : '输入API密钥'}
                  />
                </Form.Item>
                <Form.Item>
                  <Button type="primary" onClick={handleSaveAI} loading={saving}>
                    保存
                  </Button>
                </Form.Item>
              </Form>
            ),
          },
        ]}
      />
    </Modal>
  );
};

export default SettingsDialog;
