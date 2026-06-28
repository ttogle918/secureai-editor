'use client';
import React, { useMemo, useState, useCallback } from 'react';
import { Network, Play, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { useSecureStore } from '@/store/useSecureStore';
import type { ApiGroup } from '@/store/useSecureStore';
import { useDastBatchStream } from '@/hooks/useDastBatchStream';
import { useToastStore } from '@/hooks/useToast';
import { apiClient } from '@/lib/api/client';
import type { Vulnerability } from '@/lib/mockData';

// 단건 DAST 게이트와 동일 — localhost 데모 환경에서는 consentGiven=true
const DEMO_CONSENT_GIVEN = true;

interface BatchDastTarget {
  vulnId: string;
  vulnType: string;
  targetUrl: string;
  endpoint: string;
  params: Record<string, string>;
}

interface BatchDastRequest {
  sessionId: string;
  domain: string;
  consentGiven: boolean;
  targets: BatchDastTarget[];
}

/** 취약점에서 배치 DAST 타깃을 구성한다 */
function buildBatchTarget(v: Vulnerability, baseUrl: string): BatchDastTarget {
  return {
    vulnId:    v.id,
    vulnType:  v.type,
    targetUrl: baseUrl,
    endpoint:  v.apiEndpoint ?? '',
    params:    {},
  };
}

/** 경로 비교 — 백슬래시 정규화 후 정확 일치, 실패 시 basename 일치로 폴백 */
function samePath(a: string, b: string): boolean {
  const na = a.replace(/\\/g, '/');
  const nb = b.replace(/\\/g, '/');
  if (na === nb) return true;
  return na.split('/').pop() === nb.split('/').pop();
}

/**
 * 취약점을 api_discovery가 발견한 apiGroups와 매칭해 엔드포인트(url)를 찾는다 (OPTION-2).
 * 백엔드 DB에 apiEndpoint 컬럼이 없으므로, 분석 시 발견된 엔드포인트-파일 매핑(store.apiGroups)을
 * 취약점 위치(filePath+lineStart)와 대조해 연결한다.
 * 같은 파일에 여러 엔드포인트가 있으면 취약점 라인 바로 위(가장 가까운 line ≤ lineStart)에서
 * 선언된 엔드포인트를 고르고, 라인 위 선언이 없으면 가장 가까운(최소 line) 것을 쓴다.
 */
function resolveEndpoint(v: Vulnerability, apiGroups: ApiGroup[]): string | undefined {
  let above: { url: string; line: number } | undefined;
  let fallback: { url: string; line: number } | undefined;
  for (const g of apiGroups) {
    for (const f of g.files) {
      if (!samePath(f.path, v.filePath)) continue;
      if (fallback === undefined || f.line < fallback.line) fallback = { url: g.url, line: f.line };
      if (f.line <= v.lineStart && (above === undefined || f.line > above.line)) {
        above = { url: g.url, line: f.line };
      }
    }
  }
  return (above ?? fallback)?.url;
}

/** URL에서 hostname을 추출한다. 파싱 실패 시 'localhost' 폴백 */
function extractDomain(url: string): string {
  try { return new URL(url).hostname; }
  catch { return 'localhost'; }
}

/** 선택된 취약점 목록과 세션 정보로 배치 요청 객체를 조립한다 */
function buildBatchRequest(
  selectedVulns: Vulnerability[],
  baseUrl: string,
  sessionId: string,
): BatchDastRequest {
  return {
    sessionId,
    domain: extractDomain(baseUrl),
    consentGiven: DEMO_CONSENT_GIVEN,
    targets: selectedVulns.map((v) => buildBatchTarget(v, baseUrl)),
  };
}

/** 배치 DAST 시작 — POST /api/v1/dast/batch, 202 반환 */
async function startBatchDast(req: BatchDastRequest): Promise<void> {
  await apiClient.post('/dast/batch', req);
}

// ── 진행 상태 뱃지 ────────────────────────────────────────────────────────────
interface TargetStatusBadgeProps {
  vulnId: string;
}

function TargetStatusBadge({ vulnId }: TargetStatusBadgeProps) {
  const dastExploitResults = useSecureStore((s) => s.dastExploitResults);
  const result = dastExploitResults[vulnId];

  if (!result) {
    return (
      <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
        대기 중
      </span>
    );
  }

  if (result.success) {
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--critical)', fontWeight: 700 }}>
        <XCircle size={11} />EXPLOITED
      </span>
    );
  }

  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--low)', fontWeight: 700 }}>
      <CheckCircle size={11} />안전
    </span>
  );
}

// ── 배치 로그 터미널 ──────────────────────────────────────────────────────────
function BatchDastTerminal() {
  const dastLogs = useSecureStore((s) => s.dastLogs);

  const levelColor: Record<string, string> = {
    info:    'var(--text-secondary)',
    warn:    '#f59e0b',
    error:   'var(--critical)',
    success: 'var(--low)',
  };

  return (
    <div style={{
      flex: 1,
      background: 'var(--bg-0)',
      borderRadius: 8,
      border: '1px solid var(--border)',
      padding: '10px 12px',
      overflowY: 'auto',
      fontFamily: 'var(--font-mono)',
      fontSize: 11,
      lineHeight: 1.6,
    }}>
      {dastLogs.length === 0 ? (
        <span style={{ color: 'var(--text-tertiary)' }}>배치 DAST 실행 시 로그가 표시됩니다.</span>
      ) : (
        dastLogs.map((log, i) => (
          <div key={i} style={{ color: levelColor[log.level] ?? 'var(--text-secondary)' }}>
            <span style={{ color: 'var(--text-tertiary)', marginRight: 8 }}>{log.timestamp}</span>
            {log.message}
          </div>
        ))
      )}
    </div>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────
export function DastWorkspacePage() {
  const { t } = useTranslation();
  const vulns            = useSecureStore((s) => s.vulns);
  const apiGroups        = useSecureStore((s) => s.apiGroups);
  const dastBaseUrl      = useSecureStore((s) => s.dastBaseUrl);
  const sseSessionId     = useSecureStore((s) => s.sseSessionId);
  const setDastBatchSessionId = useSecureStore((s) => s.setDastBatchSessionId);
  const setDastBatchSummary   = useSecureStore((s) => s.setDastBatchSummary);
  const dastBatchSummary      = useSecureStore((s) => s.dastBatchSummary);
  const dastBatchSessionId    = useSecureStore((s) => s.dastBatchSessionId);
  const clearDastLogs         = useSecureStore((s) => s.clearDastLogs);
  const addToast              = useToastStore((s) => s.addToast);

  // 배치 SSE 구독 — 세션 id가 설정되면 자동 연결
  useDastBatchStream();

  const [selectedVulnIds, setSelectedVulnIds] = useState<Set<string>>(new Set());
  const [targetBaseUrl, setTargetBaseUrl]      = useState(dastBaseUrl || 'http://localhost:8080');
  const [isLaunching, setIsLaunching]          = useState(false);

  const isBatchRunning = dastBatchSessionId !== null;

  // 엔드포인트가 연결되는 취약점만 DAST 대상으로 표시.
  // 우선순위: 이미 세팅된 v.apiEndpoint > api_discovery(apiGroups) 매칭 (OPTION-2)
  const dastableVulns = useMemo(() => {
    return vulns
      .map((v) => {
        const endpoint = v.apiEndpoint ?? resolveEndpoint(v, apiGroups);
        return endpoint ? { ...v, apiEndpoint: endpoint } : null;
      })
      .filter((v): v is Vulnerability => v !== null);
  }, [vulns, apiGroups]);

  const toggleVuln = useCallback((id: string) => {
    setSelectedVulnIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedVulnIds(new Set(dastableVulns.map((v) => v.id)));
  }, [dastableVulns]);

  const clearSelection = useCallback(() => {
    setSelectedVulnIds(new Set());
  }, []);

  const handleBatchRun = useCallback(async () => {
    if (selectedVulnIds.size === 0 || !sseSessionId) return;

    // dastableVulns를 사용해야 매칭된 apiEndpoint가 배치 요청에 포함된다 (OPTION-2)
    const selectedVulns = Array.from(selectedVulnIds)
      .map((id) => dastableVulns.find((v) => v.id === id))
      .filter((v): v is Vulnerability => v !== undefined);

    const req = buildBatchRequest(selectedVulns, targetBaseUrl, sseSessionId);

    clearDastLogs();
    setDastBatchSummary(null);
    setIsLaunching(true);

    try {
      await startBatchDast(req);
      // 202 — SSE 세션 id를 store에 설정하면 useDastBatchStream이 구독 시작
      setDastBatchSessionId(sseSessionId);
      clearSelection();
    } catch {
      addToast('배치 DAST 시작 실패 — 잠시 후 다시 시도하세요', 'error');
    } finally {
      setIsLaunching(false);
    }
  }, [
    selectedVulnIds, sseSessionId, dastableVulns, targetBaseUrl,
    clearDastLogs, setDastBatchSummary, setDastBatchSessionId,
    clearSelection, addToast,
  ]);

  if (vulns.length === 0) {
    return (
      <div style={{ padding: 40, color: '#fff', background: 'var(--bg-1)', height: '100%', overflow: 'auto' }}>
        <EmptyBanner icon={<Network size={32} color="var(--orange)" />} message="SAST 분석 내역이 없습니다. 먼저 SAST를 실행하여 테스트 가능한 API 엔드포인트를 발견하세요." />
      </div>
    );
  }

  if (dastableVulns.length === 0) {
    return (
      <div style={{ padding: 40, color: '#fff', background: 'var(--bg-1)', height: '100%', overflow: 'auto' }}>
        <PageHeader />
        <EmptyBanner icon={<AlertTriangle size={28} color="var(--orange)" />} message="분석된 코드에서 HTTP API 엔드포인트가 발견되지 않았습니다." />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-1)', color: '#fff', overflow: 'hidden' }}>
      <div style={{ padding: '20px 24px 0' }}>
        <PageHeader />
      </div>

      <div style={{ display: 'flex', flex: 1, gap: 16, padding: '16px 24px 20px', overflow: 'hidden' }}>
        {/* 왼쪽: 타깃 목록 */}
        <div style={{ width: 280, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* URL 입력 */}
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>
              TARGET BASE URL
            </label>
            <input
              type="text"
              value={targetBaseUrl}
              onChange={(e) => setTargetBaseUrl(e.target.value)}
              placeholder="http://localhost:8080"
              style={{
                width: '100%',
                padding: '6px 10px',
                background: 'var(--bg-3)',
                border: '1px solid var(--border)',
                borderRadius: 5,
                color: '#fff',
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* 타깃 목록 헤더 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', flex: 1 }}>
              DAST 타깃 ({dastableVulns.length}건)
            </span>
            <button
              onClick={selectAll}
              style={{ fontSize: 10, color: 'var(--orange)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 4px' }}
            >
              전체 선택
            </button>
            <button
              onClick={clearSelection}
              style={{ fontSize: 10, color: 'var(--text-tertiary)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 4px' }}
            >
              해제
            </button>
          </div>

          {/* 타깃 목록 */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {dastableVulns.map((v) => {
              const isChecked = selectedVulnIds.has(v.id);
              return (
                <div
                  key={v.id}
                  role="checkbox"
                  aria-checked={isChecked}
                  tabIndex={0}
                  onClick={() => toggleVuln(v.id)}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      toggleVuln(v.id);
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    padding: '8px 10px',
                    borderRadius: 6,
                    border: `1px solid ${isChecked ? 'var(--orange-glow)' : 'var(--border)'}`,
                    background: isChecked ? 'rgba(249,115,22,0.06)' : 'var(--bg-2)',
                    cursor: 'pointer',
                    transition: 'background 0.1s, border-color 0.1s',
                  }}
                >
                  {/* 체크박스 */}
                  <div style={{
                    width: 13,
                    height: 13,
                    borderRadius: 3,
                    border: `1.5px solid ${isChecked ? 'var(--orange)' : 'rgba(255,255,255,0.2)'}`,
                    background: isChecked ? 'var(--orange)' : 'transparent',
                    flexShrink: 0,
                    marginTop: 1,
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>
                      {v.type}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>
                      {v.apiEndpoint}
                    </div>
                    <TargetStatusBadge vulnId={v.id} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* 배치 실행 버튼 */}
          <button
            disabled={selectedVulnIds.size === 0 || isBatchRunning || isLaunching || !sseSessionId}
            onClick={() => { void handleBatchRun(); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '9px 0',
              borderRadius: 7,
              fontWeight: 700,
              fontSize: 13,
              background: selectedVulnIds.size > 0 && !isBatchRunning ? 'var(--orange)' : 'var(--bg-3)',
              border: 'none',
              color: selectedVulnIds.size > 0 && !isBatchRunning ? '#fff' : 'var(--text-tertiary)',
              cursor: selectedVulnIds.size > 0 && !isBatchRunning && !isLaunching ? 'pointer' : 'not-allowed',
              transition: 'background 0.15s',
            }}
          >
            <Play size={14} />
            {isBatchRunning
              ? '실행 중...'
              : isLaunching
              ? '시작 중...'
              : `배치 실행 (${selectedVulnIds.size}건)`}
          </button>
        </div>

        {/* 오른쪽: 로그 + 집계 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
          {/* 집계 배너 */}
          {dastBatchSummary && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 20,
              padding: '10px 14px',
              borderRadius: 8,
              background: 'rgba(34,197,94,0.08)',
              border: '0.5px solid rgba(34,197,94,0.3)',
            }}>
              <CheckCircle size={18} color="var(--low)" />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>배치 완료</span>
              <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-secondary)' }}>
                <span>전체 <strong style={{ color: 'var(--text-primary)' }}>{dastBatchSummary.total}</strong>건</span>
                <span>성공 <strong style={{ color: 'var(--low)' }}>{dastBatchSummary.succeeded}</strong>건</span>
                {dastBatchSummary.skipped > 0 && (
                  <span>건너뜀 <strong style={{ color: '#f59e0b' }}>{dastBatchSummary.skipped}</strong>건</span>
                )}
              </div>
            </div>
          )}

          {/* 로그 터미널 */}
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>
            BATCH DAST LOG
          </div>
          <BatchDastTerminal />
        </div>
      </div>
    </div>
  );
}

// ── 로컬 헬퍼 컴포넌트 ────────────────────────────────────────────────────────

function PageHeader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
      <Network size={28} color="var(--orange)" />
      <div>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>DAST Workspace</h1>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
          동적 애플리케이션 보안 테스트 — 다건 타깃을 선택해 배치 실행합니다.
        </p>
      </div>
    </div>
  );
}

function EmptyBanner({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <div style={{ padding: 40, textAlign: 'center', background: 'var(--bg-2)', borderRadius: 12, border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>{icon}</div>
      <p style={{ color: 'var(--text-tertiary)', margin: 0, fontSize: 13 }}>{message}</p>
    </div>
  );
}
