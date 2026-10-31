// Only translate a same-origin loopback request made through the local Vite UI.
// Foreign Origin values stay untouched so the production backend rejects them.
export function rewriteDevOrigin(proxyReq, req, target) {
  const host = req.headers.host || "";
  if (
    /^(127\.0\.0\.1|localhost):\d+$/.test(host) &&
    req.headers.origin === `http://${host}`
  ) {
    proxyReq.setHeader("Origin", new URL(target).origin);
  }
}
