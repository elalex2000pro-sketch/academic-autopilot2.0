/** @type {import('next').NextConfig} */
const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "https://academic-autopilot-api.onrender.com"
).replace(/\/+$/, "");

const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
  // La web y la API comparten SIEMPRE el mismo origen: el servidor de Next
  // (Vercel/Render) reenvia /api/* al backend real. Asi el navegador nunca
  // hace peticiones entre dominios: sin CORS y sin fallos de conexion como
  // "No se pudo contactar con el servidor".
  // En el despliegue con Caddy, Caddy mismo enruta /api al backend y esta
  // regla no se usa.
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${API_URL}/api/:path*` },
    ];
  },
};

export default nextConfig;
