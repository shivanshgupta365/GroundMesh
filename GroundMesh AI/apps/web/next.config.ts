import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  transpilePackages: ["@groundmesh/core", "@groundmesh/runtime"],
  serverExternalPackages: ["@electric-sql/pglite", "postgres"],
  turbopack: {
    root: path.resolve(process.cwd(), "../.."),
  },
};

export default nextConfig;
