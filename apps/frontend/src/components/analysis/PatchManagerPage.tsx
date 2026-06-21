'use client';
import React, { useState } from 'react';
import { GitPullRequest, Check, ExternalLink, Loader2 } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { useSecureStore } from '@/store/useSecureStore';
import { apiClient } from '@/lib/api/client';
import { ApiError } from '@/lib/api/client';

interface PatchPrResponse {
  prUrl: string;
  prNumber: number;
  branchName: string;
}

interface PrResult {
  patchIdx: number;
  prUrl: string;
  prNumber: number;
  branchName: string;
}

interface CreatePrModalState {
  open: boolean;
  patchIdx: number | null;
  /** patch.vulnId를 patchId로 활용 */
  patchId: string | null;
  owner: string;
  repo: string;
  baseBranch: string;
}

const INITIAL_MODAL: CreatePrModalState = {
  open: false,
  patchIdx: null,
  patchId: null,
  owner: '',
  repo: '',
  baseBranch: '',
};

export function PatchManagerPage() {
  const { t } = useTranslation();
  const patches = useSecureStore((s) => s.patches);

  const [prResults, setPrResults] = useState<PrResult[]>([]);
  const [loadingIdx, setLoadingIdx] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<CreatePrModalState>(INITIAL_MODAL);

  function openModal(idx: number) {
    const patch = patches[idx];
    // patch.vulnId를 patchId로 사용. 실제 백엔드 patchId(UUID)가 FE 타입에 추가되면 교체 필요.
    setModal({
      open: true,
      patchIdx: idx,
      patchId: patch.vulnId ?? null,
      owner: '',
      repo: '',
      baseBranch: '',
    });
    setError(null);
  }

  function closeModal() {
    setModal(INITIAL_MODAL);
    setError(null);
  }

  async function handleCreatePr() {
    if (modal.patchIdx === null || modal.patchId === null) return;
    if (!modal.owner.trim() || !modal.repo.trim()) {
      setError('owner와 repo는 필수입니다.');
      return;
    }

    setLoadingIdx(modal.patchIdx);
    setError(null);

    try {
      const result = await apiClient.post<{ data: PatchPrResponse }>(
        `/patches/${modal.patchId}/pull-request`,
        {
          owner: modal.owner.trim(),
          repo: modal.repo.trim(),
          baseBranch: modal.baseBranch.trim() || undefined,
        },
      );

      const prData = result.data;
      setPrResults((prev) => [
        ...prev.filter((r) => r.patchIdx !== modal.patchIdx),
        { patchIdx: modal.patchIdx!, prUrl: prData.prUrl, prNumber: prData.prNumber, branchName: prData.branchName },
      ]);
      closeModal();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(`PR 생성 실패: ${err.message} (${err.code})`);
      } else {
        setError('PR 생성 중 알 수 없는 오류가 발생했습니다.');
      }
    } finally {
      setLoadingIdx(null);
    }
  }

  return (
    <div style={{ padding: 40, color: '#fff', background: 'var(--bg-1)', height: '100%', overflow: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <GitPullRequest size={32} color="var(--tag-1)" />
          <h1 style={{ margin: 0, fontSize: 24 }}>Patch Manager</h1>
        </div>
        <button
          style={{
            padding: '8px 16px',
            background: 'var(--tag-1)',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            opacity: patches.length === 0 ? 0.5 : 1,
          }}
          disabled={patches.length === 0}
        >
          <Check size={14} /> Apply All Patches
        </button>
      </div>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 32 }}>
        AI가 생성한 리미디에이션(Remediation) 패치 코드를 병합하고 리뷰합니다.
      </p>

      {patches.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', background: 'var(--bg-2)', borderRadius: 12, border: '1px solid var(--border)', color: 'var(--text-tertiary)' }}>
          AI가 제안한 패치 내역이 없습니다. 취약점을 먼저 분석하세요.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {patches.map((patch, idx) => {
            const prResult = prResults.find((r) => r.patchIdx === idx);
            return (
              <div key={idx} style={{ padding: 16, background: 'var(--bg-2)', borderRadius: 12, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h3 style={{ margin: 0, fontSize: 14 }}>{patch.filePath}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, background: 'rgba(34,197,94,0.1)', color: '#22c55e', padding: '2px 8px', borderRadius: 10 }}>
                      Fix: {patch.vulnType}
                    </span>
                    {/* PR 생성 버튼 */}
                    {prResult ? (
                      <a
                        href={prResult.prUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '4px 10px',
                          background: 'rgba(99,102,241,0.15)',
                          color: '#818cf8',
                          border: '1px solid rgba(99,102,241,0.3)',
                          borderRadius: 6,
                          fontSize: 12,
                          textDecoration: 'none',
                          fontWeight: 600,
                        }}
                      >
                        <GitPullRequest size={12} />
                        PR #{prResult.prNumber}
                        <ExternalLink size={10} />
                      </a>
                    ) : (
                      <button
                        onClick={() => openModal(idx)}
                        disabled={loadingIdx === idx || !patch.vulnId}
                        title={!patch.vulnId ? '패치 ID가 없습니다.' : undefined}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '4px 10px',
                          background: (loadingIdx === idx || !patch.vulnId) ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.15)',
                          color: '#818cf8',
                          border: '1px solid rgba(99,102,241,0.3)',
                          borderRadius: 6,
                          fontSize: 12,
                          cursor: (loadingIdx === idx || !patch.vulnId) ? 'not-allowed' : 'pointer',
                          opacity: (loadingIdx === idx || !patch.vulnId) ? 0.5 : 1,
                          fontWeight: 600,
                        }}
                      >
                        {loadingIdx === idx ? (
                          <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                        ) : (
                          <GitPullRequest size={12} />
                        )}
                        PR 생성
                      </button>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>{patch.explanation}</div>
                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ flex: 1, background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', padding: 12, borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: 12, color: '#fca5a5', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                    {patch.originalCode.split('\n').map((l) => `- ${l}`).join('\n')}
                  </div>
                  <div style={{ flex: 1, background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.2)', padding: 12, borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: 12, color: '#86efac', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                    {patch.patchedCode.split('\n').map((l) => `+ ${l}`).join('\n')}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* PR 생성 모달 */}
      {modal.open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pr-modal-title"
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, width: 420, maxWidth: '90vw' }}>
            <h2 id="pr-modal-title" style={{ margin: '0 0 16px', fontSize: 18, color: '#fff' }}>
              GitHub PR 생성
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
              패치를 GitHub 브랜치에 커밋하고 Pull Request를 생성합니다.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Owner (GitHub 사용자명 또는 조직) *
                <input
                  type="text"
                  value={modal.owner}
                  onChange={(e) => setModal((m) => ({ ...m, owner: e.target.value }))}
                  placeholder="예: octocat"
                  style={inputStyle}
                />
              </label>
              <label style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Repository 이름 *
                <input
                  type="text"
                  value={modal.repo}
                  onChange={(e) => setModal((m) => ({ ...m, repo: e.target.value }))}
                  placeholder="예: my-repo"
                  style={inputStyle}
                />
              </label>
              <label style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Base 브랜치 (선택, 비워두면 기본 브랜치 사용)
                <input
                  type="text"
                  value={modal.baseBranch}
                  onChange={(e) => setModal((m) => ({ ...m, baseBranch: e.target.value }))}
                  placeholder="예: main"
                  style={inputStyle}
                />
              </label>
            </div>

            {error && (
              <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, fontSize: 12, color: '#fca5a5' }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={closeModal} style={cancelBtnStyle}>취소</button>
              <button
                onClick={handleCreatePr}
                disabled={loadingIdx !== null}
                style={{ ...confirmBtnStyle, opacity: loadingIdx !== null ? 0.6 : 1, cursor: loadingIdx !== null ? 'not-allowed' : 'pointer' }}
              >
                {loadingIdx !== null ? (
                  <>
                    <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> 생성 중...
                  </>
                ) : (
                  <>
                    <GitPullRequest size={14} /> PR 생성
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  marginTop: 4,
  padding: '8px 10px',
  background: 'var(--bg-1)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  color: '#fff',
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
};

const cancelBtnStyle: React.CSSProperties = {
  padding: '8px 16px',
  background: 'transparent',
  border: '1px solid var(--border)',
  borderRadius: 6,
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  fontSize: 13,
};

const confirmBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 16px',
  background: 'rgba(99,102,241,0.8)',
  border: 'none',
  borderRadius: 6,
  color: '#fff',
  fontSize: 13,
  fontWeight: 600,
};
