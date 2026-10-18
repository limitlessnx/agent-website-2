import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
