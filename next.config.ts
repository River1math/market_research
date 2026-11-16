import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // exceljs relies on Node streams; keep it out of the server bundle.
  serverExternalPackages: ["exceljs"],
};

export default nextConfig;
