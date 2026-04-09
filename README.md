# Private RAG（Electron 桌面端）

基于 **Electron + React（Vite）** 的桌面壳；界面与原先前端一致。本仓库**不再包含** Python / FastAPI 后端，需自行部署 API 或对接其他服务。

## 目录结构（常见 Electron + Vite 布局）

```
src/
  main/           # Electron 主进程
  preload/        # 预加载（向渲染进程暴露安全 API）
  renderer/       # React 界面（Vite 工程：index.html、src、public）
release/          # electron-builder 输出（gitignore）
```

## 开发

```bash
npm install
npm run dev
```

默认 **`npm run dev`**（或 **`yarn dev`**）会同时启动 Vite 并打开 **Electron 桌面窗口**（与 `npm run electron:dev` 相同）。若只想用浏览器调试界面、不要桌面壳，请用 **`npm run dev:web`**，再打开 `http://127.0.0.1:5173`。

- 开发服务器固定 **`127.0.0.1:5173`**（`strictPort`），与 `wait-on`、Electron 一致。若提示端口占用，请先结束之前的 Vite/Electron，例如：  
  `lsof -i :5173` 查看进程，`kill <PID>`（或关掉仍占用该端口的终端）。
- `/api` 会代理到 `http://127.0.0.1:8000`（见 `src/renderer/vite.config.ts`），便于本地另有后端时使用。

## 仅构建界面

```bash
npm run build
npm run preview
```

## 桌面壳（使用已构建的 `src/renderer/dist`）

```bash
npm run build
npm run electron:start
```

## 打安装包

```bash
npm run electron:build
```

## 配置 API 基地址

| 场景 | 方式 |
|------|------|
| 浏览器 / `npm run dev:web` | 环境变量 `VITE_API_URL`（空则走 Vite 代理 `/api`） |
| Electron | 环境变量 `PRIVATE_RAG_API_URL`（默认 `http://127.0.0.1:8000`），由主进程传给预加载脚本 |

## 脚本摘要

| 命令 | 说明 |
|------|------|
| `npm run dev` | Vite + Electron（默认桌面开发） |
| `npm run dev:web` | 仅 Vite（浏览器打开 5173） |
| `npm run build` | 类型检查 + 构建渲染进程 |
| `npm run electron:dev` | 同 `npm run dev` |
| `npm run electron:start` | 仅 Electron（需先 `build`） |
| `npm run electron:build` | 构建界面 + electron-builder |
| `npm run lint` | ESLint（`src/renderer`） |
