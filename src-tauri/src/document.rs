use pdf_extract::extract_text_from_mem;
use thiserror::Error;

const PDF_MAGIC: &[u8] = b"%PDF";

pub const DOCUMENT_EXTRACT_MAX_CHARS: usize = 120_000;

#[derive(Error, Debug, Clone)]
pub enum DocumentExtractError {
    #[error("{message}")]
    Known { code: &'static str, message: String },
}

impl DocumentExtractError {
    pub fn code(&self) -> &'static str {
        match self {
            DocumentExtractError::Known { code, .. } => code,
        }
    }
    pub fn message(&self) -> String {
        self.to_string()
    }
}

fn empty() -> DocumentExtractError {
    DocumentExtractError::Known {
        code: "EMPTY_FILE",
        message: "文件为空".to_string(),
    }
}

fn unsupported() -> DocumentExtractError {
    DocumentExtractError::Known {
        code: "UNSUPPORTED_TYPE",
        message: "仅支持 PDF 与 Word（.docx）".to_string(),
    }
}

fn pdf_failed(msg: String) -> DocumentExtractError {
    DocumentExtractError::Known {
        code: "PDF_PARSE_FAILED",
        message: msg,
    }
}

fn docx_failed(msg: String) -> DocumentExtractError {
    DocumentExtractError::Known {
        code: "DOCX_PARSE_FAILED",
        message: msg,
    }
}

fn no_text() -> DocumentExtractError {
    DocumentExtractError::Known {
        code: "NO_TEXT",
        message: "未能从文档中提取到可读文本".to_string(),
    }
}

fn extract_pdf_text(data: &[u8]) -> Result<String, DocumentExtractError> {
    let text = extract_text_from_mem(data).map_err(|e| pdf_failed(e.to_string()))?;
    Ok(text.replace('\0', ""))
}

fn extract_docx_text(data: &[u8]) -> Result<String, DocumentExtractError> {
    use quick_xml::events::Event;
    use quick_xml::reader::Reader;

    let cursor = std::io::Cursor::new(data);
    let mut archive = zip::ZipArchive::new(cursor)
        .map_err(|e| docx_failed(format!("ZIP 解压失败: {}", e)))?;

    let mut file = archive
        .by_name("word/document.xml")
        .map_err(|e| docx_failed(format!("未找到 word/document.xml: {}", e)))?;

    let mut xml = Vec::new();
    std::io::Read::read_to_end(&mut file, &mut xml)
        .map_err(|e| docx_failed(format!("读取 XML 失败: {}", e)))?;

    let mut reader = Reader::from_reader(&xml[..]);
    reader.config_mut().trim_text(true);

    let mut buf = Vec::new();
    let mut text = String::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) | Ok(Event::Empty(ref e)) => {
                if e.name().as_ref() == b"w:t" || e.name().as_ref() == b"w:tab" {
                    // w:t handled in Text event; w:tab adds tab character
                    if e.name().as_ref() == b"w:tab" {
                        text.push('\t');
                    }
                }
            }
            Ok(Event::Text(e)) => {
                if let Ok(t) = e.unescape() {
                    text.push_str(&t);
                }
            }
            Ok(Event::End(ref e)) => {
                if e.name().as_ref() == b"w:p" {
                    text.push('\n');
                }
            }
            Ok(Event::Eof) => break,
            Err(e) => return Err(docx_failed(format!("XML 解析错误: {}", e))),
            _ => {}
        }
        buf.clear();
    }

    Ok(text.replace('\0', ""))
}

pub fn extract_document_text(
    data: &[u8],
    originalname: Option<&str>,
    mimetype: Option<&str>,
    max_chars: usize,
) -> Result<(String, bool), DocumentExtractError> {
    if data.is_empty() {
        return Err(empty());
    }

    let name = originalname.unwrap_or("").to_lowercase();
    let mime = mimetype.unwrap_or("").to_lowercase();

    let is_pdf = mime == "application/pdf"
        || name.ends_with(".pdf")
        || (data.len() >= 4 && &data[0..4] == PDF_MAGIC);

    let is_docx = mime
        == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        || name.ends_with(".docx");

    let raw = if is_pdf {
        extract_pdf_text(data)?
    } else if is_docx {
        extract_docx_text(data)?
    } else {
        return Err(unsupported());
    };

    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err(no_text());
    }

    let mut truncated = false;
    let text = if trimmed.chars().count() > max_chars {
        truncated = true;
        let mut s = String::new();
        for (i, c) in trimmed.chars().enumerate() {
            if i >= max_chars {
                break;
            }
            s.push(c);
        }
        s.push_str("\n\n[文档过长，已按服务器配置截断后续内容；如需全量分析请拆分文件或提高 DOCUMENT_EXTRACT_MAX_CHARS。]");
        s
    } else {
        trimmed.to_string()
    };

    Ok((text, truncated))
}
