'use client';
import React, { useMemo } from 'react';
import { Network, Activity } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { useSecureStore } from '@/store/useSecureStore';

export function DastWorkspacePage() {
  const { t } = useTranslation();
  const vulns = useSecureStore((s) => s.vulns);

  const endpoints = useMemo(() => {
    const ep = vulns.map(v => v.apiEndpoint).filter(Boolean) as string[];
    return Array.from(new Set(ep));
  }, [vulns]);

  return (
    <div style={{ padding: 40, color: '#fff', background: 'var(--bg-1)', height: '100%', overflow: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Network size={32} color="var(--orange)" />
        <h1 style={{ margin: 0, fontSize: 24 }}>DAST Workspace</h1>
      </div>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 32 }}>
        동적 애플리케이션 보안 테스트(DAST) 및 HTTP 요청 빌더 공간입니다.
      </p>

      {vulns.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', background: 'var(--bg-2)', borderRadius: 12, border: '1px solid var(--border)', color: 'var(--text-tertiary)' }}>
          SAST 분석 내역이 없습니다. 먼저 SAST를 실행하여 테스트 가능한 API 엔드포인트를 발견하세요.
        </div>
      ) : endpoints.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', background: 'var(--bg-2)', borderRadius: 12, border: '1px solid var(--border)', color: 'var(--text-tertiary)' }}>
          분석된 코드에서 HTTP API 엔드포인트가 발견되지 않았습니다.
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 16, height: 'calc(100% - 120px)' }}>
          {/* Left pane: endpoints */}
          <div style={{ width: 250, padding: 16, background: 'var(--bg-2)', borderRadius: 12, border: '1px solid var(--border)', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 13, textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Discovered Endpoints</h3>
            {endpoints.map(ep => (
              <div key={ep} style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>{ep}</div>
            ))}
          </div>
          
          {/* Right pane: Request Builder */}
          <div style={{ flex: 1, padding: 16, background: 'var(--bg-2)', borderRadius: 12, border: '1px solid var(--border)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 13, textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Request Builder</h3>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <select style={{ padding: '6px 12px', background: 'var(--bg-3)', border: '1px solid var(--border)', color: '#fff', borderRadius: 4 }}>
                <option>GET</option>
                <option>POST</option>
                <option>PUT</option>
                <option>DELETE</option>
              </select>
              <input type="text" placeholder="https://target.local/api/v1/" defaultValue={endpoints[0]?.split(' ')[1] || ''} style={{ flex: 1, padding: '6px 12px', background: 'var(--bg-3)', border: '1px solid var(--border)', color: '#fff', borderRadius: 4 }} />
              <button style={{ padding: '6px 16px', background: 'var(--orange)', border: 'none', borderRadius: 4, color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Send</button>
            </div>
            <div style={{ height: 200, background: 'var(--bg-3)', borderRadius: 4, border: '1px solid var(--border)' }}></div>
          </div>
        </div>
      )}
    </div>
  );
}
