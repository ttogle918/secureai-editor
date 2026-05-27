// components/analysis/GitHubScanModal.tsx
// GitHub 레포 연동 + 커밋 스캔 트리거 모달
// API: POST /api/v1/analysis/commits/scan
'use client';
import { useState } from 'react';
import { X, GitBranch, Play, RefreshCw, AlertTriangle, CheckCircle2, Key } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { useToastStore } from '@/hooks/useToast';

// ─── Types ────────────────────────────────────────────────────────────────────

interface GitHubScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
}

interface CommitScanResult {
  secretCount: number;
}

interface CommitScanApiResponse {
  data: CommitScanResult;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function GitHubScanModal({ isOpen, onClose, projectId }: GitHubScanModalProps) {
  const addToast = useToastStore((s) => s.addToast);

  const [owner,     setOwner]     = useState('');
  const [repo,      setRepo]      = useState('');
  const [ref,       setRef]       = useState('main');
  const [prNumber,  setPrNumber]  = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result,    setResult]    = useState<CommitScanResult | null>(null);
  const [error,     setError]     = useState<string | null>(null);

  if (!isOpen) return null;

  const isFormValid = owner.trim().length > 0 && repo.trim().length > 0 && ref.trim().length > 0;

  const handleScan = async () => {
    if (!isFormValid) return;

    setIsLoading(true);
    setResult(null);
    setError(null);

    try {
      const body: Record<string, unknown> = {
        projectId,
        owner: owner.trim(),
        repo: repo.trim(),
        ref: ref.trim(),
      };

      if (prNumber.trim().length > 0) {
        const parsed = parseInt(prNumber.trim(), 10);
        if (!Number.isNaN(parsed) && parsed > 0) {
          body['prNumber'] = parsed;
        }
      }

      const response = await apiClient.post<CommitScanApiResponse>(
        '/analysis/commits/scan',
        body,
      );

      setResult(response?.data ?? { secretCount: 0 });
      addToast(
        `커밋 스캔 완료 — ${response?.data?.secretCount ?? 0}개 시크릿 발견`,
        'info',
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : '스캔 중 오류가 발생했습니다.';
      setError(message);
      addToast(message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setOwner('');
      setRepo('');
      setRef('main');
      setPrNumber('');
      setResult(null);
      setError(null);
      onClose();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="GitHub 커밋 스캔"
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div style={{
        width: '100%', maxWidth: 520,
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
            <div style={{ fontSize: 14, fontWeight: 700 }}>GitHub 커밋 스캔</div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
              Git 히스토리에서 노출된 시크릿 탐지
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isLoading}
            aria-label="닫기"
            style={{
              width: 28, height: 28, borderRadius: 6, border: 'none',
              background: 'transparent', color: 'var(--text-tertiary)',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* 본문 */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Owner / Repo */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                Owner <span style={{ color: 'var(--critical)' }}>*</span>
              </label>
              <input
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                placeholder="octocat"
                disabled={isLoading}
                style={{
                  width: '100%', height: 34, padding: '0 10px', borderRadius: 6,
                  background: 'var(--bg-3)', border: '1px solid var(--border)',
                  color: 'var(--text-primary)', fontSize: 12, fontFamily: 'var(--font-mono)',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                Repository <span style={{ color: 'var(--critical)' }}>*</span>
              </label>
              <input
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                placeholder="my-repo"
                disabled={isLoading}
                style={{
                  width: '100%', height: 34, padding: '0 10px', borderRadius: 6,
                  background: 'var(--bg-3)', border: '1px solid var(--border)',
                  color: 'var(--text-primary)', fontSize: 12, fontFamily: 'var(--font-mono)',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* Ref / PR Number */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                Branch / Ref <span style={{ color: 'var(--critical)' }}>*</span>
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <GitBranch
                  size={12}
                  color="var(--text-tertiary)"
                  style={{ position: 'absolute', left: 10, pointerEvents: 'none' }}
                />
                <input
                  value={ref}
                  onChange={(e) => setRef(e.target.value)}
                  placeholder="main"
                  disabled={isLoading}
                  style={{
                    width: '100%', height: 34, padding: '0 10px 0 28px', borderRadius: 6,
                    background: 'var(--bg-3)', border: '1px solid var(--border)',
                    color: 'var(--text-primary)', fontSize: 12, fontFamily: 'var(--font-mono)',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                PR # <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>(선택)</span>
              </label>
              <input
                type="number"
                value={prNumber}
                onChange={(e) => setPrNumber(e.target.value)}
                placeholder="42"
                min={1}
                disabled={isLoading}
                style={{
                  width: '100%', height: 34, padding: '0 10px', borderRadius: 6,
                  background: 'var(--bg-3)', border: '1px solid var(--border)',
                  color: 'var(--text-primary)', fontSize: 12, fontFamily: 'var(--font-mono)',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* 폼 미완성 경고 */}
          {!isFormValid && (owner.length > 0 || repo.length > 0) && (
            <div style={{
              padding: '10px 14px', borderRadius: 8,
              background: 'var(--orange-dim)', border: '1px solid rgba(249,115,22,0.3)',
              fontSize: 11, color: 'var(--text-secondary)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <AlertTriangle size={13} color="var(--orange)" />
              Owner, Repository, Branch 는 필수 항목입니다.
            </div>
          )}

          {/* 에러 메시지 */}
          {error !== null && (
            <div style={{
              padding: '12px 16px', borderRadius: 8,
              background: 'var(--critical-dim)', border: '1px solid rgba(240,65,65,0.3)',
              display: 'flex', alignItems: 'flex-start', gap: 10,
            }}>
              <AlertTriangle size={15} color="var(--critical)" style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--critical)' }}>스캔 실패</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>{error}</div>
              </div>
            </div>
          )}

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
                    : '시크릿이 발견되지 않았습니다'
                  }
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                  {result.secretCount > 0
                    ? '보안팀에 즉시 보고하고 시크릿을 교체하세요.'
                    : 'Git 히스토리에서 노출된 시크릿이 없습니다.'
                  }
                </div>
              </div>
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
            onClick={handleClose}
            disabled={isLoading}
            style={{
              height: 32, padding: '0 14px', borderRadius: 6,
              background: 'transparent', border: '1px solid var(--border)',
              color: 'var(--text-tertiary)', fontSize: 12, fontWeight: 600,
              cursor: isLoading ? 'not-allowed' : 'pointer',
            }}
          >
            닫기
          </button>
          <button
            onClick={handleScan}
            disabled={isLoading || !isFormValid}
            style={{
              height: 32, padding: '0 16px', borderRadius: 6,
              background: isLoading || !isFormValid ? 'var(--orange-dim)' : 'var(--orange-2)',
              color: isLoading || !isFormValid ? 'var(--orange)' : '#fff',
              border: 'none', fontSize: 12, fontWeight: 700,
              cursor: isLoading || !isFormValid ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              boxShadow: isLoading || !isFormValid ? 'none' : 'var(--orange-shadow)',
            }}
          >
            {isLoading
              ? <><RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />스캔 중...</>
              : <><Play size={12} fill="currentColor" />커밋 스캔 시작</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}
