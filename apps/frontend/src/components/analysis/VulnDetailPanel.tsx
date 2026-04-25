// ── 에디터 오른쪽: 취약점 상세 토글 패널 (수정 가능) ──────────
'use client';
import { useState, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronDown, ChevronRight, AlertTriangle, CheckCircle,
  Zap, Info, ExternalLink, Layers, RefreshCw,
} from 'lucide-react';
import { useSecureStore as useAppStore } from '@/store/useSecureStore';
import { mockPatches } from '@/lib/mockData';
import type { Vulnerability } from '@/lib/mockData';

const SEV_COLOR: Record<string, string> = {
  critical: '#e24b4b', high: '#f59e0b', medium: '#eab308', low: '#22c55e',
};
const LAYER_COLOR: Record<string, string> = {
  Frontend: '#378ADD', Controller: '#7F77DD', Service: '#1D9E75',
  Repository: '#E24B4A', Config: '#BA7517',
};

function CallChainItem({
  vuln,
  onJump,
}: {
  vuln: Vulnerability;
  onJump: (path: string, line: number) => void;
}) {
  if (!vuln.callChain?.length) {
    return (
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', fontStyle: 'italic', padding: '8px 0' }}>
        API 호출 체인 없음 — 독립 파일 취약점
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
      {vuln.callChain.map((step, i) => (
        <div key={i} style={{ display: 'flex', gap: 10 }}>
          {/* 타임라인 선 */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 14, flexShrink: 0 }}>
            <div
              style={{
                width: 10, height: 10, borderRadius: '50%', marginTop: 4, flexShrink: 0,
                background: step.isVulnerable ? '#E24B4A' : 'rgba(255,255,255,0.18)',
                boxShadow: step.isVulnerable ? '0 0 12px rgba(226,75,74,0.8)' : 'none',
              }}
            />
            {i < vuln.callChain!.length - 1 && (
              <div style={{ width: 1, flex: 1, minHeight: 24, background: 'rgba(255,255,255,0.07)' }} />
            )}
          </div>

          {/* 내용 */}
          <button
            onClick={() => onJump(step.filePath, step.line)}
            style={{
              flex: 1, paddingBottom: 14, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
            }}
          >
            <div style={{
              fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em',
              color: LAYER_COLOR[step.layer] ?? 'rgba(255,255,255,0.3)',
              marginBottom: 2,
            }}>
              {step.layer}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
              <span style={{ fontWeight: 700, color: step.isVulnerable ? '#E24B4A' : 'rgba(255,255,255,0.75)', fontSize: 11 }}>
                {step.label}
              </span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                {step.file}:{step.line} <ExternalLink size={8} />
              </span>
            </div>
            {step.codeSnippet && (
              <div style={{
                marginTop: 3, fontSize: 10, padding: '3px 6px', borderRadius: 4,
                background: step.isVulnerable ? 'rgba(226,75,74,0.08)' : 'rgba(255,255,255,0.04)',
                color: step.isVulnerable ? '#f87171' : 'rgba(255,255,255,0.35)',
                border: step.isVulnerable ? '0.5px solid rgba(226,75,74,0.25)' : 'none',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {step.codeSnippet}
              </div>
            )}
            {step.isVulnerable && (
              <div style={{
                marginTop: 4, fontSize: 10, padding: '3px 8px', borderRadius: 4,
                background: 'rgba(226,75,74,0.1)', border: '0.5px solid rgba(226,75,74,0.3)',
                color: '#E24B4A',
              }}>
                ⚡ 취약점 발생 — 클릭하면 코드로 이동
              </div>
            )}
          </button>
        </div>
      ))}
    </div>
  );
}

function VulnCard({ vuln }: { vuln: Vulnerability }) {
  const expandedVulnId    = useAppStore(s => s.expandedVulnId);
  const setExpandedVulnId = useAppStore(s => s.setExpandedVulnId);
  const setSelectedPath   = useAppStore(s => s.setSelectedPath);
  const setViewMode       = useAppStore(s => s.setViewMode);
  const [isFixing, setIsFixing] = useState(false);
  const [patchApplied, setPatchApplied] = useState(vuln.status === 'patched');

  const isOpen = expandedVulnId === vuln.id;
  const patch  = mockPatches.find(p => p.vulnId === vuln.id);
  const sColor = SEV_COLOR[vuln.severity] ?? '#888';

  const handleJump = (path: string, line: number) => {
    setSelectedPath(path);
    setViewMode('editor');
  };

  const handleFix = () => {
    setIsFixing(true);
    setTimeout(() => {
      setIsFixing(false);
      setPatchApplied(true);
    }, 1400);
  };

  return (
    <div style={{
      borderTop: isOpen ? `0.5px solid rgba(255,255,255,0.15)` : '0.5px solid rgba(255,255,255,0.06)',
      borderRight: isOpen ? `0.5px solid rgba(255,255,255,0.15)` : '0.5px solid rgba(255,255,255,0.06)',
      borderBottom: isOpen ? `0.5px solid rgba(255,255,255,0.15)` : '0.5px solid rgba(255,255,255,0.06)',
      borderLeft: `2px solid ${patchApplied ? '#4caf50' : sColor}`,
      borderRadius: 10,
      background: '#141414',
      overflow: 'hidden',
      transition: 'border-color 0.2s',
    }}>
      {/* 토글 헤더 */}
      <button
        onClick={() => setExpandedVulnId(isOpen ? null : vuln.id)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '11px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, flexShrink: 0,
          background: `${sColor}18`, color: sColor, border: `0.5px solid ${sColor}30`,
          textTransform: 'uppercase',
        }}>
          {vuln.severity}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: patchApplied ? '#4caf50' : '#fff', marginBottom: 2 }}>
            {patchApplied && <span style={{ marginRight: 5 }}>✓</span>}
            {vuln.type}
          </div>
          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.3)' }}>
            {vuln.filePath.split('/').pop()}:{vuln.lineStart}
            {vuln.apiEndpoint && (
              <span style={{ marginLeft: 8, color: '#f9731666' }}>{vuln.apiEndpoint}</span>
            )}
          </div>
        </div>
        {isOpen ? <ChevronDown size={14} color="rgba(255,255,255,0.2)" /> : <ChevronRight size={14} color="rgba(255,255,255,0.2)" />}
      </button>

      {/* 토글 상세 */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            style={{ overflow: 'hidden', borderTop: '0.5px solid rgba(255,255,255,0.06)' }}
          >
            <div style={{ padding: '16px 14px', background: 'rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* 설명 */}
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Info size={10} /> 설명
                </div>
                <p style={{ fontSize: 12, lineHeight: 1.7, color: 'rgba(255,255,255,0.7)' }}>{vuln.description}</p>
                <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                  {[vuln.cweId, vuln.owaspCategory].map(t => (
                    <span key={t} style={{ fontSize: 9, padding: '1px 6px', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 3, color: 'rgba(255,255,255,0.3)' }}>{t}</span>
                  ))}
                </div>
              </div>

              {/* DAST 결과 */}
              {vuln.dastResult && (
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <AlertTriangle size={10} color="#f97316" /> 공격 시나리오
                  </div>
                  <div style={{ padding: '8px 10px', background: 'rgba(249,115,22,0.06)', border: '0.5px solid rgba(249,115,22,0.15)', borderRadius: 8, fontSize: 11, color: 'rgba(253,186,116,0.8)', fontStyle: 'italic', lineHeight: 1.6 }}>
                    {vuln.dastResult}
                  </div>
                </div>
              )}

              {/* Call Chain */}
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Layers size={10} /> API 호출 체인
                </div>
                <CallChainItem vuln={vuln} onJump={handleJump} />
              </div>

              {/* 패치 제안 */}
              {patch && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Zap size={10} color="#4caf50" /> 패치 제안
                    </div>
                    {!patchApplied && (
                      <button
                        onClick={handleFix}
                        disabled={isFixing}
                        style={{
                          fontSize: 10, padding: '4px 10px', background: '#16a34a', border: 'none',
                          borderRadius: 5, color: '#fff', fontWeight: 700, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: 4,
                          boxShadow: '0 2px 8px rgba(22,163,74,0.3)',
                        }}
                      >
                        {isFixing ? <RefreshCw size={10} className="animate-spin" /> : <Zap size={10} />}
                        AUTO FIX
                      </button>
                    )}
                    {patchApplied && (
                      <span style={{ fontSize: 10, color: '#4caf50', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <CheckCircle size={10} /> 적용됨
                      </span>
                    )}
                  </div>

                  {/* 원본 vs 패치 diff */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    <div>
                      <div style={{ fontSize: 9, color: '#E24B4A', marginBottom: 4, opacity: 0.7 }}>Before</div>
                      <div style={{ background: '#050505', borderRadius: 6, border: '0.5px solid rgba(226,75,74,0.2)', padding: '8px 10px', fontFamily: 'var(--font-mono)', fontSize: 10, color: '#f87171', lineHeight: 1.7 }}>
                        {patch.originalCode.split('\n').map((l, i) => (
                          <div key={i}><span style={{ opacity: 0.3 }}>- </span>{l}</div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, color: '#4caf50', marginBottom: 4, opacity: 0.7 }}>After</div>
                      <div style={{ background: '#050505', borderRadius: 6, border: '0.5px solid rgba(76,175,80,0.2)', padding: '8px 10px', fontFamily: 'var(--font-mono)', fontSize: 10, color: '#86efac', lineHeight: 1.7 }}>
                        {patch.patchedCode.split('\n').map((l, i) => (
                          <div key={i}><span style={{ opacity: 0.3 }}>+ </span>{l}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 10, color: 'rgba(76,175,80,0.7)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <CheckCircle size={10} /> {patch.explanation}
                  </div>
                </div>
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function VulnDetailPanel() {
  const vulns = useAppStore((s) => s.vulns);
  const severityFilter = useAppStore((s) => s.severityFilter);
  const apiGroupFilter = useAppStore((s) => s.apiGroupFilter);

  const filteredVulns = useMemo(() => {
    return vulns.filter((v) => {
      const sevOk = severityFilter === 'all' || v.severity === severityFilter;
      const apiOk =
        !apiGroupFilter ||
        (v.apiGroup
          ? v.apiGroup === apiGroupFilter || v.apiGroup.startsWith(apiGroupFilter + '/')
          : apiGroupFilter === 'other');
      return sevOk && apiOk;
    });
  }, [vulns, severityFilter, apiGroupFilter]);

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '10px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      {filteredVulns.length === 0 ? (
        <div style={{ padding: 20, textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>
          필터 조건에 맞는 취약점이 없습니다.
        </div>
      ) : (
        filteredVulns.map(v => <VulnCard key={v.id} vuln={v} />)
      )}
    </div>
  );
}
