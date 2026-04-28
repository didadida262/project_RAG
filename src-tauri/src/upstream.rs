use std::collections::HashMap;

use axum::http::HeaderMap;
use reqwest::header::{HeaderMap as ReqwestHeaderMap, HeaderValue};

use crate::config::Config;

pub fn headers_to_map(headers: &HeaderMap) -> HashMap<String, String> {
    let mut map = HashMap::new();
    for (name, value) in headers.iter() {
        let k = name.as_str().to_lowercase();
        let v = value.to_str().unwrap_or("").to_string();
        map.entry(k)
            .and_modify(|existing: &mut String| {
                *existing = format!("{}, {}", existing, v);
            })
            .or_insert(v);
    }
    map
}

fn normalize_header_value(v: &str) -> String {
    v.to_string()
}

pub fn build_enterprise_auth_headers_inner(
    headers: &HashMap<String, String>,
    config: &Config,
) -> ReqwestHeaderMap {
    let mut h = ReqwestHeaderMap::new();
    h.insert(
        "Accept",
        HeaderValue::from_static("application/json, text/plain, */*"),
    );

    let raw_auth = headers
        .get("authorization")
        .or_else(|| headers.get("Authorization"));
    if let Some(v) = raw_auth {
        let normalized = normalize_header_value(v).trim().to_string();
        if !normalized.is_empty() {
            let _ = h.insert(
                "Authorization",
                HeaderValue::from_str(&normalized)
                    .unwrap_or_else(|_| HeaderValue::from_static("")),
            );
        }
    } else {
        let token = headers.get("token").or_else(|| headers.get("Token"));
        if let Some(v) = token {
            let trimmed = normalize_header_value(v).trim().to_string();
            if !trimmed.is_empty() {
                let bearer = if trimmed.to_lowercase().starts_with("bearer ") {
                    trimmed
                } else {
                    format!("Bearer {}", trimmed)
                };
                let _ = h.insert(
                    "Authorization",
                    HeaderValue::from_str(&bearer)
                        .unwrap_or_else(|_| HeaderValue::from_static("")),
                );
            }
        }
    }

    let api_key = headers
        .get("x-api-key")
        .or_else(|| headers.get("X-Api-Key"))
        .or_else(|| headers.get("X-API-Key"));
    if let Some(v) = api_key {
        let trimmed = normalize_header_value(v).trim().to_string();
        if !trimmed.is_empty() {
            let _ = h.insert(
                "X-Api-Key",
                HeaderValue::from_str(&trimmed)
                    .unwrap_or_else(|_| HeaderValue::from_static("")),
            );
        }
    }

    let referer = format!("{}/enterprise/ai-chat", config.site_origin);
    let _ = h.insert(
        "Referer",
        HeaderValue::from_str(&referer)
            .unwrap_or_else(|_| HeaderValue::from_static("")),
    );

    if let Some(extra) = &config.public_enterprise_cookie {
        let cur = headers.get("cookie").or_else(|| headers.get("Cookie"));
        let cookie = if let Some(cur_str) = cur {
            let trimmed = normalize_header_value(cur_str).trim().to_string();
            if trimmed.is_empty() {
                extra.clone()
            } else {
                format!("{}; {}", trimmed, extra)
            }
        } else {
            extra.clone()
        };
        let _ = h.insert(
            "Cookie",
            HeaderValue::from_str(&cookie)
                .unwrap_or_else(|_| HeaderValue::from_static("")),
        );
    }

    h
}

pub fn build_chat_completions_headers(
    headers: &HashMap<String, String>,
    config: &Config,
) -> HeaderMap {
    let mut h = build_enterprise_auth_headers_inner(headers, config);
    h.insert("Content-Type", HeaderValue::from_static("application/json"));
    h.insert("Accept", HeaderValue::from_static("text/event-stream"));
    h
}

pub fn build_llm_upstream_fetch_headers(headers: &HashMap<String, String>) -> HeaderMap {
    let mut h = HeaderMap::new();
    h.insert("Content-Type", HeaderValue::from_static("application/json"));
    h.insert("Accept", HeaderValue::from_static("application/json, text/event-stream"));

    let raw = headers
        .get("authorization")
        .or_else(|| headers.get("Authorization"));
    if let Some(v) = raw {
        let trimmed = normalize_header_value(v).trim().to_string();
        if !trimmed.is_empty() {
            let _ = h.insert(
                "Authorization",
                HeaderValue::from_str(&trimmed).unwrap_or_else(|_| HeaderValue::from_static("")),
            );
        }
    }

    h
}
