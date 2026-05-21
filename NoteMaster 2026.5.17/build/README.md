# Build Resources

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
