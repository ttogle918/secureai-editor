// components/analysis/VulnDetailPanel.tsx
// 취약점 상세 아코디언 패널 — FilterBar 내장, useVulnFilter 훅 사용
'use client';
import { useEffect, useState, useCallback } from 'react';
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
function VulnCard({ vuln }: { vuln: Vulnerability }) {
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
        borderLeft:   `2px solid ${patchApplied ? '#4caf50' : sColor}`,
        borderRadius: 10,
        background:   '#141414',
        overflow:     'hidden',
        transition:   'border-color 0.2s',
        flexShrink:   0,
      }}
    >
      {/* 아코디언 헤더 — 닫힌 상태 고정 높이 52px */}
      <button
        onClick={handleToggle}
        aria-expanded={isOpen}
        style={{
          width: '100%',
          height: 52,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '0 14px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          flexShrink: 0,
          overflow: 'hidden',
        }}
      >
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

        {isOpen
          ? <ChevronDown  size={14} color="rgba(255,255,255,0.2)" style={{ flexShrink: 0 }} />
          : <ChevronRight size={14} color="rgba(255,255,255,0.2)" style={{ flexShrink: 0 }} />}
      </button>

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
  const filteredVulns = useVulnFilter();

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
        }}
      >
        {filteredVulns.length === 0 ? (
          <div
            style={{
              padding: 20,
              textAlign: 'center',
              color: 'rgba(255,255,255,0.2)',
              fontSize: 12,
            }}
          >
            필터 조건에 맞는 취약점이 없습니다.
          </div>
        ) : (
          filteredVulns.map((v) => <VulnCard key={v.id} vuln={v} />)
        )}
      </div>
    </div>
  );
}
