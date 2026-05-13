// components/analysis/VulnDetailPanel.tsx
// 취약점 상세 아코디언 패널 — FilterBar 내장, useVulnFilter 훅 사용
'use client';
import { useState } from 'react';
import {
  ChevronDown, ChevronRight, AlertTriangle, CheckCircle,
  Zap, Info, Layers, RefreshCw,
} from 'lucide-react';
import { useSecureStore } from '@/store/useSecureStore';
import { useVulnFilter } from '@/hooks/useVulnFilter';
import { CallChainView } from '@/components/analysis/CallChainView';
import FilterBar from '@/components/ui/FilterBar';
import { mockPatches } from '@/lib/mockData';
import type { Vulnerability } from '@/lib/mockData';

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
  const setExpandedVulnId = useSecureStore((s) => s.setExpandedVulnId);
  const selectedPath      = useSecureStore((s) => s.selectedPath);
  const setSelectedPath   = useSecureStore((s) => s.setSelectedPath);
  const setRevealLine     = useSecureStore((s) => s.setRevealLine);

  const [isFixing,      setIsFixing]      = useState(false);
  const [patchApplied,  setPatchApplied]  = useState(vuln.status === 'patched');

  const isOpen  = expandedVulnId === vuln.id;
  const patch   = mockPatches.find((p) => p.vulnId === vuln.id);
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
    setTimeout(() => {
      setIsFixing(false);
      setPatchApplied(true);
    }, 1400);
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
              {vuln.description}
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
