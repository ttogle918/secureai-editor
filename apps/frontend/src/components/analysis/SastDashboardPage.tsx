'use client';
import React, { useMemo } from 'react';
import { Shield, GitCommit, FileCode2 } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { useSecureStore } from '@/store/useSecureStore';

export function SastDashboardPage() {
  const { t } = useTranslation();
  const vulns = useSecureStore((s) => s.vulns);
  
  const { totalVulns, uniqueFiles, score, scoreColor } = useMemo(() => {
    const total = vulns.length;
    const files = new Set(vulns.map((v) => v.filePath)).size;
    
    let s = 'A+';
    let color = 'var(--safe)';
    if (vulns.some((v) => v.severity === 'critical')) {
      s = 'F'; color = 'var(--critical)';
    } else if (vulns.some((v) => v.severity === 'high')) {
      s = 'D'; color = 'var(--orange)';
    } else if (vulns.some((v) => v.severity === 'medium')) {
      s = 'C'; color = 'var(--medium)';
    } else if (vulns.some((v) => v.severity === 'low')) {
      s = 'B'; color = 'var(--low)';
    } else if (total > 0) {
      s = 'A';
    }

    return { totalVulns: total, uniqueFiles: files, score: s, scoreColor: color };
  }, [vulns]);

  return (
    <div style={{ padding: 40, color: '#fff', background: 'var(--bg-1)', height: '100%', overflow: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Shield size={32} color={scoreColor} />
        <h1 style={{ margin: 0, fontSize: 24 }}>SAST Dashboard</h1>
      </div>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 32 }}>
        정적 코드 분석(SAST) 결과와 취약점 데이터 흐름을 추적합니다.
      </p>

      {totalVulns === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', background: 'var(--bg-2)', borderRadius: 12, border: '1px solid var(--border)', color: 'var(--text-tertiary)' }}>
          분석된 취약점이 없거나 아직 정적 분석(SAST)이 실행되지 않았습니다.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          <div style={{ padding: 24, background: 'var(--bg-2)', borderRadius: 12, border: '1px solid var(--border)' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 14 }}>Total Vulnerabilities</h3>
            <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--critical)' }}>{totalVulns}</div>
          </div>
          <div style={{ padding: 24, background: 'var(--bg-2)', borderRadius: 12, border: '1px solid var(--border)' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 14 }}>Vulnerable Files</h3>
            <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-on-bg)' }}>{uniqueFiles}</div>
          </div>
          <div style={{ padding: 24, background: 'var(--bg-2)', borderRadius: 12, border: '1px solid var(--border)' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 14 }}>Security Score</h3>
            <div style={{ fontSize: 32, fontWeight: 800, color: scoreColor }}>{score}</div>
          </div>
        </div>
      )}
    </div>
  );
}
