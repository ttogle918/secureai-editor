'use client';
// app/commit-scan/page.tsx
// 커밋 시크릿 스캔 결과 페이지 — MissingScreens.jsx CommitSecretScan 디자인 반영

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Download, RefreshCw, ArrowRight,
  Key, Pause, Check, Zap, AlertTriangle,
} from 'lucide-react';
import { PagoriLockup } from '@/components/brand/PagoriBrand';

// ─── Types ────────────────────────────────────────────────────────────────────

type ScanRange = 'last' | 'date' | 'commit' | 'all';
type Severity  = 'critical' | 'high' | 'medium' | 'low';

interface Secret {
  id: string;
  type: string;
  commit: string;
  author: string;
  date: string;
  file: string;
  line: number;
  value: string;
  severity: Severity;
  verified: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SEV_COLORS: Record<Severity, string> = {
  critical: 'var(--critical)',
  high:     'var(--high)',
  medium:   'var(--medium)',
  low:      'var(--low)',
};

const MOCK_SECRETS: Secret[] = [
  {
    id: 's1', type: 'AWS Access Key',
    commit: 'a3f1c0e', author: 'jimin', date: '5월 12일',
    file: 'lib/config.ts', line: 18,
    value: 'AKIA****************',
    severity: 'critical', verified: true,
  },
  {
    id: 's2', type: 'GitHub Personal Token',
    commit: 'e8b2d54', author: 'seohyun', date: '5월 10일',
    file: 'scripts/deploy.sh', line: 42,
    value: 'ghp_****************',
    severity: 'critical', verified: true,
  },
  {
    id: 's3', type: 'Database URL with password',
    commit: 'c4a7f29', author: 'jimin', date: '5월 8일',
    file: '.env.example', line: 5,
    value: 'postgresql://admin:p********@db.prod.com:5432/shop',
    severity: 'high', verified: false,
  },
  {
    id: 's4', type: 'Generic API Key',
    commit: 'b1f9c33', author: 'jimin', date: '5월 5일',
    file: 'lib/sentry.ts', line: 3,
    value: 'sk_live_****************',
    severity: 'high', verified: true,
  },
  {
    id: 's5', type: 'Slack Webhook URL',
    commit: '7d8e21a', author: 'kim', date: '5월 3일',
    file: 'docs/README.md', line: 127,
    value: 'https://hooks.slack.com/services/T0****/B0****/****',
    severity: 'medium', verified: false,
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-0.01em' }}>{title}</h3>
      {hint && <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{hint}</span>}
      <div style={{ flex: 1 }} />
      {action}
    </div>
  );
}

function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span className={`chip chip-${severity}`} style={{ height: 16, fontSize: 8 }}>
      {severity.toUpperCase()}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CommitScanPage() {
  const router = useRouter();

  const [scanRange,  setScanRange]  = useState<ScanRange>('date');
  const [fromDate,   setFromDate]   = useState('2026-05-01');
  const [toDate,     setToDate]     = useState('2026-05-17');

  const RANGE_OPTIONS: Array<{ id: ScanRange; label: string }> = [
    { id: 'last',   label: '최근 N개' },
    { id: 'date',   label: '날짜 범위' },
    { id: 'commit', label: '커밋 SHA 범위' },
    { id: 'all',    label: '전체 히스토리' },
  ];

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-0)' }}>

      {/* Header */}
      <div style={{
        height: 56, flexShrink: 0,
        background: 'var(--bg-1)',
        borderBottom: '1px solid var(--hairline)',
        display: 'flex', alignItems: 'center', padding: '0 24px', gap: 14,
      }}>
        <button
          onClick={() => router.back()}
          aria-label="뒤로가기"
          style={{
            width: 32, height: 32, borderRadius: 7,
            border: '1px solid var(--border)',
            background: 'var(--bg-2)', color: 'var(--text-secondary)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <ArrowLeft size={13} />
        </button>

        <PagoriLockup size={22} />

        <div style={{ width: 1, height: 18, background: 'var(--hairline)' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 6,
            background: 'var(--orange-dim)', color: 'var(--orange)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Key size={14} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>커밋 시크릿 스캔</div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
              shop-api · main · Git 히스토리에서 시크릿 탐지
            </div>
          </div>
        </div>

        <div style={{ flex: 1 }} />

        <button className="btn btn-sm">
          <Download size={11} />결과 내보내기
        </button>
        <button className="btn btn-sm btn-primary">
          <RefreshCw size={11} />재스캔
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: 'auto', background: 'var(--bg-0)' }}>
        <div style={{
          maxWidth: 1080, margin: '0 auto', padding: '24px 24px 48px',
          display: 'flex', flexDirection: 'column', gap: 20,
        }}>

          {/* 스캔 범위 */}
          <section>
            <SectionHeader title="스캔 범위" hint="커밋 범위를 선택하세요" />
            <div className="card" style={{ padding: 18, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>

              {/* 세그먼트 탭 */}
              <div style={{
                display: 'flex', height: 32, padding: 2,
                background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 7,
              }}>
                {RANGE_OPTIONS.map(o => (
                  <button
                    key={o.id}
                    onClick={() => setScanRange(o.id)}
                    style={{
                      padding: '0 14px', borderRadius: 5, border: 'none',
                      background: scanRange === o.id ? 'var(--bg-1)' : 'transparent',
                      color: scanRange === o.id ? 'var(--text-primary)' : 'var(--text-tertiary)',
                      fontSize: 11, fontWeight: 600, cursor: 'pointer',
                      boxShadow: scanRange === o.id ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
                    }}
                  >
                    {o.label}
                  </button>
                ))}
              </div>

              <div style={{ width: 1, height: 22, background: 'var(--hairline)' }} />

              {/* 날짜 입력 */}
              {scanRange === 'date' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-secondary)' }}>
                  <span>From</span>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={e => setFromDate(e.target.value)}
                    className="field"
                    style={{ height: 28, width: 130, fontSize: 11 }}
                  />
                  <ArrowRight size={11} color="var(--text-tertiary)" />
                  <input
                    type="date"
                    value={toDate}
                    onChange={e => setToDate(e.target.value)}
                    className="field"
                    style={{ height: 28, width: 130, fontSize: 11 }}
                  />
                </div>
              )}

              <div style={{ flex: 1 }} />
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>42</span>
                개 커밋이 범위에 포함됩니다
              </span>
            </div>
          </section>

          {/* 라이브 진행 카드 */}
          <div className="card" style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <span
                className="severity-dot"
                style={{
                  background: 'var(--orange)',
                  animation: 'pulse-dot 1.4s infinite',
                  width: 8, height: 8,
                }}
              />
              <span style={{ fontSize: 13, fontWeight: 700 }}>스캔 중</span>
              <span className="chip chip-orange" style={{ height: 18 }}>5개 시크릿 탐지</span>
              <div style={{ flex: 1 }} />
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                32 / 42 커밋 · 약 1분 남음
              </span>
              <button className="btn btn-sm btn-ghost" style={{ color: 'var(--text-tertiary)' }}>
                <Pause size={10} />일시정지
              </button>
            </div>

            <div className="progress-track" style={{ height: 4 }}>
              <div className="progress-fill" style={{ width: '76%' }} />
            </div>

            <div style={{ marginTop: 10, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>
              현재: <span style={{ color: 'var(--text-secondary)' }}>커밋 c4a7f29 · .env.example</span>
            </div>
          </div>

          {/* 탐지된 시크릿 테이블 */}
          <section>
            <SectionHeader
              title="탐지된 시크릿"
              hint={`${MOCK_SECRETS.length}개 — 모두 검토 후 처리 필요`}
              action={
                <div style={{ display: 'flex', gap: 6 }}>
                  <span className="chip chip-critical" style={{ height: 20 }}>CRITICAL 2</span>
                  <span className="chip chip-high"     style={{ height: 20 }}>HIGH 2</span>
                  <span className="chip chip-medium"   style={{ height: 20 }}>MEDIUM 1</span>
                  <span style={{ width: 1, alignSelf: 'stretch', background: 'var(--hairline)', margin: '0 2px' }} />
                  <span className="chip chip-low"  style={{ height: 20 }}>검증됨 3</span>
                  <span className="chip"           style={{ height: 20 }}>미검증 2</span>
                </div>
              }
            />

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {/* 테이블 헤더 */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '24px 1.4fr 1fr 1.6fr 1.6fr 1fr',
                gap: 14, padding: '10px 18px',
                fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
                color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)',
                background: 'var(--bg-2)',
                borderBottom: '1px solid var(--hairline)',
              }}>
                <span />
                <span>시크릿 유형</span>
                <span>커밋</span>
                <span>파일</span>
                <span>값 (마스킹됨)</span>
                <span style={{ textAlign: 'right' }}>액션</span>
              </div>

              {/* 시크릿 행 */}
              {MOCK_SECRETS.map((s, i) => (
                <div
                  key={s.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '24px 1.4fr 1fr 1.6fr 1.6fr 1fr',
                    gap: 14, padding: '14px 18px',
                    alignItems: 'center', fontSize: 12,
                    borderBottom: i === MOCK_SECRETS.length - 1 ? 'none' : '1px solid var(--hairline)',
                  }}
                >
                  {/* 심각도 dot */}
                  <span
                    className="severity-dot"
                    style={{
                      background: SEV_COLORS[s.severity],
                      boxShadow: s.severity === 'critical'
                        ? `0 0 6px ${SEV_COLORS[s.severity]}`
                        : 'none',
                      width: 8, height: 8,
                    }}
                  />

                  {/* 유형 */}
                  <div>
                    <div style={{ fontWeight: 600 }}>{s.type}</div>
                    <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                      <SeverityBadge severity={s.severity} />
                      {s.verified
                        ? <span className="chip chip-critical" style={{ height: 16, fontSize: 8 }}>API 검증됨</span>
                        : <span className="chip"              style={{ height: 16, fontSize: 8 }}>미검증</span>
                      }
                    </div>
                  </div>

                  {/* 커밋 */}
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                    <div>{s.commit}</div>
                    <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 2 }}>
                      {s.author} · {s.date}
                    </div>
                  </div>

                  {/* 파일 */}
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                    {s.file}
                    <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 2 }}>line {s.line}</div>
                  </div>

                  {/* 마스킹된 값 */}
                  <div style={{
                    padding: '6px 10px',
                    background: 'var(--bg-0)',
                    border: '1px solid var(--border)',
                    borderRadius: 5,
                    fontFamily: 'var(--font-mono)', fontSize: 10,
                    color: 'var(--text-secondary)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {s.value}
                  </div>

                  {/* 액션 버튼 */}
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                    <button
                      title="허용 목록 추가"
                      className="btn btn-sm btn-ghost"
                      style={{ height: 22, width: 22, padding: 0, justifyContent: 'center' }}
                      aria-label="허용 목록에 추가"
                    >
                      <Check size={10} />
                    </button>
                    <button
                      title="Git 정리 가이드"
                      className="btn btn-sm"
                      style={{
                        height: 22,
                        background: 'var(--critical-dim)',
                        borderColor: 'rgba(240,65,65,0.30)',
                        color: 'var(--critical)',
                      }}
                      aria-label="정리 가이드"
                    >
                      <Zap size={10} />정리
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 경고 박스 */}
          <div style={{
            padding: '14px 18px', borderRadius: 8,
            background: 'var(--critical-dim)', border: '1px solid rgba(240,65,65,0.30)',
            display: 'flex', gap: 12,
          }}>
            <AlertTriangle size={16} color="var(--critical)" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--text-primary)' }}>검증된 시크릿</strong>은 실제 외부 API와 통신이 가능합니다 — 즉시 발급사에서 폐기하세요.
              그 후 Git 히스토리에서 제거(rewrite)해야 완전히 사라집니다.
              <button
                className="btn btn-sm btn-ghost"
                style={{ height: 22, marginLeft: 8, color: 'var(--critical)' }}
              >
                전체 정리 가이드 보기 →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
