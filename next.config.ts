import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Clear-Site-Data",
            value: '"cache", "storage", "executionContexts"',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
