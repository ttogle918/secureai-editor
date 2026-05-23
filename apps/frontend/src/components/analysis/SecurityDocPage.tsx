'use client';
// components/analysis/SecurityDocPage.tsx
// 보안 문서 자동 생성 — CISO 보고서 / 행안부 SW개발보안 / ISMS-P 통제항목
// API: POST /api/v1/projects/{projectId}/reports/security?type=CISO|HANAFOS|ISMS
//      GET  /api/v1/projects/{projectId}/reports/security/{requestId}
//      GET  /api/v1/reports/security/download?token={token}

import { useState, useRef } from 'react';
import { FileText, Download, Loader2, CheckCircle2, AlertCircle, Shield } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { useSecureStore } from '@/store/useSecureStore';
import { useToastStore } from '@/hooks/useToast';

// ─── 타입 정의 ─────────────────────────────────────────────────────────────

type DocType = 'CISO' | 'HANAFOS' | 'ISMS';
type CardState = 'idle' | 'generating' | 'completed' | 'failed';

interface SecurityDocStatus {
  id: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  docType: DocType;
  downloadToken?: string;
  tokenExpiresAt?: string;
}

interface DocCard {
  type: DocType;
  title: string;
  description: string;
  badge: string;
}

// ─── 문서 카드 정의 ────────────────────────────────────────────────────────

const DOC_CARDS: DocCard[] = [
  {
    type: 'CISO',
    title: 'CISO 보고서',
    description: '사내 경영진 보고용. 취약점 현황 표, 위험도 분포, Critical/High 미조치 항목 목록을 포함합니다.',
    badge: '경영진 보고',
  },
  {
    type: 'HANAFOS',
    title: '행안부 SW개발보안 가이드',
    description: '공공기관 제출용 43개 항목 체크리스트. 항목명, 관련 취약점, 준수 여부를 포함합니다.',
    badge: '공공기관 제출',
  },
  {
    type: 'ISMS',
    title: 'ISMS-P 이행현황',
    description: '인증 심사 증적용. ISMS-P 개발보안 통제항목 번호, 이행현황, 근거를 포함합니다.',
    badge: '인증 심사',
  },
];

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_COUNT = 60; // 최대 2분 폴링

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────

export function SecurityDocPage() {
  const projectId = useSecureStore((s) => s.projectId);
  const addToast  = useToastStore((s) => s.addToast);

  const [cardStates, setCardStates] = useState<Record<DocType, CardState>>({
    CISO: 'idle', HANAFOS: 'idle', ISMS: 'idle',
  });
  const [downloadTokens, setDownloadTokens] = useState<Record<DocType, string>>({
    CISO: '', HANAFOS: '', ISMS: '',
  });
  const [errorMessages, setErrorMessages] = useState<Record<DocType, string>>({
    CISO: '', HANAFOS: '', ISMS: '',
  });

  const pollingRefs = useRef<Record<DocType, ReturnType<typeof setInterval> | null>>({
    CISO: null, HANAFOS: null, ISMS: null,
  });

  const setCardState = (type: DocType, state: CardState) =>
    setCardStates(prev => ({ ...prev, [type]: state }));

  const stopPolling = (type: DocType) => {
    if (pollingRefs.current[type]) {
      clearInterval(pollingRefs.current[type]!);
      pollingRefs.current[type] = null;
    }
  };

  const handleGenerate = async (type: DocType) => {
    if (!projectId) {
      addToast('프로젝트가 선택되지 않았습니다.', 'error');
      return;
    }

    setCardState(type, 'generating');
    setErrorMessages(prev => ({ ...prev, [type]: '' }));

    try {
      const res = await apiClient.post<{ data: SecurityDocStatus }>(
        `/projects/${projectId}/reports/security?type=${type}`,
        {}
      );
      const requestId = res.data?.id;
      if (!requestId) throw new Error('requestId 없음');

      startPolling(type, projectId, requestId);
    } catch {
      setCardState(type, 'failed');
      setErrorMessages(prev => ({ ...prev, [type]: '문서 생성 요청 중 오류가 발생했습니다.' }));
      addToast('문서 생성 요청 중 오류가 발생했습니다.', 'error');
    }
  };

  const startPolling = (type: DocType, projectId: string, requestId: string) => {
    let pollCount = 0;
    pollingRefs.current[type] = setInterval(async () => {
      pollCount++;
      if (pollCount > MAX_POLL_COUNT) {
        stopPolling(type);
        setCardState(type, 'failed');
        setErrorMessages(prev => ({ ...prev, [type]: '문서 생성 시간이 초과되었습니다.' }));
        addToast('문서 생성 시간이 초과되었습니다.', 'error');
        return;
      }

      try {
        const statusRes = await apiClient.get<{ data: SecurityDocStatus }>(
          `/projects/${projectId}/reports/security/${requestId}`
        );
        const { status, downloadToken } = statusRes.data ?? {};

        if (status === 'COMPLETED' && downloadToken) {
          stopPolling(type);
          setDownloadTokens(prev => ({ ...prev, [type]: downloadToken }));
          setCardState(type, 'completed');
          addToast('문서 생성이 완료되었습니다.', 'info');
        } else if (status === 'FAILED') {
          stopPolling(type);
          setCardState(type, 'failed');
          setErrorMessages(prev => ({ ...prev, [type]: '서버에서 문서 생성에 실패했습니다.' }));
          addToast('문서 생성에 실패했습니다.', 'error');
        }
      } catch (e) {
        // 폴링 중 네트워크 오류는 재시도 — 최대 횟수 초과 시 중단
        console.warn('[SecurityDocPage] 폴링 오류:', e);
      }
    }, POLL_INTERVAL_MS);
  };

  const handleDownload = (type: DocType) => {
    const token = downloadTokens[type];
    if (!token) return;
    const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080/api/v1';
    const url  = `${base}/reports/security/download?token=${encodeURIComponent(token)}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type.toLowerCase()}-report.pdf`;
    a.click();
  };

  return (
    <div style={{ padding: '24px 28px', maxWidth: 860 }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8,
          background: 'var(--orange-dim)', color: 'var(--orange)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Shield size={18} />
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>보안 문서 자동 생성</div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            SAST 분석 결과를 기반으로 규제·인증 요구 문서를 PDF로 자동 생성합니다
          </div>
        </div>
      </div>

      {!projectId && (
        <div style={{
          padding: '12px 16px', borderRadius: 8,
          background: 'var(--orange-dim)', border: '1px solid rgba(249,115,22,0.3)',
          fontSize: 12, color: 'var(--text-secondary)', marginBottom: 20,
        }}>
          프로젝트가 선택되지 않았습니다. 에디터에서 프로젝트를 먼저 연결하세요.
        </div>
      )}

      {/* 문서 카드 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {DOC_CARDS.map(card => (
          <DocCardItem
            key={card.type}
            card={card}
            state={cardStates[card.type]}
            errorMessage={errorMessages[card.type]}
            disabled={!projectId}
            onGenerate={() => handleGenerate(card.type)}
            onDownload={() => handleDownload(card.type)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── 개별 문서 카드 ────────────────────────────────────────────────────────

interface DocCardItemProps {
  card: DocCard;
  state: CardState;
  errorMessage: string;
  disabled: boolean;
  onGenerate: () => void;
  onDownload: () => void;
}

function DocCardItem({ card, state, errorMessage, disabled, onGenerate, onDownload }: DocCardItemProps) {
  return (
    <div style={{
      border: '1px solid var(--border-2)',
      borderRadius: 10,
      background: 'var(--bg-1)',
      padding: '18px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
    }}>
      {/* 아이콘 */}
      <div style={{
        width: 44, height: 44, borderRadius: 10, flexShrink: 0,
        background: state === 'completed' ? 'rgba(22,163,74,0.12)' : 'var(--bg-3)',
        color: state === 'completed' ? '#16a34a' : 'var(--orange)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {state === 'completed' ? <CheckCircle2 size={20} /> : <FileText size={20} />}
      </div>

      {/* 텍스트 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>{card.title}</span>
          <span style={{
            fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4,
            background: 'var(--orange-dim)', color: 'var(--orange)',
          }}>
            {card.badge}
          </span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          {card.description}
        </div>
        {state === 'failed' && errorMessage && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, marginTop: 8,
            fontSize: 11, color: '#dc2626',
          }}>
            <AlertCircle size={12} />
            {errorMessage}
          </div>
        )}
      </div>

      {/* 액션 버튼 */}
      <div style={{ flexShrink: 0 }}>
        {state === 'idle' || state === 'failed' ? (
          <button
            onClick={onGenerate}
            disabled={disabled}
            style={{
              height: 34, padding: '0 16px', borderRadius: 6,
              background: disabled ? 'var(--bg-3)' : 'var(--orange-2)',
              color: disabled ? 'var(--text-tertiary)' : '#fff',
              border: 'none', fontSize: 12, fontWeight: 600,
              cursor: disabled ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              boxShadow: disabled ? 'none' : 'var(--orange-shadow)',
            }}
          >
            <FileText size={12} />
            {state === 'failed' ? '재시도' : '생성'}
          </button>
        ) : state === 'generating' ? (
          <div style={{
            height: 34, padding: '0 16px', display: 'flex',
            alignItems: 'center', gap: 6,
            fontSize: 12, color: 'var(--text-secondary)',
          }}>
            <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
            생성 중…
          </div>
        ) : (
          <button
            onClick={onDownload}
            style={{
              height: 34, padding: '0 16px', borderRadius: 6,
              background: 'rgba(22,163,74,0.12)', color: '#16a34a',
              border: '1px solid rgba(22,163,74,0.3)',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <Download size={12} />
            다운로드
          </button>
        )}
      </div>
    </div>
  );
}
