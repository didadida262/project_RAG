import os
from pathlib import Path
from typing import Any, List, Optional

from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    gguf_model_path: Optional[str] = None
    # 逗号分隔的多个 .gguf 路径，供前端下拉展示；实际推理仍由 GGUF_MODEL_PATH 加载的模型执行
    gguf_model_paths: Optional[str] = None
    n_gpu_layers: int = 0
    max_context_chars: int = 8000
    max_new_tokens: int = 512
    n_ctx: int = 4096
    rag_top_k: int = 12

    chroma_path: Path = _BACKEND_ROOT / "data" / "chroma"
    upload_dir: Path = _BACKEND_ROOT / "data" / "uploads"

    # 中文语料勿用纯英文 MiniLM，检索会对不上；默认多语言句向量（换模型后必须 ./ingest_docs.sh --clear 重导入）
    embedding_model_name: str = (
        "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
    )
    embedding_model_path: Optional[str] = None

    chunk_max_chars: int = 1200
    chunk_overlap: int = 120

    # 国内网络可设为 https://hf-mirror.com（见 .env.example）
    hf_endpoint: Optional[str] = None
    hf_hub_download_timeout: int = 300

    cors_origins: str = (
        "http://localhost:5173,http://127.0.0.1:5173,"
        "http://localhost:5174,http://127.0.0.1:5174"
    )


settings = Settings()


def list_gguf_model_entries() -> List[dict[str, Any]]:
    """path / label / active，供 /api/status 的 llm_models。"""
    paths: List[str] = []
    if settings.gguf_model_paths and str(settings.gguf_model_paths).strip():
        paths = [p.strip() for p in str(settings.gguf_model_paths).split(",") if p.strip()]
    elif settings.gguf_model_path:
        paths = [settings.gguf_model_path]

    active_resolved: Optional[str] = None
    if settings.gguf_model_path:
        try:
            active_resolved = str(Path(settings.gguf_model_path).expanduser().resolve())
        except Exception:
            active_resolved = settings.gguf_model_path

    seen: set[str] = set()
    out: List[dict[str, Any]] = []
    for p in paths:
        try:
            r = str(Path(p).expanduser().resolve())
        except Exception:
            r = p
        if r in seen:
            continue
        seen.add(r)
        label = Path(p).name
        active = active_resolved is not None and r == active_resolved
        out.append({"path": p, "label": label, "active": active})
    return out


def apply_hub_env() -> None:
    """在首次使用 Hugging Face 相关下载前调用。"""
    if settings.hf_endpoint:
        os.environ["HF_ENDPOINT"] = settings.hf_endpoint
    os.environ["HF_HUB_DOWNLOAD_TIMEOUT"] = str(settings.hf_hub_download_timeout)
