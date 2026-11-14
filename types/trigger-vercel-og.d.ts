/**
 * Next.js 16 ships the standalone Node @vercel/og renderer at this location.
 * Its public next/og wrapper imports React Server Component compiler aliases,
 * which are unavailable in Trigger.dev's independent esbuild worker bundle.
 * Keep the compile-time API typed against Next's supported ImageResponse.
 * This path is pinned to the installed Next.js version and must be verified
 * when Next.js is upgraded.
 */
declare module "next/dist/compiled/@vercel/og/index.node.js" {
  export { ImageResponse } from "next/og";
}
