// components/ui/ProgressPanel.tsx
// TASK-406 진행률 패널 + TASK-1106 API 중심 분석 계획(아코디언·파일별 상태·선택 분석)
// + 신규: stage_plan/stage_started/stage_completed/progress phase 이벤트 UI
// + STAGE-1: stage 완료 시 취약점 점진 노출 (배지 + 펼침 목록)
'use client';
import { useState } from 'react';
import { CheckSquare, ChevronRight, ChevronDown, Play } from 'lucide-react';
import {
  useSecureStore,
  type ProgressStep,
  type FileAnalysisStatus,
  type StageInfo,
  type StageVulnSummary,
} from '@/store/useSecureStore';
import { useStartAnalysis } from '@/hooks/useStartAnalysis';

// ── 단계 status 아이콘 ────────────────────────────────────────
function StatusIcon({ status }: { status: ProgressStep['status'] }) {
  if (status === 'completed') return <span style={{ color: '#22c55e', fontSize: 13, lineHeight: 1 }} aria-label="완료">✓</span>;
  if (status === 'running') return <span style={{ display: 'inline-block', color: '#ea580c', fontSize: 13, lineHeight: 1, animation: 'spin 0.85s linear infinite' }} aria-label="진행 중">⟳</span>;
  if (status === 'error') return <span style={{ color: '#ef4444', fontSize: 13, lineHeight: 1 }} aria-label="오류">✗</span>;
  return <span style={{ color: 'rgba(255,255,255,0.28)', fontSize: 13, lineHeight: 1 }} aria-label="대기">○</span>;
}

// ── 파일별 분석 status 아이콘 (TASK-1106) ─────────────────────
const FILE_STATUS_META: Record<FileAnalysisStatus, { icon: string; color: string; label: string }> = {
  pending:   { icon: '○', color: 'rgba(255,255,255,0.28)', label: '대기' },
  analyzing: { icon: '⟳', color: '#ea580c', label: '분석 중' },
  done:      { icon: '✓', color: '#22c55e', label: '완료' },
  cached:    { icon: '⚡', color: '#3b82f6', label: '캐시' },
  failed:    { icon: '✗', color: '#ef4444', label: '실패' },
};

function FileStatusIcon({ status }: { status: FileAnalysisStatus }) {
  const m = FILE_STATUS_META[status];
  return (
    <span
      style={{ color: m.color, fontSize: 12, lineHeight: 1, width: 14, textAlign: 'center', flexShrink: 0,
        ...(status === 'analyzing' ? { display: 'inline-block', animation: 'spin 0.85s linear infinite' } : {}) }}
      aria-label={m.label}
    >
      {m.icon}
    </span>
  );
}

function basename(path: string): string {
  return path.split('/').pop() ?? path;
}

// severity → 뱃지 색상 매핑 (매직 스트링 금지 → 상수화)
const SEVERITY_COLOR: Record<string, string> = {
  CRITICAL: '#ef4444',
  HIGH:     '#f97316',
  MEDIUM:   '#eab308',
  LOW:      '#3b82f6',
};

function severityColor(sev: string): string {
  return SEVERITY_COLOR[sev.toUpperCase()] ?? 'rgba(255,255,255,0.4)';
}

// ── API 그룹 아코디언 (TASK-1106) ─────────────────────────────
function ApiPlanSection() {
  const apiGroups    = useSecureStore((s) => s.apiGroups) ?? [];
  const fileStatuses = useSecureStore((s) => s.fileStatuses) ?? {};
  const openTab      = useSecureStore((s) => s.openTab);
  const { startSelectiveAnalysis, isAnalyzing } = useStartAnalysis();

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());

  if (apiGroups.length === 0) return null;

  const keyOf = (i: number) => `${apiGroups[i].name}::${apiGroups[i].url}::${i}`;
  const toggleExpand = (k: string) => setExpanded((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const toggleSelect = (k: string) => setSelected((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });

  const handleAnalyzeSelected = () => {
    const paths = new Set<string>();
    apiGroups.forEach((g, i) => {
      if (selected.has(keyOf(i))) g.files.forEach((f) => paths.add(f.path));
    });
    startSelectiveAnalysis(Array.from(paths));
  };

  const doneOf = (g: typeof apiGroups[number]) =>
    g.files.filter((f) => { const st = fileStatuses[f.path]; return st === 'done' || st === 'cached'; }).length;

  return (
    <div style={{ background: '#0f0f0f', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#e8e8ee' }}>API 분석 계획</span>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{apiGroups.length}개 그룹</span>
      </div>

      {apiGroups.map((g, i) => {
        const k = keyOf(i);
        const isOpen = expanded.has(k);
        const isSel = selected.has(k);
        const done = doneOf(g);
        const total = g.files.length;
        const pct = total === 0 ? 0 : Math.round((done / total) * 100);
        return (
          <div key={k} style={{ border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, overflow: 'hidden' }}>
            {/* 그룹 헤더 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', background: 'rgba(255,255,255,0.02)' }}>
              <input type="checkbox" checked={isSel} onChange={() => toggleSelect(k)} aria-label={`${g.name} 선택`} style={{ flexShrink: 0 }} />
              <button onClick={() => toggleExpand(k)} aria-expanded={isOpen} style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0, background: 'none', border: 'none', cursor: 'pointer', color: '#e8e8ee', padding: 0, textAlign: 'left' }}>
                {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                <span style={{ fontSize: 11, fontWeight: 600, flexShrink: 0 }}>{g.name}</span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.url}</span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginLeft: 'auto', flexShrink: 0 }}>{done}/{total}</span>
              </button>
            </div>
            {/* 그룹 진행률 바 */}
            <div style={{ height: 3, background: 'rgba(255,255,255,0.06)' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: '#ea580c', transition: 'width 0.3s ease' }} />
            </div>
            {/* 파일 목록 */}
            {isOpen && (
              <div style={{ display: 'flex', flexDirection: 'column', padding: '4px 8px 6px 26px' }}>
                {g.files.map((f) => (
                  <button
                    key={f.path}
                    onClick={() => openTab(f.path, basename(f.path))}
                    title={f.path}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.7)', fontSize: 11, textAlign: 'left', width: '100%' }}
                  >
                    <FileStatusIcon status={fileStatuses[f.path] ?? 'pending'} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{basename(f.path)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* 선택 분석 */}
      <button
        onClick={handleAnalyzeSelected}
        disabled={selected.size === 0 || isAnalyzing}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 12px', marginTop: 2,
          background: selected.size === 0 || isAnalyzing ? 'rgba(234,88,12,0.08)' : 'rgba(234,88,12,0.18)',
          border: '1px solid rgba(234,88,12,0.3)', borderRadius: 6, color: '#ea580c', fontSize: 11, fontWeight: 600,
          cursor: selected.size === 0 || isAnalyzing ? 'not-allowed' : 'pointer', opacity: selected.size === 0 || isAnalyzing ? 0.6 : 1 }}
      >
        <Play size={11} fill="currentColor" />
        선택한 API만 분석 {selected.size > 0 ? `(${selected.size})` : ''}
      </button>
    </div>
  );
}

// ── Stage status 아이콘 ───────────────────────────────────────
function StageStatusIcon({ status }: { status: StageInfo['status'] }) {
  if (status === 'completed') return <span style={{ color: '#22c55e', fontSize: 12 }} aria-label="완료">✓</span>;
  if (status === 'running')   return <span style={{ color: '#ea580c', fontSize: 12, display: 'inline-block', animation: 'spin 0.85s linear infinite' }} aria-label="진행 중">⟳</span>;
  return <span style={{ color: 'rgba(255,255,255,0.28)', fontSize: 12 }} aria-label="대기">○</span>;
}

// ── Stage 취약점 펼침 목록 ───────────────────────────────────
function StageVulnList({ vulns, onOpen }: { vulns: StageVulnSummary[]; onOpen: (path: string) => void }) {
  if (vulns.length === 0) {
    return (
      <div style={{ paddingLeft: 24, paddingBottom: 6, fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
        발견 없음
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', paddingLeft: 24, paddingBottom: 4 }}>
      {vulns.map((v) => (
        <button
          key={v.id}
          onClick={() => onOpen(v.filePath)}
          title={`${v.filePath}${v.lineNumber != null ? `:${v.lineNumber}` : ''}`}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0',
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'rgba(255,255,255,0.7)', fontSize: 10, textAlign: 'left', width: '100%',
          }}
        >
          <span
            style={{
              width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
              background: severityColor(v.severity),
            }}
            aria-label={v.severity}
          />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
            {basename(v.filePath)}
            {v.lineNumber != null && (
              <span style={{ color: 'rgba(255,255,255,0.35)', marginLeft: 4 }}>:{v.lineNumber}</span>
            )}
          </span>
          <span style={{ color: severityColor(v.severity), flexShrink: 0 }}>{v.vulnType}</span>
        </button>
      ))}
    </div>
  );
}

// ── Stage 목록 섹션 (stage_plan 수신 시) ─────────────────────
function StagePlanSection() {
  const stageList      = useSecureStore((s) => s.stageList);
  const currentStageNo = useSecureStore((s) => s.currentStageNo);
  const stageVulns     = useSecureStore((s) => s.stageVulns);
  const openTab        = useSecureStore((s) => s.openTab);

  const [expandedStages, setExpandedStages] = useState<Set<number>>(new Set());

  if (stageList.length === 0) return null;

  const completedCount = stageList.filter((s) => s.status === 'completed').length;

  const toggleExpand = (stageNo: number) =>
    setExpandedStages((prev) => {
      const next = new Set(prev);
      next.has(stageNo) ? next.delete(stageNo) : next.add(stageNo);
      return next;
    });

  return (
    <div style={{ background: '#0f0f0f', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#e8e8ee' }}>분석 단계 계획</span>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
          {completedCount}/{stageList.length} 완료
        </span>
      </div>

      {stageList.map((stage) => {
        const isActive  = stage.stage_no === currentStageNo;
        const vulnEntry = stageVulns[stage.stage_no];
        const vulnCount = vulnEntry?.loaded ? vulnEntry.vulns.length : null;
        const isExpanded = expandedStages.has(stage.stage_no);

        return (
          <div key={stage.stage_no}>
            {/* Stage 행 */}
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px',
                borderRadius: 6, fontSize: 11,
                background: isActive ? 'rgba(234,88,12,0.08)' : 'transparent',
                border: `1px solid ${isActive ? 'rgba(234,88,12,0.25)' : 'rgba(255,255,255,0.04)'}`,
                transition: 'background 0.2s, border-color 0.2s',
              }}
            >
              <StageStatusIcon status={stage.status} />
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', flexShrink: 0, fontFamily: 'var(--font-mono)' }}>
                {stage.stage_no}/{stageList.length}
              </span>
              <span style={{ flex: 1, color: isActive ? '#ea580c' : 'rgba(255,255,255,0.7)', fontWeight: isActive ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {stage.name}
              </span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>
                {stage.file_count}파일
              </span>
              {/* 취약점 배지 — stage 완료 후 조회 결과가 있을 때만 표시 */}
              {vulnEntry?.loaded && (
                <button
                  onClick={() => toggleExpand(stage.stage_no)}
                  aria-expanded={isExpanded}
                  aria-label={`Stage ${stage.stage_no} 취약점 ${vulnCount}건`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 3, padding: '2px 6px',
                    background: vulnCount! > 0 ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.06)',
                    border: `1px solid ${vulnCount! > 0 ? 'rgba(239,68,68,0.35)' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: 4, cursor: 'pointer', color: vulnCount! > 0 ? '#ef4444' : 'rgba(255,255,255,0.4)',
                    fontSize: 10, fontWeight: 600, flexShrink: 0,
                  }}
                >
                  {isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                  발견 {vulnCount}건
                </button>
              )}
            </div>

            {/* 취약점 펼침 목록 */}
            {isExpanded && vulnEntry?.loaded && (
              <StageVulnList
                vulns={vulnEntry.vulns}
                onOpen={(path) => openTab(path, basename(path))}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── 실시간 스캔 중 파일 표시 ─────────────────────────────────
function ScanningFileIndicator() {
  const scanningFile = useSecureStore((s) => s.scanningFile);

  if (!scanningFile) return null;

  const { file, current, total } = scanningFile;
  const fileName = file.split('/').pop() ?? file;
  const pct = total === 0 ? 0 : Math.round((current / total) * 100);

  return (
    <div style={{ background: 'rgba(234,88,12,0.06)', border: '1px solid rgba(234,88,12,0.2)', borderRadius: 8, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
        <span style={{ display: 'inline-block', color: '#ea580c', animation: 'spin 0.85s linear infinite', fontSize: 13 }}>⟳</span>
        <span style={{ color: 'rgba(255,255,255,0.5)', flexShrink: 0 }}>지금 스캔 중…</span>
        <span
          title={file}
          style={{ flex: 1, color: '#ea580c', fontWeight: 600, fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {fileName}
        </span>
        <span style={{ color: 'rgba(255,255,255,0.35)', flexShrink: 0, fontFamily: 'var(--font-mono)' }}>
          {current}/{total}
        </span>
      </div>
      {/* 진행률 바 */}
      <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: '#ea580c', borderRadius: 2, transition: 'width 0.15s ease' }} />
      </div>
    </div>
  );
}

// ── Markdown 생성/다운로드 (기존) ────────────────────────────
function generateMarkdown(steps: ProgressStep[]): string {
  const completed = steps.filter((s) => s.status === 'completed').length;
  const total = steps.length;
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
  return [
    `# 보안 분석 진행률 — ${new Date().toLocaleDateString('ko-KR')}`, '',
    `**진행률**: ${completed}/${total} (${pct}%)`, '', '## 분석 단계',
    ...steps.map((s) => `- ${s.status === 'completed' ? '[x]' : '[ ]'} **${s.stepName}** — ${s.target}${s.durationMs !== undefined ? ` _(${s.durationMs}ms)_` : ''}`),
  ].join('\n');
}

function downloadMarkdown(steps: ProgressStep[]): void {
  const blob = new Blob([generateMarkdown(steps)], { type: 'text/markdown' });
  const anchor = document.createElement('a');
  anchor.href = URL.createObjectURL(blob);
  anchor.download = `security-progress-${Date.now()}.md`;
  anchor.click();
  URL.revokeObjectURL(anchor.href);
}

// ── 메인 컴포넌트 ────────────────────────────────────────────
export function ProgressPanel() {
  const progressSteps = useSecureStore((s) => s.progressSteps);
  const total = progressSteps.length;
  const completed = progressSteps.filter((s) => s.status === 'completed').length;
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '12px 16px', overflowY: 'auto', flex: 1, minHeight: 0 }}>
      {/* Stage 계획 목록 (stage_plan 수신 시) */}
      <StagePlanSection />

      {/* 실시간 스캔 중 파일 표시 (progress phase=scanning) */}
      <ScanningFileIndicator />

      {/* TASK-1106 — API 분석 계획 (api_plan 수신 시) */}
      <ApiPlanSection />

      {/* 진행률 요약 */}
      <div style={{ background: '#0f0f0f', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#e8e8ee' }}>진행률</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{completed} / {total} 완료 ({pct}%)</span>
        </div>
        <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}
          role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`진행률 ${pct}%`}>
          <div style={{ height: '100%', width: `${pct}%`, background: '#ea580c', borderRadius: 3, transition: 'width 0.3s ease' }} />
        </div>
      </div>

      {/* 단계 목록 */}
      <div style={{ background: '#0f0f0f', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#e8e8ee', marginBottom: 4 }}>분석 단계</span>
        {progressSteps.map((step) => (
          <div key={step.stepOrder} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>
            <StatusIcon status={step.status} />
            <span style={{ flex: 1 }}>
              <span style={{ fontWeight: 500, color: '#e8e8ee' }}>{step.stepName}</span>{' '}
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>{step.target}</span>
            </span>
            {step.durationMs !== undefined && <span style={{ color: 'rgba(255,255,255,0.35)', flexShrink: 0 }}>{step.durationMs}ms</span>}
          </div>
        ))}
      </div>

      {/* 다운로드 버튼 */}
      <button
        onClick={() => downloadMarkdown(progressSteps)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 12px', background: 'rgba(234,88,12,0.12)', border: '1px solid rgba(234,88,12,0.3)', borderRadius: 6, color: '#ea580c', fontSize: 11, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}
      >
        <CheckSquare size={12} aria-hidden="true" />
        체크리스트 다운로드
      </button>
    </div>
  );
}
