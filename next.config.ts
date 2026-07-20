import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Chromium serverless (evidence): no bundlear, dejar que Vercel incluya el
  // binario. Sin esto, la captura falla en producción.
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
  // Forzar que el binario brotli de chromium (carpeta bin/) entre en la función:
  // el tracing no lo detecta porque se accede por path en runtime.
  outputFileTracingIncludes: {
    "/api/evidence": ["./node_modules/@sparticuz/chromium/**"],
  },
};

export default nextConfig;
