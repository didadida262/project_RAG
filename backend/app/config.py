import os
from pathlib import Path
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    gguf_model_path: Optional[str] = None
    n_gpu_layers: int = 0
    max_context_chars: int = 6000
    max_new_tokens: int = 512
    n_ctx: int = 4096
    rag_top_k: int = 5

    chroma_path: Path = _BACKEND_ROOT / "data" / "chroma"
    upload_dir: Path = _BACKEND_ROOT / "data" / "uploads"

    # 嵌入模型：默认从 Hub 拉 all-MiniLM-L6-v2；无法访问 HF 时设 EMBEDDING_MODEL_PATH 指向本机已下载的模型目录
    embedding_model_name: str = "sentence-transformers/all-MiniLM-L6-v2"
    embedding_model_path: Optional[str] = None

    # 国内网络可设为 https://hf-mirror.com（见 .env.example）
    hf_endpoint: Optional[str] = None
    hf_hub_download_timeout: int = 300

    cors_origins: str = (
        "http://localhost:5173,http://127.0.0.1:5173,"
        "http://localhost:5174,http://127.0.0.1:5174"
    )


settings = Settings()


def apply_hub_env() -> None:
    """在首次使用 Hugging Face 相关下载前调用。"""
    if settings.hf_endpoint:
        os.environ["HF_ENDPOINT"] = settings.hf_endpoint
    os.environ["HF_HUB_DOWNLOAD_TIMEOUT"] = str(settings.hf_hub_download_timeout)
