use std::sync::Mutex;
use tauri::Manager;
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandChild;

struct SidecarState(Mutex<Option<CommandChild>>);

#[tauri::command]
fn drag_window(window: tauri::WebviewWindow) -> Result<(), String> {
    window.start_dragging().map_err(|e| e.to_string())
}

#[tauri::command]
fn toggle_maximize(window: tauri::WebviewWindow) -> Result<(), String> {
    if window.is_maximized().unwrap_or(false) {
        window.unmaximize().map_err(|e| e.to_string())
    } else {
        window.maximize().map_err(|e| e.to_string())
    }
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(SidecarState(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![drag_window, toggle_maximize])
        .setup(|app| {
            let shell = app.shell();
            let sidecar = shell.sidecar("floudeck-server").unwrap();

            // Resolve client assets directory from Tauri's bundled resources
            let resource_path = app
                .path()
                .resource_dir()
                .expect("failed to resolve resource dir");
            let client_dir = resource_path.join("client");

            let (mut rx, child) = sidecar
                .args([
                    "--port",
                    "0",
                    "--client-dir",
                    &client_dir.to_string_lossy(),
                ])
                .spawn()
                .expect("failed to spawn floudeck-server sidecar");

            // Store child so we can kill it on exit
            let state = app.state::<SidecarState>();
            *state.0.lock().unwrap() = Some(child);

            // Read stdout to find the port
            let window = app.get_webview_window("main").unwrap();

            tauri::async_runtime::spawn(async move {
                use tauri_plugin_shell::process::CommandEvent;
                while let Some(event) = rx.recv().await {
                    match event {
                        CommandEvent::Stdout(line) => {
                            let line = String::from_utf8_lossy(&line);
                            // Look for "server:start listening on port {N}"
                            if let Some(port_str) = line
                                .strip_prefix("server:start listening on port ")
                            {
                                let port = port_str.trim();
                                let url = format!("http://localhost:{}", port);
                                println!("Navigating webview to {}", url);
                                let _ = window.navigate(url.parse().unwrap());
                            }
                        }
                        CommandEvent::Stderr(line) => {
                            let line = String::from_utf8_lossy(&line);
                            eprintln!("sidecar stderr: {}", line);
                        }
                        CommandEvent::Terminated(status) => {
                            eprintln!("sidecar terminated: {:?}", status);
                            break;
                        }
                        _ => {}
                    }
                }
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                let state = window.state::<SidecarState>();
                let child = state.0.lock().unwrap().take();
                if let Some(child) = child {
                    let _ = child.kill();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Floudeck");
}
