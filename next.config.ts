import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Development only: let phones on the same Wi-Fi open the dev server
  // (e.g. http://192.168.0.101:3000). Without this, Next.js blocks the
  // page's scripts for other addresses, so buttons like PayPal never load.
  // Wildcards cover a new address if the router assigns a different one.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*"],
  // This folder is the project root (stops Next.js picking up a stray
  // package-lock.json from a parent folder).
  turbopack: { root: __dirname },
};

export default nextConfig;
