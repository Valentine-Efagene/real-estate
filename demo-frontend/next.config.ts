import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    domains: ['localhost', 'qshelter-staging-uploads-898751738669.s3.us-east-1.amazonaws.com'],
  },
};

export default nextConfig;
