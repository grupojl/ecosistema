// Welver Dashboard — cascarón de escritorio (Tauri v2). ADR-023, opción A.
//
// La ventana carga el dashboard DESPLEGADO (`DASHBOARD_URL`). No hay lógica de negocio acá:
//   · espera a que el panel responda y navega a él;
//   · deja navegar solo al panel (lo demás se abre en el navegador del sistema);
//   · abre rutas del panel desde enlaces welver://open?path=/…  (deep link);
//   · con `--features updater`, busca versiones nuevas firmadas y pregunta antes de instalar;
//   · inicia sesión por el navegador del sistema (RFC 8252) con un servidor de loopback efímero en 127.0.0.1 y PKCE (RFC 7636):
//     la app genera un `verifier` secreto y manda al navegador solo su `challenge`; el navegador vuelve con un CÓDIGO de un solo uso
//     (no con un token) y la app navega a `/auth/desktop?code=…&verifier=…`, donde el panel canjea el código. Sin el verifier, un código
//     robado del loopback no sirve.
//
// El panel remoto NO tiene acceso a IPC (ver capabilities/default.json): solo conoce el puerto de loopback, que se le inyecta
// como `window.__WELVER_DESKTOP__`.
//
// ⚠ Este archivo se escribió sin poder compilarlo (sin Rust en la máquina de desarrollo). La primera compilación real es F0.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use sha2::{Digest, Sha256};
use std::{
    io::{Read, Write},
    net::{TcpListener, TcpStream, ToSocketAddrs},
    sync::{Arc, Mutex},
    thread,
    time::{Duration, Instant},
};

use tauri::{AppHandle, Manager, Url, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
use tauri_plugin_deep_link::DeepLinkExt;
use tauri_plugin_opener::OpenerExt;

/// En dev: `http://localhost:3022`. En un build de producción: `DASHBOARD_URL=https://… cargo tauri build`.
/// En tiempo de ejecución, la variable de entorno `DASHBOARD_URL` tiene prioridad (útil para probar contra otro entorno).
const DEFAULT_DASHBOARD_URL: &str = match option_env!("DASHBOARD_URL") {
    Some(url) => url,
    None => "http://localhost:3022",
};

fn dashboard_url() -> String {
    std::env::var("DASHBOARD_URL")
        .unwrap_or_else(|_| DEFAULT_DASHBOARD_URL.to_string())
        .trim_end_matches('/')
        .to_string()
}

/// Tiempo máximo para completar el login en el navegador; pasado esto el intento se descarta.
const LOGIN_TTL: Duration = Duration::from_secs(300);

/// Login en curso: el `state` (anti-CSRF) y el `verifier` PKCE, que NUNCA sale de la app hacia el navegador.
struct PendingLogin {
    state: String,
    verifier: String,
    created: Instant,
}

/// Se consume al usarse (un solo uso).
type PendingState = Arc<Mutex<Option<PendingLogin>>>;

/// Destino de un deep link recibido ANTES de que el panel esté cargado; `connect` lo usa como primera página.
type PendingPath = Arc<Mutex<Option<String>>>;

// ─── Lógica pura (con tests abajo) ───────────────────────────────────────────

/// Valor aleatorio de 256 bits en hex (para el `state` y el `verifier`). Sale del generador criptográfico del sistema operativo;
/// si el SO no lo entrega, no hay login (`None`) en vez de caer en algo predecible.
fn random_token() -> Option<String> {
    let mut bytes = [0u8; 32];
    getrandom::getrandom(&mut bytes).ok()?;
    Some(hex(&bytes))
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

/// PKCE: `challenge = hex(SHA-256(verifier))`. El navegador solo ve el challenge; el verifier se revela al panel recién cuando
/// vuelve el código, y el back comprueba que coincidan.
fn challenge_of(verifier: &str) -> String {
    hex(&Sha256::digest(verifier.as_bytes()))
}

/// ¿El intento de login sigue vigente?
fn is_fresh(created: Instant, now: Instant) -> bool {
    now.saturating_duration_since(created) <= LOGIN_TTL
}

struct Request {
    target: String,
    host: Option<String>,
}

/// Solo GET. Devuelve el path+query y el header Host.
fn parse_request(raw: &str) -> Option<Request> {
    let mut lines = raw.split("\r\n");
    let first = lines.next()?;
    let mut parts = first.split_whitespace();
    let method = parts.next()?;
    let target = parts.next()?;
    if method != "GET" {
        return None;
    }
    let mut host = None;
    for line in lines {
        if line.is_empty() {
            break;
        }
        if let Some((key, value)) = line.split_once(':') {
            if key.eq_ignore_ascii_case("host") {
                host = Some(value.trim().to_string());
            }
        }
    }
    Some(Request { target: target.to_string(), host })
}

fn split_path_query(target: &str) -> (&str, &str) {
    target.split_once('?').unwrap_or((target, ""))
}

fn query_param<'a>(query: &'a str, key: &str) -> Option<&'a str> {
    query.split('&').find_map(|pair| {
        let (k, v) = pair.split_once('=')?;
        (k == key).then_some(v)
    })
}

/// El código de un solo uso que emite el back es base64url (`[A-Za-z0-9_-]`). Rechazar lo demás evita inyectar nada en la URL.
fn is_valid_code(code: &str) -> bool {
    (32..=128).contains(&code.len()) && code.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}

fn is_valid_state(state: &str) -> bool {
    (16..=128).contains(&state.len())
        && state.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}

#[derive(Debug, PartialEq, Eq)]
enum NavDecision {
    Allow,
    OpenExternally,
    Block,
}

/// A dónde puede navegar la ventana: la pantalla local, el panel y el loopback del login. Lo demás (http/https) va al
/// navegador del sistema; cualquier otro esquema se bloquea.
fn decide_navigation(url: &Url, dashboard: &str, login_port: u16) -> NavDecision {
    if matches!(url.scheme(), "tauri" | "about" | "blob" | "data") {
        return NavDecision::Allow;
    }
    if url.host_str() == Some("tauri.localhost") {
        return NavDecision::Allow; // assets locales en Windows
    }
    if let Ok(panel) = Url::parse(dashboard) {
        if url.scheme() == panel.scheme()
            && url.host_str() == panel.host_str()
            && url.port_or_known_default() == panel.port_or_known_default()
        {
            return NavDecision::Allow;
        }
    }
    if url.scheme() == "http" && url.host_str() == Some("127.0.0.1") && url.port() == Some(login_port) {
        return NavDecision::Allow;
    }
    match url.scheme() {
        "http" | "https" => NavDecision::OpenExternally,
        _ => NavDecision::Block,
    }
}

/// Solo rutas internas del panel: evita "//otro-sitio", rutas con "\\", caracteres de control o largos desmedidos.
fn safe_panel_path(path: &str) -> bool {
    path.starts_with('/')
        && !path.starts_with("//")
        && !path.contains('\\')
        && path.len() <= 2048
        && !path.chars().any(|c| c.is_control())
}

/// `welver://open?path=/tienda/pedidos` → `{panel}/tienda/pedidos`. Sin `path` abre la raíz del panel. Cualquier otra
/// forma (otro esquema, otro host, ruta insegura) se descarta: un enlace externo nunca navega fuera del panel.
fn deep_link_target(raw: &str, dashboard: &str) -> Option<String> {
    let url = Url::parse(raw).ok()?;
    if url.scheme() != "welver" || url.host_str() != Some("open") {
        return None;
    }
    let path = url
        .query_pairs()
        .find(|(key, _)| key == "path")
        .map(|(_, value)| value.into_owned())
        .unwrap_or_else(|| "/".to_string());
    safe_panel_path(&path).then(|| format!("{dashboard}{path}"))
}

fn is_local_page(url: &Url) -> bool {
    url.scheme() == "tauri" || url.host_str() == Some("tauri.localhost")
}

fn html_page(title: &str, body_html: &str) -> String {
    format!(
        "<!doctype html><html lang=\"es\"><meta charset=\"utf-8\"><title>{title}</title>\
         <body style=\"font-family:system-ui,sans-serif;background:#0a0a0a;color:#f5f5f5;display:flex;min-height:100vh;\
         align-items:center;justify-content:center;text-align:center\"><div style=\"max-width:380px\">{body_html}</div></body></html>"
    )
}

// ─── Servidor de loopback para el login ──────────────────────────────────────

fn respond(stream: &mut TcpStream, status: &str, body: &str) {
    let message = format!(
        "HTTP/1.1 {status}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nCache-Control: no-store\r\n\
         Referrer-Policy: no-referrer\r\nConnection: close\r\n\r\n{body}",
        body.len()
    );
    let _ = stream.write_all(message.as_bytes());
}

/// Abre el listener en un puerto efímero y atiende en un hilo. Devuelve el puerto.
fn start_loopback(app: AppHandle, pending: PendingState) -> std::io::Result<u16> {
    let listener = TcpListener::bind("127.0.0.1:0")?;
    let port = listener.local_addr()?.port();
    thread::spawn(move || {
        for stream in listener.incoming().flatten() {
            let app = app.clone();
            let pending = pending.clone();
            thread::spawn(move || handle(stream, port, &app, &pending));
        }
    });
    Ok(port)
}

fn handle(mut stream: TcpStream, port: u16, app: &AppHandle, pending: &PendingState) {
    let _ = stream.set_read_timeout(Some(Duration::from_secs(5)));
    let mut buf = [0u8; 8192];
    let n = match stream.read(&mut buf) {
        Ok(n) if n > 0 => n,
        _ => return,
    };
    let raw = String::from_utf8_lossy(&buf[..n]).to_string();
    let Some(request) = parse_request(&raw) else {
        respond(&mut stream, "400 Bad Request", "");
        return;
    };

    // Defensa contra DNS rebinding: solo se atiende si el Host es exactamente el de loopback con ESTE puerto.
    let expected_host = format!("127.0.0.1:{port}");
    if request.host.as_deref() != Some(expected_host.as_str()) {
        respond(&mut stream, "403 Forbidden", &html_page("Acceso denegado", "<p>Solicitud no permitida.</p>"));
        return;
    }

    let (path, query) = split_path_query(&request.target);
    match path {
        "/start" => start_login(&mut stream, port, app, pending),
        "/callback" => finish_login(&mut stream, query, app, pending),
        _ => respond(&mut stream, "404 Not Found", &html_page("No encontrado", "<p>No encontrado.</p>")),
    }
}

/// El panel (dentro de la app) navega acá; abrimos el navegador del sistema en la página puente.
fn start_login(stream: &mut TcpStream, port: u16, app: &AppHandle, pending: &PendingState) {
    let (Some(state), Some(verifier)) = (random_token(), random_token()) else {
        respond(
            stream,
            "500 Internal Server Error",
            &html_page("No se pudo iniciar", "<p>El sistema no entregó aleatoriedad segura.<br>Reiniciá la aplicación e intentá de nuevo.</p>"),
        );
        return;
    };
    let challenge = challenge_of(&verifier);
    if let Ok(mut guard) = pending.lock() {
        *guard = Some(PendingLogin { state: state.clone(), verifier, created: Instant::now() });
    }
    let panel = dashboard_url();
    let bridge = format!("{panel}/desktop-login?port={port}&state={state}&challenge={challenge}");

    match app.opener().open_url(bridge, None::<&str>) {
        Ok(_) => respond(
            stream,
            "200 OK",
            &html_page(
                "Iniciá sesión",
                &format!(
                    "<p>Se abrió tu navegador.<br>Completá el inicio de sesión y volvé a esta ventana.</p>\
                     <p><a style=\"color:#60a5fa\" href=\"{panel}/login\">Cancelar</a></p>"
                ),
            ),
        ),
        Err(_) => respond(
            stream,
            "500 Internal Server Error",
            &html_page(
                "No se pudo abrir el navegador",
                &format!("<p>No pudimos abrir tu navegador.</p><p><a style=\"color:#60a5fa\" href=\"{panel}/login\">Volver</a></p>"),
            ),
        ),
    }
}

/// El navegador del sistema vuelve acá con un CÓDIGO de un solo uso (no un token). Se verifica el `state` y la vigencia (un solo uso)
/// y se navega a la página del panel que canjea el código con el `verifier`, que solo esta app conoce.
fn finish_login(stream: &mut TcpStream, query: &str, app: &AppHandle, pending: &PendingState) {
    let code = query_param(query, "code").unwrap_or("");
    let state = query_param(query, "state").unwrap_or("");
    let login = pending.lock().ok().and_then(|mut guard| guard.take());

    let verifier = match login {
        Some(l) if is_fresh(l.created, Instant::now()) && is_valid_state(state) && is_valid_code(code) && l.state == state => Some(l.verifier),
        _ => None,
    };
    let Some(verifier) = verifier else {
        respond(
            stream,
            "400 Bad Request",
            &html_page("No se pudo verificar", "<p>No pudimos verificar el inicio de sesión.<br>Volvé a la aplicación e intentá de nuevo.</p>"),
        );
        return;
    };

    respond(stream, "200 OK", &html_page("Listo", "<p>Listo. Volvé a la aplicación: ya podés cerrar esta pestaña.</p>"));
    if let Some(window) = app.get_webview_window("main") {
        location_replace(&window, &format!("{}/auth/desktop?code={code}&verifier={verifier}", dashboard_url()));
        let _ = window.set_focus();
    }
}

// ─── Ventana ─────────────────────────────────────────────────────────────────

fn js_string(text: &str) -> String {
    serde_json::to_string(text).unwrap_or_else(|_| "\"\"".to_string())
}

fn location_replace(window: &WebviewWindow, url: &str) {
    let _ = window.eval(&format!("window.location.replace({});", js_string(url)));
}

fn set_message(window: &WebviewWindow, text: &str) {
    let _ = window.eval(&format!(
        "(function(){{var m=document.getElementById('msg');if(m)m.textContent={};}})();",
        js_string(text)
    ));
}

fn reachable(host: &str, port: u16) -> bool {
    match (host, port).to_socket_addrs() {
        Ok(mut addrs) => addrs.any(|addr| TcpStream::connect_timeout(&addr, Duration::from_secs(3)).is_ok()),
        Err(_) => false,
    }
}

/// Muestra la pantalla de conexión y navega al panel apenas responde. Si no hay conexión, reintenta cada pocos segundos.
fn connect(window: WebviewWindow, dashboard: String, pending: PendingPath) {
    thread::sleep(Duration::from_millis(1500)); // deja cargar la pantalla local antes de tocarla

    let Ok(panel) = Url::parse(&dashboard) else {
        set_message(&window, "La URL del panel (DASHBOARD_URL) no es válida.");
        return;
    };
    let Some(host) = panel.host_str().map(str::to_owned) else {
        set_message(&window, "La URL del panel (DASHBOARD_URL) no tiene host.");
        return;
    };
    let port = panel.port_or_known_default().unwrap_or(443);

    let mut attempts = 0u32;
    loop {
        if reachable(&host, port) {
            // Si la app se abrió con un enlace welver://, esa ruta es la primera página; si no, la raíz del panel.
            let destination = pending.lock().ok().and_then(|mut guard| guard.take()).unwrap_or_else(|| dashboard.clone());
            location_replace(&window, &destination);
            thread::sleep(Duration::from_secs(5));
            // Si seguimos en la pantalla local, el eval se perdió: se reintenta.
            match window.url() {
                Ok(current) if is_local_page(&current) => continue,
                _ => return,
            }
        }
        attempts += 1;
        set_message(&window, &format!("No se puede conectar con el panel ({host}). Reintentando… (intento {attempts})"));
        thread::sleep(Duration::from_secs(4));
    }
}

/// Con el panel cargado navega ya; si todavía está en la pantalla de conexión, lo deja pendiente para `connect`.
fn handle_deep_link(app: &AppHandle, pending: &PendingPath, raw: &str) {
    let Some(target) = deep_link_target(raw, &dashboard_url()) else { return };
    let window = app.get_webview_window("main");
    let connected = window
        .as_ref()
        .and_then(|w| w.url().ok())
        .map(|current| !is_local_page(&current))
        .unwrap_or(false);

    match window {
        Some(w) if connected => {
            location_replace(&w, &target);
            let _ = w.unminimize();
            let _ = w.set_focus();
        }
        _ => {
            if let Ok(mut guard) = pending.lock() {
                *guard = Some(target);
            }
        }
    }
}

fn focus_main(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// Busca una versión firmada cada 6 horas (la primera, 20 s después de arrancar). Pregunta antes de instalar: en Windows
/// el instalador cierra la app, así que nunca se actualiza sin que el usuario lo sepa.
#[cfg(feature = "updater")]
fn start_update_checks(app: AppHandle) {
    thread::spawn(move || {
        thread::sleep(Duration::from_secs(20));
        loop {
            check_for_update(app.clone());
            thread::sleep(Duration::from_secs(6 * 60 * 60));
        }
    });
}

#[cfg(feature = "updater")]
fn check_for_update(app: AppHandle) {
    use tauri_plugin_dialog::{DialogExt, MessageDialogButtons};
    use tauri_plugin_updater::UpdaterExt;

    tauri::async_runtime::spawn(async move {
        let Ok(updater) = app.updater() else { return };
        let Ok(Some(update)) = updater.check().await else { return };

        let message = format!("Hay una versión nueva ({}). ¿Actualizar ahora? La aplicación se reiniciará.", update.version);
        let app_for_restart = app.clone();
        app.dialog()
            .message(message)
            .title("Actualización disponible")
            .buttons(MessageDialogButtons::OkCancelCustom("Actualizar".into(), "Más tarde".into()))
            .show(move |accepted| {
                if !accepted {
                    return;
                }
                tauri::async_runtime::spawn(async move {
                    if update.download_and_install(|_chunk, _total| {}, || {}).await.is_ok() {
                        app_for_restart.restart();
                    }
                });
            });
    });
}

fn main() {
    let builder = tauri::Builder::default()
        // Debe registrarse primero: una segunda instancia enfoca la ventana existente y reenvía el enlace welver:// si lo hubo.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| focus_main(app)))
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_opener::init());

    #[cfg(feature = "updater")]
    let builder = builder
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init());

    builder
        .setup(|app| {
            let pending_path: PendingPath = Arc::new(Mutex::new(None));

            // Deep links: en instalaciones los registra el instalador; en desarrollo (Windows/Linux) se registran acá.
            #[cfg(any(windows, target_os = "linux"))]
            {
                let _ = app.deep_link().register_all();
            }
            let link_handle = app.handle().clone();
            let link_pending = pending_path.clone();
            app.deep_link().on_open_url(move |event| {
                for url in event.urls() {
                    handle_deep_link(&link_handle, &link_pending, url.as_str());
                }
            });
            // Arranque en frío con un enlace (la app no estaba abierta): queda pendiente hasta que el panel cargue.
            if let Ok(Some(urls)) = app.deep_link().get_current() {
                for url in urls {
                    handle_deep_link(app.handle(), &pending_path, url.as_str());
                }
            }

            #[cfg(feature = "updater")]
            start_update_checks(app.handle().clone());

            let pending: PendingState = Arc::new(Mutex::new(None));
            let port = start_loopback(app.handle().clone(), pending)?;

            let dashboard = dashboard_url();
            // Se inyecta en CADA página que carga la ventana (incluido el panel remoto): le dice al panel que corre dentro de la app
            // y en qué puerto de loopback iniciar sesión. No expone IPC.
            let bridge = format!(
                "window.__WELVER_DESKTOP__ = Object.freeze({{ loginPort: {port}, version: {} }});",
                js_string(env!("CARGO_PKG_VERSION"))
            );

            let handle = app.handle().clone();
            let guard_dashboard = dashboard.clone();
            let window = WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                .title("Welver Dashboard")
                .inner_size(1280.0, 800.0)
                .min_inner_size(960.0, 600.0)
                .initialization_script(&bridge)
                .on_navigation(move |url| match decide_navigation(url, &guard_dashboard, port) {
                    NavDecision::Allow => true,
                    NavDecision::OpenExternally => {
                        let _ = handle.opener().open_url(url.as_str(), None::<&str>);
                        false
                    }
                    NavDecision::Block => false,
                })
                .build()?;

            thread::spawn(move || connect(window, dashboard, pending_path));
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error al iniciar Welver Dashboard");
}

// ─── Tests (cargo test) ──────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn url(s: &str) -> Url {
        Url::parse(s).unwrap()
    }

    #[test]
    fn random_token_es_hex_de_64_y_distinto_cada_vez() {
        let a = random_token().unwrap();
        let b = random_token().unwrap();
        assert_eq!(a.len(), 64);
        assert!(a.chars().all(|c| c.is_ascii_hexdigit()));
        assert_ne!(a, b);
        assert!(is_valid_state(&a));
    }

    #[test]
    fn challenge_es_el_sha256_del_verifier() {
        // Vector conocido de SHA-256("abc")
        assert_eq!(challenge_of("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
        assert_ne!(challenge_of("abc"), challenge_of("abd"));
        assert_eq!(challenge_of("abc").len(), 64);
    }

    #[test]
    fn el_intento_de_login_vence() {
        let t0 = Instant::now();
        assert!(is_fresh(t0, t0));
        assert!(is_fresh(t0, t0 + Duration::from_secs(299)));
        assert!(!is_fresh(t0, t0 + LOGIN_TTL + Duration::from_secs(1)));
    }

    #[test]
    fn parse_request_lee_path_y_host() {
        let req = parse_request("GET /callback?state=x&code=y HTTP/1.1\r\nHost: 127.0.0.1:5000\r\nAccept: */*\r\n\r\n").unwrap();
        assert_eq!(req.target, "/callback?state=x&code=y");
        assert_eq!(req.host.as_deref(), Some("127.0.0.1:5000"));
    }

    #[test]
    fn parse_request_rechaza_lo_que_no_es_get() {
        assert!(parse_request("POST /start HTTP/1.1\r\nHost: 127.0.0.1:1\r\n\r\n").is_none());
        assert!(parse_request("").is_none());
    }

    #[test]
    fn query_param_encuentra_cada_clave() {
        let (path, query) = split_path_query("/callback?state=abc&code=def_ghi");
        assert_eq!(path, "/callback");
        assert_eq!(query_param(query, "state"), Some("abc"));
        assert_eq!(query_param(query, "code"), Some("def_ghi"));
        assert_eq!(query_param(query, "otro"), None);
        assert_eq!(split_path_query("/start"), ("/start", ""));
    }

    #[test]
    fn codigo_solo_acepta_base64url_de_largo_razonable() {
        assert!(is_valid_code(&"a".repeat(43)));
        assert!(is_valid_code("AbC-_123AbC-_123AbC-_123AbC-_123AbC-_123"));
        assert!(!is_valid_code(""));
        assert!(!is_valid_code("corto"));
        assert!(!is_valid_code(&"a".repeat(129)));
        assert!(!is_valid_code(&format!("{}&state=x", "a".repeat(40))));
        assert!(!is_valid_code(&format!("{}%20", "a".repeat(40))));
        assert!(!is_valid_code(&format!("{}.", "a".repeat(40))));
        assert!(!is_valid_code("</script></script></script></script>"));
    }

    #[test]
    fn state_largo_y_caracteres_validos() {
        assert!(is_valid_state(&"a".repeat(16)));
        assert!(!is_valid_state("corto"));
        assert!(!is_valid_state(&"a".repeat(129)));
        assert!(!is_valid_state("aaaaaaaaaaaaaaa!"));
    }

    #[test]
    fn navegacion_permitida_solo_al_panel_a_la_pantalla_local_y_al_loopback() {
        let panel = "http://localhost:3022";
        assert_eq!(decide_navigation(&url("http://localhost:3022/tienda/productos"), panel, 5000), NavDecision::Allow);
        assert_eq!(decide_navigation(&url("tauri://localhost/index.html"), panel, 5000), NavDecision::Allow);
        assert_eq!(decide_navigation(&url("http://tauri.localhost/index.html"), panel, 5000), NavDecision::Allow);
        assert_eq!(decide_navigation(&url("http://127.0.0.1:5000/start"), panel, 5000), NavDecision::Allow);
    }

    #[test]
    fn navegacion_externa_va_al_navegador_y_lo_raro_se_bloquea() {
        let panel = "http://localhost:3022";
        assert_eq!(decide_navigation(&url("https://example.com/"), panel, 5000), NavDecision::OpenExternally);
        // otro puerto de loopback ≠ el del login
        assert_eq!(decide_navigation(&url("http://127.0.0.1:6000/start"), panel, 5000), NavDecision::OpenExternally);
        // mismo host pero otro puerto que el panel
        assert_eq!(decide_navigation(&url("http://localhost:9999/"), panel, 5000), NavDecision::OpenExternally);
        assert_eq!(decide_navigation(&url("file:///C:/Windows/System32"), panel, 5000), NavDecision::Block);
        assert_eq!(decide_navigation(&url("ftp://example.com/x"), panel, 5000), NavDecision::Block);
    }

    #[test]
    fn panel_en_https_usa_el_puerto_por_defecto() {
        let panel = "https://panel.welver.app";
        assert_eq!(decide_navigation(&url("https://panel.welver.app:443/x"), panel, 5000), NavDecision::Allow);
        assert_eq!(decide_navigation(&url("http://panel.welver.app/x"), panel, 5000), NavDecision::OpenExternally);
    }

    #[test]
    fn deep_link_abre_una_ruta_del_panel() {
        let panel = "http://localhost:3022";
        assert_eq!(deep_link_target("welver://open?path=/tienda/pedidos", panel).as_deref(), Some("http://localhost:3022/tienda/pedidos"));
        assert_eq!(deep_link_target("welver://open?path=%2Ftienda%2Fpedidos%3Festado%3Dpendiente", panel).as_deref(), Some("http://localhost:3022/tienda/pedidos?estado=pendiente"));
        assert_eq!(deep_link_target("welver://open", panel).as_deref(), Some("http://localhost:3022/"));
    }

    #[test]
    fn deep_link_nunca_navega_fuera_del_panel() {
        let panel = "http://localhost:3022";
        assert_eq!(deep_link_target("welver://open?path=//evil.com", panel), None);
        assert_eq!(deep_link_target("welver://open?path=https://evil.com", panel), None);
        assert_eq!(deep_link_target("welver://open?path=/%5Cevil.com", panel), None);
        assert_eq!(deep_link_target("welver://open?path=tienda", panel), None);
        assert_eq!(deep_link_target("welver://otro?path=/x", panel), None);
        assert_eq!(deep_link_target("https://example.com/?path=/x", panel), None);
        assert_eq!(deep_link_target("no es una url", panel), None);
    }

    #[test]
    fn ruta_segura_rechaza_control_y_largos_desmedidos() {
        assert!(safe_panel_path("/configuracion/tema"));
        assert!(!safe_panel_path("/a\nb"));
        assert!(!safe_panel_path(&format!("/{}", "a".repeat(3000))));
        assert!(!safe_panel_path(""));
    }

    #[test]
    fn pagina_local_se_reconoce() {
        assert!(is_local_page(&url("tauri://localhost/index.html")));
        assert!(is_local_page(&url("http://tauri.localhost/index.html")));
        assert!(!is_local_page(&url("http://localhost:3022/")));
    }

    #[test]
    fn js_string_escapa_comillas_y_saltos() {
        assert_eq!(js_string("a\"b\n"), "\"a\\\"b\\n\"");
    }
}
