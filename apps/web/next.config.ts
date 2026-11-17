import type { NextConfig } from 'next';

const config: NextConfig = {
  // Workspace packages ship TypeScript source.
  transpilePackages: ['@notice-exorcist/duty-engine', '@notice-exorcist/notice-extract'],
};

export default config;
