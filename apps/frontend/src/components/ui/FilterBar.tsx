'use client';
import { useSecureStore, type SeverityFilter } from '@/store/useSecureStore';

// API 그룹 추출 — apiGroup 이 있는 취약점에서 고유 그룹 목록을 만든다
function extractApiGroups(vulns: { apiGroup?: string }[]): string[] {
  const groups = new Set<string>();
  vulns.forEach((v) => {
    if (v.apiGroup) groups.add(v.apiGroup);
  });
  return Array.from(groups).sort();
}

const SEV_LIST: { value: SeverityFilter; label: string; color: string | null }[] = [
  { value: 'all',      label: 'ALL',      color: null       },
  { value: 'critical', label: 'Critical', color: '#e24b4b'  },
  { value: 'high',     label: 'High',     color: '#f59e0b'  },
  { value: 'medium',   label: 'Medium',   color: '#eab308'  },
  { value: 'low',      label: 'Low',      color: '#22c55e'  },
];

// '__none__' 상수 — API 그룹이 없는 취약점 필터 키
const NONE_KEY = '__none__';

export default function FilterBar() {
  const severityFilter = useSecureStore((s) => s.severityFilter);
  const setSeverity    = useSecureStore((s) => s.setSeverityFilter);
  const apiGroupFilter = useSecureStore((s) => s.apiGroupFilter);
  const setApiGroup    = useSecureStore((s) => s.setApiGroupFilter);
  const vulns          = useSecureStore((s) => s.vulns);

  const apiGroups = extractApiGroups(vulns);
  const hasNoApi  = vulns.some((v) => !v.apiGroup);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px 16px',
        flexWrap: 'wrap',
        padding: '8px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(0,0,0,0.3)',
        flexShrink: 0,
      }}
    >
      {/* 심각도 필터 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span
          style={{
            fontSize: 9,
            color: 'rgba(255,255,255,0.2)',
            marginRight: 6,
            textTransform: 'uppercase',
            fontWeight: 700,
            letterSpacing: '0.08em',
          }}
        >
          심각도
        </span>
        {SEV_LIST.map(({ value, label, color }) => {
          const active = severityFilter === value;
          const isAll  = value === 'all';
          const c      = color ?? '';
          return (
            <button
              key={value}
              onClick={() => setSeverity(value)}
              style={{
                padding: '3px 9px',
                fontSize: 10,
                fontWeight: 800,
                borderRadius: 4,
                background: active
                  ? isAll ? 'rgba(255,255,255,0.12)' : c
                  : isAll ? 'transparent' : `${c}22`,
                color: active
                  ? isAll ? '#e8e8ee' : '#fff'
                  : isAll ? 'rgba(255,255,255,0.35)' : c,
                border: `1px solid ${active
                  ? isAll ? 'rgba(255,255,255,0.22)' : c
                  : isAll ? 'rgba(255,255,255,0.1)' : `${c}55`}`,
                cursor: 'pointer',
                transition: 'all 0.15s',
                textTransform: 'uppercase',
                letterSpacing: '0.02em',
                minWidth: isAll ? 40 : 60,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* 구분선 */}
      <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.1)' }} />

      {/* API 그룹 필터 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
        <span
          style={{
            fontSize: 10,
            color: 'rgba(255,255,255,0.3)',
            marginRight: 4,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          API
        </span>

        {/* 전체 */}
        <button
          onClick={() => setApiGroup(null)}
          style={{
            padding: '3px 10px',
            fontSize: 11,
            borderRadius: 5,
            background: apiGroupFilter === null ? 'rgba(234,88,12,0.15)' : 'transparent',
            color: apiGroupFilter === null ? '#ea580c' : 'rgba(255,255,255,0.4)',
            border: `0.5px solid ${apiGroupFilter === null ? 'rgba(234,88,12,0.4)' : 'rgba(255,255,255,0.1)'}`,
            cursor: 'pointer',
            fontWeight: apiGroupFilter === null ? 700 : 500,
          }}
        >
          전체
        </button>

        {/* 각 API 그룹 */}
        {apiGroups.map((g) => (
          <button
            key={g}
            onClick={() => setApiGroup(apiGroupFilter === g ? null : g)}
            style={{
              padding: '3px 10px',
              fontSize: 11,
              borderRadius: 5,
              fontFamily: 'var(--font-mono)',
              background: apiGroupFilter === g ? 'rgba(234,88,12,0.15)' : 'transparent',
              color: apiGroupFilter === g ? '#ea580c' : 'rgba(255,255,255,0.4)',
              border: `0.5px solid ${apiGroupFilter === g ? 'rgba(234,88,12,0.4)' : 'rgba(255,255,255,0.1)'}`,
              cursor: 'pointer',
              fontWeight: apiGroupFilter === g ? 700 : 500,
            }}
          >
            {g}
          </button>
        ))}

        {/* 기타 (API 없음) → '__none__' */}
        {hasNoApi && (
          <button
            onClick={() => setApiGroup(apiGroupFilter === NONE_KEY ? null : NONE_KEY)}
            style={{
              padding: '3px 10px',
              fontSize: 11,
              borderRadius: 5,
              background: apiGroupFilter === NONE_KEY ? 'rgba(234,88,12,0.15)' : 'transparent',
              color: apiGroupFilter === NONE_KEY ? '#ea580c' : 'rgba(255,255,255,0.4)',
              border: `0.5px solid ${apiGroupFilter === NONE_KEY ? 'rgba(234,88,12,0.4)' : 'rgba(255,255,255,0.1)'}`,
              cursor: 'pointer',
              fontWeight: apiGroupFilter === NONE_KEY ? 700 : 500,
            }}
          >
            기타 (API 없음)
          </button>
        )}
      </div>
    </div>
  );
}
