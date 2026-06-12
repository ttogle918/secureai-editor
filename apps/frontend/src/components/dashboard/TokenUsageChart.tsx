// components/dashboard/TokenUsageChart.tsx
// provider별 일별 토큰 사용량 + 월 예상비용 + 캐시적중률 (COST-3)
'use client';

import { useState } from 'react';
import { useTokenUsage } from '@/hooks/useTokenUsage';

// ── 내부 유틸 ────────────────────────────────────────────────────────────────

function todayIso(): string {
  return new Date().toISOString();
}

function monthStartIso(): string {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

const PROVIDER_COLORS: Record<string, string> = {
  anthropic: '#d97706', // amber
  gemini:    '#2563eb', // blue
  openai:    '#16a34a', // green
};

function providerColor(provider: string): string {
  return PROVIDER_COLORS[provider.toLowerCase()] ?? '#6b7280';
}

// ── 집계 헬퍼 ────────────────────────────────────────────────────────────────

interface ProviderTotals {
  provider: string;
  totalInput: number;
  totalOutput: number;
  totalCost: number;
}

// ── 컴포넌트 ────────────────────────────────────────────────────────────────

interface TokenUsageChartProps {
  /** 조회 시작 ISO8601 문자열 (기본: 이번 달 1일) */
  from?: string;
  /** 조회 종료 ISO8601 문자열 (기본: 현재) */
  to?: string;
}

export function TokenUsageChart({ from, to }: TokenUsageChartProps) {
  const [rangeFrom] = useState(from ?? monthStartIso());
  const [rangeTo]   = useState(to   ?? todayIso());

  const { data, isLoading, error } = useTokenUsage(rangeFrom, rangeTo);

  if (isLoading) {
    return (
      <div style={{ padding: 24, color: '#9494a0', fontSize: 13 }}>
        토큰 사용량 로드 중...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24, color: '#ef4444', fontSize: 13 }}>
        {error}
      </div>
    );
  }

  if (!data || data.daily.length === 0) {
    return (
      <div style={{ padding: 24, color: '#9494a0', fontSize: 13 }}>
        이번 달 토큰 사용 기록이 없습니다.
      </div>
    );
  }

  // provider별 집계
  const providerMap = new Map<string, ProviderTotals>();
  for (const row of data.daily) {
    const existing = providerMap.get(row.provider) ?? {
      provider: row.provider,
      totalInput: 0,
      totalOutput: 0,
      totalCost: 0,
    };
    existing.totalInput  += row.inputTokens + row.cacheReadTokens;
    existing.totalOutput += row.outputTokens;
    existing.totalCost   += parseFloat(row.costUsd);
    providerMap.set(row.provider, existing);
  }
  const providerTotals = Array.from(providerMap.values());

  // 일별 데이터 (날짜별 총 토큰 합계)
  const dateMap = new Map<string, number>();
  for (const row of data.daily) {
    const prev = dateMap.get(row.date) ?? 0;
    dateMap.set(row.date, prev + row.inputTokens + row.outputTokens);
  }
  const dates = Array.from(dateMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  const maxTokens = Math.max(...dates.map(([, v]) => v), 1);

  const totalCost = parseFloat(data.totalCostUsd);
  const cacheHitPct = Math.round(data.cacheHitRate * 100);

  return (
    <div style={{ padding: 16 }}>
      {/* ── 상단 KPI ────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <KpiChip label="월 예상 비용" value={`$${totalCost.toFixed(4)}`} />
        <KpiChip label="캐시 적중률" value={`${cacheHitPct}%`} />
      </div>

      {/* ── provider별 요약 ─────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: '#9494a0', marginBottom: 8 }}>
          PROVIDER 별 사용량
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {providerTotals.map((pt) => (
            <div key={pt.provider} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                style={{
                  display: 'inline-block',
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: providerColor(pt.provider),
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 12, color: '#d0d0d8', width: 80, textTransform: 'capitalize' }}>
                {pt.provider}
              </span>
              <span style={{ fontSize: 11, color: '#9494a0', flex: 1 }}>
                입력 {pt.totalInput.toLocaleString()} / 출력 {pt.totalOutput.toLocaleString()} 토큰
              </span>
              <span style={{ fontSize: 11, color: '#d0d0d8' }}>
                ${pt.totalCost.toFixed(4)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── 일별 바 차트 ─────────────────────────────────────────── */}
      <div>
        <div style={{ fontSize: 11, color: '#9494a0', marginBottom: 8 }}>
          일별 토큰 사용량
        </div>
        <div
          style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 60 }}
          role="img"
          aria-label="일별 토큰 사용량 바 차트"
        >
          {dates.map(([date, total]) => {
            const barH = Math.max((total / maxTokens) * 56, 2);
            return (
              <div
                key={date}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 2,
                }}
                title={`${date}: ${total.toLocaleString()} 토큰`}
              >
                <div
                  style={{
                    width: '100%',
                    height: barH,
                    background: '#2563eb99',
                    borderRadius: 2,
                  }}
                />
                <div style={{ fontSize: 8, color: '#555560' }}>
                  {date.slice(8, 10)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── 내부 서브 컴포넌트 ────────────────────────────────────────────────────────

function KpiChip({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: '#1a1a2e',
        border: '1px solid #2a2a40',
        borderRadius: 8,
        padding: '8px 14px',
        minWidth: 110,
      }}
    >
      <div style={{ fontSize: 10, color: '#9494a0', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 14, color: '#d0d0d8', fontWeight: 600 }}>{value}</div>
    </div>
  );
}
