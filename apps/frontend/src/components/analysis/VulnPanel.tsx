'use client';
import { useState, useCallback, useRef, useEffect } from 'react';
import { Zap, Terminal, XCircle, Copy, ExternalLink, Eye, Sparkles, Check, X } from 'lucide-react';
import type { Vulnerability, VulnStatus, PatchSuggestion } from '@/lib/mockData';
import { isVulnResolved } from '@/lib/mockData';
import { useSecureStore } from '@/store/useSecureStore';
import { EmptyState } from '@/components/ui/EmptyState';
import { bulkTriageVulns, type BulkTriageAction } from '@/lib/api/vulnerabilities';
import { useToastStore } from '@/hooks/useToast';

// action → 낙관적 갱신에 사용할 VulnStatus 매핑
// 백엔드 응답 newStatus를 최종 신뢰하므로 낙관 갱신 후 skip만 rollback
const ACTION_TO_STATUS: Record<BulkTriageAction, VulnStatus> = {
  CONFIRM:      'open',
  DISMISS:      'false_positive',
  ACCEPT_PATCH: 'fixed',
};

const DISMISS_REASON_MAX_LEN = 1000;

/**
 * skip된 항목만 이전 status로 복원하는 스냅샷을 계산한다.
 * appliedVulnIds에 없는 id를 prevSnapshot에서 찾아 반환한다.
 * 호출자가 rollbackManyVulnStatus에 전달하여 실제 롤백을 수행한다.
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

const SEVERITY_ORDER: Array<'critical' | 'high' | 'medium' | 'low'> = ['critical', 'high', 'medium', 'low'];

const severityLabel: Record<string, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

const severityColor: Record<string, string> = {
  critical: 'var(--critical)',
  high:     'var(--high)',
  medium:   'var(--medium)',
  low:      'var(--low)',
};

// VulnStatus(서버 정렬: open|false_positive|fixed) 와 1:1 대응
const statusLabel: Record<VulnStatus, string> = {
  open:           '미해결',
  false_positive: '기각됨',
  fixed:          '패치됨',
};

const statusColor: Record<VulnStatus, string> = {
  open:           'var(--text-secondary)',
  false_positive: 'var(--text-tertiary)',
  fixed:          'var(--success)',
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

// ── 우클릭 컨텍스트 메뉴 ──────────────────────────────────────────
interface ContextMenuState {
  x: number;
  y: number;
  vulnId: string;
}

function VulnContextMenu({
  menu,
  onClose,
  onAskAI,
  onDast,
  onPatch,
  onIgnore,
}: {
  menu: ContextMenuState;
  onClose: () => void;
  onAskAI: (id: string) => void;
  onDast: (id: string) => void;
  onPatch: (id: string) => void;
  onIgnore: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  type MenuItem =
    | { type: 'item'; icon: React.ReactNode; label: string; tone?: string; action: () => void; kbd?: string }
    | { type: 'divider' };

  const items: MenuItem[] = [
    { type: 'item', icon: <Sparkles size={12} />, label: 'AI에게 질문',    tone: 'var(--tag-1)', action: () => { onAskAI(menu.vulnId);  onClose(); }, kbd: '↵' },
    { type: 'item', icon: <Eye size={12} />,      label: '취약점 상세 보기', action: () => { onClose(); },                             kbd: '⌘D' },
    { type: 'item', icon: <Terminal size={12} />, label: 'DAST 실행',      tone: 'var(--orange)', action: () => { onDast(menu.vulnId); onClose(); }, kbd: '⌘T' },
    { type: 'item', icon: <Zap size={12} />,      label: '패치 적용',       tone: 'var(--low)',    action: () => { onPatch(menu.vulnId); onClose(); }, kbd: '⌘P' },
    { type: 'divider' },
    { type: 'item', icon: <Copy size={12} />,          label: '취약점 복사',          action: () => { onClose(); } },
    { type: 'item', icon: <ExternalLink size={12} />,  label: 'CWE/OWASP 참조 열기', action: () => { onClose(); } },
    { type: 'divider' },
    { type: 'item', icon: <XCircle size={12} />,  label: '이 취약점 무시', tone: 'var(--text-tertiary)', action: () => { onIgnore(menu.vulnId); onClose(); } },
  ];

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        left: menu.x,
        top: menu.y,
        zIndex: 9000,
        width: 220,
        background: 'var(--bg-2)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 8,
        boxShadow: '0 12px 32px rgba(0,0,0,0.55)',
        padding: 4,
      }}
    >
      {items.map((item, i) => {
        if (item.type === 'divider') {
          return <div key={i} style={{ height: 1, background: 'var(--hairline)', margin: '4px 0' }} />;
        }
        return (
          <button
            key={i}
            onClick={item.action}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '6px 10px',
              borderRadius: 5,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: item.tone ?? 'var(--text-primary)',
              fontSize: 12,
              textAlign: 'left',
              transition: 'background 0.1s',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            {item.icon}
            <span style={{ flex: 1 }}>{item.label}</span>
            {item.kbd && (
              <span style={{ fontSize: 9, color: 'var(--text-tertiary)', padding: '1px 4px', borderRadius: 3, background: 'var(--bg-3)', fontFamily: 'var(--font-mono)' }}>
                {item.kbd}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── DAST 배지 ──────────────────────────────────────────────────────
function DastBadge({ vulnId }: { vulnId: string }) {
  const dastExploitResults = useSecureStore((s) => s.dastExploitResults);
  const r = dastExploitResults[vulnId];

  if (!r) {
    return (
      <span style={{
        fontSize: 8,
        fontWeight: 700,
        padding: '1px 5px',
        borderRadius: 3,
        background: 'var(--bg-3)',
        color: 'var(--text-tertiary)',
        border: '0.5px solid rgba(255,255,255,0.08)',
        whiteSpace: 'nowrap',
      }}>
        DAST · 미실행
      </span>
    );
  }

  if (r.success) {
    return (
      <span style={{
        fontSize: 8,
        fontWeight: 800,
        padding: '1px 5px',
        borderRadius: 3,
        background: 'rgba(220,38,38,0.15)',
        color: 'var(--critical)',
        border: '0.5px solid rgba(220,38,38,0.4)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        whiteSpace: 'nowrap',
      }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--critical)', display: 'inline-block' }} />
        DAST · EXPLOITED
      </span>
    );
  }

  return (
    <span style={{
      fontSize: 8,
      fontWeight: 700,
      padding: '1px 5px',
      borderRadius: 3,
      background: 'rgba(34,197,94,0.12)',
      color: 'var(--low)',
      border: '0.5px solid rgba(34,197,94,0.3)',
      whiteSpace: 'nowrap',
    }}>
      DAST · DAST 안전
    </span>
  );
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

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)',
      }}
      onClick={onCancel}
      onKeyDown={(e) => { if (e.key === 'Escape') onCancel(); }}
      role="presentation"
    >
      <div
        style={{
          width: 400,
          background: 'var(--bg-2)',
          border: '1px solid rgba(245,158,11,0.4)',
          borderRadius: 10,
          padding: 20,
          boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
            기각 사유 입력
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            {count}건을 기각합니다. 사유는 선택 입력이지만 리랭커 학습에 활용됩니다.
          </div>
        </div>
        <textarea
          ref={textareaRef}
          value={reason}
          onChange={(e) => setReason(e.target.value.slice(0, DISMISS_REASON_MAX_LEN))}
          placeholder="기각 사유를 입력하세요 (선택)"
          rows={4}
          style={{
            width: '100%',
            background: 'var(--bg-3)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            color: 'var(--text-primary)',
            fontSize: 12,
            padding: '8px 10px',
            resize: 'vertical',
            fontFamily: 'inherit',
            boxSizing: 'border-box',
          }}
        />
        <div style={{ textAlign: 'right', fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>
          {reason.length}/{DISMISS_REASON_MAX_LEN}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
          <button
            onClick={onCancel}
            style={{ fontSize: 12, padding: '5px 14px', borderRadius: 5, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer' }}
          >
            취소
          </button>
          <button
            onClick={() => onConfirm(reason)}
            style={{ fontSize: 12, fontWeight: 700, padding: '5px 14px', borderRadius: 5, background: 'rgba(245,158,11,0.15)', border: '0.5px solid rgba(245,158,11,0.4)', color: '#f59e0b', cursor: 'pointer' }}
          >
            기각 확정
          </button>
        </div>
      </div>
    </div>
  );
}

export default function VulnPanel({ vulns, patches, selectedId, onSelect }: Props) {
  const dastExploitResults              = useSecureStore((s) => s.dastExploitResults);
  const applyPatch                      = useSecureStore((s) => s.applyPatch);
  const optimisticUpdateManyVulnStatus  = useSecureStore((s) => s.optimisticUpdateManyVulnStatus);
  const rollbackManyVulnStatus          = useSecureStore((s) => s.rollbackManyVulnStatus);
  const addToast                        = useToastStore((s) => s.addToast);

  const [dastFilter,       setDastFilter]       = useState<DastFilter>('all');
  const [severityFilter,   setSeverityFilter]   = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all');
  const [apiGroupFilter,   setApiGroupFilter]   = useState<string | null>(null);
  const [collapsedGroups,  setCollapsedGroups]  = useState<Set<string>>(new Set());
  const [selectedIds,      setSelectedIds]      = useState<Set<string>>(new Set());
  const [contextMenu,      setContextMenu]      = useState<ContextMenuState | null>(null);
  const [showDismissModal, setShowDismissModal] = useState(false);
  const [isBulkLoading,    setIsBulkLoading]   = useState(false);

  const selectedVuln = vulns.find((v) => v.id === selectedId);
  const patch = selectedVuln
    ? patches.find((p) =>
        (p.vulnId && p.vulnId === selectedId) ||
        (p.filePath === selectedVuln.filePath && p.vulnType === selectedVuln.type)
      )
    : undefined;

  // ── API 그룹 목록 ─────────────────────────────────────────────
  const apiGroups = Array.from(
    new Set(vulns.map((v) => v.apiGroup).filter((g): g is string => !!g))
  );

  // ── 필터 적용 ─────────────────────────────────────────────────
  const filteredVulns = vulns.filter((v) => {
    const r = dastExploitResults[v.id];
    if (dastFilter === 'dast_done'  && !r)                    return false;
    if (dastFilter === 'exploited'  && r?.success !== true)   return false;
    if (dastFilter === 'safe'       && !(r && !r.success))    return false;
    if (severityFilter !== 'all'    && v.severity !== severityFilter) return false;
    if (apiGroupFilter !== null && v.apiGroup !== apiGroupFilter) return false;
    return true;
  });

  // ── 카운터 ────────────────────────────────────────────────────
  const dastDoneCount  = vulns.filter((v) =>  !!dastExploitResults[v.id]).length;
  const exploitedCount = vulns.filter((v) =>   dastExploitResults[v.id]?.success === true).length;

  // ── 그룹 토글 ─────────────────────────────────────────────────
  const toggleGroup = (sev: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(sev)) next.delete(sev); else next.add(sev);
      return next;
    });
  };

  // ── 체크박스 ─────────────────────────────────────────────────
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  // ── 스마트 배너: 선택된 id 중 같은 type이 2건 이상인 경우 ─────────────────
  // type별 선택 건수를 계산하여 가장 많이 선택된 type을 찾는다
  const smartBannerInfo = useCallback((): {
    topType: string;
    selectedOfType: number;
    totalOfType: number;
  } | null => {
    if (selectedIds.size === 0) return null;
    const typeCount: Record<string, number> = {};
    Array.from(selectedIds).forEach((id) => {
      const v = vulns.find((vv) => vv.id === id);
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
  }, [selectedIds, vulns, filteredVulns]);

  // 스마트 배너 클릭 — 해당 type의 filteredVulns 전체 선택
  const selectAllOfType = useCallback((type: string) => {
    const ids = filteredVulns.filter((v) => v.type === type).map((v) => v.id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
  }, [filteredVulns]);

  // ── 벌크 트리아지 API 호출 ────────────────────────────────────
  const executeBulkTriage = useCallback(async (action: BulkTriageAction, reason?: string) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    const optimisticStatus = ACTION_TO_STATUS[action];
    // 낙관적 갱신 — 이전 상태 스냅샷 보관
    const prevSnapshot = optimisticUpdateManyVulnStatus(ids, optimisticStatus);

    setIsBulkLoading(true);
    clearSelection();

    try {
      const result = await bulkTriageVulns({ vulnIds: ids, action, reason });

      // skip된 항목만 이전 상태로 복원
      const skippedSnapshot = buildSkippedSnapshot(ids, result.appliedVulnIds, prevSnapshot);
      if (Object.keys(skippedSnapshot).length > 0) {
        rollbackManyVulnStatus(skippedSnapshot);
      }

      // 결과 토스트
      if (result.skipped > 0) {
        addToast(
          `${result.applied}건 처리 완료, ${result.skipped}건 건너뜀 (권한 없음/미존재)`,
          'warning',
        );
      } else {
        addToast(`${result.applied}건 처리 완료`, 'info');
      }
    } catch {
      // 전체 실패 시 전체 롤백
      rollbackManyVulnStatus(prevSnapshot);
      addToast('벌크 트리아지 실패 — 잠시 후 다시 시도하세요', 'error');
    } finally {
      setIsBulkLoading(false);
    }
  }, [selectedIds, optimisticUpdateManyVulnStatus, rollbackManyVulnStatus, addToast]);

  // ── 컨텍스트 메뉴 ─────────────────────────────────────────────
  const handleContextMenu = useCallback((e: React.MouseEvent, id: string) => {
    e.preventDefault();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const menuW = 228;
    const menuH = 240;
    setContextMenu({
      x: Math.min(e.clientX, vw - menuW - 8),
      y: Math.min(e.clientY, vh - menuH - 8),
      vulnId: id,
    });
  }, []);

  const showBulkBar = selectedIds.size > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>

      {/* ── 심각도 필터 칩 ─────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '6px 10px 0',
        flexWrap: 'wrap',
      }}>
        <span style={{ width: 36, fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
          심각도
        </span>
        {(['all', 'critical', 'high', 'medium', 'low'] as const).map((f) => {
          const active = severityFilter === f;
          const count = f === 'all' ? vulns.length : vulns.filter((v) => v.severity === f).length;
          const color = f === 'all' ? 'rgba(255,255,255,0.5)' : `var(--${f})`;
          return (
            <button
              key={f}
              onClick={() => setSeverityFilter(f)}
              style={{
                fontSize: 9,
                fontWeight: active ? 700 : 500,
                padding: '2px 7px',
                borderRadius: 4,
                cursor: 'pointer',
                border: `0.5px solid ${active ? color : 'rgba(255,255,255,0.1)'}`,
                background: active ? `${color === 'rgba(255,255,255,0.5)' ? 'rgba(255,255,255,0.08)' : `${color}18`}` : 'transparent',
                color: active ? color : 'rgba(255,255,255,0.35)',
                transition: 'all 0.15s',
              }}
            >
              {f === 'all' ? 'ALL' : f.charAt(0).toUpperCase() + f.slice(1)}
              {count > 0 && <span style={{ marginLeft: 4, opacity: 0.7 }}>({count})</span>}
            </button>
          );
        })}
      </div>

      {/* ── DAST 필터 칩 ────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 10px 0',
        flexWrap: 'wrap',
      }}>
        <span style={{ width: 36, fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
          DAST
        </span>
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
                fontSize: 9,
                fontWeight: active ? 700 : 500,
                padding: '2px 7px',
                borderRadius: 4,
                cursor: 'pointer',
                border: `0.5px solid ${active ? accentColor : 'rgba(255,255,255,0.1)'}`,
                background: active ? `${accentColor}18` : 'transparent',
                color: active ? accentColor : 'rgba(255,255,255,0.35)',
                transition: 'all 0.15s',
              }}
            >
              {FILTER_LABELS[f]}
              {count > 0 && <span style={{ marginLeft: 4, opacity: 0.7 }}>({count})</span>}
            </button>
          );
        })}
      </div>

      {/* ── API 그룹 필터 칩 ──────────────────────────────────────── */}
      {apiGroups.length > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '4px 10px 6px',
          borderBottom: '1px solid var(--border)',
          flexWrap: 'wrap',
        }}>
          <span style={{ width: 36, fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
            API
          </span>
          {apiGroups.map((g) => {
            const active = apiGroupFilter === g;
            const cnt = vulns.filter((v) => v.apiGroup === g).length;
            return (
              <button
                key={g}
                onClick={() => setApiGroupFilter(active ? null : g)}
                style={{
                  fontSize: 9,
                  fontWeight: active ? 700 : 500,
                  padding: '2px 7px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  border: `0.5px solid ${active ? 'var(--orange)' : 'rgba(255,255,255,0.1)'}`,
                  background: active ? 'var(--orange-dim)' : 'transparent',
                  color: active ? 'var(--orange)' : 'rgba(255,255,255,0.35)',
                  transition: 'all 0.15s',
                }}
              >
                {g}
                {cnt > 0 && <span style={{ marginLeft: 4, opacity: 0.7 }}>({cnt})</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* ── 취약점 목록 (심각도 그룹) ───────────────────────────────── */}
      <div style={{ overflowY: 'auto', flex: selectedVuln ? '0 0 45%' : 1, maxHeight: selectedVuln ? '45%' : undefined }}>

        {filteredVulns.length === 0 && vulns.length === 0 && (
          <div style={{ padding: '24px 16px' }}>
            <EmptyState
              variant="scan-ready"
              eyebrow="스캔 전"
              title="분석을 시작하세요"
              description="상단 분석 시작 버튼을 눌러 취약점을 탐지합니다."
              maxWidth={280}
            />
          </div>
        )}

        {filteredVulns.length === 0 && vulns.length > 0 && (
          <div style={{ padding: '24px 16px' }}>
            <EmptyState
              variant="no-vulns"
              eyebrow="필터 결과"
              title="해당 조건의 취약점 없음"
              description="필터를 변경하면 더 많은 결과를 볼 수 있습니다."
              maxWidth={280}
            />
          </div>
        )}

        {SEVERITY_ORDER.map((sev) => {
          const groupVulns = filteredVulns.filter((v) => v.severity === sev);
          if (groupVulns.length === 0) return null;
          const collapsed = collapsedGroups.has(sev);
          const color = severityColor[sev];

          return (
            <div key={sev}>
              {/* 섹션 헤더 */}
              <button
                onClick={() => toggleGroup(sev)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 10px',
                  background: 'var(--bg-2)',
                  border: 'none',
                  borderBottom: '1px solid var(--border)',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{collapsed ? '▶' : '▼'}</span>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, display: 'inline-block', boxShadow: sev === 'critical' ? `0 0 5px ${color}` : 'none' }} />
                <span style={{ fontSize: 10, fontWeight: 700, color, letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>
                  {severityLabel[sev].toUpperCase()}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>· {groupVulns.length}건</span>
              </button>

              {/* 섹션 아이템 */}
              {!collapsed && groupVulns.map((v) => {
                const isSelected = selectedId === v.id;
                const isChecked = selectedIds.has(v.id);

                return (
                  <div
                    key={v.id}
                    onClick={() => onSelect(v.id)}
                    onContextMenu={(e) => handleContextMenu(e, v.id)}
                    style={{
                      position: 'relative',
                      padding: '10px 10px 10px 32px',
                      borderBottom: '1px solid var(--border)',
                      background: isSelected ? 'var(--bg-selected)' : 'transparent',
                      borderLeft: isSelected ? `2px solid ${color}` : '2px solid transparent',
                      cursor: 'pointer',
                      transition: 'background 0.1s',
                    }}
                  >
                    {/* 체크박스 */}
                    <span
                      onClick={(e) => { e.stopPropagation(); toggleSelect(v.id); }}
                      style={{
                        position: 'absolute',
                        top: 12,
                        left: 10,
                        width: 14,
                        height: 14,
                        borderRadius: 3,
                        border: `1.5px solid ${isChecked ? 'var(--orange-2)' : 'rgba(255,255,255,0.2)'}`,
                        background: isChecked ? 'var(--orange-2)' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: showBulkBar || isChecked ? 1 : 0.4,
                        transition: 'opacity 0.15s, background 0.15s',
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      {isChecked && <Check size={9} color="#fff" />}
                    </span>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, marginBottom: 3 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        {v.type}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                        {/* Patch/SOLVED 배지 */}
                        {isVulnResolved(v.status) ? (
                          <span style={{ fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 3, background: 'rgba(76,175,80,0.15)', color: '#4caf50', border: '0.5px solid rgba(76,175,80,0.35)' }}>SOLVED</span>
                        ) : patches.find((p) => (p.vulnId && p.vulnId === v.id) || (p.filePath === v.filePath && p.vulnType === v.type)) ? (
                          <span style={{ fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 3, background: 'rgba(234,88,12,0.12)', color: '#f97316', border: '0.5px solid rgba(234,88,12,0.3)' }}>PATCHED</span>
                        ) : null}
                        <span className={`badge badge-${v.severity}`}>{severityLabel[v.severity]}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        {v.filePath.split('/').pop()}:{v.lineStart}
                      </span>
                      <span style={{ color: statusColor[v.status] }}>● {statusLabel[v.status]}</span>
                    </div>

                    {/* DAST 배지 */}
                    <DastBadge vulnId={v.id} />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* ── 선택된 취약점 상세 ──────────────────────────────────────── */}
      {selectedVuln && (
        <div style={{ flex: 1, overflowY: 'auto', borderTop: '1px solid var(--border)', padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span className={`badge badge-${selectedVuln.severity}`}>{severityLabel[selectedVuln.severity]}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{selectedVuln.type}</span>
            </div>
            <p style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
              {selectedVuln.description}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[selectedVuln.cweId, selectedVuln.owaspCategory].map((tag) => (
              <span
                key={tag}
                style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'var(--bg-panel)', border: '1px solid var(--border-light)', color: 'var(--text-tertiary)' }}
              >
                {tag}
              </span>
            ))}
          </div>

          {selectedVuln.dastResult && (
            <div style={{ borderRadius: 6, padding: 8, fontSize: 11, background: 'var(--critical-bg)', border: '1px solid var(--critical)', color: 'var(--critical)' }}>
              ⚡ {selectedVuln.dastResult}
            </div>
          )}

          {patch && (
            <div style={{ borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border-light)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--success-bg)', color: 'var(--success)', fontSize: 11, fontWeight: 600 }}>
                <span>AI 패치 제안</span>
                <button
                  onClick={() => applyPatch(selectedVuln.id)}
                  style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'var(--success)', color: '#fff', border: 'none', cursor: 'pointer' }}
                >
                  적용 →
                </button>
              </div>
              <div style={{ padding: 8 }}>
                <p style={{ fontSize: 11, marginBottom: 6, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono, monospace)' }}>
                  {patch.explanation}
                </p>
                <div style={{ fontSize: 11, padding: 8, borderRadius: 4, background: '#0d0d0d', color: 'var(--success)', fontFamily: 'var(--font-mono, monospace)', whiteSpace: 'pre', overflowX: 'auto' }}>
                  {patch.patchedCode.split('\n').map((line, i) => (
                    <div key={i}><span style={{ color: 'var(--success)', opacity: 0.5 }}>+ </span>{line}</div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 벌크 액션 바 ─────────────────────────────────────────── */}
      {showBulkBar && (
        <div
          style={{
            borderTop: '1px solid rgba(249,115,22,0.3)',
            background: 'var(--bg-0)',
            padding: '8px 10px',
          }}
        >
          {/* 스마트 배너 — 동일 type 2건 이상 선택 시 */}
          {(() => {
            const banner = smartBannerInfo();
            if (!banner) return null;
            return (
              <div style={{
                marginBottom: 8,
                padding: '6px 9px',
                borderRadius: 6,
                background: 'rgba(249,115,22,0.08)',
                border: '0.5px solid rgba(249,115,22,0.25)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                <Zap size={12} color="#f97316" />
                <span style={{ fontSize: 11, color: '#f97316', flex: 1 }}>
                  <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{banner.topType}</span>{' '}
                  유형 {banner.selectedOfType}건 선택됨
                </span>
                {banner.selectedOfType < banner.totalOfType && (
                  <button
                    onClick={() => selectAllOfType(banner.topType)}
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: '#f97316',
                      background: 'rgba(249,115,22,0.12)',
                      border: '0.5px solid rgba(249,115,22,0.3)',
                      borderRadius: 4,
                      padding: '2px 8px',
                      cursor: 'pointer',
                    }}
                  >
                    전체 {banner.totalOfType}건 선택 →
                  </button>
                )}
              </div>
            );
          })()}

          {/* 액션 행 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 22,
              height: 22,
              borderRadius: 5,
              background: '#ea580c',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              flexShrink: 0,
            }}>
              {selectedIds.size}
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>건 선택됨</span>
            <div style={{ flex: 1 }} />
            <button
              disabled={isBulkLoading}
              onClick={() => executeBulkTriage('CONFIRM')}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                fontSize: 11, fontWeight: 700, padding: '4px 9px', borderRadius: 5,
                background: 'rgba(34,197,94,0.12)', border: '0.5px solid rgba(34,197,94,0.35)',
                color: '#22c55e', cursor: isBulkLoading ? 'not-allowed' : 'pointer',
                opacity: isBulkLoading ? 0.5 : 1,
              }}
            >
              <Check size={10} />확인
            </button>
            <button
              disabled={isBulkLoading}
              onClick={() => setShowDismissModal(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                fontSize: 11, fontWeight: 700, padding: '4px 9px', borderRadius: 5,
                background: 'rgba(245,158,11,0.1)', border: '0.5px solid rgba(245,158,11,0.3)',
                color: '#f59e0b', cursor: isBulkLoading ? 'not-allowed' : 'pointer',
                opacity: isBulkLoading ? 0.5 : 1,
              }}
            >
              <X size={10} />기각
            </button>
            <button
              disabled={isBulkLoading}
              onClick={() => executeBulkTriage('ACCEPT_PATCH')}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                fontSize: 11, fontWeight: 700, padding: '4px 9px', borderRadius: 5,
                background: 'rgba(249,115,22,0.12)', border: '0.5px solid rgba(249,115,22,0.35)',
                color: '#f97316', cursor: isBulkLoading ? 'not-allowed' : 'pointer',
                opacity: isBulkLoading ? 0.5 : 1,
              }}
            >
              <Zap size={10} />패치채택
            </button>
            <button
              onClick={clearSelection}
              title="모두 해제"
              style={{
                width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'transparent', border: 'none', color: 'var(--text-tertiary)',
                cursor: 'pointer', borderRadius: 4,
              }}
            >
              <X size={12} />
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

      {/* ── 컨텍스트 메뉴 ─────────────────────────────────────────── */}
      {contextMenu && (
        <VulnContextMenu
          menu={contextMenu}
          onClose={() => setContextMenu(null)}
          onAskAI={() => {}}
          onDast={() => {}}
          onPatch={(id) => applyPatch(id)}
          onIgnore={() => {}}
        />
      )}
    </div>
  );
}
