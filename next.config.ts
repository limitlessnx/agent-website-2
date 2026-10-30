import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.fluxknight.space" }],
        destination: "https://fluxknight.space/:path*",
        permanent: true,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "d2ol7oe51mr4n9.cloudfront.net",
        pathname: "/user_3GTV38w6zCm0fb6vRYkPEmmsNnH/**",
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
