import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  trailingSlash: false,
  redirects: async () => {
    return [
      // Force www for all non-www requests (http->https handled by Vercel)
      {
        source: "/:path*",
        destination: "https://www.tradedna.co.uk/:path*",
        basePath: false,
        permanent: true,
        has: [
          {
            type: "host",
            value: "tradedna.co.uk",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
