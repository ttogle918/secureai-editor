'use client';
import type { Vulnerability, PatchSuggestion } from '@/lib/mockData';

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

export default function VulnPanel({ vulns, patches, selectedId, onSelect }: Props) {
  const selectedVuln = vulns.find((v) => v.id === selectedId);
  const patch = selectedVuln
    ? patches.find((p) =>
        (p.vulnId && p.vulnId === selectedId) ||
        (p.filePath === selectedVuln.filePath && p.vulnType === selectedVuln.type)
      )
    : undefined;

  return (
    <div className="flex flex-col h-full">
      {/* 취약점 목록 */}
      <div className="overflow-y-auto" style={{ maxHeight: selectedVuln ? '45%' : '100%' }}>
        {vulns.map((v) => (
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
              <span className={`badge badge-${v.severity}`}>{severityLabel[v.severity]}</span>
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
