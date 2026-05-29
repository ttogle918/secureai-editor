// components/analysis/PdfReportModal.tsx
// PDF 보안 리포트 생성 · 다운로드 모달 — MissingScreens.jsx 디자인 시안 반영
// API: POST /api/v1/reports                                                  — 리포트 생성 요청 (비동기)
//      GET  /api/v1/reports/{id}/status                                       — 상태 조회
//      GET  /api/v1/reports/download/{token}                                  — 파일 다운로드
//      GET  /api/v1/reports/projects/{pId}/sessions/{sId}/roi                 — ROI JSON 조회
//      GET  /api/v1/reports/projects/{pId}/sessions/{sId}/roi/pdf             — ROI PDF 다운로드
'use client';
import { useState } from 'react';
import { X, FileText, Download, Loader2, CheckCircle2, Lock, Copy, Mail, TrendingUp } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { useSecureStore } from '@/store/useSecureStore';
import { useToastStore } from '@/hooks/useToast';

type ReportLanguage = 'ko' | 'en';
type ReportFormat   = 'pdf' | 'html' | 'md';

interface ReportSection {
  id: string;
  label: string;
  checked: boolean;
}

type ModalState = 'configure' | 'generating' | 'ready';

interface ReportStatusData {
  id: string;
  status: 'PENDING' | 'GENERATING' | 'COMPLETED' | 'FAILED';
  downloadToken?: string;
  fileName?: string;
}

/** 백엔드 RoiResult record와 매핑 */
interface RoiData {
  projectName: string;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  totalVulnCount: number;
  savedHours: number;
  savedCost: number;
  hourlyRate: number;
}

interface PdfReportModalProps {
  isOpen?: boolean;
  onClose: () => void;
  projectName?: string;
  analysisDate?: string;
}

const DEFAULT_SECTIONS: ReportSection[] = [
  { id: 'executive',  label: '경영진 요약 (Hero score + 우선순위)',     checked: true },
  { id: 'charts',     label: '심각도별 분포 + 트렌드 차트',            checked: true },
  { id: 'owasp',      label: 'OWASP Top 10 커버리지 매트릭스',          checked: true },
  { id: 'heatmap',    label: '파일별 핫스팟 히트맵',                    checked: true },
  { id: 'vulns',      label: '취약점 전체 상세',                       checked: true },
  { id: 'patches',    label: 'AI 패치 제안 코드',                      checked: true },
  { id: 'sbom',       label: 'SBOM & CVE 부록',                        checked: false },
  { id: 'dast',       label: 'DAST 실행 로그',                         checked: false },
];

// 폴링 최대 횟수 (30초 × 10 = 5분)
const MAX_POLL_COUNT = 10;
const POLL_INTERVAL_MS = 3000;

export function PdfReportModal({
  isOpen = true,
  onClose,
  projectName,
  analysisDate,
}: PdfReportModalProps) {
  const projectId    = useSecureStore((s) => s.projectId);
  const sseSessionId = useSecureStore((s) => s.sseSessionId);
  const addToast     = useToastStore((s) => s.addToast);

  const [sections, setSections]       = useState<ReportSection[]>(DEFAULT_SECTIONS);
  const [state, setState]             = useState<ModalState>('configure');
  const [downloadToken, setToken]     = useState<string | null>(null);
  const [reportId, setReportId]       = useState<string | null>(null);
  const [fileName, setFileName]       = useState<string>('report.pdf');
  const [emailSending, setEmailSending] = useState(false);
  const [language, setLanguage]       = useState<ReportLanguage>('ko');
  const [format,   setFormat]         = useState<ReportFormat>('pdf');
  const [progress, setProgress]       = useState(0);

  // ROI 위젯 상태
  const [includeRoi, setIncludeRoi]   = useState(false);
  const [hourlyRate, setHourlyRate]   = useState<number>(50);
  const [roiData, setRoiData]         = useState<RoiData | null>(null);
  const [roiLoading, setRoiLoading]   = useState(false);

  if (!isOpen) return null;

  const toggleSection = (id: string) => {
    setSections(prev =>
      prev.map(s => s.id === id ? { ...s, checked: !s.checked } : s),
    );
  };

  /** ROI JSON을 백엔드에서 조회하여 미리보기를 표시한다 */
  const fetchRoi = async () => {
    if (!projectId || !sseSessionId) {
      addToast('프로젝트와 세션이 선택되어야 ROI를 계산할 수 있습니다.', 'error');
      return;
    }
    setRoiLoading(true);
    setRoiData(null);
    try {
      const res = await apiClient.get<{ data: RoiData }>(
        `/reports/projects/${projectId}/sessions/${sseSessionId}/roi?hourlyRate=${hourlyRate}`,
      );
      setRoiData(res.data ?? null);
    } catch {
      addToast('ROI 데이터를 가져오지 못했습니다.', 'error');
    } finally {
      setRoiLoading(false);
    }
  };

  /** ROI PDF를 직접 다운로드한다 */
  const handleRoiPdfDownload = () => {
    if (!projectId || !sseSessionId) return;
    const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080/api/v1';
    const url = `${base}/reports/projects/${projectId}/sessions/${sseSessionId}/roi/pdf?hourlyRate=${hourlyRate}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = `roi-report-${sseSessionId}.pdf`;
    a.click();
  };

  const handleGenerate = async () => {
    if (!projectId) {
      addToast('프로젝트가 선택되지 않았습니다.', 'error');
      return;
    }
    setState('generating');
    setProgress(0);

    try {
      const res = await apiClient.post<{ data: { id: string } }>('/reports', {
        projectId,
        sessionId: sseSessionId ?? undefined,
        format: format.toUpperCase(),
        language,
      });

      const reportId = res.data?.id;
      if (!reportId) {
        throw new Error('reportId 없음');
      }
      setReportId(reportId);

      // 폴링으로 상태 확인
      let pollCount = 0;
      const poll = async (): Promise<void> => {
        if (pollCount >= MAX_POLL_COUNT) {
          addToast('리포트 생성이 지연되고 있습니다. 잠시 후 다시 시도하세요.', 'error');
          setState('configure');
          return;
        }
        pollCount++;

        // 진행률 시각적 업데이트 (폴링 횟수 기반)
        setProgress(Math.min(95, Math.round((pollCount / MAX_POLL_COUNT) * 100)));

        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
        const statusRes = await apiClient.get<{ data: ReportStatusData }>(`/reports/${reportId}/status`);
        const status = statusRes.data?.status;

        if (status === 'COMPLETED') {
          const token = statusRes.data?.downloadToken;
          const name  = statusRes.data?.fileName ?? 'report.pdf';
          if (token) {
            setToken(token);
            setFileName(name);
            setProgress(100);
            setState('ready');
            addToast('PDF 리포트 생성이 완료되었습니다.', 'info');
          } else {
            addToast('다운로드 토큰을 받지 못했습니다.', 'error');
            setState('configure');
          }
        } else if (status === 'FAILED') {
          addToast('리포트 생성에 실패했습니다.', 'error');
          setState('configure');
        } else {
          await poll();
        }
      };

      await poll();
    } catch {
      addToast('리포트 요청 중 오류가 발생했습니다.', 'error');
      setState('configure');
    }
  };

  const handleEmailSend = async () => {
    if (!reportId) return;
    setEmailSending(true);
    try {
      await apiClient.post(`/reports/${reportId}/send-email`);
      addToast('이메일로 리포트를 전송했습니다.', 'info');
    } catch {
      addToast('이메일 전송에 실패했습니다.', 'error');
    } finally {
      setEmailSending(false);
    }
  };

  const handleDownload = () => {
    if (!downloadToken) return;
    const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080/api/v1';
    const url = `${base}/reports/download/${downloadToken}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
  };

  const checkedCount = sections.filter(s => s.checked).length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="PDF 보안 리포트 생성"
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div style={{
        width: '100%', maxWidth: 560,
        background: 'var(--bg-1)',
        border: '1px solid var(--border-2)',
        borderRadius: 14,
        boxShadow: '0 24px 64px rgba(0,0,0,0.60)',
        overflow: 'hidden',
      }}>
        {/* 헤더 */}
        <div style={{
          padding: '18px 24px', display: 'flex', alignItems: 'center', gap: 12,
          borderBottom: '1px solid var(--hairline)',
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: 'var(--orange-dim)', color: 'var(--orange)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <FileText size={18} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>PDF 보안 리포트</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              {projectName
                ? `${projectName}${analysisDate ? ` · ${analysisDate} 분석 기준` : ''}`
                : projectId
                  ? `프로젝트 ID: ${projectId.slice(0, 8)}…`
                  : '프로젝트를 선택하세요'}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="닫기"
            style={{
              width: 28, height: 28, borderRadius: 6, border: 'none',
              background: 'transparent', color: 'var(--text-tertiary)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* 본문 */}
        <div style={{ padding: '20px 24px' }}>

          {state === 'configure' && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.06em', marginBottom: 10 }}>
                포함할 섹션 ({checkedCount}/{sections.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 18 }}>
                {sections.map(opt => (
                  <label
                    key={opt.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 10px', borderRadius: 6, cursor: 'pointer',
                      background: opt.checked ? 'var(--bg-2)' : 'transparent',
                      border: `1px solid ${opt.checked ? 'var(--border)' : 'transparent'}`,
                      transition: 'background 0.1s',
                    }}
                  >
                    <span style={{
                      width: 16, height: 16, borderRadius: 4,
                      border: `1.5px solid ${opt.checked ? 'var(--orange-2)' : 'var(--border-3)'}`,
                      background: opt.checked ? 'var(--orange-2)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      {opt.checked && (
                        <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                          <path d="M1 3.5L3.5 6L8 1" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                    <input
                      type="checkbox"
                      checked={opt.checked}
                      onChange={() => toggleSection(opt.id)}
                      style={{ display: 'none' }}
                    />
                    <span style={{ fontSize: 12, color: opt.checked ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                      {opt.label}
                    </span>
                  </label>
                ))}
              </div>

              {/* 언어 / 형식 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.06em', marginBottom: 6 }}>
                    언어
                  </div>
                  <select
                    value={language}
                    onChange={e => setLanguage(e.target.value as ReportLanguage)}
                    className="field"
                  >
                    <option value="ko">한국어</option>
                    <option value="en">English</option>
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.06em', marginBottom: 6 }}>
                    형식
                  </div>
                  <select
                    value={format}
                    onChange={e => setFormat(e.target.value as ReportFormat)}
                    className="field"
                  >
                    <option value="pdf">PDF</option>
                    <option value="html">HTML</option>
                    <option value="md">Markdown</option>
                  </select>
                </div>
              </div>

              {/* ROI 위젯 */}
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 10 }}>
                  <span style={{
                    width: 16, height: 16, borderRadius: 4,
                    border: `1.5px solid ${includeRoi ? 'var(--orange-2)' : 'var(--border-3)'}`,
                    background: includeRoi ? 'var(--orange-2)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    {includeRoi && (
                      <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                        <path d="M1 3.5L3.5 6L8 1" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  <input
                    type="checkbox"
                    checked={includeRoi}
                    onChange={e => { setIncludeRoi(e.target.checked); setRoiData(null); }}
                    style={{ display: 'none' }}
                  />
                  <TrendingUp size={13} color="var(--orange)" />
                  <span style={{ fontSize: 12, fontWeight: 600 }}>ROI 위젯 포함</span>
                </label>

                {includeRoi && (
                  <div style={{ paddingLeft: 26 }}>
                    {/* hourlyRate 입력 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                        시간당 단가 ($)
                      </div>
                      <input
                        type="number"
                        min={0}
                        step={10}
                        value={hourlyRate}
                        onChange={e => {
                          const v = parseFloat(e.target.value);
                          setHourlyRate(isNaN(v) || v < 0 ? 0 : v);
                          setRoiData(null);
                        }}
                        className="field"
                        style={{ width: 90, textAlign: 'right' }}
                      />
                      <button
                        onClick={() => { void fetchRoi(); }}
                        disabled={roiLoading}
                        className="btn btn-sm btn-ghost"
                      >
                        {roiLoading ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : '계산'}
                      </button>
                    </div>

                    {/* ROI 미리보기 */}
                    {roiData && (
                      <div style={{
                        padding: 12, background: 'var(--bg-3)', borderRadius: 8,
                        border: '1px solid var(--border)', marginBottom: 8,
                      }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 8 }}>
                          ROI 미리보기
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                          <div style={{ textAlign: 'center', padding: '8px 0', background: 'var(--bg-1)', borderRadius: 6 }}>
                            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--orange)' }}>
                              {roiData.savedHours.toFixed(1)}h
                            </div>
                            <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 2 }}>절감 시간</div>
                          </div>
                          <div style={{ textAlign: 'center', padding: '8px 0', background: 'var(--bg-1)', borderRadius: 6 }}>
                            <div style={{ fontSize: 18, fontWeight: 800, color: '#10b981' }}>
                              ${Math.round(roiData.savedCost).toLocaleString()}
                            </div>
                            <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 2 }}>절감 비용</div>
                          </div>
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 8, textAlign: 'center' }}>
                          취약점 {roiData.totalVulnCount}건 발견
                          &nbsp;·&nbsp;CRITICAL {roiData.criticalCount}
                          &nbsp;·&nbsp;HIGH {roiData.highCount}
                        </div>
                        <button
                          onClick={handleRoiPdfDownload}
                          className="btn btn-sm btn-ghost"
                          style={{ width: '100%', marginTop: 8 }}
                        >
                          <Download size={11} />ROI PDF 다운로드
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 다운로드 토큰 */}
              <div style={{
                padding: 12, background: 'var(--bg-3)', borderRadius: 8,
                display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
              }}>
                <Lock size={14} color="var(--text-secondary)" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>다운로드 토큰</div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>30분간 유효한 보안 토큰으로 다운로드</div>
                </div>
                <span className="chip chip-low" style={{ height: 18 }}>활성</span>
              </div>

              {!projectId && (
                <div style={{
                  padding: '10px 14px', borderRadius: 8,
                  background: 'var(--orange-dim)', border: '1px solid rgba(249,115,22,0.3)',
                  fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4,
                }}>
                  프로젝트가 선택되지 않았습니다. 에디터에서 프로젝트를 먼저 연결하세요.
                </div>
              )}
            </>
          )}

          {state === 'generating' && (
            <div style={{
              padding: '32px 0', display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 16, textAlign: 'center',
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: 14,
                background: 'var(--orange-dim)', color: 'var(--orange)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Loader2 size={28} style={{ animation: 'spin 1s linear infinite' }} />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>리포트 생성 중</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  AI가 분석 결과를 정리하고 있습니다…
                </div>
              </div>
              <div style={{ width: '100%', maxWidth: 320 }}>
                <div className="progress-track" style={{ height: 4, marginBottom: 6 }}>
                  <div className="progress-fill" style={{ width: `${progress}%`, transition: 'width 0.4s ease' }} />
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                  {progress}%
                </div>
              </div>
            </div>
          )}

          {state === 'ready' && (
            <div style={{
              padding: '24px 0', display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 16, textAlign: 'center',
            }}>
              <div style={{
                width: 64, height: 64, borderRadius: 14,
                background: 'linear-gradient(135deg, var(--orange), var(--orange-2))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 8px 24px rgba(234,88,12,0.40)',
              }}>
                <CheckCircle2 size={28} color="#fff" />
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em', marginBottom: 6 }}>
                  리포트가 생성되었습니다
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                  {fileName}
                </div>
              </div>

              {/* 파일 정보 + 다운로드 */}
              <div style={{
                width: '100%',
                padding: 14, borderRadius: 8,
                background: 'var(--bg-3)', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <FileText size={20} color="var(--orange)" />
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{fileName}</div>
                  <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 2 }}>
                    토큰 만료 30분 후 · 처음 다운로드 시 토큰 1회 소진
                  </div>
                </div>
                <button
                  onClick={handleDownload}
                  className="btn btn-primary"
                  style={{ height: 32 }}
                >
                  <Download size={12} />다운로드
                </button>
              </div>

              {/* 공유 버튼 */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={() => {
                    const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080/api/v1';
                    void navigator.clipboard.writeText(`${base}/reports/download/${downloadToken ?? ''}`);
                    addToast('링크가 복사되었습니다.', 'info');
                  }}
                >
                  <Copy size={11} />링크 복사
                </button>
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={() => { void handleEmailSend(); }}
                  disabled={emailSending}
                >
                  {emailSending
                    ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />
                    : <Mail size={11} />}
                  {emailSending ? '전송 중…' : '이메일 전송'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 푸터 */}
        {state !== 'generating' && (
          <div style={{
            padding: '14px 24px',
            background: 'var(--bg-2)',
            borderTop: '1px solid var(--hairline)',
            display: 'flex', alignItems: 'center', justifyContent: state === 'ready' ? 'flex-end' : 'space-between', gap: 8,
          }}>
            {state === 'configure' && (
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                섹션 {checkedCount}개 선택됨
              </span>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={onClose}
                style={{
                  height: 32, padding: '0 14px', borderRadius: 6,
                  background: 'transparent', border: '1px solid var(--border)',
                  color: 'var(--text-tertiary)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}
              >
                {state === 'ready' ? '닫기' : '취소'}
              </button>
              {state === 'configure' && (
                <button
                  onClick={handleGenerate}
                  disabled={!projectId || checkedCount === 0}
                  style={{
                    height: 32, padding: '0 16px', borderRadius: 6,
                    background: !projectId || checkedCount === 0 ? 'var(--orange-dim)' : 'var(--orange-2)',
                    color: !projectId || checkedCount === 0 ? 'var(--orange)' : '#fff',
                    border: 'none', fontSize: 12, fontWeight: 700,
                    cursor: !projectId || checkedCount === 0 ? 'default' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6,
                    boxShadow: !projectId || checkedCount === 0 ? 'none' : 'var(--orange-shadow)',
                  }}
                >
                  <FileText size={12} />
                  리포트 생성
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
