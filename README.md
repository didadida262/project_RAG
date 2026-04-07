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

首次运行会从 Hugging Face 拉取 `all-MiniLM-L6-v2` 作为向量嵌入模型，需能访问外网或提前缓存。

## 前端

```bash
cd frontend
npm install
npm run dev
```

开发时 Vite 会把 `/api` 代理到 `http://127.0.0.1:8000`。若后端部署在其他地址，可设置环境变量 `VITE_API_URL`。

## 功能概要

- 导入 `.txt` / `.md` 入 Chroma，对话时检索 + **上下文长度压缩** 后送入本地 GGUF
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
