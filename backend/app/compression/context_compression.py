"""
Fit retrieved RAG chunks into a fixed character budget for 8GB-class GPUs.
Strategy: keep chunks in retrieval order; truncate the last chunk if needed;
optionally trim chat history from the oldest messages first.
"""

from typing import Dict, List


def compress_rag_context(chunks: List[str], max_chars: int) -> str:
    if max_chars <= 0:
        return ""
    parts: List[str] = []
    used = 0
    for chunk in chunks:
        c = chunk.strip()
        if not c:
            continue
        if used >= max_chars:
            break
        remaining = max_chars - used
        if len(c) <= remaining:
            parts.append(c)
            used += len(c) + 2
        else:
            parts.append(c[:remaining].rstrip() + "…")
            break
    return "\n\n".join(parts)


def trim_history_messages(
    messages: List[Dict[str, str]],
    max_chars: int,
) -> List[Dict[str, str]]:
    """Drop oldest turns until serialized history fits max_chars (rough limit)."""
    if not messages or max_chars <= 0:
        return []

    def ser(ms: List[Dict[str, str]]) -> str:
        return "\n".join(f"{m['role']}: {m['content']}" for m in ms)

    m = list(messages)
    while m and len(ser(m)) > max_chars:
        m.pop(0)
    return m
