// components/layout/AppHeader.tsx
// Pagori 앱 상단 헤더 — V4 Hybrid 디자인 적용판
// 변경점:
//   • SecureAI 텍스트 로고 → Pagori lockup (assets/pagori-mark.png)
//   • Editor/Dashboard 버튼 토글 → segmented control
//   • CMD+K 검색 버튼 자리 추가
//   • 알림 벨 (count 배지 포함, 추후 NotificationCenter 연결)
//   • 심각도 chip이 'chip chip-{sev}' 글로벌 스타일을 사용 (밝아진 텍스트 토큰 반영)
//
// 기존 로직(useSse, useStartAnalysis, AnalysisHistoryModal 등)은 그대로 유지.
'use client';
import { useState, useEffect, useRef } from 'react';
import {
  PanelLeftClose, PanelLeftOpen, ChevronRight, ChevronDown,
  FileJson, Play, LayoutDashboard, Code2, Settings, History, Users,
  Search, Bell, Key, Github, X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PagoriLockup } from '@/components/brand/PagoriBrand';
import { CommitSecretScanModal } from '@/components/analysis/CommitSecretScanModal';
import { AnalysisHistoryModal } from '@/components/analysis/AnalysisHistoryModal';
import { useSecureStore, type SeverityFilter } from '@/store/useSecureStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useSse, type SseStatus } from '@/hooks/useSse';
import { useToastStore } from '@/hooks/useToast';
import { useStartAnalysis } from '@/hooks/useStartAnalysis';
import { SseIndicator } from '@/components/ui/SseIndicator';
import { apiClient } from '@/lib/api/client';
import type { Severity, VulnCategory, Vulnerability, PatchSuggestion } from '@/lib/mockData';
import { deriveApiGroup } from '@/lib/vulnUtils';

const SEV_FILTERS: Array<'critical' | 'high' | 'medium' | 'low'> = ['critical', 'high', 'medium', 'low'];
const VALID_CATS: VulnCategory[] = ['SECURITY', 'CODE_QUALITY'];

interface AppHeaderProps {
  onExportJSON?: () => void;
}

export function AppHeader({ onExportJSON }: AppHeaderProps) {
  const router               = useRouter();
  const { user: authUser }   = useAuthStore();
  const searchInputRef       = useRef<HTMLInputElement>(null);
  const sidebarOpen          = useSecureStore((s) => s.sidebarOpen);
  const setSidebarOpen       = useSecureStore((s) => s.setSidebarOpen);
  const viewMode             = useSecureStore((s) => s.viewMode);
  const setViewMode          = useSecureStore((s) => s.setViewMode);
  const selectedPath         = useSecureStore((s) => s.selectedPath);
  const severityFilter       = useSecureStore((s) => s.severityFilter);
  const setSeverityFilter    = useSecureStore((s) => s.setSeverityFilter);
  const apiGroupFilter       = useSecureStore((s) => s.apiGroupFilter);
  const setApiGroupFilter    = useSecureStore((s) => s.setApiGroupFilter);
  const vulns                = useSecureStore((s) => s.vulns);
  const setIsAnalyzing       = useSecureStore((s) => s.setIsAnalyzing);
  const sseSessionId         = useSecureStore((s) => s.sseSessionId);
  const addVuln              = useSecureStore((s) => s.addVuln);
  const clearVulns           = useSecureStore((s) => s.clearVulns);
  const setPatches           = useSecureStore((s) => s.setPatches);
  const setLastTokenUsage    = useSecureStore((s) => s.setLastTokenUsage);
  const setRightTab          = useSecureStore((s) => s.setRightTab);
  const addProgressStep      = useSecureStore((s) => s.addProgressStep);
  const addToast             = useToastStore((s) => s.addToast);
  const { startAnalysis, isAnalyzing } = useStartAnalysis();

  const [sseStatus,         setSseStatus]         = useState<SseStatus>('idle');
  const [showHistory,       setShowHistory]       = useState(false);
  const [showCommitScan,    setShowCommitScan]    = useState(false);
  const [showSearchPalette, setShowSearchPalette] = useState(false);
  const [searchQuery,       setSearchQuery]       = useState('');

  // Cmd+K / Ctrl+K 글로벌 단축키
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearchPalette((v) => !v);
        setSearchQuery('');
      }
      if (e.key === 'Escape') {
        setShowSearchPalette(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // 팔레트 열릴 때 input focus
  useEffect(() => {
    if (showSearchPalette) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [showSearchPalette]);

  const VALID_SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low'];

  // SSE wiring — unchanged from original
  useSse({
    sessionId: sseSessionId,
    onEvent: (event) => {
      if (event.type === 'completed') {
        const sid = event.sessionId;
        apiClient.get<{ data: { content: Array<{
          id: string; filePath: string; lineNumber: number | null;
          vulnType: string; severity: string; category: string | null;
          cwe: string | null; owasp: string | null; description: string | null;
        }> } }>(`/vulnerabilities?sessionId=${sid}&size=500`)
          .then((res) => {
            const items = res.data?.content ?? [];
            clearVulns();
            for (const v of items) {
              const rawSev = (v.severity ?? 'low').toLowerCase() as Severity;
              const severity: Severity = VALID_SEVERITIES.includes(rawSev) ? rawSev : 'low';
              const rawCat = (v.category ?? 'SECURITY') as VulnCategory;
              const category: VulnCategory = VALID_CATS.includes(rawCat) ? rawCat : 'SECURITY';
              const vuln: Vulnerability = {
                id: v.id, type: v.vulnType, severity, category,
                lineStart: v.lineNumber ?? 0, lineEnd: v.lineNumber ?? 0,
                filePath: v.filePath, description: v.description ?? '',
                cweId: v.cwe ?? '', owaspCategory: v.owasp ?? '', status: 'open',
                apiGroup: deriveApiGroup(v.filePath),
              };
              addVuln(vuln);
            }
          })
          .catch(() => {});

        const totalVulns = event.vuln_count ?? 0;
        const usage = event.token_usage as {
          input_tokens: number; output_tokens: number;
          cache_creation_input_tokens?: number; cache_read_input_tokens?: number;
        } | undefined;
        if (usage) {
          const inp = usage.input_tokens, out = usage.output_tokens;
          const cw = usage.cache_creation_input_tokens ?? 0;
          const cr = usage.cache_read_input_tokens ?? 0;
          const costUsd = (inp * 0.80 + out * 4.00 + cw * 1.00 + cr * 0.08) / 1_000_000;
          setLastTokenUsage({
            inputTokens: inp, outputTokens: out, cacheWriteTokens: cw, cacheReadTokens: cr,
            estimatedCostUsd: costUsd, modelId: 'claude-haiku-4-5',
          });
          const totalTokens = inp + out + cw + cr;
          addToast(`분석 완료 — 취약점 ${totalVulns}개 · ${(totalTokens / 1000).toFixed(1)}k 토큰 · $${costUsd.toFixed(4)}`, 'info');
        } else {
          addToast(`분석 완료 — 취약점 ${totalVulns}개 발견`, 'info');
        }

        apiClient.get<{ data: Array<{
          id: string; vulnId: string | null; filePath: string; vulnType: string;
          originalSnippet: string | null; patchedSnippet: string | null; explanation: string | null;
        }> }>(`/sessions/${sid}/patches`)
          .then((res) => {
            const items = res.data ?? [];
            const patches: PatchSuggestion[] = items.map((p) => ({
              vulnId: p.vulnId ?? undefined,
              filePath: p.filePath,
              vulnType: p.vulnType,
              originalCode: p.originalSnippet ?? '',
              patchedCode: p.patchedSnippet ?? '',
              explanation: p.explanation ?? '',
            }));
            setPatches(patches);
          })
          .catch(() => {});

        setRightTab('vulns');
        setIsAnalyzing(false);
      } else if (event.type === 'started') {
        addProgressStep({ stepName: '분석 시작', stepOrder: Date.now(), target: '초기화 중...', status: 'completed' });
      } else if (event.type === 'progress') {
        if (event.file) {
          addProgressStep({
            stepName: event.node === 'sast' ? 'SAST 분석' : (event.node ?? '분석 중'),
            stepOrder: Date.now(), target: event.file, status: 'completed',
          });
        } else if (event.message) {
          addProgressStep({
            stepName: event.node ?? '진행 중', stepOrder: Date.now(),
            target: event.message, status: 'completed',
          });
        }
      } else if (event.type === 'scan_complete') {
        addProgressStep({
          stepName: '스캔 완료', stepOrder: Date.now(),
          target: `취약점 ${event.vuln_count ?? 0}개 발견`, status: 'completed',
        });
      } else if (event.type === 'error') {
        addToast(event.message ?? 'SSE 오류가 발생했습니다.', 'error');
        setIsAnalyzing(false);
      }
    },
    onStatusChange: (status) => {
      setSseStatus(status);
      if (status === 'closed' || status === 'auth_error') setIsAnalyzing(false);
    },
  });

  // ── Derived UI state ────────────────────────────────────────────
  const pathSegs = selectedPath.split('/').filter(Boolean);
  // Truncate breadcrumb to last 3 segments so the header doesn't blow up on deep paths
  const breadcrumb = pathSegs.length > 3 ? ['…', ...pathSegs.slice(-3)] : pathSegs;
  // If the path is inside api/foo/..., the second segment after 'api' is the API group
  const apiIdx = pathSegs.indexOf('api');
  const activeApi = apiIdx >= 0 && pathSegs[apiIdx + 1] ? pathSegs[apiIdx + 1] : null;
  const apiGroupCount = activeApi
    ? vulns.filter(v => v.apiGroup === activeApi || v.apiGroup?.startsWith(activeApi + '/')).length
    : 0;

  // placeholder — wire up when NotificationCenter is built
  const unreadNotifications = 0;

  // ── Severity counts (for chip badges) ───────────────────────────
  const sevCount = (sev: 'critical' | 'high' | 'medium' | 'low') =>
    vulns.filter(v => v.severity === sev).length;

  const handleSevFilter = (sev: SeverityFilter) => {
    setSeverityFilter(severityFilter === sev ? 'all' : sev);
  };

  const toggleApiFilter = () => {
    if (!activeApi) return;
    setApiGroupFilter(apiGroupFilter === activeApi ? null : activeApi);
  };

  return (
    <header
      style={{
        height: '100%',
        borderBottom: '1px solid var(--hairline)',
        background: 'var(--bg-1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 12px 0 10px',
        flexShrink: 0,
        zIndex: 10,
        gap: 12,
      }}
    >
      {/* ── Left: sidebar toggle + Pagori brand + breadcrumb ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <button
          onClick={() => setSidebarOpen((v) => !v)}
          title={sidebarOpen ? '사이드바 접기' : '사이드바 펼치기'}
          style={{
            width: 28, height: 28, borderRadius: 6,
            background: sidebarOpen ? 'var(--orange-dim)' : 'transparent',
            border: 'none',
            color: sidebarOpen ? 'var(--orange)' : 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.15s, color 0.15s',
          }}
        >
          {sidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
        </button>

        <PagoriLockup size={22} />

        <div style={{ width: 1, height: 18, background: 'var(--hairline)' }} />

        {/* Breadcrumb — click api/<group> chip to filter the right panel by that API */}
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 12, color: 'var(--text-on-bg)',
            fontFamily: 'var(--font-mono)', minWidth: 0,
          }}
        >
          {breadcrumb.map((seg, i) => {
            const isFile = i === breadcrumb.length - 1;
            const isApiGroup = activeApi && seg === activeApi;
            const apiActive = apiGroupFilter === activeApi;
            return (
              <span key={`${seg}-${i}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                {i > 0 && <ChevronRight size={11} color="var(--text-tertiary)" />}
                {isApiGroup ? (
                  <button
                    onClick={toggleApiFilter}
                    title={apiActive ? '필터 해제' : `이 API 그룹으로 필터 (${apiGroupCount}건)`}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '3px 6px', borderRadius: 4,
                      background: apiActive ? 'var(--orange-dim)' : 'transparent',
                      border: `1px solid ${apiActive ? 'rgba(249,115,22,0.30)' : 'transparent'}`,
                      color: apiActive ? 'var(--orange)' : 'var(--text-on-bg)',
                      fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    {seg}
                    <ChevronDown size={10} />
                    {apiGroupCount > 0 && (
                      <span className="chip chip-critical" style={{ height: 14, fontSize: 8, padding: '0 4px', marginLeft: 2 }}>
                        {apiGroupCount}
                      </span>
                    )}
                  </button>
                ) : (
                  <span
                    style={{
                      padding: '3px 6px', borderRadius: 4,
                      color: isFile ? 'var(--text-active)' : 'var(--text-on-bg)',
                    }}
                  >
                    {seg}
                  </span>
                )}
              </span>
            );
          })}
          {!breadcrumb.length && (
            <span style={{ color: 'var(--text-tertiary)' }}>
              {viewMode === 'editor' ? '파일을 선택하세요' : 'Security Dashboard'}
            </span>
          )}
        </div>

        <div className="header-pipeline-badges">
          {([
            { label: 'SAST',  color: 'var(--low)',     bg: 'var(--low-dim)' },
            { label: 'DAST',  color: 'var(--orange)',  bg: 'var(--orange-dim)' },
            { label: 'PATCH', color: 'var(--tag-1)',   bg: 'rgba(129,140,248,0.10)' },
          ] as const).map(({ label, color, bg }) => (
            <div
              key={label}
              style={{
                fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 10,
                background: bg, color, border: `0.5px solid ${color}`,
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* ── Right ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* CMD+K search button — 팔레트 토글 */}
        <button
          title="전역 검색 (⌘K)"
          onClick={() => { setShowSearchPalette(true); setSearchQuery(''); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            height: 28, padding: '0 8px 0 10px',
            background: 'var(--bg-3)', border: '1px solid var(--border)',
            borderRadius: 6, color: 'var(--text-tertiary)',
            fontSize: 11, cursor: 'pointer', minWidth: 200,
          }}
        >
          <Search size={12} />
          <span style={{ flex: 1, textAlign: 'left' }}>취약점 · 파일 · CVE 검색</span>
          <span
            className="font-mono"
            style={{
              padding: '2px 5px', borderRadius: 3,
              background: 'var(--bg-1)', border: '1px solid var(--border)',
              fontSize: 9, fontWeight: 600,
            }}
          >
            ⌘K
          </span>
        </button>

        {/* Severity chips — uses global .chip styles, brighter active text */}
        <div className="header-sev-filters">
          <button
            onClick={() => setSeverityFilter('all')}
            className={`chip ${severityFilter === 'all' ? 'chip-active' : ''}`}
            style={{ height: 22 }}
          >
            ALL
          </button>
          {SEV_FILTERS.map(sev => {
            const active = severityFilter === sev;
            return (
              <button
                key={sev}
                onClick={() => handleSevFilter(sev)}
                className={`chip chip-${sev} ${active ? 'chip-active' : ''}`}
                style={{
                  height: 22,
                  opacity: severityFilter !== 'all' && !active ? 0.45 : 1,
                }}
              >
                <span className="severity-dot" style={{ background: `var(--${sev})` }} />
                {sev.toUpperCase()}
                {sevCount(sev) > 0 && (
                  <span style={{ opacity: 0.75, marginLeft: 2 }}>{sevCount(sev)}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Editor / Dashboard — segmented control */}
        <div
          style={{
            display: 'flex', height: 28, padding: 2,
            background: 'var(--bg-3)', border: '1px solid var(--border)',
            borderRadius: 7,
          }}
        >
          {(['editor', 'dashboard'] as const).map(v => {
            const active = viewMode === v;
            return (
              <button
                key={v}
                onClick={() => setViewMode(v)}
                style={{
                  padding: '0 10px', borderRadius: 5, border: 'none',
                  background: active ? 'var(--bg-1)' : 'transparent',
                  color: active ? 'var(--text-active)' : 'var(--text-tertiary)',
                  fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 5,
                  boxShadow: active ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                {v === 'editor' ? <Code2 size={12} /> : <LayoutDashboard size={12} />}
                {v === 'editor' ? '에디터' : '대시보드'}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => setShowCommitScan(true)}
          title="커밋 시크릿 스캔"
          style={{
            width: 28, height: 28, borderRadius: 6,
            background: 'var(--bg-2)', color: 'var(--text-secondary)',
            border: '1px solid var(--border)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Key size={14} />
        </button>

        <button
          onClick={() => setShowHistory(true)}
          title="분석 이력 (전체 프로젝트)"
          style={{
            width: 28, height: 28, borderRadius: 6,
            background: 'var(--bg-2)', color: 'var(--text-secondary)',
            border: '1px solid var(--border)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <History size={14} />
        </button>

        <button
          title="알림"
          onClick={() => addToast('알림 센터는 곧 출시됩니다', 'info')}
          style={{
            position: 'relative',
            width: 28, height: 28, borderRadius: 6,
            background: 'var(--bg-2)', color: 'var(--text-secondary)',
            border: '1px solid var(--border)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Bell size={14} />
          {unreadNotifications > 0 && (
            <span
              style={{
                position: 'absolute', top: -3, right: -3,
                minWidth: 14, height: 14, borderRadius: 7,
                background: 'var(--orange-2)', color: '#fff',
                fontSize: 9, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '0 3px', boxShadow: '0 0 0 2px var(--bg-1)',
              }}
            >
              {unreadNotifications}
            </span>
          )}
        </button>

        <button
          onClick={startAnalysis}
          disabled={isAnalyzing}
          style={{
            fontSize: 11, fontWeight: 800, padding: '0 14px',
            height: 28, borderRadius: 6,
            background: isAnalyzing ? 'var(--orange-dim)' : 'var(--orange-2)',
            color: isAnalyzing ? 'var(--orange)' : '#fff', border: 'none',
            cursor: isAnalyzing ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
            boxShadow: isAnalyzing ? 'none' : 'var(--orange-shadow)',
          }}
        >
          <Play size={12} fill="currentColor" />
          {isAnalyzing ? '분석 중...' : '분석 시작'}
        </button>

        {showHistory && <AnalysisHistoryModal onClose={() => setShowHistory(false)} />}
        {showCommitScan && <CommitSecretScanModal onClose={() => setShowCommitScan(false)} />}

        {onExportJSON && (
          <button
            onClick={onExportJSON}
            className="header-export-btn"
            style={{
              fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)',
              background: 'none', border: 'none', cursor: 'pointer',
              alignItems: 'center', gap: 4, marginLeft: 4,
            }}
          >
            <FileJson size={14} /> Export JSON
          </button>
        )}

        <div style={{ marginLeft: 4 }}>
          <SseIndicator status={sseStatus} isAnalyzing={isAnalyzing} hasResults={vulns.length > 0} />
        </div>

        {/* 검색 팔레트 오버레이 */}
        {showSearchPalette && (
          <>
            {/* backdrop */}
            <div
              onClick={() => setShowSearchPalette(false)}
              style={{
                position: 'fixed', inset: 0, zIndex: 200,
                background: 'rgba(0,0,0,0.55)',
                backdropFilter: 'blur(3px)',
              }}
            />
            {/* palette */}
            <div style={{
              position: 'fixed', top: '15%', left: '50%', transform: 'translateX(-50%)',
              zIndex: 201, width: '100%', maxWidth: 560,
              background: 'var(--bg-2, #1a1a1c)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 12, overflow: 'hidden',
              boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
            }}>
              {/* input row */}
              <div style={{ display: 'flex', alignItems: 'center', padding: '0 16px', height: 52, gap: 10, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <Search size={16} color="rgba(255,255,255,0.35)" />
                <input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="검색: 취약점 유형, 파일명, CVE ID…"
                  style={{
                    flex: 1, background: 'transparent', border: 'none', outline: 'none',
                    fontSize: 14, color: '#e8e8ee',
                  }}
                />
                <button
                  onClick={() => setShowSearchPalette(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', display: 'flex' }}
                >
                  <X size={14} />
                </button>
              </div>
              {/* quick actions */}
              <div style={{ padding: '8px 0' }}>
                {([
                  { label: '분석 시작',    icon: <Play size={13} fill="currentColor" />, action: () => { setShowSearchPalette(false); startAnalysis(); } },
                  { label: 'GitHub 스캔',  icon: <Github size={13} />,                  action: () => { setShowSearchPalette(false); router.push('/github-scan'); } },
                  { label: 'PDF 다운로드', icon: <FileJson size={13} />,                action: () => { setShowSearchPalette(false); if (onExportJSON) onExportJSON(); } },
                  { label: '설정',         icon: <Settings size={13} />,                action: () => { setShowSearchPalette(false); router.push('/settings'); } },
                ] as const).map(({ label, icon, action }) => (
                  <button
                    key={label}
                    onClick={action}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 16px', background: 'none', border: 'none',
                      cursor: 'pointer', color: 'rgba(255,255,255,0.65)', fontSize: 13,
                      textAlign: 'left', transition: 'background 0.1s',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(249,115,22,0.08)'; (e.currentTarget as HTMLElement).style.color = '#f97316'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.65)'; }}
                  >
                    <span style={{ opacity: 0.7 }}>{icon}</span>
                    {label}
                  </button>
                ))}
              </div>
              {/* hint */}
              <div style={{ padding: '8px 16px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 12, fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>
                <span>↑↓ 탐색</span>
                <span>Enter 실행</span>
                <span>Esc 닫기</span>
              </div>
            </div>
          </>
        )}

        {authUser?.isAdmin && (
          <Link
            href="/admin/users"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '5px 10px', borderRadius: 6,
              fontSize: 11, fontWeight: 700,
              color: 'var(--orange)',
              background: 'var(--orange-dim)',
              border: '1px solid rgba(234,88,12,0.25)',
              textDecoration: 'none', marginLeft: 4,
            }}
            title="Admin Console"
          >
            Admin
          </Link>
        )}

        <Link
          href="/team"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 28, height: 28, borderRadius: 6,
            color: 'var(--text-tertiary)',
            background: 'transparent', border: '1px solid transparent',
            transition: 'color 0.15s, background 0.15s, border-color 0.15s',
            marginLeft: 4,
          }}
          title="팀"
        >
          <Users size={14} />
        </Link>

        <Link
          href="/settings"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 28, height: 28, borderRadius: 6,
            color: 'var(--text-tertiary)',
            background: 'transparent', border: '1px solid transparent',
            transition: 'color 0.15s, background 0.15s, border-color 0.15s',
          }}
          title="설정"
        >
          <Settings size={14} />
        </Link>
      </div>
    </header>
  );
}
