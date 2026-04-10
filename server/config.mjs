/**
 * 本地反代与文档分析服务共享配置（环境变量）。
 */
export const PROXY_PORT = Number(process.env.PROXY_PORT || 8787)

export const PUBLIC_API_TARGET = (
  process.env.PUBLIC_API_TARGET || 'http://58.222.41.68'
).replace(/\/$/, '')

export const SITE_ORIGIN = (
  process.env.PUBLIC_ENTERPRISE_SITE_ORIGIN || PUBLIC_API_TARGET
).replace(/\/$/, '')

/** 单文件上传上限（字节） */
export const DOCUMENT_UPLOAD_MAX_BYTES = Number(
  process.env.DOCUMENT_UPLOAD_MAX_BYTES || 15 * 1024 * 1024,
)

/**
 * 送入模型的正文上限（字符）。超长则截断并附加说明，避免撑爆上下文或费用失控。
 */
export const DOCUMENT_EXTRACT_MAX_CHARS = Number(
  process.env.DOCUMENT_EXTRACT_MAX_CHARS || 120_000,
)

export const ENTERPRISE_CHAT_PATH = '/enterprise/api/v1/chat/completions'
