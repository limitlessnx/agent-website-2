/** Compare the browser origin with the incoming host, including reverse-proxy requests. */
export function isSameOriginAdminRequest(request: Request) {
  const site = request.headers?.get("sec-fetch-site");
  if (site && !["same-origin", "none"].includes(site)) return false;
  const origin = request.headers?.get("origin");
  if (!origin) return true;
  try {
    const source = new URL(origin), target = new URL(request.url);
    return source.protocol === target.protocol && (source.host === target.host || source.host === request.headers.get("host"));
  } catch { return false; }
}
