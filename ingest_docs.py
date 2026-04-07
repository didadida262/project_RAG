#!/usr/bin/env python3
"""
将项目根目录下 docs/ 中所有 .txt / .md 写入 Chroma（与后端共用同一向量库）。

用法（在仓库根目录）:
  backend/.venv/bin/python ingest_docs.py
  ./ingest_docs.sh

可选:
  --clear  先清空本地向量库再导入（避免重复叠加旧语料）
"""
from __future__ import annotations

import argparse
import os
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKEND = ROOT / "backend"
DOCS = ROOT / "docs"


def main() -> int:
    parser = argparse.ArgumentParser(description="Ingest docs/ into Chroma")
    parser.add_argument(
        "--clear",
        action="store_true",
        help="删除现有 Chroma 数据后再导入",
    )
    args = parser.parse_args()

    if not DOCS.is_dir():
        print(f"错误: 请创建目录 {DOCS}，并放入 .txt / .md 文件", file=sys.stderr)
        return 1

    os.chdir(BACKEND)
    sys.path.insert(0, str(BACKEND))

    from app.config import settings
    from app.rag import chroma_store

    if args.clear:
        if settings.chroma_path.exists():
            shutil.rmtree(settings.chroma_path)
        settings.chroma_path.mkdir(parents=True, exist_ok=True)
        print("已清空向量库目录:", settings.chroma_path)

    allowed = {".txt", ".md", ".markdown"}
    files = sorted(
        p
        for p in DOCS.rglob("*")
        if p.is_file() and p.suffix.lower() in allowed
    )
    if not files:
        print(f"{DOCS} 下未找到 .txt / .md 文件")
        return 0

    total_chunks = 0
    for path in files:
        rel = path.relative_to(DOCS)
        try:
            text = path.read_text(encoding="utf-8", errors="replace")
        except OSError as e:
            print(f"跳过 {rel}: {e}", file=sys.stderr)
            continue
        if not text.strip():
            print(f"跳过（空文件） {rel}")
            continue
        n = chroma_store.ingest_text(text, source_name=str(rel))
        total_chunks += n
        print(f"+ {rel}  →  {n} 块")

    print(f"本次写入块数: {total_chunks}，库中合计: {chroma_store.collection_count()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
