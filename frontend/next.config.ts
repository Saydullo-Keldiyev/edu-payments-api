import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The Docker image sets NEXT_OUTPUT=standalone to get a self-contained server.js;
  // local `npm run build` / `npm start` keep the default output.
  ...(process.env.NEXT_OUTPUT === 'standalone' ? { output: 'standalone' as const } : {}),
};

export default nextConfig;
