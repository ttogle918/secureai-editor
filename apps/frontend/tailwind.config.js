/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx}',
    './src/components/**/*.{js,ts,jsx,tsx}',
    './src/app/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    // UI/UX REVISIONS.md §2 — 4개 breakpoint 명시
    screens: {
      sm:  '375px',   // 모바일
      md:  '768px',   // 태블릿 (drawer 사이드바)
      lg:  '1024px',  // 데스크톱
      xl:  '1440px',  // 와이드 (max-width 고려)
    },
    extend: {
      colors: {
        // SecureAI 다크 팔레트
        bg: {
          0: '#080809',
          1: '#0d0d0f',
          2: '#111114',
          3: '#161619',
          4: '#1c1c20',
        },
        orange: {
          DEFAULT: '#f97316',
          dim:     'rgba(249,115,22,0.12)',
        },
        red: {
          vuln: '#f04141',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'var(--font-mono)', 'Consolas', 'monospace'],
        sans: ['Space Grotesk', 'var(--font-sans)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
