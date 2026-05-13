/** @type {import('next').NextConfig} */

// NEXT_OUTPUT=export → Tauri 정적 빌드
// 기본값(standalone) → Docker 웹 배포
const isDesktopBuild = process.env.NEXT_OUTPUT === 'export';

const nextConfig = {
  output: isDesktopBuild ? 'export' : 'standalone',

  // Tauri 빌드: Image Optimization은 서버가 없어 동작 불가
  images: isDesktopBuild ? { unoptimized: true } : {},

  webpack: (config) => {
    config.resolve.alias = { ...config.resolve.alias };
    return config;
  },
};

module.exports = nextConfig;
