import type { NextConfig } from "next";

const ARTIFACT_STORE =
  process.env.NEXT_PUBLIC_ARTIFACT_STORE ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  async rewrites() {
    return [
      {
        source: "/artifacts/:path*",
        destination: `${ARTIFACT_STORE}/artifacts/:path*`,
      },
    ];
  },
};

export default nextConfig;
