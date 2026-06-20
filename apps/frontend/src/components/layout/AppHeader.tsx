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
  Shield, Menu, Code, Settings2, ShieldAlert, FileText, Share2,
  PanelLeftClose, PanelLeftOpen, ChevronRight, ChevronDown,
  FileJson, Play, LayoutDashboard, Code2, Settings, History, Users,
  Search, Bell, Key, Github, X, PanelBottom,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PagoriMark, ModeIndicator } from '@/components/brand/PagoriBrand';
import { CommitSecretScanModal } from '@/components/analysis/CommitSecretScanModal';
import { AnalysisHistoryModal } from '@/components/analysis/AnalysisHistoryModal';
import { PlanConfirmModal } from '@/components/analysis/PlanConfirmModal';
import { useSecureStore, type SeverityFilter, type ViewMode } from '@/store/useSecureStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useSse, type SseStatus } from '@/hooks/useSse';
import { useToastStore } from '@/hooks/useToast';
import { useStartAnalysis } from '@/hooks/useStartAnalysis';
import { useVulnerabilitiesByFiles } from '@/hooks/useVulnerabilitiesByFiles';
import { SseIndicator } from '@/components/ui/SseIndicator';
import { apiClient } from '@/lib/api/client';
import type { Severity, VulnCategory, Vulnerability, PatchSuggestion } from '@/lib/mockData';
import { deriveApiGroup } from '@/lib/vulnUtils';
import { calcCostUsd, DEFAULT_MODEL_ID } from '@/lib/constants/models';

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
  const bottomPanelOpen      = useSecureStore((s) => s.bottomPanelOpen);
  const setBottomPanelOpen   = useSecureStore((s) => s.setBottomPanelOpen);
  const workspaceMode        = authUser?.workspaceMode ?? 'DEVELOPER';  // 권위 소스(DB /me)로 일원화 — TASK-1102
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
  const setApiGroups         = useSecureStore((s) => s.setApiGroups);
  const setFileStatus        = useSecureStore((s) => s.setFileStatus);
  const clearApiAnalysis     = useSecureStore((s) => s.clearApiAnalysis);
  const setStageList            = useSecureStore((s) => s.setStageList);
  const setCurrentStageNo       = useSecureStore((s) => s.setCurrentStageNo);
  const markStageCompleted      = useSecureStore((s) => s.markStageCompleted);
  const setScanningFile         = useSecureStore((s) => s.setScanningFile);
  const clearStageProgress      = useSecureStore((s) => s.clearStageProgress);
  const setAwaitingConfirmation = useSecureStore((s) => s.setAwaitingConfirmation);
  const clearAwaitingConfirmation = useSecureStore((s) => s.clearAwaitingConfirmation);
  const awaitingConfirmation    = useSecureStore((s) => s.awaitingConfirmation);
  const confirmStages           = useSecureStore((s) => s.confirmStages);
  const addToast             = useToastStore((s) => s.addToast);
  const { startAnalysis, isAnalyzing } = useStartAnalysis();
  const { fetchAndStore: fetchStageVulns } = useVulnerabilitiesByFiles();
  const { t }                = useTranslation();

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
        // 엔진이 실제 사용한 모델. 없으면 기본 모델 폴백(하위 호환).
        const resolvedModelId: string = (event as { model?: string }).model ?? DEFAULT_MODEL_ID;
        const usage = event.token_usage as {
          input_tokens: number; output_tokens: number;
          cache_creation_input_tokens?: number; cache_read_input_tokens?: number;
        } | undefined;
        if (usage) {
          const inp = usage.input_tokens, out = usage.output_tokens;
          const cw = usage.cache_creation_input_tokens ?? 0;
          const cr = usage.cache_read_input_tokens ?? 0;
          const costUsd = calcCostUsd(inp, out, cw, cr, resolvedModelId);
          setLastTokenUsage({
            inputTokens: inp, outputTokens: out, cacheWriteTokens: cw, cacheReadTokens: cr,
            estimatedCostUsd: costUsd, modelId: resolvedModelId,
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
      } else if (event.type === 'awaiting_confirmation') {
        // STAGE-2: planning_node interrupt → 컨펌 모달 표시
        // awaiting_confirmation 이벤트의 stages 필드는 ConfirmStagePlanItem[] (files 포함).
        // ProgressEvent.stages가 union 타입이므로 as any 없이 안전하게 캐스트한다.
        const rawStages = (event.stages ?? []) as import('@/hooks/useSse').ConfirmStagePlanItem[];
        setAwaitingConfirmation(rawStages);
        setIsAnalyzing(false); // 컨펌 대기 중에는 analyzing 중단
        addToast('분석 계획이 준비되었습니다. 계획을 확인하고 승인해주세요.', 'info');
      } else if (event.type === 'started') {
        clearApiAnalysis();
        clearStageProgress();
        clearAwaitingConfirmation();
        addProgressStep({ stepName: '분석 시작', stepOrder: Date.now(), target: '초기화 중...', status: 'completed' });
      } else if (event.type === 'api_plan') {
        // TASK-1106 — API 그룹 계획 수신 → 파일 전부 pending 초기화
        setApiGroups(event.api_groups ?? []);
      } else if (event.type === 'stage_plan') {
        // Stage 목록 수신 — 전체 스테이지를 pending으로 초기화
        setStageList(
          (event.stages ?? []).map((s) => ({ ...s, status: 'pending' as const }))
        );
      } else if (event.type === 'stage_started') {
        // 현재 실행 중인 stage 강조 — stageList에서 해당 stage를 running으로 전환
        const stageNo = event.stage_no ?? null;
        setCurrentStageNo(stageNo);
        if (stageNo !== null) {
          const current = useSecureStore.getState().stageList;
          setStageList(
            current.map((s) => ({
              ...s,
              status: s.stage_no === stageNo ? ('running' as const) : s.status,
            }))
          );
        }
        addProgressStep({
          stepName: `Stage ${event.stage_no ?? ''}`,
          stepOrder: Date.now(),
          target: event.name ?? '',
          status: 'running',
        });
      } else if (event.type === 'stage_completed') {
        const stageNo = event.stage_no ?? 0;
        markStageCompleted(stageNo);
        // STAGE-1: stage 파일 목록이 있으면 취약점 점진 조회
        // files 없는 구버전 이벤트는 markStageCompleted만 수행(하위호환)
        if (event.files && event.files.length > 0 && sseSessionId) {
          fetchStageVulns(sseSessionId, stageNo, event.files);
        }
      } else if (event.type === 'progress') {
        if (event.file) {
          // TASK-1106 — 파일별 분석 상태 갱신
          if (event.node === 'cache_check') {
            setFileStatus(event.file, event.cache_hit ? 'cached' : 'analyzing');
          } else if (event.node === 'sast') {
            if (event.phase === 'scanning') {
              // 실시간 스캔 중 — scanningFile 상태 업데이트
              setScanningFile({
                file: event.file,
                current: event.current ?? 0,
                total: event.total ?? 0,
              });
              setFileStatus(event.file, 'analyzing');
            } else if (event.phase === 'done') {
              // 파일 완료
              setFileStatus(event.file, 'done');
              setScanningFile(null);
            } else {
              // phase 없는 기존 progress — 완료로 처리
              setFileStatus(event.file, 'done');
            }
          }
          if (event.phase !== 'scanning') {
            // scanning 중에는 addProgressStep 호출하지 않음 — 너무 빈번한 업데이트 방지
            addProgressStep({
              stepName: event.node === 'sast' ? 'SAST 분석' : (event.node ?? '분석 중'),
              stepOrder: Date.now(), target: event.file, status: 'completed',
            });
          }
        } else if (event.message) {
          addProgressStep({
            stepName: event.node ?? '진행 중', stepOrder: Date.now(),
            target: event.message, status: 'completed',
          });
        }
      } else if (event.type === 'scan_complete') {
        setScanningFile(null);
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


  const toggleApiFilter = () => {
    if (!activeApi) return;
    setApiGroupFilter(apiGroupFilter === activeApi ? null : activeApi);
  };

  return (
    <header
      className="hide-scrollbar"
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
        overflow: 'hidden',
      }}
    >
      {/* ── Left: sidebar toggle + Pagori brand + breadcrumb ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1, whiteSpace: 'nowrap', wordBreak: 'keep-all' }}>
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

        <PagoriMark size={22} />

        <ModeIndicator mode={workspaceMode} compact />

        <div style={{ width: 1, height: 18, background: 'var(--hairline)' }} />

        {/* Breadcrumb — click api/<group> chip to filter the right panel by that API */}
        <div
          className="app-header-breadcrumb"
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 12, color: 'var(--text-on-bg)',
            fontFamily: 'var(--font-mono)', minWidth: 0,
            overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
          }}
        >
          {breadcrumb.map((seg, i) => {
            const isFile = i === breadcrumb.length - 1;
            const isApiGroup = activeApi && seg === activeApi;
            const apiActive = apiGroupFilter === activeApi;
            return (
              <span key={`${seg}-${i}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minWidth: 0, flexShrink: isFile ? 1 : 0 }}>
                {i > 0 && <ChevronRight size={11} color="var(--text-tertiary)" style={{ flexShrink: 0 }} />}
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
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      minWidth: 0,
                    }}
                    title={seg}
                  >
                    {seg}
                  </span>
                )}
              </span>
            );
          })}
          {!breadcrumb.length && (
            <span style={{ color: 'var(--text-tertiary)' }}>
              {viewMode === 'editor' ? t('header.editor', '파일을 선택하세요') : viewMode === 'dashboard' ? t('header.dashboard', 'Security Dashboard') : viewMode.toUpperCase()}
            </span>
          )}
        </div>

        <div className="header-pipeline-badges">
          {([
            { id: 'sast',  label: 'SAST',  color: 'var(--low)',     bg: 'var(--low-dim)' },
            { id: 'dast',  label: 'DAST',  color: 'var(--orange)',  bg: 'var(--orange-dim)' },
            { id: 'patch', label: 'PATCH', color: 'var(--tag-1)',   bg: 'rgba(129,140,248,0.10)' },
          ] as const).map(({ id, label, color, bg }) => (
            <button
              key={label}
              onClick={() => setViewMode(id as ViewMode)}
              style={{
                fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 10,
                background: bg, color, border: `0.5px solid ${color}`,
                cursor: 'pointer', outline: 'none', transition: 'transform 0.1s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Right ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 1, minWidth: 0 }}>
        {/* CMD+K search button — 팔레트 토글 */}
        <button
          title="전역 검색 (⌘K)"
          onClick={() => { setShowSearchPalette(true); setSearchQuery(''); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            height: 28, padding: '0 8px 0 10px',
            background: 'var(--bg-3)', border: '1px solid var(--border)',
            borderRadius: 6, color: 'var(--text-tertiary)',
            fontSize: 11, cursor: 'pointer', flexShrink: 1, minWidth: 40, overflow: 'hidden',
          }}
        >
          <Search size={12} style={{ flexShrink: 0 }} />
          <span className="app-header-search-text" style={{ flex: 1, textAlign: 'left', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {t('header.search_placeholder', '취약점 · 파일 · CVE 검색')}
          </span>
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
                  background: active ? 'var(--orange-dim)' : 'transparent',
                  color: active ? 'var(--orange)' : 'var(--text-tertiary)',
                  fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 5,
                  boxShadow: active ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                {v === 'editor' ? <Code2 size={12} /> : <LayoutDashboard size={12} />}
                {v === 'editor' ? t('header.editor', '에디터') : t('header.dashboard', '대시보드')}
              </button>
            );
          })}
        </div>

        {/* 하단 패널 토글 버튼 */}
        <button
          onClick={() => setBottomPanelOpen(!bottomPanelOpen)}
          title="하단 패널 토글"
          style={{
            width: 28, height: 28, borderRadius: 6,
            background: bottomPanelOpen ? 'var(--orange-dim)' : 'var(--bg-2)',
            color: bottomPanelOpen ? 'var(--orange)' : 'var(--text-secondary)',
            border: `1px solid ${bottomPanelOpen ? 'rgba(234,88,12,0.3)' : 'var(--border)'}`,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.15s, color 0.15s',
          }}
        >
          <PanelBottom size={14} />
        </button>

        <button
          onClick={() => setShowCommitScan(true)}
          title={t('header.commit_scan', '커밋 시크릿 스캔')}
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
          title={t('header.history', '분석 이력 (전체 프로젝트)')}
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
          title={t('header.notifications', '알림')}
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
          onClick={workspaceMode === 'SECURITY_MANAGER' ? undefined : startAnalysis}
          disabled={isAnalyzing || workspaceMode === 'SECURITY_MANAGER'}
          title={workspaceMode === 'SECURITY_MANAGER' ? '보안 관리자는 읽기 전용 — 개발자에게 분석 요청' : undefined}
          style={{
            fontSize: 11, fontWeight: 800, padding: '0 14px',
            height: 28, borderRadius: 6,
            background: (isAnalyzing || workspaceMode === 'SECURITY_MANAGER') ? 'var(--orange-dim)' : 'var(--orange-2)',
            color: (isAnalyzing || workspaceMode === 'SECURITY_MANAGER') ? 'var(--orange)' : '#fff', border: 'none',
            cursor: (isAnalyzing || workspaceMode === 'SECURITY_MANAGER') ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
            boxShadow: (isAnalyzing || workspaceMode === 'SECURITY_MANAGER') ? 'none' : 'var(--orange-shadow)',
            opacity: workspaceMode === 'SECURITY_MANAGER' ? 0.55 : 1,
          }}
        >
          {workspaceMode === 'SECURITY_MANAGER'
            ? <Key size={12} />
            : <Play size={12} fill="currentColor" />}
          {isAnalyzing ? t('header.analyzing', '분석 중...') : workspaceMode === 'SECURITY_MANAGER' ? t('header.analyze_request', '분석 요청') : t('header.analyze_start', '분석 시작')}
        </button>

        {showHistory && <AnalysisHistoryModal onClose={() => setShowHistory(false)} />}
        {showCommitScan && <CommitSecretScanModal onClose={() => setShowCommitScan(false)} />}
        {/* STAGE-2: 계획 컨펌 모달 */}
        {awaitingConfirmation && sseSessionId && (
          <PlanConfirmModal
            sessionId={sseSessionId}
            stages={confirmStages}
            onClose={clearAwaitingConfirmation}
          />
        )}

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
            <FileJson size={14} /> {t('header.export_json', 'Export JSON')}
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
