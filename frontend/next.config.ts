import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["admin.echosphere.systems"],
  reactCompiler: true,
};

export default nextConfig;
