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

    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"


settings = Settings()
