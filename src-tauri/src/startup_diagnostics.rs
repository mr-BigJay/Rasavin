//! Basic on-device startup diagnostics. No medical records are logged.
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

fn log_path() -> PathBuf {
    let base = std::env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(std::env::temp_dir);
    base.join("Rasavin").join("logs").join("startup.log")
}

fn append(message: &str) {
    let path = log_path();
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(&path) {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        let _ = writeln!(file, "[{timestamp}] {message}");
    }
}

#[cfg(windows)]
fn error_dialog(message: &str) {
    use std::ffi::c_void;
    #[link(name = "user32")]
    unsafe extern "system" {
        fn MessageBoxW(
            hwnd: *mut c_void,
            text: *const u16,
            caption: *const u16,
            kind: u32,
        ) -> i32;
    }

    let caption: Vec<u16> = "Rasavin - Startup problem\0".encode_utf16().collect();
    let text = format!(
        "Rasavin could not start.\n\n{}\n\nPlease send the diagnostic file:\n{}",
        message,
        log_path().display(),
    );
    let text: Vec<u16> = text.encode_utf16().chain(std::iter::once(0)).collect();
    // MB_OK | MB_ICONERROR
    unsafe {
        MessageBoxW(std::ptr::null_mut(), text.as_ptr(), caption.as_ptr(), 0x10);
    }
}

pub fn initialize() {
    append("Rasavin startup started; diagnostic build 0.1.2");
    let default_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        let detail = info.payload().downcast_ref::<String>().map(String::as_str)
            .or_else(|| info.payload().downcast_ref::<&str>().copied())
            .unwrap_or("Unknown Rust panic");
        let location = info.location()
            .map(|l| format!("{}:{}", l.file(), l.line()))
            .unwrap_or_else(|| "unknown location".to_string());
        let message = format!("{detail} (at {location})");
        append(&format!("Startup/runtime failure: {message}"));
        #[cfg(windows)]
        error_dialog(&message);
        default_hook(info);
    }));
}
