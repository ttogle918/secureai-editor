// components/analysis/VulnDetailPanel.tsx
// 취약점 상세 아코디언 패널 — FilterBar 내장, useVulnFilter 훅 사용
'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import {
  ChevronDown, ChevronRight, AlertTriangle, CheckCircle,
  Zap, Info, Layers, RefreshCw, Play, Server, Shield, XCircle, Check,
} from 'lucide-react';
import { useSecureStore } from '@/store/useSecureStore';
import type { DastExploitResult } from '@/store/useSecureStore';
import { useToastStore } from '@/hooks/useToast';
import { useVulnFilter } from '@/hooks/useVulnFilter';
import { useTranslate } from '@/hooks/useTranslate';
import { CallChainView } from '@/components/analysis/CallChainView';
import FilterBar from '@/components/ui/FilterBar';
import type { Vulnerability, VulnStatus } from '@/lib/mockData';
import { isVulnResolved } from '@/lib/mockData';
import { deriveEndpoint } from '@/lib/vulnUtils';
import { BASE_URL, getAccessToken, apiClient } from '@/lib/api/client';
import { bulkTriageVulns, type BulkTriageAction } from '@/lib/api/vulnerabilities';

// ── 벌크 트리아지 상수 ────────────────────────────────────────────────────────

/** action → 낙관적 갱신에 사용할 VulnStatus 매핑. 최종값은 백엔드 응답 newStatus를 신뢰. */
const BULK_ACTION_TO_STATUS: Record<BulkTriageAction, VulnStatus> = {
  CONFIRM:      'open',
  DISMISS:      'false_positive',
  ACCEPT_PATCH: 'fixed',
};

const DISMISS_REASON_MAX_LEN = 1000;

/**
 * skip된 항목만 이전 status로 복원하는 스냅샷을 계산한다.
 * appliedVulnIds에 없는 id를 prevSnapshot에서 찾아 반환한다.
 */
function buildSkippedSnapshot(
  allIds: string[],
  appliedVulnIds: string[],
  prevSnapshot: Record<string, VulnStatus>,
): Record<string, VulnStatus> {
  const appliedSet = new Set(appliedVulnIds);
  const skipped: Record<string, VulnStatus> = {};
  for (const id of allIds) {
    if (!appliedSet.has(id) && id in prevSnapshot) {
      skipped[id] = prevSnapshot[id];
    }
  }
  return skipped;
}

// ── DISMISS 사유 입력 모달 ────────────────────────────────────────────────────
interface DismissModalProps {
  count: number;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

function DismissReasonModal({ count, onConfirm, onCancel }: DismissModalProps) {
  const [reason, setReason] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { textareaRef.current?.focus(); }, []);

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)' }}
      onClick={onCancel}
      onKeyDown={(e) => { if (e.key === 'Escape') onCancel(); }}
      role="presentation"
    >
      <div
        style={{ width: 400, background: 'var(--bg-2)', border: '1px solid rgba(245,158,11,0.4)', borderRadius: 10, padding: 20, boxShadow: '0 16px 48px rgba(0,0,0,0.6)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>기각 사유 입력</div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{count}건을 기각합니다. 사유는 선택 입력이지만 리랭커 학습에 활용됩니다.</div>
        </div>
        <textarea
          ref={textareaRef}
          value={reason}
          onChange={(e) => setReason(e.target.value.slice(0, DISMISS_REASON_MAX_LEN))}
          placeholder="기각 사유를 입력하세요 (선택)"
          rows={4}
          style={{ width: '100%', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', fontSize: 12, padding: '8px 10px', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
        />
        <div style={{ textAlign: 'right', fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>{reason.length}/{DISMISS_REASON_MAX_LEN}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
          <button onClick={onCancel} style={{ fontSize: 12, padding: '5px 14px', borderRadius: 5, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer' }}>취소</button>
          <button onClick={() => onConfirm(reason)} style={{ fontSize: 12, fontWeight: 700, padding: '5px 14px', borderRadius: 5, background: 'rgba(245,158,11,0.15)', border: '0.5px solid rgba(245,158,11,0.4)', color: '#f59e0b', cursor: 'pointer' }}>기각 확정</button>
        </div>
      </div>
    </div>
  );
}

// ── 트리아지 액션 타입 ─────────────────────────────────────────
type TriageAction = 'CONFIRM' | 'DISMISS' | 'ACCEPT_PATCH';

// ── 트리아지 섹션 컴포넌트 ────────────────────────────────────
function TriageSection({ vuln }: { vuln: Vulnerability }) {
  const addToast                 = useToastStore((s) => s.addToast);
  const optimisticUpdateVulnStatus = useSecureStore((s) => s.optimisticUpdateVulnStatus);
  const rollbackVulnStatus       = useSecureStore((s) => s.rollbackVulnStatus);

  const [reason,  setReason]  = useState('');
  const [loading, setLoading] = useState<TriageAction | null>(null);

  /** action → 한국어 레이블 */
  const actionLabel: Record<TriageAction, string> = {
    CONFIRM:      '확인',
    DISMISS:      '기각',
    ACCEPT_PATCH: '패치 채택',
  };

  /** action → vuln status 낙관적 매핑 */
  const actionToStatus: Record<TriageAction, VulnStatus> = {
    CONFIRM:      'open',
    DISMISS:      'false_positive',
    ACCEPT_PATCH: 'fixed',
  };

  const handleTriage = async (action: TriageAction) => {
    if (loading) return;
    const prevStatus = vuln.status;

    // 낙관적 갱신 — API 응답 전에 UI를 먼저 업데이트
    optimisticUpdateVulnStatus(vuln.id, actionToStatus[action]);
    setLoading(action);

    try {
      await apiClient.patch(
        `/vulnerabilities/${vuln.id}/triage`,
        { action, reason: reason.trim() || undefined },
      );
      addToast(`트리아지 완료: ${actionLabel[action]}`, 'info');
      setReason('');
    } catch (err) {
      // API 실패 시 낙관적 갱신 롤백
      rollbackVulnStatus(vuln.id, prevStatus);
      const msg = err instanceof Error ? err.message : '트리아지 처리 중 오류가 발생했습니다.';
      addToast(msg, 'error');
    } finally {
      setLoading(null);
    }
  };

  const buttonConfigs: Array<{ action: TriageAction; icon: React.ReactNode; color: string; bg: string; border: string }> = [
    {
      action: 'CONFIRM',
      icon:   <Shield size={10} />,
      color:  '#f59e0b',
      bg:     'rgba(245,158,11,0.12)',
      border: 'rgba(245,158,11,0.35)',
    },
    {
      action: 'DISMISS',
      icon:   <XCircle size={10} />,
      color:  'rgba(255,255,255,0.4)',
      bg:     'rgba(255,255,255,0.05)',
      border: 'rgba(255,255,255,0.12)',
    },
    {
      action: 'ACCEPT_PATCH',
      icon:   <Check size={10} />,
      color:  '#4ade80',
      bg:     'rgba(74,222,128,0.12)',
      border: 'rgba(74,222,128,0.35)',
    },
  ];

  return (
    <div>
      <SectionLabel icon={<Shield size={10} color="#818cf8" />} text="트리아지" />

      {/* 사유 입력 */}
      <textarea
        placeholder="사유 (선택, 최대 1000자)"
        value={reason}
        onChange={(e) => setReason(e.target.value.slice(0, 1000))}
        rows={2}
        style={{
          width: '100%', boxSizing: 'border-box',
          background: '#0a0a0c', border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 6, padding: '6px 10px',
          fontSize: 11, color: '#e8e8ee', fontFamily: 'inherit',
          outline: 'none', resize: 'none', marginBottom: 8,
        }}
      />

      {/* 액션 버튼 3개 */}
      <div style={{ display: 'flex', gap: 6 }}>
        {buttonConfigs.map(({ action, icon, color, bg, border }) => {
          const isLoading = loading === action;
          const disabled  = loading !== null;
          return (
            <button
              key={action}
              onClick={() => handleTriage(action)}
              disabled={disabled}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                padding: '5px 8px', fontSize: 10, fontWeight: 700, borderRadius: 5,
                background: disabled ? 'rgba(255,255,255,0.04)' : bg,
                border: `1px solid ${disabled ? 'rgba(255,255,255,0.08)' : border}`,
                color: disabled ? 'rgba(255,255,255,0.2)' : color,
                cursor: disabled ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {isLoading
                ? <RefreshCw size={10} style={{ animation: 'spin 0.85s linear infinite' }} />
                : icon}
              {actionLabel[action]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── DAST 실행 섹션 ────────────────────────────────────────────
function DastRunSection({ vuln }: { vuln: Vulnerability }) {
  const setDastSessionId = useSecureStore((s) => s.setDastSessionId);
  const dastSessionId    = useSecureStore((s) => s.dastSessionId);
  const dastBaseUrl      = useSecureStore((s) => s.dastBaseUrl);
  const setDastBaseUrl   = useSecureStore((s) => s.setDastBaseUrl);
  const addToast         = useToastStore((s) => s.addToast);

  const derivedPath = deriveEndpoint(vuln.filePath, vuln.description);

  const buildTargetUrl = useCallback(
    (base: string) => (base.trim() ? base.replace(/\/$/, '') + derivedPath : vuln.apiEndpoint ?? ''),
    [derivedPath, vuln.apiEndpoint],
  );

  const [baseInput,  setBaseInput]  = useState(dastBaseUrl);
  const [targetUrl,  setTargetUrl]  = useState(() => buildTargetUrl(dastBaseUrl));
  const [consent,    setConsent]    = useState(false);
  const [running,    setRunning]    = useState(false);

  // base URL이 변경되면 target URL도 갱신
  useEffect(() => {
    setTargetUrl(buildTargetUrl(baseInput));
  }, [baseInput, buildTargetUrl]);

  const handleBaseBlur = () => {
    const trimmed = baseInput.trim().replace(/\/$/, '');
    setDastBaseUrl(trimmed);
  };

  const isGlobalRunning = dastSessionId !== null;
  const canRun = consent && targetUrl.trim() !== '' && !running && !isGlobalRunning;

  const handleRun = async () => {
    if (!canRun) return;
    setRunning(true);
    try {
      let parsedUrl: URL;
      try { parsedUrl = new URL(targetUrl.trim()); }
      catch { addToast('올바른 URL을 입력해주세요.', 'error'); setRunning(false); return; }

      const dastId = crypto.randomUUID();
      // SSE 구독을 먼저 열어 race condition 방어 (DAST가 즉시 완료될 수 있음)
      setDastSessionId(dastId);

      const token = getAccessToken();
      const res = await fetch(`${BASE_URL}/dast/start`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          sessionId:    dastId,
          vulnId:       vuln.id,
          domain:       parsedUrl.hostname,
          consentGiven: true,
          vulnType:     vuln.type,
          targetUrl:    parsedUrl.origin + parsedUrl.pathname,
          endpoint:     parsedUrl.pathname,
          params:       Object.fromEntries(new URLSearchParams(parsedUrl.search)),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        setDastSessionId(null);
        throw new Error(err?.error?.message ?? err?.message ?? `DAST 시작 실패: ${res.status}`);
      }
      addToast('DAST 분석을 시작했습니다. 하단 터미널에서 진행 상황을 확인하세요.', 'info');
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'DAST 시작에 실패했습니다.', 'error');
    } finally {
      setRunning(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    background: '#0a0a0c', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 6, padding: '6px 10px',
    fontSize: 11, color: '#e8e8ee', fontFamily: 'var(--font-mono)',
    outline: 'none',
  };

  return (
    <div>
      <SectionLabel icon={<Play size={10} color="#f97316" />} text="동적 분석 (DAST)" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

        {/* 테스트 서버 Base URL — 한 번 설정하면 기억됨 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Server size={10} color="rgba(255,255,255,0.3)" style={{ flexShrink: 0 }} />
          <input
            type="url"
            placeholder="테스트 서버 주소 (예: http://localhost:8888)"
            value={baseInput}
            onChange={(e) => setBaseInput(e.target.value)}
            onBlur={handleBaseBlur}
            style={{ ...inputStyle, fontSize: 10, color: 'rgba(255,255,255,0.55)' }}
          />
        </div>

        {/* 타겟 URL — base + 추론된 경로로 자동 완성 */}
        <input
          type="url"
          placeholder="Target URL"
          value={targetUrl}
          onChange={(e) => setTargetUrl(e.target.value)}
          style={inputStyle}
        />
        {derivedPath && (
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', marginTop: -4, paddingLeft: 2 }}>
            경로 자동 추론: <span style={{ fontFamily: 'var(--font-mono)', color: 'rgba(249,115,22,0.5)' }}>{derivedPath}</span>
          </div>
        )}

        <label style={{
          display: 'flex', alignItems: 'flex-start', gap: 7,
          fontSize: 10, color: 'rgba(255,255,255,0.45)', cursor: 'pointer', lineHeight: 1.5,
        }}>
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            style={{ marginTop: 2, cursor: 'pointer', accentColor: '#f97316' }}
          />
          이 대상에 대한 보안 테스트 수행에 동의합니다 (반드시 테스트 환경만 사용)
        </label>
        <button
          onClick={handleRun}
          disabled={!canRun}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            padding: '6px 12px', fontSize: 11, fontWeight: 700, borderRadius: 6,
            background: canRun ? 'rgba(249,115,22,0.2)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${canRun ? 'rgba(249,115,22,0.5)' : 'rgba(255,255,255,0.08)'}`,
            color: canRun ? '#f97316' : 'rgba(255,255,255,0.2)',
            cursor: canRun ? 'pointer' : 'not-allowed',
          }}
        >
          {running ? (
            <><RefreshCw size={11} style={{ animation: 'spin 0.85s linear infinite' }} /> 시작 중...</>
          ) : isGlobalRunning ? (
            <><Play size={11} /> DAST 실행 중...</>
          ) : (
            <><Play size={11} /> DAST 실행</>
          )}
        </button>
      </div>
    </div>
  );
}

// ── DAST 결과 JSON 상세 컴포넌트 ────────────────────────────────
function DastResultDetail({ result }: { result: DastExploitResult }) {
  const [open, setOpen] = useState(false);
  const isExploited = result.success === true;
  const accentColor = isExploited ? '#f87171' : '#4ade80';
  const bgColor     = isExploited ? 'rgba(220,38,38,0.06)' : 'rgba(34,197,94,0.06)';
  const borderColor = isExploited ? 'rgba(220,38,38,0.2)' : 'rgba(34,197,94,0.2)';

  const jsonObj = {
    success:         result.success,
    evidence:        result.evidence || null,
    payload:         result.payload  || null,
    responseSnippet: result.responseSnippet || null,
    error:           result.error    || null,
  };
  const jsonStr = JSON.stringify(jsonObj, null, 2);

  return (
    <div>
      <SectionLabel
        icon={<AlertTriangle size={10} color={accentColor} />}
        text={isExploited ? 'DAST 결과 — EXPLOITED' : 'DAST 결과 — 안전'}
      />
      <div style={{
        borderRadius: 8, overflow: 'hidden',
        border: `0.5px solid ${borderColor}`,
        background: bgColor,
      }}>
        {/* 요약 행 */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '6px 10px',
        }}>
          <span style={{ fontSize: 11, color: accentColor, fontWeight: 700 }}>
            {isExploited ? '⚡ 취약점 익스플로잇 성공' : '✓ 공격 차단됨'}
          </span>
          <button
            onClick={() => setOpen((p) => !p)}
            style={{
              fontSize: 9, color: 'rgba(255,255,255,0.35)', background: 'none',
              cursor: 'pointer', padding: '2px 6px',
              borderRadius: 3, border: '0.5px solid rgba(255,255,255,0.08)',
            }}
          >
            {open ? '접기 ▲' : 'JSON 보기 ▼'}
          </button>
        </div>

        {/* evidence 요약 */}
        {result.evidence && (
          <div style={{
            padding: '0 10px 8px', fontSize: 11,
            color: 'rgba(255,255,255,0.55)', lineHeight: 1.6,
          }}>
            {result.evidence}
          </div>
        )}

        {/* JSON 상세 (접기/펴기) */}
        {open && (
          <pre style={{
            margin: 0, padding: '8px 10px',
            borderTop: `0.5px solid ${borderColor}`,
            fontSize: 10, fontFamily: 'var(--font-mono)',
            color: accentColor, lineHeight: 1.7,
            overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
            background: 'rgba(0,0,0,0.3)',
          }}>
            {jsonStr}
          </pre>
        )}
      </div>
    </div>
  );
}

// ── 심각도별 색상 ──────────────────────────────────────────────
const SEV_COLOR: Record<string, string> = {
  critical: '#e24b4b',
  high:     '#f59e0b',
  medium:   '#eab308',
  low:      '#22c55e',
};

// ── 개별 취약점 카드 ───────────────────────────────────────────
interface VulnCardProps {
  vuln: Vulnerability;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
}

function VulnCard({ vuln, isSelected, onToggleSelect }: VulnCardProps) {
  const expandedVulnId    = useSecureStore((s) => s.expandedVulnId);
  const dastExploitResults = useSecureStore((s) => s.dastExploitResults);
  const exploitResult      = dastExploitResults[vuln.id];
  const setExpandedVulnId = useSecureStore((s) => s.setExpandedVulnId);
  const selectedPath      = useSecureStore((s) => s.selectedPath);
  const setSelectedPath   = useSecureStore((s) => s.setSelectedPath);
  const setRevealLine     = useSecureStore((s) => s.setRevealLine);
  const displayLanguage   = useSecureStore((s) => s.displayLanguage);

  const [isFixing,       setIsFixing]       = useState(false);
  const [patchApplied,   setPatchApplied]   = useState(isVulnResolved(vuln.status));
  const [translatedDesc, setTranslatedDesc] = useState<string | null>(null);

  // 트리아지(ACCEPT_PATCH) 등 store status 변경 시 SOLVED 배지 동기화.
  // handleFix 의 낙관적 setPatchApplied(true) 와 양립 — resolved면 항상 반영.
  useEffect(() => {
    if (isVulnResolved(vuln.status)) setPatchApplied(true);
  }, [vuln.status]);

  const { translate, translating } = useTranslate();

  const patches    = useSecureStore((s) => s.patches);
  const applyPatch = useSecureStore((s) => s.applyPatch);
  const isOpen     = expandedVulnId === vuln.id;

  useEffect(() => {
    if (!isOpen || displayLanguage !== 'ko' || !vuln.description) return;
    if (translatedDesc) return;
    translate(vuln.description, 'ko').then(setTranslatedDesc);
  }, [isOpen, displayLanguage, vuln.description, translatedDesc, translate]);
  const patch   = patches.find((p) =>
    (p.vulnId && p.vulnId === vuln.id) ||
    (p.filePath === vuln.filePath && p.vulnType === vuln.type)
  );
  const sColor  = SEV_COLOR[vuln.severity] ?? '#888';

  const handleToggle = () => {
    setExpandedVulnId(isOpen ? null : vuln.id);
    if (!isOpen) {
      setRevealLine(vuln.lineStart);
      if (vuln.filePath !== selectedPath) setSelectedPath(vuln.filePath);
    }
  };

  const handleFix = () => {
    setIsFixing(true);
    applyPatch(vuln.id);
    setTimeout(() => {
      setIsFixing(false);
      setPatchApplied(true);
    }, 300);
  };

  return (
    <div
      style={{
        borderTop:    isOpen ? '0.5px solid rgba(255,255,255,0.15)' : '0.5px solid rgba(255,255,255,0.06)',
        borderRight:  isOpen ? '0.5px solid rgba(255,255,255,0.15)' : '0.5px solid rgba(255,255,255,0.06)',
        borderBottom: isOpen ? '0.5px solid rgba(255,255,255,0.15)' : '0.5px solid rgba(255,255,255,0.06)',
        borderLeft:   `2px solid ${isSelected ? 'var(--orange)' : patchApplied ? '#4caf50' : sColor}`,
        borderRadius: 10,
        background:   isSelected ? 'var(--orange-dim)' : '#141414',
        overflow:     'hidden',
        transition:   'border-color 0.2s, background 0.15s',
        flexShrink:   0,
      }}
    >
      {/* 아코디언 헤더 행 — 클릭 시 멀티셀렉트 토글 */}
      <div
        role="row"
        style={{
          width: '100%',
          height: 52,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '0 14px',
          cursor: 'pointer',
          textAlign: 'left',
          flexShrink: 0,
          overflow: 'hidden',
        }}
        onClick={() => onToggleSelect(vuln.id)}
      >
        {/* 체크박스 시각 표시 */}
        <span
          role="checkbox"
          aria-checked={isSelected}
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); onToggleSelect(vuln.id); }}
          onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onToggleSelect(vuln.id); } }}
          style={{
            width: 14,
            height: 14,
            borderRadius: 3,
            border: `1.5px solid ${isSelected ? 'var(--orange)' : 'rgba(255,255,255,0.2)'}`,
            background: isSelected ? 'var(--orange)' : 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'background 0.15s, border-color 0.15s',
            cursor: 'pointer',
          }}
        >
          {isSelected && <Check size={9} color="#fff" />}
        </span>

        {/* 심각도 배지 */}
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            padding: '2px 7px',
            borderRadius: 4,
            flexShrink: 0,
            background: `${sColor}18`,
            color: sColor,
            border: `0.5px solid ${sColor}30`,
            textTransform: 'uppercase',
          }}
        >
          {vuln.severity}
        </span>

        {/* CODE_QUALITY 배지 */}
        {vuln.category === 'CODE_QUALITY' && (
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: 4,
              flexShrink: 0,
              background: 'rgba(99,102,241,0.12)',
              color: '#818cf8',
              border: '0.5px solid rgba(99,102,241,0.3)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            CODE QUALITY
          </span>
        )}

        {/* SOLVED / PATCHED 배지 */}
        {patchApplied ? (
          <span style={{
            fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 4, flexShrink: 0,
            background: 'rgba(76,175,80,0.15)', color: '#4caf50',
            border: '0.5px solid rgba(76,175,80,0.4)', letterSpacing: '0.04em',
          }}>
            SOLVED
          </span>
        ) : patch ? (
          <span style={{
            fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 4, flexShrink: 0,
            background: 'rgba(234,88,12,0.12)', color: '#f97316',
            border: '0.5px solid rgba(234,88,12,0.3)', letterSpacing: '0.04em',
          }}>
            PATCHED
          </span>
        ) : null}

        {/* DAST 익스플로잇 결과 배지 */}
        {exploitResult?.success === true ? (
          <span style={{
            flexShrink: 0, fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 4,
            background: 'rgba(220,38,38,0.15)', color: '#f87171',
            border: '0.5px solid rgba(220,38,38,0.4)', letterSpacing: '0.04em',
          }}>
            EXPLOITED ✓
          </span>
        ) : exploitResult && !exploitResult.success ? (
          <span style={{
            flexShrink: 0, fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
            background: 'rgba(34,197,94,0.12)', color: '#4ade80',
            border: '0.5px solid rgba(34,197,94,0.3)', letterSpacing: '0.04em',
          }}>
            DAST 안전
          </span>
        ) : null}

        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: patchApplied ? '#4caf50' : '#fff',
              marginBottom: 2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {patchApplied && <span style={{ marginRight: 5 }}>✓</span>}
            {vuln.type}
          </div>
          <div
            style={{
              fontSize: 10,
              fontFamily: 'var(--font-mono)',
              color: 'rgba(255,255,255,0.3)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {vuln.filePath.split('/').pop()}:{vuln.lineStart}
            {vuln.cweId && (
              <span style={{ marginLeft: 8, color: 'rgba(255,255,255,0.2)' }}>
                {vuln.cweId}
              </span>
            )}
            {vuln.apiEndpoint && (
              <span style={{ marginLeft: 8, color: '#f9731666' }}>
                {vuln.apiEndpoint}
              </span>
            )}
          </div>
        </div>

        {/* chevron — 상세 펼치기/접기 전용 버튼. 행 클릭(선택 토글)과 독립적. */}
        <button
          aria-expanded={isOpen}
          aria-label={isOpen ? '상세 접기' : '상세 펼치기'}
          onClick={(e) => { e.stopPropagation(); handleToggle(); }}
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 2,
            borderRadius: 3,
          }}
        >
          {isOpen
            ? <ChevronDown  size={14} color="rgba(255,255,255,0.2)" />
            : <ChevronRight size={14} color="rgba(255,255,255,0.2)" />}
        </button>
      </div>

      {/* 아코디언 상세 */}
      {isOpen && (
        <div
          style={{
            borderTop: '0.5px solid rgba(255,255,255,0.06)',
            padding: '16px 14px',
            background: 'rgba(0,0,0,0.25)',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {/* 설명 + CWE */}
          <div>
            <SectionLabel icon={<Info size={10} />} text="설명" />
            <p style={{ fontSize: 12, lineHeight: 1.7, color: 'rgba(255,255,255,0.7)' }}>
              {displayLanguage === 'ko'
                ? (translating && !translatedDesc
                    ? <span style={{ color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>번역 중...</span>
                    : (translatedDesc ?? vuln.description))
                : vuln.description}
            </p>
            <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
              {[vuln.cweId, vuln.owaspCategory].filter(Boolean).map((t) => (
                <span
                  key={t}
                  style={{
                    fontSize: 9,
                    padding: '1px 6px',
                    border: '0.5px solid rgba(255,255,255,0.1)',
                    borderRadius: 3,
                    color: 'rgba(255,255,255,0.3)',
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* 트리아지 */}
          <TriageSection vuln={vuln} />

          {/* DAST 실행 */}
          <DastRunSection vuln={vuln} />

          {/* DAST 결과 JSON 상세 */}
          {exploitResult && (
            <DastResultDetail result={exploitResult} />
          )}

          {/* DAST 결과 (레거시 dastResult 필드) */}
          {!exploitResult && vuln.dastResult && (
            <div>
              <SectionLabel icon={<AlertTriangle size={10} color="#f97316" />} text="공격 시나리오" />
              <div
                style={{
                  padding: '8px 10px',
                  background: 'rgba(249,115,22,0.06)',
                  border: '0.5px solid rgba(249,115,22,0.15)',
                  borderRadius: 8,
                  fontSize: 11,
                  color: 'rgba(253,186,116,0.8)',
                  fontStyle: 'italic',
                  lineHeight: 1.6,
                }}
              >
                {vuln.dastResult}
              </div>
            </div>
          )}

          {/* 호출 체인 */}
          <div>
            <SectionLabel icon={<Layers size={10} />} text="API 호출 체인" />
            <CallChainView vuln={vuln} />
          </div>

          {/* 코드 스니펫 (callChain 내 취약 단계) */}
          {vuln.callChain?.some((s) => s.isVulnerable && s.codeSnippet) && (
            <div>
              <SectionLabel icon={<Info size={10} />} text="취약 코드 스니펫" />
              {vuln.callChain
                .filter((s) => s.isVulnerable && s.codeSnippet)
                .map((s, i) => (
                  <div
                    key={i}
                    style={{
                      marginTop: 4,
                      padding: '8px 10px',
                      background: 'rgba(226,75,74,0.06)',
                      border: '0.5px solid rgba(226,75,74,0.2)',
                      borderRadius: 6,
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      color: '#f87171',
                      lineHeight: 1.7,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                    }}
                  >
                    {s.codeSnippet}
                  </div>
                ))}
            </div>
          )}

          {/* 패치 제안 */}
          {patch && (
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 8,
                }}
              >
                <SectionLabel icon={<Zap size={10} color="#4caf50" />} text="패치 제안" />
                {!patchApplied ? (
                  <button
                    onClick={handleFix}
                    disabled={isFixing}
                    style={{
                      fontSize: 10,
                      padding: '4px 10px',
                      background: '#16a34a',
                      border: 'none',
                      borderRadius: 5,
                      color: '#fff',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      boxShadow: '0 2px 8px rgba(22,163,74,0.3)',
                    }}
                  >
                    {isFixing
                      ? <RefreshCw size={10} className="animate-spin" />
                      : <Zap size={10} />}
                    AUTO FIX
                  </button>
                ) : (
                  <span
                    style={{
                      fontSize: 10,
                      color: '#4caf50',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 3,
                    }}
                  >
                    <CheckCircle size={10} /> 적용됨
                  </span>
                )}
              </div>

              {/* Before / After diff */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <div>
                  <div style={{ fontSize: 9, color: '#E24B4A', marginBottom: 4, opacity: 0.7 }}>Before</div>
                  <div
                    style={{
                      background: '#050505',
                      borderRadius: 6,
                      border: '0.5px solid rgba(226,75,74,0.2)',
                      padding: '8px 10px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      color: '#f87171',
                      lineHeight: 1.7,
                    }}
                  >
                    {patch.originalCode.split('\n').map((l, i) => (
                      <div key={i}><span style={{ opacity: 0.3 }}>- </span>{l}</div>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: '#4caf50', marginBottom: 4, opacity: 0.7 }}>After</div>
                  <div
                    style={{
                      background: '#050505',
                      borderRadius: 6,
                      border: '0.5px solid rgba(76,175,80,0.2)',
                      padding: '8px 10px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      color: '#86efac',
                      lineHeight: 1.7,
                    }}
                  >
                    {patch.patchedCode.split('\n').map((l, i) => (
                      <div key={i}><span style={{ opacity: 0.3 }}>+ </span>{l}</div>
                    ))}
                  </div>
                </div>
              </div>

              <div
                style={{
                  marginTop: 6,
                  fontSize: 10,
                  color: 'rgba(76,175,80,0.7)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <CheckCircle size={10} /> {patch.explanation}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── 섹션 레이블 헬퍼 ──────────────────────────────────────────
function SectionLabel({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div
      style={{
        fontSize: 9,
        fontWeight: 700,
        color: 'rgba(255,255,255,0.25)',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        marginBottom: 6,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
      }}
    >
      {icon}
      {text}
    </div>
  );
}

// ── 메인 패널 ─────────────────────────────────────────────────
export default function VulnDetailPanel() {
  const filteredVulns                  = useVulnFilter();
  const optimisticUpdateManyVulnStatus = useSecureStore((s) => s.optimisticUpdateManyVulnStatus);
  const rollbackManyVulnStatus         = useSecureStore((s) => s.rollbackManyVulnStatus);
  const addToast                       = useToastStore((s) => s.addToast);

  const [selectedIds,      setSelectedIds]      = useState<Set<string>>(new Set());
  const [showDismissModal, setShowDismissModal] = useState(false);
  const [isBulkLoading,    setIsBulkLoading]   = useState(false);

  // ── 멀티셀렉트 헬퍼 ────────────────────────────────────────
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const selectAllOfType = useCallback((type: string) => {
    const ids = filteredVulns.filter((v) => v.type === type).map((v) => v.id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
  }, [filteredVulns]);

  // ── 스마트 배너: 같은 type 2건 이상 선택 시 ─────────────────
  // 선택된 id 중 가장 많이 선택된 type을 반환한다
  const smartBanner = useCallback((): {
    topType: string;
    selectedOfType: number;
    totalOfType: number;
  } | null => {
    if (selectedIds.size === 0) return null;
    const typeCount: Record<string, number> = {};
    Array.from(selectedIds).forEach((id) => {
      const v = filteredVulns.find((vv) => vv.id === id);
      if (v) typeCount[v.type] = (typeCount[v.type] ?? 0) + 1;
    });
    let topType = '';
    let topCount = 0;
    Object.entries(typeCount).forEach(([t, c]) => {
      if (c > topCount) { topType = t; topCount = c; }
    });
    if (topCount < 2) return null;
    const totalOfType = filteredVulns.filter((v) => v.type === topType).length;
    return { topType, selectedOfType: topCount, totalOfType };
  }, [selectedIds, filteredVulns]);

  // ── 벌크 트리아지 API 호출 ────────────────────────────────────
  const executeBulkTriage = useCallback(async (action: BulkTriageAction, reason?: string) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    const optimisticStatus = BULK_ACTION_TO_STATUS[action];
    const prevSnapshot = optimisticUpdateManyVulnStatus(ids, optimisticStatus);

    setIsBulkLoading(true);
    clearSelection();

    try {
      const result = await bulkTriageVulns({ vulnIds: ids, action, reason });

      const skippedSnapshot = buildSkippedSnapshot(ids, result.appliedVulnIds, prevSnapshot);
      if (Object.keys(skippedSnapshot).length > 0) {
        rollbackManyVulnStatus(skippedSnapshot);
      }

      if (result.skipped > 0) {
        addToast(`${result.applied}건 처리 완료, ${result.skipped}건 건너뜀 (권한 없음/미존재)`, 'warning');
      } else {
        addToast(`${result.applied}건 처리 완료`, 'info');
      }
    } catch {
      rollbackManyVulnStatus(prevSnapshot);
      addToast('벌크 트리아지 실패 — 잠시 후 다시 시도하세요', 'error');
    } finally {
      setIsBulkLoading(false);
    }
  }, [selectedIds, optimisticUpdateManyVulnStatus, rollbackManyVulnStatus, addToast, clearSelection]);

  const showBulkBar = selectedIds.size > 0;
  const banner = smartBanner();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {/* FilterBar — 상단 필터 UI */}
      <FilterBar />

      {/* 취약점 목록 */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '10px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          // 벌크 액션바 높이만큼 패딩 확보 — 마지막 카드가 바 뒤에 안 잘림
          paddingBottom: showBulkBar ? 96 : 10,
        }}
      >
        {filteredVulns.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>
            필터 조건에 맞는 취약점이 없습니다.
          </div>
        ) : (
          filteredVulns.map((v) => (
            <VulnCard
              key={v.id}
              vuln={v}
              isSelected={selectedIds.has(v.id)}
              onToggleSelect={toggleSelect}
            />
          ))
        )}
      </div>

      {/* ── 벌크 액션바 ─────────────────────────────────────────── */}
      {showBulkBar && (
        <div style={{ borderTop: '1px solid rgba(249,115,22,0.3)', background: 'var(--bg-0)', padding: '8px 10px', flexShrink: 0 }}>
          {/* 스마트 배너 — 같은 type 2건 이상 선택 시 */}
          {banner && (
            <div style={{ marginBottom: 8, padding: '6px 9px', borderRadius: 6, background: 'rgba(249,115,22,0.08)', border: '0.5px solid var(--orange-glow)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Zap size={12} color="#f97316" />
              <span style={{ fontSize: 11, color: '#f97316', flex: 1 }}>
                <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{banner.topType}</span>{' '}유형 {banner.selectedOfType}건 선택됨
              </span>
              {banner.selectedOfType < banner.totalOfType && (
                <button
                  onClick={() => selectAllOfType(banner.topType)}
                  style={{ fontSize: 10, fontWeight: 700, color: '#f97316', background: 'rgba(249,115,22,0.12)', border: '0.5px solid rgba(249,115,22,0.3)', borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}
                >
                  전체 {banner.totalOfType}건 선택 →
                </button>
              )}
            </div>
          )}

          {/* 액션 행 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 22, height: 22, borderRadius: 5, background: '#ea580c', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
              {selectedIds.size}
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>건 선택됨</span>
            <div style={{ flex: 1 }} />
            <button
              disabled={isBulkLoading}
              onClick={() => { void executeBulkTriage('CONFIRM'); }}
              style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, padding: '4px 9px', borderRadius: 5, background: 'rgba(34,197,94,0.12)', border: '0.5px solid rgba(34,197,94,0.35)', color: '#22c55e', cursor: isBulkLoading ? 'not-allowed' : 'pointer', opacity: isBulkLoading ? 0.5 : 1 }}
            >
              <Check size={10} />확인
            </button>
            <button
              disabled={isBulkLoading}
              onClick={() => setShowDismissModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, padding: '4px 9px', borderRadius: 5, background: 'rgba(245,158,11,0.1)', border: '0.5px solid rgba(245,158,11,0.3)', color: '#f59e0b', cursor: isBulkLoading ? 'not-allowed' : 'pointer', opacity: isBulkLoading ? 0.5 : 1 }}
            >
              <XCircle size={10} />기각
            </button>
            <button
              disabled={isBulkLoading}
              onClick={() => { void executeBulkTriage('ACCEPT_PATCH'); }}
              style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, padding: '4px 9px', borderRadius: 5, background: 'rgba(249,115,22,0.12)', border: '0.5px solid rgba(249,115,22,0.35)', color: '#f97316', cursor: isBulkLoading ? 'not-allowed' : 'pointer', opacity: isBulkLoading ? 0.5 : 1 }}
            >
              <Zap size={10} />패치채택
            </button>
            <button
              onClick={clearSelection}
              title="모두 해제"
              style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', borderRadius: 4 }}
            >
              <XCircle size={12} />
            </button>
          </div>
        </div>
      )}

      {/* ── DISMISS 사유 모달 ─────────────────────────────────────── */}
      {showDismissModal && (
        <DismissReasonModal
          count={selectedIds.size}
          onConfirm={(reason) => {
            setShowDismissModal(false);
            void executeBulkTriage('DISMISS', reason || undefined);
          }}
          onCancel={() => setShowDismissModal(false)}
        />
      )}
    </div>
  );
}
