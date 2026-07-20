import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Chromium serverless (evidence): no bundlear, dejar que Vercel incluya el
  // binario. Sin esto, la captura falla en producción.
  serverExternalPackages: ["@sparticuz/chromium", "playwright-core"],
  // Forzar que entren en la función los archivos que se acceden por path en
  // runtime y el tracing no detecta: el binario brotli de chromium (carpeta
  // bin/) y los paquetes internos de playwright-core.
  outputFileTracingIncludes: {
    "/api/evidence": [
      "./node_modules/@sparticuz/chromium/**",
      "./node_modules/playwright-core/**",
    ],
  },
};

export default nextConfig;
