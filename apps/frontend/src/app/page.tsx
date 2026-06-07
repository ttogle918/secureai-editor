import Link from 'next/link';
import LandingNav from '@/components/landing/LandingNav';

// 랜딩 페이지 — 서버 컴포넌트 (Nav만 클라이언트 분리)
export default function LandingPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#e8e8ee', fontFamily: 'var(--font-sans, system-ui)' }}>
      <LandingNav />
      <Hero />
      <FeaturesStrip />
      <PricingSection />
      <StatsBar />
      <Footer />
    </div>
  );
}

/* ── Hero ──────────────────────────────────────────────────── */
function Hero() {
  return (
    <section className="landing-hero">
      <div className="landing-hero__grid">

        {/* Left: copy */}
        <div className="landing-hero__copy">
          {/* Tag */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '5px 12px', borderRadius: 20,
            border: '1px solid rgba(234,88,12,0.4)',
            background: 'rgba(234,88,12,0.08)',
            fontSize: 12, color: '#ea580c', fontWeight: 600,
            letterSpacing: '0.05em', marginBottom: 24,
          }}>
            AI × Security × DevSecOps
          </div>

          {/* Headline */}
          <h1 style={{ fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 800, lineHeight: 1.15, letterSpacing: '-0.03em', margin: '0 0 20px' }}>
            바이브코딩 시대,<br />
            <span style={{ color: '#ea580c' }}>AI가 보안을 지킨다</span>
          </h1>

          {/* Subtitle */}
          <p style={{ fontSize: 16, lineHeight: 1.7, color: 'rgba(255,255,255,0.45)', margin: '0 0 12px' }}>
            로컬 코드 → GitHub → 배포 앱까지<br />
            전 과정을 3-Layer AI 에이전트가 자동 점검합니다.
          </p>

          {/* Free credits badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '5px 12px', borderRadius: 6,
            background: 'rgba(34,197,94,0.1)',
            border: '1px solid rgba(34,197,94,0.25)',
            fontSize: 12, color: '#22c55e', marginBottom: 32,
          }}>
            ✓ 회원가입 시 100 크레딧 무료 제공
          </div>

          {/* CTA buttons */}
          <div className="landing-hero__cta-group">
            <Link href="/register" style={{
              padding: '12px 28px', borderRadius: 8,
              background: '#ea580c', color: '#fff',
              fontSize: 15, fontWeight: 700, textDecoration: 'none',
              transition: 'background 0.15s',
            }}>
              무료로 시작하기
            </Link>
            <Link href="/editor" style={{
              padding: '12px 28px', borderRadius: 8,
              background: 'rgba(249,115,22,0.12)', color: '#f97316',
              border: '1px solid rgba(249,115,22,0.35)',
              fontSize: 15, fontWeight: 700, textDecoration: 'none',
            }}>
              Demo로 시작하기
            </Link>
            <Link href="/login" style={{
              padding: '12px 28px', borderRadius: 8,
              background: 'transparent', color: 'rgba(255,255,255,0.6)',
              border: '1px solid rgba(255,255,255,0.15)',
              fontSize: 15, fontWeight: 600, textDecoration: 'none',
            }}>
              로그인
            </Link>
          </div>
        </div>

        {/* Right: 3-Layer cards */}
        <div className="landing-hero__layers">
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 16 }}>
            3-Layer 보안 감사
          </div>

          <LayerCard level="L1" color="#ea580c" title="SAST — 로컬 코드 분석" desc="MCP Filesystem + Claude AI 문맥 분석" />
          <Arrow />
          <LayerCard level="L2" color="#f59e0b" title="GitHub 저장소 스캔" desc="PR 자동 리뷰 + 커밋 히스토리 시크릿 탐지" />
          <Arrow />
          <LayerCard level="L3" color="#e24b4b" title="DAST — 배포 앱 동적 분석" desc="Docker 샌드박스 실제 공격 시뮬레이션" />
        </div>
      </div>
    </section>
  );
}

function LayerCard({ level, color, title, desc }: { level: string; color: string; title: string; desc: string }) {
  return (
    <div style={{
      display: 'flex', gap: 16, alignItems: 'flex-start',
      padding: '16px 20px', borderRadius: 10,
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)',
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
        background: `${color}22`, border: `1px solid ${color}55`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 800, color, fontFamily: 'var(--font-mono)',
      }}>
        {level}
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#e8e8ee', marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', lineHeight: 1.5 }}>{desc}</div>
      </div>
    </div>
  );
}

function Arrow() {
  return (
    <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 18, margin: '6px 0' }}>↓</div>
  );
}

/* ── Features strip ────────────────────────────────────────── */
function FeaturesStrip() {
  const features = [
    { icon: '🔍', title: 'OWASP Top 10', desc: 'SQL Injection, XSS, SSRF 등 자동 탐지 및 CWE 매핑' },
    { icon: '⚡', title: '실시간 SSE 스트리밍', desc: '파일별 분석 진행 상황을 실시간으로 확인' },
    { icon: '🛠', title: 'AI 패치 추천', desc: '취약점 발견 즉시 수정 코드를 Claude가 제안' },
    { icon: '💬', title: '보안 전문가 채팅', desc: '분석 결과에 대한 질문을 AI 에이전트에게' },
  ];

  return (
    <section id="features" className="landing-features">
      <div className="landing-features__grid">
        {features.map(({ icon, title, desc }) => (
          <div key={title}>
            <div style={{ fontSize: 24, marginBottom: 12 }}>{icon}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#e8e8ee', marginBottom: 8 }}>{title}</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', lineHeight: 1.6 }}>{desc}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── Pricing section ────────────────────────────────────────── */
const PLANS = [
  {
    name: 'Free',
    displayName: '무료',
    price: '₩0',
    period: '/월',
    credits: 100,
    highlight: false,
    badge: null as string | null,
    models: ['Haiku (1 cr/파일)'],
    features: ['월 100 크레딧', '로컬 SAST 분석', 'GitHub 저장소 스캔', 'OWASP Top 10 자동 분류'],
    cta: '무료 시작',
    ctaHref: '/register',
  },
  {
    name: 'Pro',
    displayName: '프로',
    price: '₩15,000',
    period: '/월',
    credits: 2000,
    highlight: true,
    badge: '가장 인기',
    models: ['Haiku (1 cr/파일)', 'Sonnet (5 cr/파일)'],
    features: ['월 2,000 크레딧', 'BYOK 지원 (자기 키로 무제한)', '이메일 우선 지원', '패치 추천 무제한'],
    cta: '프로 시작',
    ctaHref: '/register?plan=pro',
  },
  {
    name: 'Team',
    displayName: '팀',
    price: '₩49,000',
    period: '/월',
    credits: 10000,
    highlight: false,
    badge: null,
    models: ['Haiku (1 cr/파일)', 'Sonnet (5 cr/파일)', 'Opus (20 cr/파일)'],
    features: ['월 10,000 크레딧', '팀 멤버 무제한', 'DAST 동적 분석', '전용 슬랙 채널 지원'],
    cta: '팀으로 시작',
    ctaHref: '/register?plan=team',
  },
] as const;

function PricingSection() {
  return (
    <section id="pricing" style={{ background: '#0a0a0a', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '72px 24px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', color: '#ea580c', marginBottom: 12, textTransform: 'uppercase' }}>
            가격 플랜
          </div>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 800, color: '#e8e8ee', margin: '0 0 16px', letterSpacing: '-0.025em' }}>
            필요한 만큼만 사용하세요
          </h2>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6, maxWidth: 480, margin: '0 auto' }}>
            크레딧 단위 과금 — 쓴 만큼만 결제합니다.<br />
            자체 API 키(BYOK)로 무제한 사용도 가능합니다.
          </p>
        </div>

        {/* Cards */}
        <div className="landing-pricing__grid">
          {PLANS.map((plan) => (
            <div key={plan.name} style={{
              position: 'relative',
              borderRadius: 16,
              padding: '32px 28px',
              background: plan.highlight ? 'rgba(234,88,12,0.06)' : 'rgba(255,255,255,0.02)',
              border: plan.highlight ? '1px solid rgba(234,88,12,0.4)' : '1px solid rgba(255,255,255,0.08)',
              boxShadow: plan.highlight ? '0 0 32px rgba(234,88,12,0.1)' : 'none',
            }}>
              {plan.badge && (
                <div style={{
                  position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                  padding: '4px 16px', borderRadius: 20,
                  background: '#ea580c', color: '#fff',
                  fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap',
                }}>
                  {plan.badge}
                </div>
              )}

              {/* Plan name + price */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: plan.highlight ? '#ea580c' : 'rgba(255,255,255,0.5)', marginBottom: 8 }}>
                  {plan.displayName}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={{ fontSize: 36, fontWeight: 800, color: '#e8e8ee', letterSpacing: '-0.03em' }}>{plan.price}</span>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>{plan.period}</span>
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 6 }}>
                  월 {plan.credits.toLocaleString()} 크레딧 포함
                </div>
              </div>

              {/* Model access */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                  사용 가능한 모델
                </div>
                {plan.models.map((m) => (
                  <div key={m} style={{ fontSize: 12, color: '#a3e6a3', marginBottom: 4, fontFamily: 'var(--font-mono)' }}>
                    ✓ {m}
                  </div>
                ))}
              </div>

              {/* Features */}
              <div style={{ marginBottom: 28 }}>
                {plan.features.map((f) => (
                  <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
                    <span style={{ color: '#ea580c', fontSize: 13, flexShrink: 0, marginTop: 1 }}>✓</span>
                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>{f}</span>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <Link href={plan.ctaHref} style={{
                display: 'block', textAlign: 'center',
                padding: '11px 20px', borderRadius: 8,
                background: plan.highlight ? '#ea580c' : 'rgba(255,255,255,0.06)',
                color: plan.highlight ? '#fff' : 'rgba(255,255,255,0.7)',
                border: plan.highlight ? 'none' : '1px solid rgba(255,255,255,0.12)',
                fontSize: 14, fontWeight: 700, textDecoration: 'none',
              }}>
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        {/* BYOK note */}
        <div style={{ textAlign: 'center', marginTop: 40, fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>
          Anthropic API 키를 직접 연결하면(BYOK) 크레딧 소모 없이 무제한 분석이 가능합니다.
        </div>
      </div>
    </section>
  );
}

/* ── Stats bar ─────────────────────────────────────────────── */
function StatsBar() {
  const stats = [
    { num: '3-Layer', label: '통합 커버리지' },
    { num: 'OWASP', label: 'Top 10 자동 매핑' },
    { num: 'Zero', label: '업로드 없이 로컬 분석' },
    { num: 'SSE', label: '실시간 결과 스트리밍' },
  ];

  return (
    <section style={{ background: '#141414', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="landing-stats__flex">
        {stats.map(({ num, label }) => (
          <div key={num} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#ea580c', fontFamily: 'var(--font-mono)', letterSpacing: '-0.02em' }}>{num}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 6 }}>{label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── Footer ────────────────────────────────────────────────── */
function Footer() {
  return (
    <footer style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '24px', textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>
      © 2026 SecureAI · 바이브코딩 시대의 보안 파트너
    </footer>
  );
}
