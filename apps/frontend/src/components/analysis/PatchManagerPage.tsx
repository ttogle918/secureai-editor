'use client';
import React from 'react';
import { GitPullRequest, Check } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { useSecureStore } from '@/store/useSecureStore';

export function PatchManagerPage() {
  const { t } = useTranslation();
  const patches = useSecureStore((s) => s.patches);

  return (
    <div style={{ padding: 40, color: '#fff', background: 'var(--bg-1)', height: '100%', overflow: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <GitPullRequest size={32} color="var(--tag-1)" />
          <h1 style={{ margin: 0, fontSize: 24 }}>Patch Manager</h1>
        </div>
        <button style={{ padding: '8px 16px', background: 'var(--tag-1)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: patches.length === 0 ? 0.5 : 1 }} disabled={patches.length === 0}>
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
          {patches.map((patch, idx) => (
            <div key={idx} style={{ padding: 16, background: 'var(--bg-2)', borderRadius: 12, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 14 }}>{patch.filePath}</h3>
                <span style={{ fontSize: 11, background: 'rgba(34,197,94,0.1)', color: '#22c55e', padding: '2px 8px', borderRadius: 10 }}>Fix: {patch.vulnType}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>{patch.explanation}</div>
              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ flex: 1, background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', padding: 12, borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: 12, color: '#fca5a5', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                  {patch.originalCode.split('\n').map(l => `- ${l}`).join('\n')}
                </div>
                <div style={{ flex: 1, background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.2)', padding: 12, borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: 12, color: '#86efac', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                  {patch.patchedCode.split('\n').map(l => `+ ${l}`).join('\n')}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
