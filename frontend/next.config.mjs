/** @type {import('next').NextConfig} */
const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "https://academic-autopilot-api.onrender.com"
).replace(/\/+$/, "");

const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  compress: true,
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: ["lucide-react", "date-fns"],
  },
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
  // Code splitting manual para las dependencias que no deben entrar en el
  // bundle inicial. Next ya divide por ruta; estos grupos separan ademas los
  // vendors pesados en chunks con nombre propio para que se cacheen mejor.
  webpack(config, { isServer, dev }) {
    if (dev || isServer) return config;

    const splitChunks = config.optimization.splitChunks ?? {};
    const cacheGroups = splitChunks.cacheGroups ?? {};

    config.optimization.splitChunks = {
      ...splitChunks,
      cacheGroups: {
        ...cacheGroups,
        // pdfjs-dist solo se carga al abrir el visor de la Biblioteca.
        pdfVendor: {
          test: /[\\/]node_modules[\\/]pdfjs-dist[\\/]/,
          name: "pdf-vendor",
          chunks: "all",
          priority: 40,
          enforce: true,
        },
        // Si en el futuro se incorpora Framer Motion, queda aislado.
        motionVendor: {
          test: /[\\/]node_modules[\\/](framer-motion|motion|@motionone)[\\/]/,
          name: "motion-vendor",
          chunks: "all",
          priority: 35,
          enforce: true,
        },
        // SDKs de IA en cliente (hoy la IA se resuelve en el backend).
        aiVendor: {
          test: /[\\/]node_modules[\\/](@google[\\/](generative-ai|genai)|@google-ai[\\/]generativelanguage|google-auth-library)[\\/]/,
          name: "ai-vendor",
          chunks: "all",
          priority: 30,
          enforce: true,
        },
      },
    };

    return config;
  },
};

export default nextConfig;
