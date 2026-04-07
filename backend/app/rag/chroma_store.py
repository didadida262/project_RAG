import re
import uuid
from typing import Dict, List, Optional, Tuple

import chromadb
from chromadb.utils import embedding_functions

from app.config import apply_hub_env, settings

_COLLECTION = "private_corpus"


def _embedding_fn():
    apply_hub_env()
    # 本地目录优先（需含 config.json 等完整 sentence-transformers 快照）
    model = (
        settings.embedding_model_path.strip()
        if settings.embedding_model_path
        else settings.embedding_model_name
    )
    return embedding_functions.SentenceTransformerEmbeddingFunction(
        model_name=model,
    )


def get_client() -> chromadb.PersistentClient:
    settings.chroma_path.mkdir(parents=True, exist_ok=True)
    return chromadb.PersistentClient(path=str(settings.chroma_path))


def get_collection():
    client = get_client()
    return client.get_or_create_collection(
        name=_COLLECTION,
        embedding_function=_embedding_fn(),
        metadata={"hnsw:space": "cosine"},
    )


def chunk_text(
    text: str,
    max_chunk: Optional[int] = None,
    overlap: Optional[int] = None,
) -> List[str]:
    max_chunk = max_chunk if max_chunk is not None else settings.chunk_max_chars
    overlap = overlap if overlap is not None else settings.chunk_overlap
    text = text.strip()
    if not text:
        return []
    if len(text) <= max_chunk:
        return [text]
    chunks: List[str] = []
    start = 0
    while start < len(text):
        end = min(start + max_chunk, len(text))
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= len(text):
            break
        nxt = end - overlap
        start = nxt if nxt > start else end
    return chunks


def ingest_text(
    text: str,
    source_name: Optional[str] = None,
) -> int:
    col = get_collection()
    chunks = chunk_text(text)
    if not chunks:
        return 0
    ids = [str(uuid.uuid4()) for _ in chunks]
    metadatas = [
        {"source": source_name or "paste", "chunk_index": i} for i in range(len(chunks))
    ]
    col.add(ids=ids, documents=chunks, metadatas=metadatas)
    return len(chunks)


def _chinese_keyword_terms(query: str, max_terms: int = 18) -> List[str]:
    """从问句抽 2～4 字子串（覆盖「什么是闭包」→「闭包」等），用于 $contains 补充检索。"""
    s = "".join(re.findall(r"[\u4e00-\u9fff]+", query))
    if len(s) < 2:
        return []
    grams: List[str] = []
    # 先 2 字再 3、4 字，让「闭包」等短词优先参与 $contains（避免只查长串漏命中）
    for L in (2, 3, 4):
        if len(s) < L:
            continue
        for i in range(len(s) - L + 1):
            grams.append(s[i : i + L])
    out: List[str] = []
    seen = set()
    for t in grams:
        if t in seen:
            continue
        seen.add(t)
        out.append(t)
        if len(out) >= max_terms:
            break
    return out


def query_similar(query: str, top_k: int) -> List[Tuple[str, float]]:
    """
    语义检索 +（可选）中文关键词子串检索，合并去重后按距离排序。
    缓解「英文向量模型 + 中文语料」语义对不上的问题。
    """
    col = get_collection()
    n = max(1, min(top_k, 25))
    res = col.query(query_texts=[query], n_results=n)
    docs = (res.get("documents") or [[]])[0]
    dists = (res.get("distances") or [[]])[0]
    best: Dict[str, float] = {}
    for i, doc in enumerate(docs):
        d = float(dists[i]) if i < len(dists) else 1.0
        if doc not in best or d < best[doc]:
            best[doc] = d

    for term in _chinese_keyword_terms(query)[:8]:
        try:
            kw = col.query(
                query_texts=[query],
                n_results=min(12, max(n, 8)),
                where_document={"$contains": term},
            )
        except Exception:
            continue
        kdocs = (kw.get("documents") or [[]])[0]
        kdists = (kw.get("distances") or [[]])[0]
        for i, doc in enumerate(kdocs):
            d = float(kdists[i]) if i < len(kdists) else 1.0
            boosted = d * 0.92
            if doc not in best or boosted < best[doc]:
                best[doc] = boosted

    ranked = sorted(best.items(), key=lambda x: x[1])[:top_k]
    return ranked


def debug_retrieve(query: str, top_k: int = 8) -> List[dict]:
    """返回检索调试信息（文本预览、距离、来源）。"""
    col = get_collection()
    n = max(1, min(top_k, 15))
    res = col.query(
        query_texts=[query],
        n_results=n,
        include=["documents", "distances", "metadatas"],
    )
    docs = (res.get("documents") or [[]])[0]
    dists = (res.get("distances") or [[]])[0]
    metas = (res.get("metadatas") or [[]])[0]
    rows: List[dict] = []
    for i, doc in enumerate(docs):
        meta = metas[i] if i < len(metas) else {}
        src = (meta or {}).get("source", "")
        preview = (doc or "")[:280].replace("\n", " ")
        rows.append(
            {
                "distance": float(dists[i]) if i < len(dists) else None,
                "source": src,
                "preview": preview + ("…" if doc and len(doc) > 280 else ""),
            }
        )
    return rows


def collection_count() -> int:
    col = get_collection()
    return col.count()
