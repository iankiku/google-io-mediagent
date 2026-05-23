import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const frontendRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  output: "standalone",
  // Monorepo has a root-level lockfile; pin Turbopack to this app folder to avoid wrong workspace root inference.
  turbopack: {
    root: frontendRoot,
  },
};

export default nextConfig;
