use actix_web::{web, Error, HttpRequest, HttpResponse};
use awc::Client;
use futures_util::{SinkExt, StreamExt};
use url::Url;

use crate::config::env_config;

pub struct HmrUrl(pub Url);

pub fn configure_hmr_proxy(cfg: &mut web::ServiceConfig) {
  let hmr_url = Url::parse(&format!(
    "ws://{}:{}/__vite_hmr",
    env_config().proxy_host,
    24678
  ))
  .expect("invalid HMR proxy target URL");

  cfg
    .app_data(web::Data::new(HmrUrl(hmr_url)))
    .route("/__vite_hmr", web::get().to(ws_hmr_proxy));
}

pub async fn ws_hmr_proxy(
  req: HttpRequest,
  body: web::Payload,
  hmr_target: web::Data<HmrUrl>,
) -> Result<HttpResponse, Error> {
  let (response, mut session, mut msg_stream) = actix_ws::handle(&req, body)?;

  let mut target_url = hmr_target.0.clone();
  target_url.set_query(req.uri().query());

  let (_backend_resp, mut backend_ws) = Client::new()
    .ws(target_url.as_str())
    .protocols(&["vite-hmr"])
    .connect()
    .await
    .map_err(actix_web::error::ErrorBadGateway)?;

  actix_web::rt::spawn(async move {
    loop {
      tokio::select! {
          Some(Ok(msg)) = msg_stream.next() => {
              use actix_ws::Message;
              let ok = match msg {
                  Message::Text(t) => backend_ws.send(awc::ws::Message::Text(t.to_string().into())).await,
                  Message::Binary(b) => backend_ws.send(awc::ws::Message::Binary(b)).await,
                  Message::Ping(b) => backend_ws.send(awc::ws::Message::Ping(b)).await,
                  Message::Pong(b) => backend_ws.send(awc::ws::Message::Pong(b)).await,
                  Message::Close(r) => { let _ = backend_ws.send(awc::ws::Message::Close(r)).await; break; }
                  _ => Ok(()),
              };
              if ok.is_err() { break; }
          }
          Some(Ok(frame)) = backend_ws.next() => {
              use awc::ws::Frame;
              let ok = match frame {
                  Frame::Text(t) => session.text(String::from_utf8_lossy(&t).to_string()).await,
                  Frame::Binary(b) => session.binary(b).await,
                  Frame::Ping(b) => session.pong(&b).await,
                  Frame::Close(r) => { let _ = session.close(r).await; break; }
                  _ => Ok(()),
              };
              if ok.is_err() { break; }
          }
          else => break,
      }
    }
  });

  Ok(response)
}
