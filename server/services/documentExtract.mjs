import mammoth from 'mammoth'
import { PDFParse } from 'pdf-parse'
import { DOCUMENT_EXTRACT_MAX_CHARS } from '../config.mjs'

const PDF_MAGIC = Buffer.from('%PDF', 'utf8')

export class DocumentExtractError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   */
  constructor(code, message) {
    super(message)
    this.name = 'DocumentExtractError'
    this.code = code
  }
}

/**
 * @param {Buffer} buffer
 * @param {string} [originalname]
 * @param {string} [mimetype]
 * @returns {Promise<{ text: string, truncated: boolean, meta: Record<string, unknown> }>}
 */
export async function extractDocumentText(buffer, originalname, mimetype) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new DocumentExtractError('EMPTY_FILE', '文件为空')
  }

  const name = String(originalname || '').toLowerCase()
  const mime = String(mimetype || '').toLowerCase()

  let raw = ''
  /** @type {Record<string, unknown>} */
  const meta = { originalname, mimetype }

  const isPdf =
    mime === 'application/pdf' ||
    name.endsWith('.pdf') ||
    (buffer.length >= 4 && buffer.subarray(0, 4).equals(PDF_MAGIC))

  const isDocx =
    mime ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    name.endsWith('.docx')

  if (isPdf) {
    let parser
    try {
      parser = new PDFParse({ data: buffer })
      const data = await parser.getText()
      raw = String(data.text ?? '').replace(/\0/g, '')
      meta.pages = data.total
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'PDF 解析失败'
      throw new DocumentExtractError('PDF_PARSE_FAILED', msg)
    } finally {
      try {
        await parser?.destroy?.()
      } catch {
        /* ignore */
      }
    }
  } else if (isDocx) {
    try {
      const result = await mammoth.extractRawText({ buffer })
      raw = String(result.value ?? '').replace(/\0/g, '')
      if (result.messages?.length) {
        meta.mammothMessages = result.messages.map((m) => ({
          type: m.type,
          message: m.message,
        }))
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'DOCX 解析失败'
      throw new DocumentExtractError('DOCX_PARSE_FAILED', msg)
    }
  } else {
    throw new DocumentExtractError(
      'UNSUPPORTED_TYPE',
      '仅支持 PDF 与 Word（.docx）',
    )
  }

  const trimmed = raw.trim()
  if (!trimmed) {
    throw new DocumentExtractError('NO_TEXT', '未能从文档中提取到可读文本')
  }

  const max = DOCUMENT_EXTRACT_MAX_CHARS
  let truncated = false
  let text = trimmed
  if (text.length > max) {
    truncated = true
    text =
      text.slice(0, max) +
      '\n\n[文档过长，已按服务器配置截断后续内容；如需全量分析请拆分文件或提高 DOCUMENT_EXTRACT_MAX_CHARS。]'
  }

  return { text, truncated, meta }
}
