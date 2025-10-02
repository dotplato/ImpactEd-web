import type { NextConfig } from "next";
/** @type {import('next').NextConfig} */

const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000'],
    },
  },
  images: {
    domains: ['your-supabase-project.supabase.co'],
  },
  webpack: (config: { resolve: { alias: { canvas: boolean; }; }; }) => {
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
