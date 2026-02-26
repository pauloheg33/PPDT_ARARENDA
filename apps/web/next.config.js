/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  // Para GitHub Pages com repo name como base path, descomente:
  // basePath: '/PPDT_ARARENDA',
  // assetPrefix: '/PPDT_ARARENDA/',
};

module.exports = nextConfig;
