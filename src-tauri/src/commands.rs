#[tauri::command]
pub fn get_api_base_url() -> String {
    "http://127.0.0.1:8787".to_string()
}
