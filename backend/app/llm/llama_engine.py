from __future__ import annotations

import logging
from pathlib import Path
from typing import Dict, Iterator, List, Optional

from app.config import settings

logger = logging.getLogger(__name__)

_llm = None
_load_error: Optional[str] = None


def _load_llm():
    global _llm, _load_error
    if _llm is not None or _load_error is not None:
        return
    path = settings.gguf_model_path
    if not path:
        _load_error = "GGUF_MODEL_PATH is not set"
        return
    p = Path(path)
    if not p.is_file():
        _load_error = f"GGUF file not found: {path}"
        return
    try:
        from llama_cpp import Llama
    except Exception as e:  # pragma: no cover
        _load_error = f"llama-cpp-python import failed: {e}"
        logger.exception(_load_error)
        return
    try:
        _llm = Llama(
            model_path=str(p),
            n_ctx=settings.n_ctx,
            n_gpu_layers=settings.n_gpu_layers,
            verbose=False,
        )
    except Exception as e:
        _load_error = f"Failed to load model: {e}"
        logger.exception(_load_error)


def llm_status() -> dict:
    _load_llm()
    return {
        "ready": _llm is not None,
        "error": _load_error,
        "path_set": bool(settings.gguf_model_path),
    }


def generate_rag_reply(
    user_message: str,
    context_block: str,
    history: Optional[List[Dict[str, str]]] = None,
) -> str:
    _load_llm()
    if _llm is None:
        raise RuntimeError(_load_error or "LLM not loaded")

    system = (
        "You are a private RAG assistant. Answer using the context when it is relevant. "
        "If the context is empty or irrelevant, say you do not have that information in the corpus."
    )
    ctx = context_block.strip() or "(no retrieved context)"
    hist = history or []
    messages: List[Dict[str, str]] = [{"role": "system", "content": system}]
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
            temperature=0.2,
        )
        choice = out["choices"][0]
        msg = choice.get("message") or {}
        text = msg.get("content") or ""
        return text.strip() or "(empty model response)"
    except Exception:
        prompt = _fallback_prompt(system, ctx, hist, user_message)
        out = _llm(
            prompt,
            max_tokens=settings.max_new_tokens,
            temperature=0.2,
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

    system = (
        "You are a private RAG assistant. Answer using the context when it is relevant. "
        "If the context is empty or irrelevant, say you do not have that information in the corpus."
    )
    ctx = context_block.strip() or "(no retrieved context)"
    hist = history or []
    messages: List[Dict[str, str]] = [{"role": "system", "content": system}]
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
            temperature=0.2,
            stream=True,
        )
        for chunk in stream:
            ch = chunk["choices"][0]
            delta = ch.get("delta") or {}
            piece = delta.get("content") or ""
            if piece:
                yield piece
    except Exception:
        prompt = _fallback_prompt(system, ctx, hist, user_message)
        stream = _llm(
            prompt,
            max_tokens=settings.max_new_tokens,
            temperature=0.2,
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
