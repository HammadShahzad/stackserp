import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["sharp"],
  env: {
    // next-auth/react calls new URL(process.env.NEXTAUTH_URL) at module-level
    // using ?? (not ||), so empty string "" crashes with Invalid URL.
    // Ensure it's always a valid URL even during build.
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || "https://stackserp.com",
  },
};

export default nextConfig;
