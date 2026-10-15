import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg"],
  images: {
    formats: ["image/avif", "image/webp"],
  },
  async redirects() {
    return [
      { source: "/listen", destination: "/music", permanent: false },
      { source: "/support", destination: "/join", permanent: true },
    ];
  },
};

export default nextConfig;
