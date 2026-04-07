# 语料目录

将需要检索的 **`.txt` / `.md`** 放在本目录（可含子文件夹）。

在项目根目录执行入库（需已配置 `backend/.env` 中的 `EMBEDDING_MODEL_PATH` 等）：

```bash
./ingest_docs.sh
```

若曾导入过、想**整体重来**（清空向量库后再导入）：

```bash
./ingest_docs.sh --clear
```

然后再启动 `./run-backend.sh` 与 `./run-frontend.sh`。
