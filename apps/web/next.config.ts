import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  transpilePackages: ["@fab-dashboard/scheduling"],
  experimental: {
    // Proxy (this Next.js version's renamed Middleware) buffers the entire
    // request body in memory to allow re-reading it in both proxy.ts and the
    // route handler, capped at 10MB by default — larger GDS uploads were
    // silently truncated mid-multipart-boundary, corrupting the form data.
    // Match nginx's client_max_body_size (50m) so this isn't the tighter cap.
    proxyClientMaxBodySize: "50mb",
  },
};

export default nextConfig;
