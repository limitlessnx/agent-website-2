/** Keep authentication handoffs on this application, including backslash URL forms. */
export function safeAuthPath(
  value: string | null | undefined,
  fallback = "/portal",
) {
  if (
    !value?.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\u0000-\u001f\u007f]/.test(value)
  )
    return fallback;
  try {
    const url = new URL(value, "https://fluxknight.local");
    return url.origin === "https://fluxknight.local"
      ? `${url.pathname}${url.search}${url.hash}`
      : fallback;
  } catch {
    return fallback;
  }
}
export function isAdminPath(value: string | null | undefined) {
  const path = safeAuthPath(value).split(/[?#]/)[0];
  return path === "/dashboard" || path.startsWith("/dashboard/");
}
export function adminAuthDestination(value: string | null | undefined) {
  return isAdminPath(value) ? safeAuthPath(value, "/dashboard") : "/dashboard";
}
