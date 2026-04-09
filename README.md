# Private RAG（Electron 桌面端）

基于 **Electron + React（Vite）**，企业 API 经本机 **Express 反代** 转发到公网，避免浏览器跨域限制。

## 目录结构

```
server/
  index.mjs       # Express：/enterprise → 公网（默认同下）
src/
  main/           # Electron 主进程
  preload/
  renderer/       # React + Vite
release/          # electron-builder 输出（gitignore）
```

## 开发（推荐）

```bash
npm install
npm run dev
```

**`npm run dev`** 会并行启动：

1. **反代服务** `http://127.0.0.1:8787`（`server/index.mjs`）→ 默认上游 `http://58.222.41.68`
2. **Vite** `http://127.0.0.1:5173`
3. **Electron**（待上述就绪后打开）

前端请求统一打到 **`127.0.0.1:8787/enterprise/...`**，由 Node 转发，无 CORS 问题。

仅浏览器调试 UI（无 Electron）时，**仍需先起反代**，否则企业接口会失败：

```bash
# 终端 1
npm run server

# 终端 2
npm run dev:web
```

## 仅构建前端

```bash
npm run build
npm run preview
```

`preview` 下同样需 **`npm run server`** 在 8787 端口运行，或配置 **`VITE_ENTERPRISE_API_URL`** 直连已开放 CORS 的地址。

## 桌面壳（本地 dist）

```bash
npm run build
npm run electron:start:proxy
```

`electron:start:proxy` = 反代 + Electron。若只用 **`electron:start`**，须**另开终端**先执行 **`npm run server`**。

## 打安装包

```bash
npm run electron:build
```

安装包内已包含 `server/index.mjs`；运行桌面应用前仍建议在安装目录旁能通过 Node 执行反代（或从源码目录 `npm run server`），与当前架构一致。

## 环境变量

| 变量 | 作用 |
|------|------|
| **`PROXY_PORT`** | 反代监听端口，默认 `8787` |
| **`PUBLIC_API_TARGET`** | 上游公网根地址，默认 `http://58.222.41.68` |
| **`VITE_API_PROXY_URL`** | 前端使用的反代根地址，默认 `http://127.0.0.1:8787`（写入构建） |
| **`VITE_ENTERPRISE_API_URL`** | 若设置，前端**直连**该地址（不经过反代）；仅当上游已配置 CORS 时使用 |

## 脚本摘要

| 命令 | 说明 |
|------|------|
| `npm run server` | 仅启动 Express 反代（8787） |
| `npm run dev` | 反代 + Vite + Electron |
| `npm run dev:web` | 仅 Vite（需自行先 `npm run server`） |
| `npm run build` | 类型检查 + 构建渲染进程 |
| `npm run electron:start` | 仅 Electron（需已 build 且反代已开） |
| `npm run electron:start:proxy` | 反代 + Electron |
| `npm run electron:build` | 构建 + electron-builder |
| `npm run lint` | ESLint |
