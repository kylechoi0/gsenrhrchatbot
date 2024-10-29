/** @type {import('next').NextConfig} */
const nextConfig = {
  productionBrowserSourceMaps: false, // enable browser source map generation during the production build
  // Configure pageExtensions to include md and mdx
  pageExtensions: ['ts', 'tsx', 'js', 'jsx', 'md', 'mdx'],
  experimental: {
    // appDir: true,
    serverActions: {
      timeout: 300000, // 5분
    },
  },
  // fix all before production. Now it slow the develop speed.
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // https://nextjs.org/docs/api-reference/next.config.js/ignoring-typescript-errors
    ignoreBuildErrors: true,
  },
}

module.exports = {
  ...nextConfig,
  experimental: {
    serverActions: {
      timeout: 300000, // 5분
    },
  },
  // Pro plan에서 제공하는 최대 메모리 활용
  functions: {
    memory: 1024, // 1GB 메모리 할당
    maxDuration: 300, // 5분
  },
}
