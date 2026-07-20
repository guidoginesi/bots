import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Anclar el tracing al proyecto. Sin esto, Next puede inferir el workspace
  // root en la carpeta padre (hay un package-lock.json en la home del dev) y
  // copiar node_modules a un path equivocado dentro de la función → el binario
  // de chromium no queda en /var/task/node_modules/@sparticuz/chromium/bin.
  outputFileTracingRoot: path.join(process.cwd()),
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
