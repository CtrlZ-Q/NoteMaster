# 安装指南

## 系统要求

### 开发环境

| 依赖 | 版本要求 |
|------|----------|
| Node.js | >= 18.0.0 |
| npm | >= 9.0.0 |
| Git | 任意版本 |

### 支持平台

- Windows 10/11（64位）
- macOS 10.15+
- Ubuntu 20.04+ / Debian 10+

## 安装步骤

### 1. 克隆项目

```bash
git clone https://github.com/your-username/NoteMaster.git
cd NoteMaster
```

### 2. 安装依赖

```bash
npm install
```

> 注意：如果安装 `better-sqlite3` 时遇到编译错误，请确保已安装以下工具：
>
> **Windows:**
> 下载安装 [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)，安装时勾选「使用C++的桌面开发」。
>
> **macOS:**
> ```bash
> xcode-select --install
> ```
>
> **Linux (Ubuntu/Debian):**
> ```bash
> sudo apt-get install build-essential python3
> ```

### 3. 启动开发服务器

```bash
npm run dev
```

此命令会同时启动：
- Webpack dev server（渲染进程）
- Electron 主进程（监听文件变化自动重启）

### 4. 构建生产版本

```bash
npm run build
```

构建产物位于 `dist/` 目录。

### 5. 打包为可执行文件

```bash
npm run dist
```

打包产物位于 `release/` 目录：
- Windows: `release/NoteMaster Setup.exe`
- macOS: `release/NoteMaster.dmg`
- Linux: `release/NoteMaster.AppImage`

## 常见问题

### Q: npm install 报错 `node-gyp` 相关错误

A: 确保已安装 C++ 编译工具链：
- Windows: 安装 Visual Studio Build Tools
- macOS: 运行 `xcode-select --install`
- Linux: 安装 `build-essential`

### Q: 启动后白屏

A: 检查控制台输出，通常是 webpack 编译错误。运行以下命令检查：

```bash
npm run build:renderer
```

### Q: 数据存储在哪里？

A: 数据库文件位于用户数据目录：
- Windows: `%APPDATA%/NoteMaster/data/notemaster.db`
- macOS: `~/Library/Application Support/NoteMaster/data/notemaster.db`
- Linux: `~/.config/NoteMaster/data/notemaster.db`

## 开发工具推荐

- VS Code + ESLint 扩展 + Prettier 扩展
- React Developer Tools（Chrome 扩展）
- Redux DevTools（如需要）
