mod commands;
mod config;
mod document;
mod error;
mod gateway;
mod proxy;
mod state;
mod upstream;

use tauri::Manager;

pub fn run() {
    let config = config::Config::from_env();
    let client = reqwest::Client::builder()
        .pool_max_idle_per_host(10)
        .build()
        .expect("Failed to build HTTP client");

    let (shutdown_tx, shutdown_rx) = tokio::sync::oneshot::channel::<()>();
    let shutdown_tx = std::sync::Mutex::new(Some(shutdown_tx));

    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .invoke_handler(tauri::generate_handler![commands::get_api_base_url])
        .setup(move |_app| {
            let config_clone = config.clone();
            let client_clone = client.clone();
            tokio::spawn(async move {
                if let Err(e) = proxy::start_server(config_clone, client_clone, shutdown_rx).await {
                    log::error!("[api-proxy] server error: {}", e);
                }
            });
            Ok(())
        })
        .on_window_event(move |window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let _app_handle = window.app_handle();
                if let Some(tx) = shutdown_tx.lock().unwrap().take() {
                    let _ = tx.send(());
                }
                // on macOS keep app running even when all windows closed
                #[cfg(target_os = "macos")]
                {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app_handle, event| {
            if let tauri::RunEvent::ExitRequested { api, .. } = event {
                api.prevent_exit();
            }
        });
}
