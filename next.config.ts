import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Chromium serverless (evidence): no bundlear, dejar que Vercel incluya el
  // binario. Sin esto, la captura falla en producción.
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
};

export default nextConfig;
