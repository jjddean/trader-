import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  trailingSlash: false,
  serverExternalPackages: ["@aws-sdk/client-textract"],
  redirects: async () => {
    return [
      {
        source: "/dashborad",
        destination: "/dashboard",
        permanent: false,
      },
      {
        source: "/dashboard/import/tre",
        destination: "/dashboard/tre-import",
        permanent: true,
      },
      {
        source: "/dashboard/audit",
        destination: "/dashboard/trade-compliance",
        permanent: true,
      },
      // Force www for all non-www requests (http->https handled by Vercel)
      {
        source: "/:path*",
        destination: "https://www.freightcode.co.uk/:path*",
        basePath: false,
        permanent: true,
        has: [
          {
            type: "host",
            value: "freightcode.co.uk",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
