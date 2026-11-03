# 栖景 Quiet

给桌面一点留白。Windows 和 macOS 都能用的壁纸应用：精选推荐、山野、海岸、极简直接来自 Unsplash，也可以导入自己的图片。

作者：[月白白](https://www.ilovedsy.com)

## 下载安装

- [下载 Windows 安装包](https://github.com/DreamCarCF/quiet-wall/releases/latest/download/Quiet-Wall-Windows-Setup.exe)
- [下载 macOS 安装包](https://github.com/DreamCarCF/quiet-wall/releases/latest/download/Quiet-Wall-Mac.dmg)

Windows 10 / 11 64 位：运行安装包，按提示安装。安装包未做代码签名，SmartScreen 若提示未知发布者，选择仍要运行。

macOS：打开镜像，把「栖景 Quiet」拖进「应用程序」。首次打开若被拦截，到「系统设置 → 隐私与安全性」里允许打开。设置壁纸时，系统可能会询问是否允许控制「系统事件」，需要允许。这份安装包同时包含 Apple 芯片和 Intel。

关闭窗口后程序留在系统托盘里，自动切换会继续。从托盘选择「退出」后停止。

## 使用

1. 在「发现壁纸」里切换精选推荐、山野、海岸、极简，或直接搜索。图片来自 Unsplash，点作者姓名可打开摄影师主页。
2. 预览后可以设为桌面壁纸、收藏或下载。
3. 侧边栏或「偏好设置」里可以选择 30 分钟、1 小时、4 小时、1 天自动切换。切换按当前这一组风景依次进行，从本次打开应用开始计时。
4. 「导入图片」支持 JPG、PNG、WebP，单张不超过 60 MB。
5. 偏好设置里可以打开作者月白白的个人主页。

内置 6 张插画标记为「内置原创插画」，不是 Unsplash 照片。

## 开发

需要 Node.js 22 或更高版本。

```powershell
npm ci
npm test
npm start
npm run dist:win
```

`npm run dist:mac` 需要在 macOS 上执行。推送 `v*` 标签后，GitHub Actions 会同时构建 Windows 安装包和 macOS 通用镜像，并挂到对应 Release。

在国内安装 Electron 时，可以在项目里放一个不会提交的 `.npmrc`：

```
electron_mirror=https://cdn.npmmirror.com/binaries/electron/
```

## 数据与安全

- 收藏、历史和导入的图片保存在本机，Windows 上通常是 `%APPDATA%\栖景 Quiet\`。
- 页面启用了 contextIsolation 和 sandbox。外链只允许 Unsplash 官网和作者主页 `https://www.ilovedsy.com`。
- Windows 通过固定的 PowerShell 脚本设置壁纸，图片路径放在环境变量里。macOS 把图片路径作为参数交给 `osascript`，不把用户输入拼进命令。
- 应用不设置开机启动，也不上传本地照片。

本项目源码与内置插画按 MIT 许可提供。Unsplash 照片须遵守其许可和条款。
