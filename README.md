# Private RAG（本地私人问答）

前后端分离：React + FastAPI + ChromaDB + Sentence-Transformers 检索；生成端通过 `llama-cpp-python` 加载本地 GGUF（如 Gemma）。

## 前置

- Node 20+、Python 3.9+（建议 3.10+）
- 可选：本机已下载的 `.gguf` 模型文件

## 后端

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# 编辑 .env：设置 GGUF_MODEL_PATH=/path/to/model.gguf，按需调整 N_GPU_LAYERS 等
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

推理依赖（与 PyTorch 等分开装，便于排查编译问题）：

```bash
pip install -r requirements-llm.txt
```

首次运行会从 Hugging Face 拉取嵌入模型（默认 `sentence-transformers/all-MiniLM-L6-v2`），需能访问外网或提前缓存。

### 提前下载嵌入模型（推荐，可避免运行时联网）

在一台**能访问 Hugging Face（或已配置镜像）**的机器上执行其一，把模型落到固定目录（示例：`~/models/all-MiniLM-L6-v2`）：

```bash
pip install -U "huggingface_hub[cli]"
huggingface-cli download sentence-transformers/all-MiniLM-L6-v2 \
  --local-dir ~/models/all-MiniLM-L6-v2
```

或在已激活的 `backend` 虚拟环境里用 Python：

```bash
python -c "from huggingface_hub import snapshot_download; snapshot_download('sentence-transformers/all-MiniLM-L6-v2', local_dir='/绝对路径/all-MiniLM-L6-v2')"
```

然后在 `backend/.env` 中设置（路径改成你本机绝对路径）：

```env
EMBEDDING_MODEL_PATH=/Users/你的用户名/models/all-MiniLM-L6-v2
```

可注释或删除 `HF_ENDPOINT`；重启 `./run-backend.sh` 后，嵌入模型只从该目录加载，**不再依赖访问 huggingface.co**。

**注意**：若用 `git clone` 拉模型仓库，必须安装 [Git LFS](https://git-lfs.com) 并在模型目录执行 `git lfs pull`，否则 `model.safetensors` 等可能只是指针，运行时会报 `deserializing header` 类错误。更省事的方式是用上文 `huggingface-cli download` 一次性下全文件。

### 常见问题

- **前端 `ETIMEDOUT` / `502`、或终端里 `connect 127.0.0.1:8000` 失败**：先单独启动后端 `./run-backend.sh`，等终端里不再卡在下载后再开前端。后端未监听 8000 时，Vite 代理会超时。
- **`huggingface.co` 连接超时**：在 `backend/.env` 中设置 `HF_ENDPOINT=https://hf-mirror.com`（或自行准备离线模型目录并设置 `EMBEDDING_MODEL_PATH`，见 `backend/.env.example`），保存后重启后端。
- **Vite 占用 5173 改用 5174**：无需改配置，后端 CORS 已包含 5174。

## 前端

```bash
cd frontend
npm install
npm run dev
```

开发时 Vite 会把 `/api` 代理到 `http://127.0.0.1:8000`。若后端部署在其他地址，可设置环境变量 `VITE_API_URL`。

## 语料入库（推荐流程）

1. 把 `.txt` / `.md` 放进仓库根目录的 **`docs/`**（可含子目录）。
2. 在**启动前后端之前**（或更新语料后、重启后端前）在项目根目录执行：

```bash
./ingest_docs.sh
```

首次全量重建向量库（清空旧 Chroma 再导入）：

```bash
./ingest_docs.sh --clear
```

3. 再运行 `./run-backend.sh` 与 `./run-frontend.sh`。  
   前端不再提供网页上传语料；批量入库在本地跑脚本，避免 HTTP 上传大文件超时。

## 功能概要

- 通过 `ingest_docs.sh` 将 `docs/` 下 `.txt` / `.md` 写入 Chroma；对话时检索 + **上下文压缩** 后送入本地 GGUF
- 流式输出（SSE）与明暗主题、Font Awesome 图标

## API 摘要

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET | `/api/status` | 语料块数量与 LLM 是否就绪 |
| POST | `/api/ingest/text` | JSON `{ "text", "source_name?" }` |
| POST | `/api/ingest/file` | `multipart/form-data` 字段 `file` |
| POST | `/api/chat` | JSON 非流式 |
| POST | `/api/chat/stream` | SSE 流式 |
