/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@hermes/shared", "@hermes/memory"],
};

export default nextConfig;

