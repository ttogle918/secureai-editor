// components/analysis/PdfReportModal.tsx
// API: POST /api/v1/reports                               — 리포트 생성 요청 (비동기, 형식별 1회씩)
//      GET  /api/v1/reports/{id}/status                   — 상태 조회
//      GET  /api/v1/reports/download/{token}              — 파일 다운로드
//      POST /api/v1/reports/{id}/send-email               — 이메일 전송
//      GET  /api/v1/reports/projects/{pId}/sessions/{sId}/roi     — ROI JSON
//      GET  /api/v1/reports/projects/{pId}/sessions/{sId}/roi/pdf — ROI PDF
'use client';
import { useState } from 'react';
import { X, FileText, Download, Loader2, CheckCircle2, Lock, Copy, Mail, TrendingUp, AlertCircle } from 'lucide-react';
import { apiClient, BASE_URL } from '@/lib/api/client';
import { useSecureStore } from '@/store/useSecureStore';
import { useToastStore } from '@/hooks/useToast';

type ReportLanguage = 'ko' | 'en';
type ReportFormat   = 'pdf' | 'json' | 'html' | 'md';
type ModalState     = 'configure' | 'generating' | 'ready';

interface ReportSection { id: string; label: string; checked: boolean; }

interface GeneratedReport {
  reportId: string;
  format: ReportFormat;
  downloadToken: string | null;
  fileName: string;
  status: 'polling' | 'ready' | 'failed';
}

interface ReportStatusData {
  id: string;
  status: 'PENDING' | 'GENERATING' | 'COMPLETED' | 'FAILED';
  downloadToken?: string;
}

interface RoiData {
  projectName: string; criticalCount: number; highCount: number;
  mediumCount: number; lowCount: number; totalVulnCount: number;
  savedHours: number; savedCost: number; hourlyRate: number;
}

interface PdfReportModalProps {
  isOpen?: boolean; onClose: () => void;
  projectName?: string; analysisDate?: string;
}

const FORMAT_OPTIONS: { value: ReportFormat; label: string; ext: string }[] = [
  { value: 'pdf',  label: 'PDF',              ext: 'pdf'  },
  { value: 'json', label: 'JSON (CycloneDX)', ext: 'json' },
  { value: 'html', label: 'HTML',             ext: 'html' },
  { value: 'md',   label: 'Markdown',         ext: 'md'   },
];

const DEFAULT_SECTIONS: ReportSection[] = [
  { id: 'executive', label: '경영진 요약 (Hero score + 우선순위)',  checked: true  },
  { id: 'charts',    label: '심각도별 분포 + 트렌드 차트',          checked: true  },
  { id: 'owasp',     label: 'OWASP Top 10 커버리지 매트릭스',       checked: true  },
  { id: 'heatmap',   label: '파일별 핫스팟 히트맵',                 checked: true  },
  { id: 'vulns',     label: '취약점 전체 상세',                     checked: true  },
  { id: 'patches',   label: 'AI 패치 제안 코드',                    checked: true  },
  { id: 'sbom',      label: 'SBOM & CVE 부록',                     checked: false },
  { id: 'dast',      label: 'DAST 실행 로그',                      checked: false },
];

const MAX_POLL = 10;
const POLL_MS  = 3000;

function CheckboxUI({ checked }: { checked: boolean }) {
  return (
    <span style={{
      width: 16, height: 16, borderRadius: 4, flexShrink: 0,
      border: `1.5px solid ${checked ? 'var(--orange-2)' : 'var(--border-3)'}`,
      background: checked ? 'var(--orange-2)' : 'transparent',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {checked && (
        <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
          <path d="M1 3.5L3.5 6L8 1" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  );
}

export function PdfReportModal({ isOpen = true, onClose, projectName, analysisDate }: PdfReportModalProps) {
  const projectId    = useSecureStore((s) => s.projectId);
  const sseSessionId = useSecureStore((s) => s.sseSessionId);
  const addToast     = useToastStore((s) => s.addToast);

  const [sections, setSections]             = useState<ReportSection[]>(DEFAULT_SECTIONS);
  const [state, setState]                   = useState<ModalState>('configure');
  const [language, setLanguage]             = useState<ReportLanguage>('ko');
  const [selectedFormats, setSelectedFormats] = useState<Set<ReportFormat>>(new Set(['pdf']));
  const [progress, setProgress]             = useState(0);
  const [generatedReports, setGeneratedReports] = useState<GeneratedReport[]>([]);
  const [emailSending, setEmailSending]     = useState(false);

  // ROI
  const [includeRoi, setIncludeRoi] = useState(false);
  const [hourlyRate, setHourlyRate] = useState<number>(50);
  const [roiData, setRoiData]       = useState<RoiData | null>(null);
  const [roiLoading, setRoiLoading] = useState(false);

  if (!isOpen) return null;

  const toggleSection = (id: string) =>
    setSections(prev => prev.map(s => s.id === id ? { ...s, checked: !s.checked } : s));

  const toggleFormat = (fmt: ReportFormat) =>
    setSelectedFormats(prev => {
      const next = new Set(prev);
      if (next.has(fmt)) { if (next.size > 1) next.delete(fmt); }
      else next.add(fmt);
      return next;
    });

  const fetchRoi = async () => {
    if (!projectId || !sseSessionId) { addToast('프로젝트와 세션이 필요합니다.', 'error'); return; }
    setRoiLoading(true); setRoiData(null);
    try {
      const res = await apiClient.get<{ data: RoiData }>(
        `/reports/projects/${projectId}/sessions/${sseSessionId}/roi?hourlyRate=${hourlyRate}`);
      setRoiData(res.data ?? null);
    } catch { addToast('ROI 데이터를 가져오지 못했습니다.', 'error'); }
    finally { setRoiLoading(false); }
  };

  const handleRoiPdfDownload = () => {
    if (!projectId || !sseSessionId) return;
    const a = document.createElement('a');
    a.href = `${BASE_URL}/reports/projects/${projectId}/sessions/${sseSessionId}/roi/pdf?hourlyRate=${hourlyRate}`;
    a.download = `roi-report-${sseSessionId}.pdf`;
    a.click();
  };

  // 선택한 형식 각각 POST → 병렬 폴링
  const handleGenerate = async () => {
    if (!projectId) { addToast('프로젝트가 선택되지 않았습니다.', 'error'); return; }
    setState('generating');
    setProgress(0);
    setGeneratedReports([]);

    const formats = Array.from(selectedFormats);

    try {
      // 형식별 리포트 생성 요청
      const createResults = await Promise.all(
        formats.map(fmt =>
          apiClient.post<{ data: { id: string } }>('/reports', {
            projectId,
            sessionId: sseSessionId ?? undefined,
            format: fmt.toUpperCase(),
            language,
          }).then(res => ({ fmt, reportId: res.data?.id ?? null }))
           .catch(() => ({ fmt, reportId: null }))
        )
      );

      const pending: GeneratedReport[] = createResults.map(({ fmt, reportId }) => ({
        reportId: reportId ?? '',
        format: fmt,
        downloadToken: null,
        fileName: `report.${fmt}`,
        status: reportId ? 'polling' : 'failed',
      }));
      setGeneratedReports(pending);

      // 형식별 독립 폴링
      const pollOne = async (entry: GeneratedReport): Promise<GeneratedReport> => {
        if (entry.status === 'failed') return entry;
        for (let i = 0; i < MAX_POLL; i++) {
          setProgress(Math.min(95, Math.round(((i + 1) / MAX_POLL) * 100)));
          await new Promise(r => setTimeout(r, POLL_MS));
          try {
            const res = await apiClient.get<{ data: ReportStatusData }>(`/reports/${entry.reportId}/status`);
            const s = res.data?.status;
            if (s === 'COMPLETED') {
              return { ...entry, status: 'ready', downloadToken: res.data?.downloadToken ?? null };
            }
            if (s === 'FAILED') return { ...entry, status: 'failed' };
          } catch { /* 일시적 오류 — 계속 시도 */ }
        }
        return { ...entry, status: 'failed' };
      };

      const results = await Promise.all(pending.map(pollOne));
      setGeneratedReports(results);
      setProgress(100);
      setState('ready');

      const successCount = results.filter(r => r.status === 'ready').length;
      if (successCount === 0) addToast('모든 리포트 생성에 실패했습니다.', 'error');
      else if (successCount < results.length) addToast(`${successCount}/${results.length}개 리포트가 생성되었습니다.`, 'info');
      else addToast('리포트 생성이 완료되었습니다.', 'info');

    } catch {
      addToast('리포트 요청 중 오류가 발생했습니다.', 'error');
      setState('configure');
    }
  };

  const handleDownload = (entry: GeneratedReport) => {
    if (!entry.downloadToken) return;
    const a = document.createElement('a');
    a.href = `${BASE_URL}/reports/download/${entry.downloadToken}`;
    a.download = entry.fileName;
    a.click();
  };

  const handleEmailSend = async () => {
    // 첫 번째 완료된 리포트로 이메일 전송
    const target = generatedReports.find(r => r.status === 'ready');
    if (!target) return;
    setEmailSending(true);
    try {
      await apiClient.post(`/reports/${target.reportId}/send-email`);
      addToast('이메일로 리포트를 전송했습니다.', 'info');
    } catch { addToast('이메일 전송에 실패했습니다.', 'error'); }
    finally { setEmailSending(false); }
  };

  const checkedCount = sections.filter(s => s.checked).length;

  return (
    <div
      role="dialog" aria-modal="true" aria-label="보안 리포트 생성"
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
    >
      <div style={{
        width: '100%', maxWidth: 580,
        background: 'var(--bg-1)', border: '1px solid var(--border-2)',
        borderRadius: 14, boxShadow: '0 24px 64px rgba(0,0,0,0.60)', overflow: 'hidden',
      }}>
        {/* 헤더 */}
        <div style={{ padding: '18px 24px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--hairline)' }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--orange-dim)', color: 'var(--orange)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FileText size={18} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>보안 리포트 생성</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              {projectName ? `${projectName}${analysisDate ? ` · ${analysisDate}` : ''}` : projectId ? `프로젝트 ID: ${projectId.slice(0, 8)}…` : '프로젝트를 선택하세요'}
            </div>
          </div>
          <button onClick={onClose} aria-label="닫기" style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={14} />
          </button>
        </div>

        {/* 본문 */}
        <div style={{ padding: '20px 24px', maxHeight: '72vh', overflowY: 'auto' }}>

          {state === 'configure' && (
            <>
              {/* 섹션 선택 */}
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.06em', marginBottom: 8 }}>
                포함할 섹션 ({checkedCount}/{sections.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 18 }}>
                {sections.map(opt => (
                  <label key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 6, cursor: 'pointer', background: opt.checked ? 'var(--bg-2)' : 'transparent', border: `1px solid ${opt.checked ? 'var(--border)' : 'transparent'}` }}>
                    <CheckboxUI checked={opt.checked} />
                    <input type="checkbox" checked={opt.checked} onChange={() => toggleSection(opt.id)} style={{ display: 'none' }} />
                    <span style={{ fontSize: 12, color: opt.checked ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>{opt.label}</span>
                  </label>
                ))}
              </div>

              {/* 언어 + 형식 멀티 선택 */}
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12, marginBottom: 18 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.06em', marginBottom: 6 }}>언어</div>
                  <select value={language} onChange={e => setLanguage(e.target.value as ReportLanguage)} className="field">
                    <option value="ko">한국어</option>
                    <option value="en">English</option>
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.06em', marginBottom: 6 }}>
                    출력 형식 (복수 선택 가능)
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {FORMAT_OPTIONS.map(({ value, label }) => {
                      const active = selectedFormats.has(value);
                      return (
                        <button
                          key={value}
                          onClick={() => toggleFormat(value)}
                          style={{
                            height: 28, padding: '0 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                            background: active ? 'var(--orange-2)' : 'var(--bg-3)',
                            color: active ? '#fff' : 'var(--text-secondary)',
                            border: `1px solid ${active ? 'var(--orange-2)' : 'var(--border)'}`,
                            transition: 'all 0.1s',
                          }}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>
                    {selectedFormats.size}개 선택됨 · 각 형식별로 독립 파일 생성
                  </div>
                </div>
              </div>

              {/* ROI 위젯 */}
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 10 }}>
                  <CheckboxUI checked={includeRoi} />
                  <input type="checkbox" checked={includeRoi} onChange={e => { setIncludeRoi(e.target.checked); setRoiData(null); }} style={{ display: 'none' }} />
                  <TrendingUp size={13} color="var(--orange)" />
                  <span style={{ fontSize: 12, fontWeight: 600 }}>ROI 위젯 포함</span>
                </label>
                {includeRoi && (
                  <div style={{ paddingLeft: 26 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>시간당 단가 ($)</div>
                      <input type="number" min={0} step={10} value={hourlyRate} onChange={e => { const v = parseFloat(e.target.value); setHourlyRate(isNaN(v) || v < 0 ? 0 : v); setRoiData(null); }} className="field" style={{ width: 90, textAlign: 'right' }} />
                      <button onClick={() => { void fetchRoi(); }} disabled={roiLoading} className="btn btn-sm btn-ghost">
                        {roiLoading ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : '계산'}
                      </button>
                    </div>
                    {roiData && (
                      <div style={{ padding: 12, background: 'var(--bg-3)', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 8 }}>ROI 미리보기</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                          <div style={{ textAlign: 'center', padding: '8px 0', background: 'var(--bg-1)', borderRadius: 6 }}>
                            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--orange)' }}>{roiData.savedHours.toFixed(1)}h</div>
                            <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 2 }}>절감 시간</div>
                          </div>
                          <div style={{ textAlign: 'center', padding: '8px 0', background: 'var(--bg-1)', borderRadius: 6 }}>
                            <div style={{ fontSize: 18, fontWeight: 800, color: '#10b981' }}>${Math.round(roiData.savedCost).toLocaleString()}</div>
                            <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 2 }}>절감 비용</div>
                          </div>
                        </div>
                        <button onClick={handleRoiPdfDownload} className="btn btn-sm btn-ghost" style={{ width: '100%', marginTop: 8 }}>
                          <Download size={11} />ROI PDF 다운로드
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 토큰 안내 */}
              <div style={{ padding: 12, background: 'var(--bg-3)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <Lock size={14} color="var(--text-secondary)" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>다운로드 토큰</div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>24시간 유효한 보안 토큰으로 다운로드</div>
                </div>
                <span className="chip chip-low" style={{ height: 18 }}>활성</span>
              </div>

              {!projectId && (
                <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--orange-dim)', border: '1px solid rgba(249,115,22,0.3)', fontSize: 11, color: 'var(--text-secondary)' }}>
                  프로젝트가 선택되지 않았습니다.
                </div>
              )}
            </>
          )}

          {state === 'generating' && (
            <div style={{ padding: '32px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
              <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--orange-dim)', color: 'var(--orange)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Loader2 size={28} style={{ animation: 'spin 1s linear infinite' }} />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>리포트 생성 중</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {selectedFormats.size}개 형식 병렬 생성 중…
                </div>
              </div>
              <div style={{ width: '100%', maxWidth: 320 }}>
                <div className="progress-track" style={{ height: 4, marginBottom: 6 }}>
                  <div className="progress-fill" style={{ width: `${progress}%`, transition: 'width 0.4s ease' }} />
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>{progress}%</div>
              </div>
            </div>
          )}

          {state === 'ready' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, var(--orange), var(--orange-2))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckCircle2 size={20} color="#fff" />
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>리포트 생성 완료</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                    {generatedReports.filter(r => r.status === 'ready').length}개 형식 준비됨
                  </div>
                </div>
              </div>

              {/* 형식별 다운로드 행 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {generatedReports.map(entry => {
                  const fmtInfo = FORMAT_OPTIONS.find(f => f.value === entry.format);
                  return (
                    <div key={entry.format} style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--bg-3)', border: `1px solid ${entry.status === 'failed' ? 'rgba(239,68,68,0.3)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', gap: 12 }}>
                      {entry.status === 'failed'
                        ? <AlertCircle size={16} color="#ef4444" />
                        : <FileText size={16} color="var(--orange)" />}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>{fmtInfo?.label ?? entry.format.toUpperCase()}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1 }}>
                          {entry.status === 'failed' ? '생성 실패' : `report-${entry.reportId.slice(0, 8)}.${entry.format}`}
                        </div>
                      </div>
                      {entry.status === 'ready' && (
                        <button onClick={() => handleDownload(entry)} className="btn btn-primary" style={{ height: 28, fontSize: 11 }}>
                          <Download size={11} />다운로드
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* 공유 버튼 */}
              <div style={{ display: 'flex', gap: 8 }}>
                {generatedReports.some(r => r.status === 'ready' && r.downloadToken) && (
                  <button className="btn btn-sm btn-ghost"
                    onClick={() => {
                      const first = generatedReports.find(r => r.status === 'ready' && r.downloadToken);
                      if (first) { void navigator.clipboard.writeText(`${BASE_URL}/reports/download/${first.downloadToken ?? ''}`); addToast('링크가 복사되었습니다.', 'info'); }
                    }}>
                    <Copy size={11} />링크 복사
                  </button>
                )}
                <button className="btn btn-sm btn-ghost" onClick={() => { void handleEmailSend(); }} disabled={emailSending || !generatedReports.some(r => r.status === 'ready')}>
                  {emailSending ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <Mail size={11} />}
                  {emailSending ? '전송 중…' : '이메일 전송'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 푸터 */}
        {state !== 'generating' && (
          <div style={{ padding: '14px 24px', background: 'var(--bg-2)', borderTop: '1px solid var(--hairline)', display: 'flex', alignItems: 'center', justifyContent: state === 'ready' ? 'flex-end' : 'space-between', gap: 8 }}>
            {state === 'configure' && (
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>섹션 {checkedCount}개 · 형식 {selectedFormats.size}개 선택됨</span>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={onClose} style={{ height: 32, padding: '0 14px', borderRadius: 6, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-tertiary)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                {state === 'ready' ? '닫기' : '취소'}
              </button>
              {state === 'configure' && (
                <button
                  onClick={() => { void handleGenerate(); }}
                  disabled={!projectId || checkedCount === 0}
                  style={{
                    height: 32, padding: '0 16px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 700, cursor: !projectId || checkedCount === 0 ? 'default' : 'pointer',
                    background: !projectId || checkedCount === 0 ? 'var(--orange-dim)' : 'var(--orange-2)',
                    color: !projectId || checkedCount === 0 ? 'var(--orange)' : '#fff',
                    display: 'flex', alignItems: 'center', gap: 6,
                    boxShadow: !projectId || checkedCount === 0 ? 'none' : 'var(--orange-shadow)',
                  }}>
                  <FileText size={12} />리포트 생성
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
