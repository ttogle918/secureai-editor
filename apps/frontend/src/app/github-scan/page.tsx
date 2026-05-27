'use client';
// app/github-scan/page.tsx
// GitHub 레포 스캔 설정 페이지 — MissingScreens.jsx GithubScanFlow 디자인 반영

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Settings, Search, Star, GitBranch,
  Sparkles, X, Plus, Play, Code, History,
  Cpu, Key, Zap,
} from 'lucide-react';
import { PagoriLockup } from '@/components/brand/PagoriBrand';

// ─── Types ────────────────────────────────────────────────────────────────────

type AnalysisModel = 'haiku' | 'sonnet' | 'opus';
type ScanDepth = 'fast' | 'full';

interface Repo {
  name: string;
  desc: string;
  stars: number;
  lang: string;
}

interface Branch {
  name: string;
  head: string;
  commits: number;
}

interface PipelineOption {
  id: string;
  label: string;
  desc: string;
  color: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const REPOS: Repo[] = [
  { name: 'jimin/shop-api',    desc: 'Spring Boot · TypeScript', stars: 12, lang: 'TypeScript' },
  { name: 'jimin/shop-admin',  desc: 'Next.js dashboard',        stars: 4,  lang: 'TypeScript' },
  { name: 'jimin/shop-mobile', desc: 'React Native',             stars: 2,  lang: 'TypeScript' },
];

const BRANCHES: Branch[] = [
  { name: 'main',          head: '2분 전 · jimin',    commits: 142 },
  { name: 'develop',       head: '어제 · seohyun',    commits: 158 },
  { name: 'feature/oauth', head: '3일 전 · seohyun',  commits: 12  },
];

const FILE_FILTERS = [
  { label: 'src/**/*.ts',   exclude: false },
  { label: 'src/**/*.tsx',  exclude: false },
  { label: 'api/**',        exclude: false },
  { label: '!node_modules', exclude: true  },
  { label: '!*.test.ts',    exclude: true  },
  { label: '!dist/**',      exclude: true  },
];

const PIPELINE_OPTIONS: PipelineOption[] = [
  { id: 'sast',  label: 'SAST',    desc: '정적 분석 · 28파일 · 3분',         color: 'var(--low)'    },
  { id: 'dast',  label: 'DAST',    desc: '동적 분석 · 도메인 검증 필요',       color: 'var(--orange)' },
  { id: 'patch', label: 'AI 패치', desc: '자동 수정 제안 생성',               color: 'var(--tag-1)'  },
];

const MODELS: Array<{
  id: AnalysisModel;
  label: string;
  sub: string;
  desc: string;
  time: string;
  recommended?: boolean;
}> = [
  { id: 'haiku',  label: 'Haiku 4.5',  sub: '빠름 · 28파일 · 약 140 크레딧',   desc: '대부분의 패턴 탐지',         time: '3-5분',   recommended: true },
  { id: 'sonnet', label: 'Sonnet 4.5', sub: '균형 · 28파일 · 약 420 크레딧',   desc: '복잡한 호출 체인 추적',       time: '8-12분'   },
  { id: 'opus',   label: 'Opus 4',     sub: '정확 · 28파일 · 약 2,100 크레딧', desc: '드문 패턴까지 추론',           time: '20-30분'  },
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

function Toggle({ active, color }: { active: boolean; color: string }) {
  return (
    <span style={{
      width: 28, height: 16, borderRadius: 8,
      background: active ? color : 'var(--bg-3)',
      border: active ? 'none' : '1px solid var(--border-2)',
      position: 'relative', flexShrink: 0,
      display: 'inline-block',
    }}>
      <span style={{
        position: 'absolute', top: 2, left: active ? 13 : 1,
        width: 12, height: 12, borderRadius: 6,
        background: '#fff',
        transition: 'left 0.15s',
      }} />
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GithubScanPage() {
  const router = useRouter();

  const [selectedRepo,   setSelectedRepo]   = useState(REPOS[0].name);
  const [selectedBranch, setSelectedBranch] = useState('main');
  const [searchQuery,    setSearchQuery]     = useState('shop');
  const [enabledPipelines, setEnabledPipelines] = useState<Set<string>>(
    new Set(['sast', 'dast', 'patch']),
  );
  const [scanEnabled,  setScanEnabled]  = useState(true);
  const [scanDepth,    setScanDepth]    = useState<ScanDepth>('full');
  const [model,        setModel]        = useState<AnalysisModel>('haiku');

  const filteredRepos = REPOS.filter(r =>
    searchQuery === '' || r.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const togglePipeline = (id: string) => {
    setEnabledPipelines(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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
            <GitBranch size={14} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>GitHub 레포 스캔</div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
              새 레포를 연동하고 스캔을 시작합니다
            </div>
          </div>
        </div>

        <div style={{ flex: 1 }} />

        <button className="btn btn-sm btn-ghost" style={{ color: 'var(--text-tertiary)' }}>
          나중에
        </button>
        <button className="btn btn-sm">
          <Settings size={11} />Webhook 설정
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: 'auto', background: 'var(--bg-0)' }}>
        <div style={{
          maxWidth: 880, margin: '0 auto', padding: '32px 32px 56px',
          display: 'flex', flexDirection: 'column', gap: 24,
        }}>

          {/* GitHub 연동 상태 카드 */}
          <div className="card" style={{
            padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
            background: 'linear-gradient(90deg, rgba(34,197,94,0.06), transparent)',
            border: '1px solid rgba(34,197,94,0.20)',
          }}>
            <GitBranch size={20} color="var(--text-primary)" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700 }}>GitHub 연동됨</div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                jimin@github.com · 12개 레포 접근 가능
              </div>
            </div>
            <span className="chip chip-low">
              <span className="severity-dot" style={{ background: 'var(--low)' }} />
              연결됨
            </span>
            <button className="btn btn-sm btn-ghost">
              <Settings size={11} />설정
            </button>
          </div>

          {/* 레포 + 브랜치 선택 */}
          {/* API: GET /api/v1/github/repos — GitHub OAuth 연동 레포 목록 */}
          <section>
            <SectionHeader title="레포 선택" hint="OAuth로 연동된 12개 중에서 선택" />
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>

              {/* 레포 피커 */}
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                  borderBottom: '1px solid var(--hairline)',
                }}>
                  <Search size={12} color="var(--text-tertiary)" />
                  <input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="레포 검색..."
                    style={{
                      flex: 1, background: 'transparent', border: 'none', outline: 'none',
                      fontSize: 12, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)',
                    }}
                  />
                </div>
                {filteredRepos.map((r, i) => {
                  const active = selectedRepo === r.name;
                  return (
                    <div
                      key={r.name}
                      onClick={() => setSelectedRepo(r.name)}
                      style={{
                        padding: '10px 14px',
                        display: 'flex', alignItems: 'center', gap: 10,
                        borderBottom: i < filteredRepos.length - 1 ? '1px solid var(--hairline)' : 'none',
                        background: active ? 'var(--orange-dim)' : 'transparent',
                        borderLeft: active ? '2px solid var(--orange-2)' : '2px solid transparent',
                        cursor: 'pointer',
                      }}
                    >
                      <GitBranch size={13} color={active ? 'var(--orange)' : 'var(--text-secondary)'} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{r.name}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{r.desc}</div>
                      </div>
                      <span className="chip" style={{ height: 18, fontSize: 9 }}>{r.lang}</span>
                      <span style={{ fontSize: 10, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Star size={9} />{r.stars}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* 브랜치 피커 */}
              {/* API: GET /api/v1/github/repos/{owner}/{repo}/branches */}
              <div className="card" style={{ padding: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>브랜치</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {BRANCHES.map(b => {
                    const active = selectedBranch === b.name;
                    return (
                      <div
                        key={b.name}
                        onClick={() => setSelectedBranch(b.name)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '6px 8px', borderRadius: 5,
                          background: active ? 'var(--orange-dim)' : 'transparent',
                          cursor: 'pointer',
                        }}
                      >
                        <GitBranch size={11} color={active ? 'var(--orange)' : 'var(--text-tertiary)'} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{b.name}</div>
                          <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 2 }}>{b.head}</div>
                        </div>
                        <span style={{ fontSize: 9, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                          {b.commits}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          {/* 파일 필터 */}
          <section>
            <SectionHeader
              title="파일 필터"
              hint="AI 자동 추천 — 언제든 수정 가능"
              action={
                <span className="chip chip-orange" style={{ height: 20 }}>
                  <Sparkles size={9} />AI 추천
                </span>
              }
            />
            <div className="card" style={{
              padding: 14, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center',
            }}>
              {FILE_FILTERS.map((f, i) => (
                <span
                  key={i}
                  className={f.exclude ? 'chip' : 'chip chip-orange'}
                  style={{
                    cursor: 'default', height: 26, padding: '0 4px 0 10px', fontSize: 11,
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    ...(f.exclude ? { color: 'var(--text-tertiary)', borderColor: 'var(--border)' } : {}),
                  }}
                >
                  <Sparkles size={8} color={f.exclude ? 'var(--text-tertiary)' : 'var(--orange)'} />
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{f.label}</span>
                  <X size={10} color="var(--text-tertiary)" />
                </span>
              ))}
              <button style={{
                height: 26, padding: '0 10px',
                background: 'transparent', border: '1px dashed var(--border-2)', borderRadius: 4,
                color: 'var(--text-secondary)', cursor: 'pointer',
                fontSize: 11, fontWeight: 600,
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}>
                <Plus size={10} />필터 추가
              </button>
            </div>
          </section>

          {/* 분석 파이프라인 */}
          <section>
            <SectionHeader title="분석 파이프라인" hint="모듈 선택 — 비활성도 가능" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {PIPELINE_OPTIONS.map(p => {
                const active = enabledPipelines.has(p.id);
                return (
                  <div
                    key={p.id}
                    onClick={() => togglePipeline(p.id)}
                    style={{
                      padding: 14, borderRadius: 8,
                      background: active ? 'var(--bg-2)' : 'var(--bg-3)',
                      border: `1px solid ${active ? p.color : 'var(--border)'}`,
                      opacity: active ? 1 : 0.6,
                      display: 'flex', alignItems: 'center', gap: 10,
                      cursor: 'pointer',
                    }}
                  >
                    <span className="severity-dot" style={{ background: p.color, width: 8, height: 8 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', color: p.color, fontFamily: 'var(--font-mono)' }}>
                        {p.label}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 3 }}>{p.desc}</div>
                    </div>
                    <Toggle active={active} color={p.color} />
                  </div>
                );
              })}
            </div>
          </section>

          {/* 커밋 시크릿 스캔 */}
          <section>
            <SectionHeader title="커밋 시크릿 스캔" hint="Git 히스토리에서 노출된 시크릿 탐지" />
            <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Key size={16} color="var(--orange)" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>커밋 스캔 실행</div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>스캔 후 별도 화면에서 결과 검토</div>
                </div>
                <button
                  onClick={() => setScanEnabled(!scanEnabled)}
                  aria-label={scanEnabled ? '커밋 스캔 끄기' : '커밋 스캔 켜기'}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  <span style={{
                    width: 32, height: 18, borderRadius: 9, display: 'inline-block',
                    background: scanEnabled ? 'var(--orange-2)' : 'var(--bg-3)',
                    border: scanEnabled ? 'none' : '1px solid var(--border-2)',
                    position: 'relative',
                  }}>
                    <span style={{
                      position: 'absolute', top: 2, left: scanEnabled ? 16 : 2,
                      width: 14, height: 14, borderRadius: 7, background: '#fff',
                      transition: 'left 0.15s',
                    }} />
                  </span>
                </button>
              </div>

              {/* 스캔 깊이 라디오 카드 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {([
                  {
                    id: 'fast' as ScanDepth,
                    label: '빠른 스캔',
                    desc: '유출 확률이 높은 파일만 검사',
                    hint: '.env, config, secrets/, *.key',
                    credit: '약 8 크레딧',
                    time: '~30초',
                  },
                  {
                    id: 'full' as ScanDepth,
                    label: '전수 검사',
                    desc: '모든 커밋의 모든 파일을 검사\n과거 시크릿 누락 없음',
                    hint: '',
                    credit: '약 42 크레딧',
                    time: '~3분',
                    recommended: true,
                  },
                ] as const).map(opt => {
                  const active = scanDepth === opt.id;
                  return (
                    <label
                      key={opt.id}
                      onClick={() => setScanDepth(opt.id)}
                      style={{
                        padding: 12, borderRadius: 8,
                        background: active ? 'var(--orange-dim)' : 'var(--bg-3)',
                        border: `1px solid ${active ? 'rgba(249,115,22,0.40)' : 'var(--border)'}`,
                        cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 10,
                        outline: active ? '2px solid var(--orange-2)' : 'none',
                        outlineOffset: -1,
                      }}
                    >
                      <span style={{
                        width: 14, height: 14, borderRadius: 7, marginTop: 2,
                        border: `1.5px solid ${active ? 'var(--orange-2)' : 'var(--border-3)'}`,
                        background: active ? 'var(--orange-2)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        {active && <span style={{ width: 6, height: 6, borderRadius: 3, background: '#fff' }} />}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                          {opt.label}
                          {'recommended' in opt && opt.recommended && (
                            <span className="chip chip-orange" style={{ height: 16, fontSize: 8 }}>권장</span>
                          )}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 3, lineHeight: 1.5, whiteSpace: 'pre-line' }}>
                          {opt.desc}
                        </div>
                        {opt.hint && (
                          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                            {opt.hint}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                          <span className={`chip ${active ? 'chip-orange' : ''}`} style={{ height: 18, fontSize: 9 }}>
                            {opt.credit}
                          </span>
                          <span className="chip" style={{ height: 18, fontSize: 9 }}>{opt.time}</span>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          </section>

          {/* AI 모델 선택 */}
          <section>
            <SectionHeader
              title="AI 분석 모델"
              hint="분석 정확도와 크레딧 비용은 모델에 따라 달라집니다"
            />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {MODELS.map(m => {
                const active = model === m.id;
                return (
                  <label
                    key={m.id}
                    onClick={() => setModel(m.id)}
                    style={{
                      textAlign: 'left', padding: 14, borderRadius: 8,
                      background: active ? 'var(--orange-dim)' : 'var(--bg-3)',
                      border: `1px solid ${active ? 'rgba(249,115,22,0.45)' : 'var(--border)'}`,
                      cursor: 'pointer', position: 'relative',
                      display: 'flex', flexDirection: 'column', gap: 4,
                      outline: active ? '1.5px solid var(--orange-2)' : 'none',
                      outlineOffset: -1,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span style={{
                        width: 14, height: 14, borderRadius: 7,
                        border: `1.5px solid ${active ? 'var(--orange-2)' : 'var(--border-3)'}`,
                        background: active ? 'var(--orange-2)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        {active && <span style={{ width: 6, height: 6, borderRadius: 3, background: '#fff' }} />}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{m.label}</span>
                      {m.recommended && (
                        <span style={{ marginLeft: 'auto', fontSize: 8, fontWeight: 700, color: 'var(--orange)', letterSpacing: '0.05em', fontFamily: 'var(--font-mono)' }}>
                          추천
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{m.sub}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>{m.desc}</div>
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--hairline)', display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                      <span style={{ color: 'var(--text-tertiary)' }}>예상 소요</span>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{m.time}</span>
                    </div>
                  </label>
                );
              })}
            </div>
          </section>

          {/* 예상 분석 요약 카드 */}
          <div className="card" style={{
            padding: 16, background: 'var(--bg-2)',
            display: 'flex', alignItems: 'center', gap: 16,
            border: '1px solid var(--orange)',
          }}>
            <Cpu size={22} color="var(--orange)" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>예상 분석</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>
                <span style={{ fontFamily: 'var(--font-mono)' }}>28</span>개 파일 · 약{' '}
                <span style={{ fontFamily: 'var(--font-mono)' }}>140</span> 크레딧 · {' '}
                <span style={{ fontFamily: 'var(--font-mono)' }}>3-5</span>분
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>잔여 크레딧</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--low)', fontFamily: 'var(--font-mono)' }}>
                1,240
              </div>
            </div>
          </div>

          {/* 푸터 CTA */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => router.back()}
              className="btn btn-ghost"
              style={{ color: 'var(--text-tertiary)' }}
            >
              취소
            </button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn">
                <History size={11} />스캔 이력
              </button>
              <button
                title="스캔 없이 클론 후 에디터로 이동"
                className="btn btn-lg"
              >
                <Code size={12} />에디터로 (스킵)
              </button>
              {/* API: POST /api/v1/projects (레포 등록) → POST /api/v1/analysis/sessions (분석 시작) */}
              <button className="btn btn-primary btn-lg">
                <Play size={12} />스캔 시작
              </button>
            </div>
          </div>

          <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'right' }}>
            <strong style={{ color: 'var(--text-secondary)' }}>스킵</strong> 시 레포가 클론되어 에디터에서 코드만 확인할 수 있고, 분석은 언제든 다시 시작할 수 있어요.
          </div>
        </div>
      </div>
    </div>
  );
}
