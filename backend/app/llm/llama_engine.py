from __future__ import annotations

import logging
import threading
from pathlib import Path
from typing import Dict, Iterator, List, Optional, Tuple

from app.config import settings

logger = logging.getLogger(__name__)

# 语料有用则引用；没有或不相关时允许用模型自身知识回答，不必再说「语料里没有」。
SYSTEM_PROMPT_RAG = (
    "你是本地助手，带有用户提供的「上下文」片段（可能来自其私有文档）。"
    "若上下文与问题相关，请优先结合上下文作答，可转述或概括。"
    "若上下文为空、无关或不足以回答，请直接运用你的常识与推理完整回答问题，无需拒绝或强调「语料库未包含」；"
    "若你同时用了上下文和常识，可简要说明哪些来自文档（可选）。"
    "回答使用与用户问题相同的语言（如中文问则用中文答）。"
)

_llm = None
_load_error: Optional[str] = None
_cv = threading.Condition()
_loading = False


def _try_build_llama() -> Tuple[Optional[object], Optional[str]]:
    """返回 (Llama 实例, 错误信息)。只做一次构建，不碰全局锁里的状态。"""
    path = settings.gguf_model_path
    if not path:
        return None, "GGUF_MODEL_PATH is not set"
    p = Path(path)
    if not p.is_file():
        return None, f"GGUF file not found: {path}"
    try:
        from llama_cpp import Llama
    except Exception as e:  # pragma: no cover
        return None, f"llama-cpp-python import failed: {e}"
    try:
        llm = Llama(
            model_path=str(p),
            n_ctx=settings.n_ctx,
            n_gpu_layers=settings.n_gpu_layers,
            verbose=False,
        )
        return llm, None
    except Exception as e:
        logger.exception("Llama load failed")
        return None, f"Failed to load model: {e}"


def _load_llm() -> None:
    """单飞加载：多线程同时调用时只有一个会真正加载，其余在 Condition 上等待。"""
    global _llm, _load_error, _loading
    with _cv:
        if _llm is not None or _load_error is not None:
            return
        while _loading:
            _cv.wait(timeout=2.0)
        if _llm is not None or _load_error is not None:
            return
        _loading = True

    built, err = None, None
    try:
        built, err = _try_build_llama()
    finally:
        with _cv:
            _loading = False
            if built is not None:
                _llm = built
            elif err is not None:
                _load_error = err
            else:
                _load_error = "Unknown load failure"
            _cv.notify_all()


def start_background_preload() -> None:
    """启动时调用：在后台线程加载 GGUF，不阻塞 HTTP。"""

    def run() -> None:
        logger.info("GGUF background preload started")
        _load_llm()
        if _llm is not None:
            logger.info("GGUF loaded successfully")
        else:
            logger.warning("GGUF preload finished without model: %s", _load_error)

    t = threading.Thread(target=run, daemon=True, name="gguf-preload")
    t.start()


def llm_status() -> dict:
    """轻量状态，不触发加载（避免 /api/status 卡死）。"""
    with _cv:
        loading = _loading
        ready = _llm is not None
        err = _load_error
    path_set = bool(settings.gguf_model_path)
    return {
        "ready": ready,
        "error": err,
        "path_set": path_set,
        "loading": bool(loading and not ready and err is None and path_set),
    }


def generate_rag_reply(
    user_message: str,
    context_block: str,
    history: Optional[List[Dict[str, str]]] = None,
) -> str:
    _load_llm()
    if _llm is None:
        raise RuntimeError(_load_error or "LLM not loaded")

    ctx = context_block.strip() or "(未检索到相关文档片段)"
    hist = history or []
    messages: List[Dict[str, str]] = [{"role": "system", "content": SYSTEM_PROMPT_RAG}]
    for m in hist:
        role = m.get("role", "user")
        content = m.get("content", "")
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})
    messages.append(
        {
            "role": "user",
            "content": f"Context:\n{ctx}\n\nQuestion:\n{user_message}",
        }
    )

    try:
        out = _llm.create_chat_completion(
            messages=messages,
            max_tokens=settings.max_new_tokens,
            temperature=0.35,
        )
        choice = out["choices"][0]
        msg = choice.get("message") or {}
        text = msg.get("content") or ""
        return text.strip() or "(empty model response)"
    except Exception:
        prompt = _fallback_prompt(SYSTEM_PROMPT_RAG, ctx, hist, user_message)
        out = _llm(
            prompt,
            max_tokens=settings.max_new_tokens,
            temperature=0.35,
            stop=["<end>", "</s>"],
        )
        return (out.get("choices") or [{}])[0].get("text", "").strip() or "(empty model response)"


def stream_rag_reply(
    user_message: str,
    context_block: str,
    history: Optional[List[Dict[str, str]]] = None,
) -> Iterator[str]:
    _load_llm()
    if _llm is None:
        raise RuntimeError(_load_error or "LLM not loaded")

    ctx = context_block.strip() or "(未检索到相关文档片段)"
    hist = history or []
    messages: List[Dict[str, str]] = [{"role": "system", "content": SYSTEM_PROMPT_RAG}]
    for m in hist:
        role = m.get("role", "user")
        content = m.get("content", "")
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})
    messages.append(
        {
            "role": "user",
            "content": f"Context:\n{ctx}\n\nQuestion:\n{user_message}",
        }
    )

    try:
        stream = _llm.create_chat_completion(
            messages=messages,
            max_tokens=settings.max_new_tokens,
            temperature=0.35,
            stream=True,
        )
        for chunk in stream:
            ch = chunk["choices"][0]
            delta = ch.get("delta") or {}
            piece = delta.get("content") or ""
            if piece:
                yield piece
    except Exception:
        prompt = _fallback_prompt(SYSTEM_PROMPT_RAG, ctx, hist, user_message)
        stream = _llm(
            prompt,
            max_tokens=settings.max_new_tokens,
            temperature=0.35,
            stream=True,
            stop=["<end>", "</s>"],
        )
        for chunk in stream:
            piece = (chunk.get("choices") or [{}])[0].get("text") or ""
            if piece:
                yield piece


def _fallback_prompt(
    system: str,
    ctx: str,
    hist: List[Dict[str, str]],
    user_message: str,
) -> str:
    lines = [f"System: {system}", "", f"Context:\n{ctx}", ""]
    for m in hist:
        role = m.get("role", "user").capitalize()
        lines.append(f"{role}: {m.get('content', '')}")
    lines.append(f"User: {user_message}")
    lines.append("Assistant:")
    return "\n".join(lines)
