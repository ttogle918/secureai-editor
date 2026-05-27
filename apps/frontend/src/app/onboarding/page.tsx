'use client';
// app/onboarding/page.tsx
// 4-step onboarding flow:
//   Step 0: 워크스페이스 모드 선택 (개발자 vs 보안 관리자)  ← V4 신규
//   Step 1: 프로젝트 생성
//   Step 2: 분석 소스
//   Step 3: 첫 분석 시작
// 레퍼런스: frontend-refactoring/components/Onboarding.jsx
//           frontend-refactoring/components/WorkspaceMode.jsx

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Cpu, Globe, LayoutDashboard, Package, Layers, CheckCircle2,
  ArrowRight, ArrowLeft, FolderOpen, Github, Upload,
  Users, Mail, Lock, ChevronDown, ChevronRight,
  Play, Code, Plus, X, Sparkles, AlertTriangle, Filter,
  Code2, Shield, Terminal, PieChart, FileText, Download, Check,
} from 'lucide-react';
import { PagoriLockup } from '@/components/brand/PagoriBrand';
import { apiClient } from '@/lib/api/client';
import { useSecureStore, type WorkspaceMode } from '@/store/useSecureStore';

// ─── Types ──────────────────────────────────────────────────────────────────

type ProjectType = 'server' | 'web' | 'mobile' | 'desktop' | 'embedded' | 'etc';
type Visibility  = 'private' | 'team';
type AnalysisModel = 'haiku' | 'sonnet' | 'opus';
type SourceType  = 'github' | 'local' | 'upload';

interface InviteEntry {
  value: string;
  type: 'email' | 'handle';
}

interface Step1State {
  name: string;
  description: string;
  projectType: ProjectType;
  visibility: Visibility;
  inviteInput: string;
  invites: InviteEntry[];
  model: AnalysisModel;
}

interface Step2State {
  source: SourceType;
  githubRepo: string;
  githubBranch: string;
  filters: string[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PROJECT_TYPES: Array<{ id: ProjectType; icon: React.ReactNode; label: string; sub: string }> = [
  { id: 'server',   icon: <Cpu size={13} />,             label: '서버 / API',     sub: 'Spring · Node · FastAPI' },
  { id: 'web',      icon: <Globe size={13} />,            label: '웹 프론트',      sub: 'React · Vue · Svelte' },
  { id: 'mobile',   icon: <LayoutDashboard size={13} />,  label: '모바일 앱',      sub: 'Android · iOS · Flutter' },
  { id: 'desktop',  icon: <LayoutDashboard size={13} />,  label: '데스크탑 SW',    sub: 'Tauri · Electron · WinForms' },
  { id: 'embedded', icon: <Layers size={13} />,           label: '임베디드 / IoT', sub: 'C · C++ · Rust · MCU' },
  { id: 'etc',      icon: <Package size={13} />,          label: '기타',            sub: 'CLI · 라이브러리 등' },
];

const MODELS: Array<{ id: AnalysisModel; label: string; sub: string; recommended?: boolean }> = [
  { id: 'haiku',  label: 'Haiku 4.5',  sub: '빠름 · 5크레딧/파일',   recommended: true },
  { id: 'sonnet', label: 'Sonnet 4.6', sub: '균형 · 15크레딧/파일' },
  { id: 'opus',   label: 'Opus 4',     sub: '정확 · 75크레딧/파일' },
];

const DEFAULT_FILTERS = [
  'src/**/*.ts',
  'src/**/*.tsx',
  'api/**',
  '!node_modules',
  '!*.test.ts',
  '!dist/**',
];

// ─── WorkspaceMode 정의 ─────────────────────────────────────────────────────

const WORKSPACE_MODES = {
  DEVELOPER: {
    id: 'DEVELOPER' as WorkspaceMode,
    label: '개발자 모드',
    sub: 'DEVELOPER',
    accent: 'var(--orange)',
    accent2: 'var(--orange-2)',
    accentDim: 'var(--orange-dim)',
    accentBorder: 'rgba(249,115,22,0.45)',
    desc: '코드를 직접 수정하고 패치를 적용하는 IDE 중심 워크플로우',
    bullets: [
      { icon: <Code2 size={11} />,    text: 'Monaco 에디터 · 실시간 인라인 패치 적용' },
      { icon: <Sparkles size={11} />, text: 'AI 채팅 · @ 멘션으로 취약점 컨텍스트 주입' },
      { icon: <Terminal size={11} />, text: 'DAST 시뮬레이터 · 익스플로잇 검증' },
      { icon: <Cpu size={11} />,      text: 'API 호출 흐름 추적 (Controller → Service → Repo)' },
    ],
    cta: '에디터로 시작',
    permission: '읽기/쓰기',
  },
  SECURITY_MANAGER: {
    id: 'SECURITY_MANAGER' as WorkspaceMode,
    label: '보안 관리자 모드',
    sub: 'SECURITY MANAGER',
    accent: 'var(--tag-1)',
    accent2: '#6c75dd',
    accentDim: 'rgba(129,140,248,0.14)',
    accentBorder: 'rgba(129,140,248,0.50)',
    desc: '대시보드와 리포트 중심 — 코드는 읽기 전용으로만 열람',
    bullets: [
      { icon: <PieChart size={11} />,  text: 'SLA · 보안 점수 · 추세 차트 위젯' },
      { icon: <FileText size={11} />,  text: 'ISO 27001 · NIST CSF 컴플라이언스 매트릭스' },
      { icon: <Lock size={11} />,      text: '읽기 전용 코드 뷰어 (편집 불가)' },
      { icon: <Download size={11} />,  text: '경영진/감사 리포트 PDF 자동 생성' },
    ],
    cta: '대시보드로 시작',
    permission: '읽기 전용',
  },
} as const;

// ─── StepIndicator ──────────────────────────────────────────────────────────
// Step 0: 워크스페이스 모드, Step 1: 프로젝트 생성, Step 2: 분석 소스, Step 3: 첫 분석 시작

const STEPS = ['워크스페이스 모드', '프로젝트 생성', '분석 소스', '첫 분석 시작'];

function StepIndicator({ current }: { current: number }) {
  // current는 0-indexed (0=모드선택, 1=프로젝트, 2=소스, 3=분석시작)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 40 }}>
      {STEPS.map((label, i) => {
        const isActive = i === current;
        const isDone   = i < current;
        const color = isDone ? 'var(--low)' : isActive ? 'var(--orange)' : 'var(--text-tertiary)';

        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : undefined }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                background: isActive ? 'var(--orange-2)' : isDone ? 'var(--low)' : 'var(--bg-3)',
                color: isActive || isDone ? '#fff' : 'var(--text-tertiary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)',
                border: isActive ? 'none' : `1px solid ${isDone ? 'var(--low)' : 'var(--border)'}`,
                boxShadow: isActive ? '0 0 0 4px var(--orange-dim)' : 'none',
              }}>
                {isDone ? <CheckCircle2 size={11} /> : i + 1}
              </div>
              <div style={{ flexShrink: 0 }}>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)' }}>STEP {i + 1}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: isActive ? 'var(--text-primary)' : color }}>{label}</div>
              </div>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{
                flex: 1, height: 1, margin: '0 12px',
                background: isDone ? 'var(--low)' : 'var(--border)',
                minWidth: 24,
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Step 0: 워크스페이스 모드 선택 ─────────────────────────────────────────
// 레퍼런스: WorkspaceMode.jsx → WorkspaceModeCards + OnboardStep0

function Step0({
  selected,
  onSelect,
  onNext,
  onSkip,
}: {
  selected: WorkspaceMode;
  onSelect: (m: WorkspaceMode) => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  const [hovered, setHovered] = useState<WorkspaceMode | null>(null);

  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 10 }}>
        어떻게 사용하시나요?
      </h1>
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 32 }}>
        역할에 맞는 워크스페이스를 선택하세요.{' '}
        <strong>나중에 설정 → 워크스페이스</strong>에서 언제든 변경할 수 있습니다.<br />
        이 선택은 랜딩 화면, 사이드바 메뉴, 그리고 코드 편집 권한에 영향을 줍니다.
      </p>

      {/* Mode cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
        {Object.values(WORKSPACE_MODES).map((m) => {
          const isSelected = selected === m.id;
          const isHover    = hovered === m.id;

          return (
            <button
              key={m.id}
              onClick={() => onSelect(m.id)}
              onMouseEnter={() => setHovered(m.id)}
              onMouseLeave={() => setHovered(null)}
              style={{
                position: 'relative',
                textAlign: 'left',
                padding: 22,
                borderRadius: 12,
                background: isSelected ? m.accentDim : 'var(--bg-2)',
                border: `1px solid ${isSelected ? m.accentBorder : isHover ? 'var(--border-3, var(--border))' : 'var(--border)'}`,
                outline: isSelected ? `2px solid ${m.accent2}` : 'none',
                outlineOffset: -1,
                cursor: 'pointer',
                transition: 'transform .15s ease, background .15s, border-color .15s',
                transform: isHover && !isSelected ? 'translateY(-2px)' : 'none',
                boxShadow: isHover && !isSelected ? '0 8px 24px rgba(0,0,0,0.4)' : 'none',
              }}
            >
              {/* 선택된 경우 체크 뱃지 */}
              {isSelected && (
                <div style={{
                  position: 'absolute', top: 14, right: 14,
                  width: 22, height: 22, borderRadius: 11,
                  background: m.accent2, color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: `0 4px 12px ${m.accent}66`,
                }}>
                  <Check size={12} strokeWidth={3} />
                </div>
              )}

              {/* 헤더: 아이콘 + 타이틀 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                  background: isSelected ? m.accent2 : 'var(--bg-3)',
                  color: isSelected ? '#fff' : m.accent,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background .15s, color .15s',
                }}>
                  {m.id === 'DEVELOPER' ? <Code2 size={20} /> : <Shield size={20} />}
                </div>
                <div>
                  <div style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: '0.10em',
                    color: m.accent, fontFamily: 'var(--font-mono)', marginBottom: 4,
                  }}>
                    {m.sub}
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>
                    {m.label}
                  </div>
                </div>
              </div>

              {/* 설명 */}
              <div style={{
                fontSize: 12, color: 'var(--text-secondary)',
                lineHeight: 1.6, marginBottom: 14,
              }}>
                {m.desc}
              </div>

              {/* 기능 목록 */}
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14, padding: 0 }}>
                {m.bullets.map((b, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{
                      width: 22, height: 22, borderRadius: 5, flexShrink: 0,
                      background: isSelected ? 'var(--bg-1)' : 'var(--bg-3)',
                      color: m.accent,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {b.icon}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {b.text}
                    </span>
                  </li>
                ))}
              </ul>

              {/* 권한 푸터 */}
              <div style={{
                paddingTop: 12, borderTop: '1px solid var(--hairline)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                fontSize: 10, fontFamily: 'var(--font-mono)',
              }}>
                <span style={{ color: 'var(--text-tertiary)', letterSpacing: '0.04em' }}>
                  권한 ·{' '}
                  <span style={{ color: m.accent, fontWeight: 700 }}>{m.permission}</span>
                </span>
                <span style={{ color: isSelected ? m.accent : 'var(--text-tertiary)', fontWeight: 600 }}>
                  {m.cta} →
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* RBAC 안내 */}
      <div style={{
        marginTop: 20, padding: '12px 16px', borderRadius: 8,
        background: 'var(--info-dim, rgba(86,156,214,0.08))', border: '1px solid rgba(86,156,214,0.30)',
        display: 'flex', gap: 12,
      }}>
        <AlertTriangle size={14} color="var(--info, #569cd6)" style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          기업 계정의 경우 관리자가{' '}
          <strong>역할 기반 접근 제어(RBAC)</strong>로 모드를 미리 지정할 수 있습니다.
          이 경우 모드 선택이 잠겨있을 수 있어요.
        </div>
      </div>

      {/* 액션 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 28 }}>
        <button
          onClick={onSkip}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 13, color: 'var(--text-tertiary)', fontWeight: 600,
            padding: '8px 12px', borderRadius: 6,
          }}
        >
          나중에 결정
        </button>
        <button
          onClick={onNext}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '8px 20px', borderRadius: 8, cursor: 'pointer',
            background: 'var(--orange-2)', color: '#fff',
            border: 'none', fontSize: 13, fontWeight: 700,
          }}
        >
          다음 — 프로젝트 생성 <ArrowRight size={13} />
        </button>
      </div>
    </div>
  );
}

// ─── Step 1 ──────────────────────────────────────────────────────────────────

function Step1({
  state,
  onChange,
  onNext,
  onSkip,
}: {
  state: Step1State;
  onChange: (patch: Partial<Step1State>) => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  const handleAddInvite = () => {
    const v = state.inviteInput.trim();
    if (!v) return;
    const type: InviteEntry['type'] = v.startsWith('@') ? 'handle' : 'email';
    onChange({
      invites: [...state.invites, { value: v, type }],
      inviteInput: '',
    });
  };

  const handleInviteKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleAddInvite();
  };

  const removeInvite = (idx: number) =>
    onChange({ invites: state.invites.filter((_, i) => i !== idx) });

  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 10 }}>
        새 프로젝트를 만들어보세요
      </h1>
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 32 }}>
        분석 결과와 채팅 이력이 프로젝트 단위로 저장됩니다.<br />
        팀이 있다면 멤버를 초대할 수도 있습니다.
      </p>

      <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 28, display: 'flex', flexDirection: 'column', gap: 22 }}>

        {/* Name + Description */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 14 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>프로젝트 이름</label>
            <input
              value={state.name}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder="my-project"
              style={{
                width: '100%', padding: '8px 12px', borderRadius: 6,
                background: 'var(--bg-3)', border: '1px solid var(--border)',
                color: 'var(--text-primary)', fontSize: 13, fontFamily: 'var(--font-mono)',
                outline: 'none',
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>설명 (선택)</label>
            <input
              value={state.description}
              onChange={(e) => onChange({ description: e.target.value })}
              placeholder="이 프로젝트가 무엇인지 한 줄로…"
              style={{
                width: '100%', padding: '8px 12px', borderRadius: 6,
                background: 'var(--bg-3)', border: '1px solid var(--border)',
                color: 'var(--text-primary)', fontSize: 13, outline: 'none',
              }}
            />
          </div>
        </div>

        {/* Project type */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>프로젝트 유형</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {PROJECT_TYPES.map((pt) => {
              const active = state.projectType === pt.id;
              return (
                <button
                  key={pt.id}
                  onClick={() => onChange({ projectType: pt.id })}
                  style={{
                    textAlign: 'left', padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                    background: active ? 'var(--orange-dim)' : 'var(--bg-3)',
                    border: `1px solid ${active ? 'rgba(249,115,22,0.45)' : 'var(--border)'}`,
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                    background: active ? 'var(--orange-2)' : 'var(--bg-2)',
                    color: active ? '#fff' : 'var(--text-secondary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {pt.icon}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{pt.label}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{pt.sub}</div>
                  </div>
                </button>
              );
            })}
          </div>
          <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-tertiary)' }}>
            유형은 AI 분석 시 사용되는 룰셋과 스캔 방식에 영향을 줍니다 — 나중에 변경 가능
          </div>
        </div>

        {/* Visibility */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>가시성</label>
          <div style={{ display: 'flex', height: 32, padding: 2, background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 6, maxWidth: 280 }}>
            {([
              { id: 'private' as const, icon: <Lock size={11} />, label: '비공개 (나만)' },
              { id: 'team'    as const, icon: <Users size={11} />, label: '팀과 공유' },
            ]).map((o) => {
              const active = state.visibility === o.id;
              return (
                <button
                  key={o.id}
                  onClick={() => onChange({ visibility: o.id })}
                  style={{
                    flex: 1, border: 'none', borderRadius: 4, cursor: 'pointer',
                    background: active ? 'var(--bg-1)' : 'transparent',
                    color: active ? 'var(--text-primary)' : 'var(--text-tertiary)',
                    fontSize: 11, fontWeight: 600,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}
                >
                  {o.icon}{o.label}
                </button>
              );
            })}
          </div>

          {/* Team invite — shown when visibility is 'team' */}
          {/* API: POST /api/v1/organizations/{orgId}/invitations — { email?, username?, role }
               응답: 201 Created → 이메일 발송 or 기존 가입자 즉시 추가 */}
          {state.visibility === 'team' && (
            <div style={{
              marginTop: 12, padding: 14,
              background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Users size={13} color="var(--orange)" />
                <span style={{ fontSize: 12, fontWeight: 700 }}>팀원 초대</span>
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>이메일 또는 @닉네임 — Enter로 추가</span>
              </div>

              <div style={{
                display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6,
                padding: '6px 10px',
                background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 6,
                marginBottom: 10, minHeight: 36,
              }}>
                {state.invites.map((inv, idx) => (
                  <span
                    key={idx}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      height: 22, padding: '0 4px 0 8px', borderRadius: 4,
                      background: 'var(--bg-3)', border: '1px solid var(--border-2)',
                      fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)',
                    }}
                  >
                    {inv.type === 'email' ? <Mail size={10} /> : <span style={{ fontWeight: 700 }}>@</span>}
                    {inv.value}
                    <button
                      onClick={() => removeInvite(idx)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 0, color: 'var(--text-tertiary)' }}
                      aria-label={`${inv.value} 제거`}
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
                <input
                  value={state.inviteInput}
                  onChange={(e) => onChange({ inviteInput: e.target.value })}
                  onKeyDown={handleInviteKeyDown}
                  placeholder="이메일 또는 @닉네임…"
                  style={{
                    flex: 1, background: 'transparent', border: 'none', outline: 'none',
                    fontSize: 12, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)',
                    minWidth: 140,
                  }}
                />
              </div>

              <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                <AlertTriangle size={10} style={{ verticalAlign: '-1px', marginRight: 4 }} />
                미가입 사용자는 이메일로 초대 링크가 발송됩니다
              </div>
            </div>
          )}
        </div>

        {/* AI model */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>AI 모델</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {MODELS.map((m) => {
              const active = state.model === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => onChange({ model: m.id })}
                  style={{
                    textAlign: 'left', padding: 12, borderRadius: 8, cursor: 'pointer', position: 'relative',
                    background: active ? 'var(--orange-dim)' : 'var(--bg-3)',
                    border: `1px solid ${active ? 'rgba(249,115,22,0.40)' : 'var(--border)'}`,
                  }}
                >
                  {m.recommended && (
                    <span style={{ position: 'absolute', top: 8, right: 8, fontSize: 8, fontWeight: 700, color: 'var(--orange)', letterSpacing: '0.05em', fontFamily: 'var(--font-mono)' }}>추천</span>
                  )}
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 3 }}>{m.label}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{m.sub}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 20, borderTop: '1px solid var(--hairline)' }}>
          <button
            onClick={onSkip}
            style={{
              padding: '8px 16px', borderRadius: 8, cursor: 'pointer',
              background: 'transparent', border: '1px solid var(--border)',
              color: 'var(--text-tertiary)', fontSize: 13, fontWeight: 600,
            }}
          >
            취소
          </button>
          <button
            onClick={onNext}
            disabled={!state.name.trim()}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '8px 20px', borderRadius: 8, cursor: state.name.trim() ? 'pointer' : 'not-allowed',
              background: 'var(--orange-2)', color: '#fff',
              border: 'none', fontSize: 13, fontWeight: 700,
              opacity: state.name.trim() ? 1 : 0.4,
            }}
          >
            다음 — 분석 소스 선택 <ArrowRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Step 2 ──────────────────────────────────────────────────────────────────

function Step2({
  state,
  onChange,
  onNext,
  onPrev,
}: {
  state: Step2State;
  onChange: (patch: Partial<Step2State>) => void;
  onNext: () => void;
  onPrev: () => void;
}) {
  const [filterInput, setFilterInput] = useState('');

  const removeFilter = (idx: number) =>
    onChange({ filters: state.filters.filter((_, i) => i !== idx) });

  const addFilter = () => {
    const v = filterInput.trim();
    if (!v || state.filters.includes(v)) return;
    onChange({ filters: [...state.filters, v] });
    setFilterInput('');
  };

  const SOURCE_OPTIONS: Array<{ id: SourceType; icon: React.ReactNode; title: string; desc: string; recommended?: boolean }> = [
    { id: 'github', icon: <Github size={18} />, title: 'GitHub 레포', desc: 'OAuth로 연동된 레포에서 브랜치 선택', recommended: true },
    { id: 'local',  icon: <FolderOpen size={18} />, title: '로컬 폴더',  desc: 'showDirectoryPicker로 폴더 열기 또는 드래그' },
    { id: 'upload', icon: <Upload size={18} />,     title: 'ZIP 업로드', desc: '프로젝트 zip 파일 업로드 (최대 100MB)' },
  ];

  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 10 }}>
        무엇을 분석할까요?
      </h1>
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 32 }}>
        세 가지 소스 중 하나를 고르세요. 분석 후에도 언제든 추가할 수 있습니다.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {SOURCE_OPTIONS.map((o) => {
          const active = state.source === o.id;
          return (
            <button
              key={o.id}
              onClick={() => onChange({ source: o.id })}
              style={{
                textAlign: 'left', padding: 20, borderRadius: 10, cursor: 'pointer', position: 'relative',
                background: active ? 'var(--orange-dim)' : 'var(--bg-2)',
                border: `1px solid ${active ? 'rgba(249,115,22,0.40)' : 'var(--border)'}`,
                outline: active ? '2px solid var(--orange-2)' : 'none',
                outlineOffset: -1,
                display: 'flex', flexDirection: 'column', gap: 10,
              }}
            >
              {o.recommended && (
                <span style={{
                  position: 'absolute', top: 12, right: 12,
                  fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                  background: 'var(--orange-dim)', color: 'var(--orange)',
                  border: '1px solid rgba(249,115,22,0.4)', fontFamily: 'var(--font-mono)',
                }}>가장 빠름</span>
              )}
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: active ? 'var(--orange-2)' : 'var(--bg-3)',
                color: active ? '#fff' : 'var(--text-secondary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {o.icon}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{o.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{o.desc}</div>
            </button>
          );
        })}
      </div>

      {/* GitHub picker — shown when source is github */}
      {/* API: GET /api/v1/github/repos — GitHub OAuth 연동된 레포 목록
               GET /api/v1/github/repos/{owner}/{repo}/branches — 브랜치 목록
               (OAuth 토큰은 useAuthStore의 accessToken 기반으로 백엔드가 처리) */}
      {state.source === 'github' && (
        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <Github size={16} color="var(--text-primary)" />
            <span style={{ fontSize: 13, fontWeight: 700 }}>GitHub 레포 선택</span>
            <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: 'var(--low-dim)', color: 'var(--low)', border: '1px solid rgba(34,197,94,0.3)', fontFamily: 'var(--font-mono)' }}>연결됨</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>레포</label>
              <div style={{
                padding: '8px 10px', background: 'var(--bg-3)', border: '1px solid var(--border)',
                borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
              }}>
                <Github size={12} color="var(--text-secondary)" />
                <input
                  value={state.githubRepo}
                  onChange={(e) => onChange({ githubRepo: e.target.value })}
                  placeholder="owner/repo"
                  style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 12, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}
                />
                <ChevronDown size={11} color="var(--text-tertiary)" />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>브랜치</label>
              <div style={{
                padding: '8px 10px', background: 'var(--bg-3)', border: '1px solid var(--border)',
                borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
              }}>
                <ChevronRight size={12} color="var(--text-secondary)" />
                <input
                  value={state.githubBranch}
                  onChange={(e) => onChange({ githubBranch: e.target.value })}
                  placeholder="main"
                  style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 12, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}
                />
                <ChevronDown size={11} color="var(--text-tertiary)" />
              </div>
            </div>
          </div>

          {/* File filters */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>파일 필터</label>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                height: 18, padding: '0 8px', borderRadius: 3,
                background: 'var(--orange-dim)', color: 'var(--orange)',
                border: '1px solid rgba(249,115,22,0.4)', fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-mono)',
              }}>
                <Sparkles size={9} />AI 자동 추천
              </span>
              <div style={{ flex: 1 }} />
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                <AlertTriangle size={10} style={{ verticalAlign: '-1px', marginRight: 4 }} />
                나중에 분석 설정에서 수정 가능
              </span>
            </div>

            <div style={{
              padding: 10, background: 'var(--bg-3)', border: '1px solid var(--border)',
              borderRadius: 6, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center',
            }}>
              {state.filters.map((f, i) => {
                const isExclude = f.startsWith('!');
                return (
                  <span
                    key={i}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      height: 26, padding: '0 4px 0 10px', borderRadius: 4,
                      background: isExclude ? 'var(--bg-2)' : 'var(--orange-dim)',
                      border: `1px solid ${isExclude ? 'var(--border)' : 'rgba(249,115,22,0.35)'}`,
                      color: isExclude ? 'var(--text-tertiary)' : 'var(--orange)',
                      fontSize: 11, fontFamily: 'var(--font-mono)',
                    }}
                  >
                    <Sparkles size={8} color={isExclude ? 'var(--text-tertiary)' : 'var(--orange)'} />
                    {f}
                    <button
                      onClick={() => removeFilter(i)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 2, color: 'var(--text-tertiary)' }}
                      aria-label={`${f} 필터 제거`}
                    >
                      <X size={10} />
                    </button>
                  </span>
                );
              })}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input
                  value={filterInput}
                  onChange={(e) => setFilterInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addFilter(); }}
                  placeholder="패턴 입력 후 Enter"
                  style={{
                    height: 26, padding: '0 8px',
                    background: 'transparent', border: '1px dashed var(--border-2)', borderRadius: 4,
                    color: 'var(--text-secondary)', fontSize: 11, fontFamily: 'var(--font-mono)', outline: 'none', width: 160,
                  }}
                />
                <button
                  onClick={addFilter}
                  style={{
                    height: 26, padding: '0 10px',
                    background: 'transparent', border: '1px dashed var(--border-2)', borderRadius: 4,
                    color: 'var(--text-secondary)', cursor: 'pointer',
                    fontSize: 11, fontWeight: 600,
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                  }}
                >
                  <Plus size={10} />필터 추가
                </button>
              </div>
            </div>

            <div style={{ marginTop: 8, fontSize: 10, color: 'var(--text-tertiary)' }}>
              AI가 프로젝트 유형을 기준으로 추천한 필터입니다.
              <span style={{ color: 'var(--orange)', marginLeft: 4 }}>×</span> 로 제거하거나 <strong style={{ color: 'var(--text-secondary)' }}>+ 필터 추가</strong>로 더할 수 있어요.
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
        <button
          onClick={onPrev}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '8px 16px', borderRadius: 8, cursor: 'pointer',
            background: 'transparent', border: '1px solid var(--border)',
            color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600,
          }}
        >
          <ArrowLeft size={13} />이전
        </button>
        <button
          onClick={onNext}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '8px 20px', borderRadius: 8, cursor: 'pointer',
            background: 'var(--orange-2)', color: '#fff',
            border: 'none', fontSize: 13, fontWeight: 700,
          }}
        >
          다음 — 분석 시작 <ArrowRight size={13} />
        </button>
      </div>
    </div>
  );
}

// ─── Step 3 ──────────────────────────────────────────────────────────────────

function Step3({
  step1,
  step2,
  onPrev,
  onStart,
  onSkip,
  submitting,
}: {
  step1: Step1State;
  step2: Step2State;
  onPrev: () => void;
  onStart: () => void;
  onSkip: () => void;
  submitting: boolean;
}) {
  const sourceLabel =
    step2.source === 'github' ? `${step2.githubRepo || 'owner/repo'} · ${step2.githubBranch || 'main'}` :
    step2.source === 'local'  ? '로컬 폴더' :
    'ZIP 업로드';

  const rows = [
    { label: '프로젝트',   value: `${step1.name} · ${PROJECT_TYPES.find(p => p.id === step1.projectType)?.label ?? step1.projectType}`, icon: <FolderOpen size={13} /> },
    { label: '소스',       value: sourceLabel, icon: <Github size={13} /> },
    { label: '파일 필터',  value: `${step2.filters.slice(0, 2).join(', ')}${step2.filters.length > 2 ? ` 외 ${step2.filters.length - 2}개` : ''}`, icon: <Filter size={13} /> },
    { label: '팀',         value: step1.invites.length > 0 ? step1.invites.map(i => i.value).join(', ') : '혼자 (비공개)', icon: <Users size={13} /> },
    { label: 'AI 모델',    value: MODELS.find(m => m.id === step1.model)?.label ?? step1.model, icon: <Sparkles size={13} /> },
  ];

  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 10 }}>
        검토 후 분석을 시작하세요
      </h1>
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 32 }}>
        SAST → DAST → AI 패치 순서로 진행됩니다. 평균 3-5분 소요.<br />
        지금 분석하지 않고 <strong>에디터부터 둘러볼 수도 있어요</strong>.
      </p>

      <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, marginBottom: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {rows.map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '4px 0' }}>
              <div style={{
                width: 28, height: 28, borderRadius: 6,
                background: 'var(--bg-3)', color: 'var(--text-secondary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                {r.icon}
              </div>
              <span style={{ width: 100, fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0 }}>{r.label}</span>
              <span style={{ fontSize: 12, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', flex: 1 }}>{r.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{
        padding: '14px 16px', borderRadius: 8,
        background: 'var(--info-dim)', border: '1px solid rgba(86,156,214,0.30)',
        display: 'flex', gap: 12, marginBottom: 24,
      }}>
        <AlertTriangle size={16} color="var(--info)" style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          DAST 테스트는 실제 HTTP 요청을 보냅니다.{' '}
          <strong>분석 중 도메인 소유 확인이 요구</strong>되며, 확인 후 익스플로잇 검증이 진행됩니다.
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          onClick={onPrev}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '8px 16px', borderRadius: 8, cursor: 'pointer',
            background: 'transparent', border: '1px solid var(--border)',
            color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600,
          }}
        >
          <ArrowLeft size={13} />이전
        </button>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onSkip}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              height: 36, padding: '0 18px',
              border: '1px solid var(--border-2)',
              borderRadius: 8, background: 'var(--bg-2)',
              color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            <Code size={12} />
            에디터로 바로 가기 (분석 스킵)
          </button>
          {/* API: POST /api/v1/projects — { name, description?, projectType }
                   → 201 Created { id, name, ... }
               이후 분석 시작: POST /api/v1/analysis/sessions — { projectId, sourceType, ... }
                   → 202 Accepted { sessionId } → SSE /api/v1/sse/{sessionId} 구독 */}
          <button
            onClick={onStart}
            disabled={submitting}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              height: 36, padding: '0 22px',
              background: 'var(--orange-2)', color: '#fff',
              border: 'none', borderRadius: 8, cursor: submitting ? 'wait' : 'pointer',
              fontSize: 13, fontWeight: 700,
              opacity: submitting ? 0.6 : 1,
            }}
          >
            <Play size={12} />
            {submitting ? '생성 중…' : '첫 분석 시작'}
          </button>
        </div>
      </div>

      <div style={{ marginTop: 14, fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'right' }}>
        스킵해도 언제든 상단{' '}
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          height: 18, padding: '0 8px', borderRadius: 3,
          background: 'var(--orange-dim)', color: 'var(--orange)',
          border: '1px solid rgba(249,115,22,0.4)', fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-mono)',
        }}>
          <Play size={8} />분석 시작
        </span>{' '}
        버튼으로 분석 가능
      </div>
    </div>
  );
}

// ─── Page shell ──────────────────────────────────────────────────────────────
// step: 0=워크스페이스 모드, 1=프로젝트 생성, 2=분석 소스, 3=첫 분석 시작

export default function OnboardingPage() {
  const router          = useRouter();
  const setWorkspaceMode = useSecureStore((s) => s.setWorkspaceMode);

  // Step 0부터 시작 (워크스페이스 모드 선택)
  const [step, setStep]         = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [wMode, setWMode]       = useState<WorkspaceMode>('DEVELOPER');

  const [step1, setStep1] = useState<Step1State>({
    name: '',
    description: '',
    projectType: 'server',
    visibility: 'private',
    inviteInput: '',
    invites: [],
    model: 'haiku',
  });

  const [step2, setStep2] = useState<Step2State>({
    source: 'github',
    githubRepo: '',
    githubBranch: 'main',
    filters: DEFAULT_FILTERS,
  });

  const handleModeNext = () => {
    // Step 0 완료 시 Zustand에 저장
    setWorkspaceMode(wMode);
    setStep(1);
  };

  const handleCreateProject = async (startAnalysis: boolean) => {
    setSubmitting(true);
    try {
      // POST /api/v1/projects — 프로젝트 생성
      // Body: { name, description?, projectType }
      // Response: { id, name, ... }
      await apiClient.post('/projects', {
        name: step1.name.trim(),
        description: step1.description.trim() || undefined,
        projectType: step1.projectType,
      });
      // Analysis source state is retained locally; actual trigger happens in the editor
      router.push('/editor');
    } catch {
      // Keep user on step 3 — error will be visible via submitting reset
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-0)' }}>
      {/* Header */}
      <div style={{
        height: 60, flexShrink: 0,
        borderBottom: '1px solid var(--hairline)',
        background: 'var(--bg-1)',
        display: 'flex', alignItems: 'center', padding: '0 24px',
      }}>
        <PagoriLockup size={26} subtitle="security audit agent" />
        <div style={{ flex: 1 }} />
        <button
          onClick={() => router.push('/editor')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 13, color: 'var(--text-tertiary)', fontWeight: 600,
            padding: '6px 12px', borderRadius: 6,
          }}
        >
          나중에 설정
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <div style={{ maxWidth: 920, margin: '0 auto', padding: '48px 32px' }}>
          <StepIndicator current={step} />

          {step === 0 && (
            <Step0
              selected={wMode}
              onSelect={setWMode}
              onNext={handleModeNext}
              onSkip={() => { setWorkspaceMode(wMode); router.push('/editor'); }}
            />
          )}
          {step === 1 && (
            <Step1
              state={step1}
              onChange={(p) => setStep1((s) => ({ ...s, ...p }))}
              onNext={() => setStep(2)}
              onSkip={() => router.push('/editor')}
            />
          )}
          {step === 2 && (
            <Step2
              state={step2}
              onChange={(p) => setStep2((s) => ({ ...s, ...p }))}
              onNext={() => setStep(3)}
              onPrev={() => setStep(1)}
            />
          )}
          {step === 3 && (
            <Step3
              step1={step1}
              step2={step2}
              onPrev={() => setStep(2)}
              onStart={() => handleCreateProject(true)}
              onSkip={() => handleCreateProject(false)}
              submitting={submitting}
            />
          )}
        </div>
      </div>
    </div>
  );
}
