from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Annotated, List, Literal, Optional

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.compression.context_compression import (
    compress_rag_context,
    trim_history_messages,
)
from app.config import list_gguf_model_entries, settings
from app.llm import llama_engine
from app.rag import chroma_store

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Private RAG API", version="0.1.0")

_origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=8000)
    history: List[ChatMessage] = Field(default_factory=list)
    stream: bool = False
    # 与当前后端 GGUF_MODEL_PATH 一致时才接受；省略则不校验
    model_path: Optional[str] = Field(default=None, max_length=8192)


class ChatResponse(BaseModel):
    reply: str
    warnings: List[str] = Field(default_factory=list)
    retrieved_chunks: int = 0
    context_chars: int = 0


class IngestTextBody(BaseModel):
    text: str = Field(..., min_length=1)
    source_name: Optional[str] = None


@app.on_event("startup")
def startup():
    settings.chroma_path.mkdir(parents=True, exist_ok=True)
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    llama_engine.start_background_preload()


@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/api/status")
def status():
    st = llama_engine.llm_status()
    try:
        n = chroma_store.collection_count()
        emb_err: Optional[str] = None
    except Exception as e:
        logger.exception("chroma unavailable")
        n = 0
        emb_err = (
            f"向量库/嵌入模型未就绪: {e}。"
            "若访问 Hugging Face 超时，请在 backend/.env 设置 HF_ENDPOINT=https://hf-mirror.com "
            "或配置 EMBEDDING_MODEL_PATH 指向本机已下载的 all-MiniLM-L6-v2 目录。"
        )
    out: dict = {
        "chroma_documents": n,
        "llm": st,
    }
    if emb_err:
        out["embedding_error"] = emb_err
    out["embedding_active"] = (
        settings.embedding_model_path or settings.embedding_model_name
    )
    out["llm_models"] = list_gguf_model_entries()
    return out


@app.get("/api/debug/retrieve")
def debug_retrieve(
    q: str = Query(..., min_length=1, description="测试检索的问句"),
    top_k: int = Query(8, ge=1, le=20),
):
    """本地调试用：看该问句实际命中的片段预览与距离（不调用大模型）。"""
    try:
        hits = chroma_store.debug_retrieve(q.strip(), top_k)
    except Exception as e:
        logger.exception("debug_retrieve")
        raise HTTPException(status_code=500, detail=str(e)) from e
    return {"query": q, "top_k": top_k, "hits": hits}


@app.post("/api/ingest/text")
def ingest_text(body: IngestTextBody):
    n = chroma_store.ingest_text(body.text, body.source_name)
    return {"chunks_added": n, "total": chroma_store.collection_count()}


@app.post("/api/ingest/file")
async def ingest_file(
    file: Annotated[UploadFile, File(...)],
):
    raw = await file.read()
    name = file.filename or "upload"
    suffix = name.lower().rsplit(".", 1)[-1] if "." in name else ""
    if suffix not in ("txt", "md", "markdown"):
        raise HTTPException(
            status_code=400,
            detail="Only .txt and .md files are supported in this version.",
        )
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        text = raw.decode("utf-8", errors="replace")
    n = chroma_store.ingest_text(text, source_name=name)
    return {"chunks_added": n, "total": chroma_store.collection_count(), "filename": name}


def _validate_chat_model_path(model_path: Optional[str]) -> None:
    if not model_path or not str(model_path).strip():
        return
    cur = settings.gguf_model_path
    if not cur:
        raise HTTPException(
            status_code=400,
            detail="后端未配置 GGUF_MODEL_PATH，无法使用 model_path 参数。",
        )
    try:
        want = Path(model_path).expanduser().resolve()
        have = Path(cur).expanduser().resolve()
    except Exception:
        raise HTTPException(status_code=400, detail="无效的 model_path") from None
    if want != have:
        raise HTTPException(
            status_code=400,
            detail="所选模型与当前后端已加载的不一致；请修改 backend/.env 的 GGUF_MODEL_PATH 为该文件并重启服务。",
        )


def _build_chat_payload(req: ChatRequest):
    hits = chroma_store.query_similar(req.message, settings.rag_top_k)
    raw_chunks = [h[0] for h in hits]
    warnings: List[str] = []
    if not raw_chunks:
        warnings.append(
            "未从语料库检索到相关片段；模型将主要依据自身知识作答（仍会附带空上下文供参考）。"
        )

    # Reserve part of budget for prompt framing; compress retrieved text
    context_text = compress_rag_context(raw_chunks, settings.max_context_chars)

    hist_dicts = [m.model_dump() for m in req.history]
    hist_budget = min(2500, max(500, settings.max_context_chars // 3))
    trimmed_hist = trim_history_messages(hist_dicts, hist_budget)

    return context_text, warnings, len(raw_chunks), len(context_text), trimmed_hist


@app.post("/api/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    _validate_chat_model_path(req.model_path)
    context_text, warnings, n_chunks, ctx_len, trimmed_hist = _build_chat_payload(req)
    st = llama_engine.llm_status()
    if not st["ready"]:
        msg = st.get("error") or "LLM not loaded"
        raise HTTPException(
            status_code=503,
            detail={
                "message": msg,
                "hint": "Set GGUF_MODEL_PATH in backend/.env to your .gguf file and restart.",
            },
        )
    try:
        reply = llama_engine.generate_rag_reply(
            req.message,
            context_text,
            history=trimmed_hist,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except Exception as e:
        logger.exception("chat failed")
        raise HTTPException(status_code=500, detail=str(e)) from e

    return ChatResponse(
        reply=reply,
        warnings=warnings,
        retrieved_chunks=n_chunks,
        context_chars=ctx_len,
    )


@app.post("/api/chat/stream")
def chat_stream(req: ChatRequest):
    try:
        _validate_chat_model_path(req.model_path)
    except HTTPException as e:

        def err_iter_validation():
            payload = json.dumps(
                {"type": "error", "detail": str(e.detail)},
                ensure_ascii=False,
            )
            yield f"data: {payload}\n\n"

        return StreamingResponse(err_iter_validation(), media_type="text/event-stream")

    context_text, warnings, n_chunks, ctx_len, trimmed_hist = _build_chat_payload(req)
    st = llama_engine.llm_status()
    if not st["ready"]:

        def err_iter():
            payload = json.dumps(
                {
                    "type": "error",
                    "detail": st.get("error") or "LLM not loaded",
                    "warnings": warnings,
                },
                ensure_ascii=False,
            )
            yield f"data: {payload}\n\n"

        return StreamingResponse(err_iter(), media_type="text/event-stream")

    meta = json.dumps(
        {
            "type": "meta",
            "warnings": warnings,
            "retrieved_chunks": n_chunks,
            "context_chars": ctx_len,
        },
        ensure_ascii=False,
    )

    def event_iter():
        yield f"data: {meta}\n\n"
        try:
            for piece in llama_engine.stream_rag_reply(
                req.message,
                context_text,
                history=trimmed_hist,
            ):
                chunk = json.dumps({"type": "token", "text": piece}, ensure_ascii=False)
                yield f"data: {chunk}\n\n"
            yield f"data: {json.dumps({'type': 'done'}, ensure_ascii=False)}\n\n"
        except Exception as e:
            logger.exception("stream failed")
            err = json.dumps({"type": "error", "detail": str(e)}, ensure_ascii=False)
            yield f"data: {err}\n\n"

    return StreamingResponse(event_iter(), media_type="text/event-stream")
