# 语料目录

将需要检索的 **`.txt` / `.md`** 放在本目录（可含子文件夹）。

在 `backend/.env` 中配置好 `EMBEDDING_MODEL_PATH` 等后，在项目根目录执行入库：

**Windows：**

```bat
ingest_docs.bat
```

**macOS / Linux：**

```bash
./ingest_docs.sh
```

若曾导入过、想**整体重来**（清空向量库后再导入）：`ingest_docs.bat --clear` 或 `./ingest_docs.sh --clear`。

然后再启动后端与前端（Windows：`run-backend.bat`、`run-frontend.bat`；其他：`./run-backend.sh`、`./run-frontend.sh`）。
