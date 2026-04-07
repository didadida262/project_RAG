import uuid
from typing import List, Optional, Tuple

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


def chunk_text(text: str, max_chunk: int = 800, overlap: int = 100) -> List[str]:
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


def query_similar(query: str, top_k: int) -> List[Tuple[str, float]]:
    col = get_collection()
    n = max(1, min(top_k, 20))
    res = col.query(query_texts=[query], n_results=n)
    docs = (res.get("documents") or [[]])[0]
    dists = (res.get("distances") or [[]])[0]
    out: List[Tuple[str, float]] = []
    for i, doc in enumerate(docs):
        d = dists[i] if i < len(dists) else 0.0
        out.append((doc, float(d)))
    return out


def collection_count() -> int:
    col = get_collection()
    return col.count()
