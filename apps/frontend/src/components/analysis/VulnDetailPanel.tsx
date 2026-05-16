// components/analysis/VulnDetailPanel.tsx
// 취약점 상세 아코디언 패널 — FilterBar 내장, useVulnFilter 훅 사용
'use client';
import { useEffect, useState, useCallback } from 'react';
import {
  ChevronDown, ChevronRight, AlertTriangle, CheckCircle,
  Zap, Info, Layers, RefreshCw, Play, Server,
} from 'lucide-react';
import { useSecureStore } from '@/store/useSecureStore';
import { useToastStore } from '@/hooks/useToast';
import { useVulnFilter } from '@/hooks/useVulnFilter';
import { useTranslate } from '@/hooks/useTranslate';
import { CallChainView } from '@/components/analysis/CallChainView';
import FilterBar from '@/components/ui/FilterBar';
import type { Vulnerability } from '@/lib/mockData';
import { deriveEndpoint } from '@/lib/vulnUtils';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080/api/v1';

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
      const res = await fetch(`${API_BASE}/dast/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
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
      if (!res.ok) throw new Error(`DAST 시작 실패: ${res.status}`);
      setDastSessionId(dastId);
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
  const [patchApplied,   setPatchApplied]   = useState(vuln.status === 'patched');
  const [translatedDesc, setTranslatedDesc] = useState<string | null>(null);

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
          <span className="bg-red-600 text-white text-xs px-2 py-0.5 rounded font-bold" style={{ flexShrink: 0 }}>
            EXPLOITED
          </span>
        ) : exploitResult && !exploitResult.success ? (
          <span className="bg-gray-600 text-white text-xs px-2 py-0.5 rounded" style={{ flexShrink: 0 }}>
            DAST ✗
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

          {/* DAST 실행 */}
          <DastRunSection vuln={vuln} />

          {/* DAST 결과 */}
          {vuln.dastResult && (
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
