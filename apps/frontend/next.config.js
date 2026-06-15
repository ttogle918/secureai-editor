/** @type {import('next').NextConfig} */
const { withSentryConfig } = require('@sentry/nextjs');

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

// Sentry 설정 — NEXT_PUBLIC_SENTRY_DSN 미설정 시 withSentryConfig wrapper만 적용 (무해)
const sentryWebpackPluginOptions = {
  // Source map 업로드는 SENTRY_AUTH_TOKEN 있을 때만 동작
  silent: true,
  // Sentry CLI auth token이 없으면 빌드 실패 방지
  dryRun: !process.env.SENTRY_AUTH_TOKEN,
  // 소스맵을 Sentry 업로드 후 번들에서 제거 (보안)
  deleteSourcemapsAfterUpload: true,
};

module.exports = process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(nextConfig, sentryWebpackPluginOptions)
  : nextConfig;
