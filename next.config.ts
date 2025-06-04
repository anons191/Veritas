import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /** other config options … */
  webpack(config) {
    // 👇 turn on async WASM so tiktoken’s .wasm file is accepted
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };

    return config;
  },
};

export default nextConfig;

