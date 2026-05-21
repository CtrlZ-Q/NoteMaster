# NoteMaster

AI增强的Markdown学习笔记管理工具，专为开发者和学生设计。

## 功能特性

### 核心功能

- **Markdown编辑器** - 实时预览、语法高亮、公式渲染（KaTeX）
- **笔记管理** - 文件夹分类、标签管理、全文搜索、笔记模板
- **AI辅助** - 智能摘要生成、知识点提取、语法检查
- **知识图谱** - 笔记关联可视化，发现知识间的联系
- **导出分享** - 支持导出为PDF、HTML、图片格式

### 技术亮点

- 基于 FlexSearch 的高性能全文搜索
- 虚拟滚动（react-virtuoso）处理大量笔记
- 自动保存机制，防止数据丢失
- 离线优先，数据存储在本地SQLite数据库

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Electron 28 + React 18 + TypeScript |
| UI | Ant Design 5 |
| Markdown | markdown-it + highlight.js + KaTeX |
| 搜索 | FlexSearch |
| 存储 | SQLite（better-sqlite3）|
| 打包 | electron-builder |

## 项目结构

```
NoteMaster/
├── src/
│   ├── main/                    # Electron主进程
│   │   ├── main.ts              # 应用入口
│   │   ├── db.ts                # SQLite数据库（better-sqlite3）
│   │   ├── dbHandlers.ts        # 数据库IPC处理器
│   │   ├── ipcHandlers.ts       # 文件/窗口/AI的IPC处理
│   │   ├── ipcUtils.ts          # IPC channel注册工具
│   │   ├── menu.ts              # 菜单配置
│   │   └── preload.ts           # 预加载脚本（IPC桥接）
│   └── renderer/                # React渲染进程
│       ├── App.tsx              # 根组件
│       ├── index.tsx            # React入口
│       ├── index.html           # HTML模板
│       ├── components/          # UI组件
│       │   ├── Editor/          # 编辑器组件
│       │   ├── Sidebar/         # 侧边栏组件
│       │   ├── Notebook/        # 笔记列表组件
│       │   ├── Tags/            # 标签管理组件
│       │   ├── Search/          # 搜索组件
│       │   ├── Graph/           # 知识图谱组件
│       │   ├── Export/          # 导出组件
│       │   ├── Settings/        # 设置组件
│       │   ├── Help/            # 帮助组件
│       │   └── ErrorBoundary.tsx
│       ├── services/            # 业务服务层（通过IPC调用main process）
│       ├── types/               # TypeScript类型定义
│       └── styles/              # 全局样式
├── package.json
├── tsconfig.json
├── webpack.main.config.js
├── webpack.preload.config.js
├── webpack.renderer.config.js
└── README.md
```

## 快速开始

### 环境要求

| 依赖 | 最低版本 | 说明 |
|------|----------|------|
| Node.js | >= 18.0.0 | 运行时环境 |
| npm | >= 9.0.0 | 包管理器 |
| Python | >= 3.6 | better-sqlite3 原生编译需要 |
| C++ 编译器 | - | 见下方安装说明 |

### 第一步：安装基础环境

#### Windows

```powershell
# 1. 安装 Node.js（如果尚未安装）
winget install OpenJS.NodeJS.LTS

# 2. 安装 Visual Studio Build Tools
# 下载地址：https://visualstudio.microsoft.com/visual-cpp-build-tools/
# 安装时勾选「使用C++的桌面开发」工作负载
# 安装完成后重启终端

# 3. 验证安装
node --version    # 应输出 v18+
python --version  # 应输出 3.6+
```

#### macOS

```bash
xcode-select --install
brew install python3
```

#### Linux (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install -y python3 build-essential
```

### 第二步：克隆并安装

```bash
# 克隆项目
git clone https://github.com/your-username/NoteMaster.git
cd NoteMaster

# 安装依赖（这一步会编译 better-sqlite3 原生模块）
npm install
```

> **如果 `npm install` 报错**：通常是 Python 或 C++ 编译工具未正确安装。请确认：
> - 终端中运行 `python --version` 或 `python3 --version` 能输出版本号
> - 终端中运行 `node --version` 能输出版本号
> - Windows 用户确认已安装 Visual Studio Build Tools

### 第三步：启动开发

```bash
npm run dev
```

此命令会同时启动 webpack 主进程编译 + 渲染进程开发服务器（端口 9000），Electron 窗口会自动打开。

### 构建与打包

```bash
# 构建生产版本
npm run build

# 打包为安装程序（Windows .exe / macOS .dmg / Linux .AppImage）
npm run dist
```

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+N` | 新建笔记 |
| `Ctrl+S` | 保存笔记 |
| `Ctrl+B` | 粗体 |
| `Ctrl+I` | 斜体 |
| `Ctrl+F` | 搜索 |
| `Ctrl+1` | 编辑模式 |
| `Ctrl+2` | 预览模式 |
| `Ctrl+3` | 分屏模式 |
| `Ctrl+G` | 知识图谱 |

## 开源协议

MIT License

##————————————————————————————————————
## Build Resources

此目录用于存放 electron-builder 打包资源。

## 必需文件

### icon.ico (Windows)
- 尺寸：256x256 像素
- 格式：ICO（包含多尺寸：16x16, 32x32, 48x48, 256x256）
- 用途：应用程序图标、安装程序图标

### icon.icns (macOS)
- 尺寸：512x512 或 1024x1024 像素
- 格式：ICNS
- 用途：macOS 应用程序图标

### icon.png (Linux)
- 尺寸：512x512 像素
- 格式：PNG
- 用途：Linux 应用程序图标

## 可选文件

### background.png (macOS DMG)
- 尺寸：540x380 像素
- 格式：PNG
- 用途：DMG 安装程序背景

### installerHeader.bmp (Windows NSIS)
- 尺寸：150x57 像素
- 格式：BMP
- 用途：NSIS 安装程序头部横幅

## 快速生成图标

推荐工具：
1. https://iconverticons.com/ - 在线转换
2. https://icoconvert.com/ - 在线 ICO 转换
3. GIMP - 开源图像编辑器

生成步骤：
1. 准备 1024x1024 PNG 源图
2. 转换为各平台格式
3. 放入此目录

