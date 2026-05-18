// components/analysis/CommitSecretScanModal.tsx
// 커밋 시크릿 스캔 모달 — MissingScreens.jsx 디자인 시안 반영
// API: POST /api/v1/analysis/sessions/{sessionId}/scan-commits
//      GET  /api/v1/analysis/sessions/{sessionId}/commit-secrets
'use client';
import { useState } from 'react';
import { X, Key, Play, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { useSecureStore } from '@/store/useSecureStore';
import { useToastStore } from '@/hooks/useToast';

type ScanDepth = 'fast' | 'full';
type ScanRange = 'last' | 'date' | 'all';

interface CommitScanResult {
  secretCount: number;
}

interface CommitSecretScanModalProps {
  onClose: () => void;
}

export function CommitSecretScanModal({ onClose }: CommitSecretScanModalProps) {
  const sseSessionId = useSecureStore((s) => s.sseSessionId);
  const addToast     = useToastStore((s) => s.addToast);

  const [depth,      setDepth]      = useState<ScanDepth>('full');
  const [range,      setRange]      = useState<ScanRange>('date');
  const [fromDate,   setFromDate]   = useState('');
  const [toDate,     setToDate]     = useState('');
  const [lastN,      setLastN]      = useState(50);
  const [isScanning, setIsScanning] = useState(false);
  const [result,     setResult]     = useState<CommitScanResult | null>(null);

  const handleScan = async () => {
    if (!sseSessionId) {
      addToast('분석 세션이 없습니다. 먼저 SAST 분석을 시작하세요.', 'error');
      return;
    }
    setIsScanning(true);
    setResult(null);

    try {
      // 스캔 트리거
      await apiClient.post(
        `/analysis/sessions/${sseSessionId}/scan-commits`,
        {
          depth,
          range,
          fromDate: range === 'date' ? fromDate || undefined : undefined,
          toDate:   range === 'date' ? toDate   || undefined : undefined,
          lastN:    range === 'last' ? lastN     : undefined,
        },
      );
      addToast('커밋 시크릿 스캔이 시작되었습니다.', 'info');

      // 결과 조회 (스캔은 비동기 처리 — 잠시 후 카운트 조회)
      await new Promise(resolve => setTimeout(resolve, 3000));
      const res = await apiClient.get<{ data: CommitScanResult }>(
        `/analysis/sessions/${sseSessionId}/commit-secrets`,
      );
      setResult(res.data);
      addToast(`시크릿 스캔 완료 — ${res.data?.secretCount ?? 0}개 발견`, 'info');
    } catch {
      addToast('스캔 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="커밋 시크릿 스캔"
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div style={{
        width: '100%', maxWidth: 600,
        background: 'var(--bg-1)',
        border: '1px solid var(--border-2)',
        borderRadius: 14,
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        overflow: 'hidden',
      }}>
        {/* 헤더 */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--hairline)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'var(--orange-dim)', color: 'var(--orange)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Key size={15} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>커밋 시크릿 스캔</div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
              Git 히스토리에서 노출된 시크릿 탐지
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
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* 스캔 범위 */}
          <section>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>스캔 범위</div>
            <div style={{
              display: 'flex', height: 32, padding: 2,
              background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 7,
              marginBottom: 12,
            }}>
              {([
                { id: 'last',   label: '최근 N개 커밋' },
                { id: 'date',   label: '날짜 범위' },
                { id: 'all',    label: '전체 히스토리' },
              ] as const).map(o => (
                <button
                  key={o.id}
                  onClick={() => setRange(o.id)}
                  style={{
                    flex: 1, padding: '0 12px', borderRadius: 5, border: 'none',
                    background: range === o.id ? 'var(--bg-1)' : 'transparent',
                    color: range === o.id ? 'var(--text-primary)' : 'var(--text-tertiary)',
                    fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    boxShadow: range === o.id ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
                  }}
                >
                  {o.label}
                </button>
              ))}
            </div>

            {range === 'date' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="date"
                  value={fromDate}
                  onChange={e => setFromDate(e.target.value)}
                  style={{
                    flex: 1, height: 32, padding: '0 10px', borderRadius: 6,
                    background: 'var(--bg-3)', border: '1px solid var(--border)',
                    color: 'var(--text-primary)', fontSize: 12, fontFamily: 'var(--font-mono)',
                  }}
                />
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>~</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={e => setToDate(e.target.value)}
                  style={{
                    flex: 1, height: 32, padding: '0 10px', borderRadius: 6,
                    background: 'var(--bg-3)', border: '1px solid var(--border)',
                    color: 'var(--text-primary)', fontSize: 12, fontFamily: 'var(--font-mono)',
                  }}
                />
              </div>
            )}
            {range === 'last' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>최근</span>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={lastN}
                  onChange={e => setLastN(Number(e.target.value))}
                  style={{
                    width: 80, height: 32, padding: '0 10px', borderRadius: 6,
                    background: 'var(--bg-3)', border: '1px solid var(--border)',
                    color: 'var(--text-primary)', fontSize: 12, fontFamily: 'var(--font-mono)',
                  }}
                />
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>개 커밋</span>
              </div>
            )}
          </section>

          {/* 스캔 깊이 */}
          <section>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>스캔 깊이</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {([
                {
                  id: 'fast' as ScanDepth,
                  label: '빠른 스캔',
                  desc: '유출 확률이 높은 파일만 검사',
                  hint: '.env, config, secrets/, *.key',
                  credit: '약 8 크레딧',
                  time: '~30초',
                },
                {
                  id: 'full' as ScanDepth,
                  label: '전수 검사',
                  desc: '모든 커밋의 모든 파일을 검사',
                  hint: '과거 시크릿 누락 없음',
                  credit: '약 42 크레딧',
                  time: '~3분',
                  recommended: true,
                },
              ]).map(opt => {
                const active = depth === opt.id;
                return (
                  <label
                    key={opt.id}
                    style={{
                      padding: 14, borderRadius: 8, cursor: 'pointer',
                      background: active ? 'var(--orange-dim)' : 'var(--bg-3)',
                      border: `1px solid ${active ? 'rgba(249,115,22,0.40)' : 'var(--border)'}`,
                      outline: active ? '1.5px solid var(--orange-2)' : 'none',
                      outlineOffset: -1,
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                    }}
                  >
                    <input
                      type="radio"
                      name="depth"
                      value={opt.id}
                      checked={active}
                      onChange={() => setDepth(opt.id)}
                      style={{ display: 'none' }}
                    />
                    <span style={{
                      width: 14, height: 14, borderRadius: 7, marginTop: 2,
                      border: `1.5px solid ${active ? 'var(--orange-2)' : 'var(--border-3)'}`,
                      background: active ? 'var(--orange-2)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      {active && <span style={{ width: 6, height: 6, borderRadius: 3, background: '#fff' }} />}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                        {opt.label}
                        {opt.recommended && (
                          <span className="chip chip-orange" style={{ height: 16, fontSize: 8 }}>권장</span>
                        )}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 3, lineHeight: 1.5 }}>
                        {opt.desc}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                        {opt.hint}
                      </div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                        <span className={`chip ${active ? 'chip-orange' : ''}`} style={{ height: 18, fontSize: 9 }}>
                          {opt.credit}
                        </span>
                        <span className="chip" style={{ height: 18, fontSize: 9 }}>{opt.time}</span>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </section>

          {/* 결과 표시 */}
          {result !== null && (
            <div style={{
              padding: '12px 16px', borderRadius: 8,
              background: result.secretCount > 0 ? 'var(--critical-dim)' : 'var(--low-dim)',
              border: `1px solid ${result.secretCount > 0 ? 'rgba(240,65,65,0.3)' : 'rgba(34,197,94,0.3)'}`,
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              {result.secretCount > 0
                ? <AlertTriangle size={18} color="var(--critical)" />
                : <CheckCircle2 size={18} color="var(--low)" />
              }
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>
                  {result.secretCount > 0
                    ? `${result.secretCount}개 시크릿 탐지됨`
                    : '시크릿이 발견되지 않았습니다'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                  {result.secretCount > 0
                    ? '보안팀에 즉시 보고하고 시크릿을 교체하세요.'
                    : 'Git 히스토리에서 노출된 시크릿이 없습니다.'}
                </div>
              </div>
            </div>
          )}

          {/* 세션 없음 경고 */}
          {!sseSessionId && (
            <div style={{
              padding: '10px 14px', borderRadius: 8,
              background: 'var(--orange-dim)', border: '1px solid rgba(249,115,22,0.3)',
              fontSize: 11, color: 'var(--text-secondary)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <AlertTriangle size={13} color="var(--orange)" />
              SAST 분석 세션이 없습니다. 먼저 분석 시작 후 실행하세요.
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div style={{
          padding: '14px 20px',
          background: 'var(--bg-2)',
          borderTop: '1px solid var(--hairline)',
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8,
        }}>
          <button
            onClick={onClose}
            style={{
              height: 32, padding: '0 14px', borderRadius: 6,
              background: 'transparent', border: '1px solid var(--border)',
              color: 'var(--text-tertiary)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >
            닫기
          </button>
          <button
            onClick={handleScan}
            disabled={isScanning || !sseSessionId}
            style={{
              height: 32, padding: '0 16px', borderRadius: 6,
              background: isScanning || !sseSessionId ? 'var(--orange-dim)' : 'var(--orange-2)',
              color: isScanning || !sseSessionId ? 'var(--orange)' : '#fff',
              border: 'none', fontSize: 12, fontWeight: 700, cursor: isScanning || !sseSessionId ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              boxShadow: isScanning || !sseSessionId ? 'none' : 'var(--orange-shadow)',
            }}
          >
            {isScanning
              ? <><RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> 스캔 중...</>
              : <><Play size={12} fill="currentColor" /> 스캔 시작</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}
