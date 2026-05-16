'use client';
import { useState } from 'react';
import type { Vulnerability, PatchSuggestion } from '@/lib/mockData';
import { useSecureStore } from '@/store/useSecureStore';

const severityLabel: Record<string, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

const statusLabel: Record<string, string> = {
  open:      '미해결',
  exploited: '익스플로잇됨',
  patched:   '패치됨',
  pending:   '대기중',
};

const statusColor: Record<string, string> = {
  open:      'var(--text-secondary)',
  exploited: 'var(--critical)',
  patched:   'var(--success)',
  pending:   'var(--high)',
};

interface Props {
  vulns: Vulnerability[];
  patches: PatchSuggestion[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

type DastFilter = 'all' | 'dast_done' | 'exploited' | 'safe';

const FILTER_LABELS: Record<DastFilter, string> = {
  all:       '전체',
  dast_done: 'DAST 완료',
  exploited: 'EXPLOITED',
  safe:      'DAST 안전',
};

export default function VulnPanel({ vulns, patches, selectedId, onSelect }: Props) {
  const dastExploitResults = useSecureStore((s) => s.dastExploitResults);
  const [dastFilter, setDastFilter] = useState<DastFilter>('all');

  const selectedVuln = vulns.find((v) => v.id === selectedId);
  const patch = selectedVuln
    ? patches.find((p) =>
        (p.vulnId && p.vulnId === selectedId) ||
        (p.filePath === selectedVuln.filePath && p.vulnType === selectedVuln.type)
      )
    : undefined;

  const filteredVulns = vulns.filter((v) => {
    if (dastFilter === 'all') return true;
    const r = dastExploitResults[v.id];
    if (dastFilter === 'dast_done') return !!r;
    if (dastFilter === 'exploited') return r?.success === true;
    if (dastFilter === 'safe')      return !!r && r.success === false;
    return true;
  });

  const dastDoneCount   = vulns.filter((v) => !!dastExploitResults[v.id]).length;
  const exploitedCount  = vulns.filter((v) => dastExploitResults[v.id]?.success === true).length;

  return (
    <div className="flex flex-col h-full">

      {/* DAST 필터 태그 */}
      <div style={{
        display: 'flex', gap: 4, padding: '6px 10px',
        borderBottom: '1px solid var(--border)', flexWrap: 'wrap',
      }}>
        {(['all', 'dast_done', 'exploited', 'safe'] as DastFilter[]).map((f) => {
          const active = dastFilter === f;
          const count = f === 'all' ? vulns.length
            : f === 'dast_done'  ? dastDoneCount
            : f === 'exploited'  ? exploitedCount
            : dastDoneCount - exploitedCount;
          const accentColor = f === 'exploited' ? '#f87171'
            : f === 'safe'     ? '#4ade80'
            : f === 'dast_done' ? '#f97316'
            : 'rgba(255,255,255,0.5)';
          return (
            <button
              key={f}
              onClick={() => setDastFilter(f)}
              style={{
                fontSize: 9, fontWeight: active ? 700 : 500,
                padding: '2px 7px', borderRadius: 4, cursor: 'pointer',
                border: `0.5px solid ${active ? accentColor : 'rgba(255,255,255,0.1)'}`,
                background: active ? `${accentColor}18` : 'transparent',
                color: active ? accentColor : 'rgba(255,255,255,0.35)',
                transition: 'all 0.15s',
              }}
            >
              {FILTER_LABELS[f]}
              {count > 0 && (
                <span style={{ marginLeft: 4, opacity: 0.7 }}>({count})</span>
              )}
            </button>
          );
        })}
      </div>

      {/* 취약점 목록 */}
      <div className="overflow-y-auto" style={{ maxHeight: selectedVuln ? '45%' : '100%' }}>
        {filteredVulns.map((v) => (
          <div
            key={v.id}
            onClick={() => onSelect(v.id)}
            className="px-3 py-2 cursor-pointer border-b"
            style={{
              borderColor: 'var(--border)',
              background: selectedId === v.id ? 'var(--bg-selected)' : 'transparent',
            }}
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                {v.type}
              </span>
              <div className="flex items-center gap-1.5">
                {/* DAST 결과 배지 */}
                {(() => {
                  const dr = dastExploitResults[v.id];
                  if (dr?.success === true) return (
                    <span style={{ fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 3, background: 'rgba(220,38,38,0.15)', color: '#f87171', border: '0.5px solid rgba(220,38,38,0.4)' }}>EXPLOITED</span>
                  );
                  if (dr && !dr.success) return (
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: 'rgba(34,197,94,0.12)', color: '#4ade80', border: '0.5px solid rgba(34,197,94,0.3)' }}>DAST 안전</span>
                  );
                  return null;
                })()}
                {/* 패치/해결 배지 */}
                {(() => {
                  const p = patches.find((p) =>
                    (p.vulnId && p.vulnId === v.id) ||
                    (p.filePath === v.filePath && p.vulnType === v.type)
                  );
                  if (v.status === 'patched') return (
                    <span style={{ fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 3, background: 'rgba(76,175,80,0.15)', color: '#4caf50', border: '0.5px solid rgba(76,175,80,0.35)' }}>SOLVED</span>
                  );
                  if (p) return (
                    <span style={{ fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 3, background: 'rgba(234,88,12,0.12)', color: '#f97316', border: '0.5px solid rgba(234,88,12,0.3)' }}>PATCHED</span>
                  );
                  return null;
                })()}
                <span className={`badge badge-${v.severity}`}>{severityLabel[v.severity]}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
              <span>{v.filePath.split('/').pop()}:{v.lineStart}</span>
              <span style={{ color: statusColor[v.status] }}>● {statusLabel[v.status]}</span>
            </div>
          </div>
        ))}
      </div>

      {/* 선택된 취약점 상세 */}
      {selectedVuln && (
        <div className="flex-1 overflow-y-auto border-t p-3 flex flex-col gap-3" style={{ borderColor: 'var(--border)' }}>
          {/* 헤더 */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`badge badge-${selectedVuln.severity}`}>{severityLabel[selectedVuln.severity]}</span>
              <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{selectedVuln.type}</span>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {selectedVuln.description}
            </p>
          </div>

          {/* 태그 */}
          <div className="flex gap-2 flex-wrap">
            {[selectedVuln.cweId, selectedVuln.owaspCategory].map((tag) => (
              <span
                key={tag}
                className="text-xs px-2 py-0.5 rounded"
                style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-light)', color: 'var(--text-tertiary)' }}
              >
                {tag}
              </span>
            ))}
          </div>

          {/* DAST 결과 */}
          {selectedVuln.dastResult && (
            <div className="rounded p-2 text-xs" style={{ background: 'var(--critical-bg)', border: '1px solid var(--critical)', color: 'var(--critical)' }}>
              ⚡ {selectedVuln.dastResult}
            </div>
          )}

          {/* 패치 제안 */}
          {patch && (
            <div className="rounded overflow-hidden" style={{ border: '1px solid var(--border-light)' }}>
              <div
                className="flex items-center justify-between px-3 py-1.5 text-xs font-medium"
                style={{ background: 'var(--success-bg)', color: 'var(--success)' }}
              >
                <span>AI 패치 제안</span>
                <button
                  className="text-xs px-2 py-0.5 rounded"
                  style={{ background: 'var(--success)', color: '#fff', border: 'none', cursor: 'pointer' }}
                >
                  적용 →
                </button>
              </div>
              <div className="p-2">
                <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono, monospace)' }}>
                  {patch.explanation}
                </p>
                <div
                  className="text-xs p-2 rounded"
                  style={{ background: '#0d0d0d', color: 'var(--success)', fontFamily: 'var(--font-mono, monospace)', whiteSpace: 'pre' }}
                >
                  {patch.patchedCode.split('\n').map((line, i) => (
                    <div key={i}><span style={{ color: 'var(--success)', opacity: 0.5 }}>+ </span>{line}</div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
