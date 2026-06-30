'use client';
import React from 'react';
import {
  ShieldAlert, BookOpen, FileText, ExternalLink, Download,
  CheckCircle2, Circle, Landmark, Newspaper, AlertTriangle, Paperclip,
} from 'lucide-react';
import { useComplianceFeed } from '@/hooks/useComplianceFeed';
import type { FeedItem } from '@/hooks/useComplianceFeed';

// ──────────────────────────────────────────────────────────────
// 보안 점검 체크리스트 — 정적 유지 (후속: 스캔결과 연동 예정)
// 외부 피드 3개 섹션은 GET /api/v1/compliance/feed (실데이터)로 전환.
// ──────────────────────────────────────────────────────────────

type Severity = 'critical' | 'high' | 'medium' | 'low';

const SEV_META: Record<Severity, { label: string; color: string }> = {
  critical: { label: 'CRITICAL', color: '#ef4444' },
  high:     { label: 'HIGH',     color: '#f97316' },
  medium:   { label: 'MEDIUM',   color: '#eab308' },
  low:      { label: 'LOW',      color: '#3b82f6' },
};

interface ChecklistItem { id: string; label: string; severity: Severity; done: boolean; hint: string; }
const CHECKLIST: ChecklistItem[] = [
  { id: 'c1', label: '하드코딩된 시크릿·API 키 제거', severity: 'critical', done: false, hint: '소스에 직접 박힌 키/비밀번호를 환경변수·시크릿 매니저로 이전' },
  { id: 'c2', label: 'SQL 인젝션 방어 (파라미터 바인딩)', severity: 'critical', done: true,  hint: '문자열 연결 쿼리 금지, Prepared Statement 사용' },
  { id: 'c3', label: '의존성 취약점(CVE) 점검',           severity: 'high',     done: false, hint: 'SBOM 기반으로 알려진 CVE 보유 패키지 업데이트' },
  { id: 'c4', label: 'HTTPS/TLS 강제 적용',               severity: 'high',     done: true,  hint: 'HTTP→HTTPS 리다이렉트 + HSTS 헤더' },
  { id: 'c5', label: '접근통제·권한 검증 (IDOR 방지)',    severity: 'high',     done: false, hint: '리소스 접근 시 소유자/권한 서버측 검증' },
  { id: 'c6', label: '로그 내 민감정보 마스킹',           severity: 'medium',   done: true,  hint: '토큰·주민번호·카드번호 로그 출력 금지' },
  { id: 'c7', label: '보안 헤더 설정 (CSP·X-Frame-Options)', severity: 'medium', done: false, hint: 'XSS·클릭재킹 완화를 위한 응답 헤더 추가' },
  { id: 'c8', label: '정기 백업·복구 시나리오 점검',      severity: 'low',      done: true,  hint: '백업 무결성 + 복구 리허설 분기 1회' },
];

const cardStyle: React.CSSProperties = { border: '1px solid var(--border-2)', borderRadius: 12, padding: 24, background: 'var(--bg-1)' };
const linkBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', background: 'var(--bg-2)', border: '1px solid var(--border-2)', padding: '8px 16px', borderRadius: 6, textDecoration: 'none' };

/** publishedDate("YYYY-MM-DD") 를 "YYYY-MM" 형태로 단축한다. */
function toYearMonth(dateStr: string | null): string {
  if (!dateStr) return '';
  return dateStr.slice(0, 7);
}

/** 피드 섹션 로딩/빈/에러 상태를 통합 렌더하는 헬퍼 */
function FeedSectionContent({
  isLoading, error, items, emptyMessage, children,
}: {
  isLoading: boolean;
  error: string | null;
  items: FeedItem[] | undefined;
  emptyMessage: string;
  children: (items: FeedItem[]) => React.ReactNode;
}) {
  if (isLoading) {
    return (
      <div style={{ padding: '16px 4px', color: 'var(--text-tertiary)', fontSize: 13 }}>
        불러오는 중...
      </div>
    );
  }
  if (error) {
    return (
      <div style={{ padding: '16px 4px', color: '#f97316', fontSize: 12 }}>
        피드를 불러오지 못했습니다. ({error})
      </div>
    );
  }
  if (!items || items.length === 0) {
    return (
      <div style={{ padding: '16px 4px', color: 'var(--text-tertiary)', fontSize: 13 }}>
        {emptyMessage}
      </div>
    );
  }
  return <>{children(items)}</>;
}

export default function ComplianceGuidelinePage() {
  const doneCount = CHECKLIST.filter((c) => c.done).length;
  const pct = Math.round((doneCount / CHECKLIST.length) * 100);

  const { data: feedData, isLoading: feedLoading, error: feedError } = useComplianceFeed();

  return (
    <div style={{ padding: '32px 40px', maxWidth: 900, margin: '0 auto', color: 'var(--text-primary)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <BookOpen size={24} color="var(--orange)" />
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>컴플라이언스 & 보안 현황</h1>
      </div>
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12 }}>
        보안 점검 체크리스트, 정부 권장 사항, 최신 보안 동향과 규제/인증 레퍼런스를 한곳에서 확인하세요.
      </p>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 28 }}>
        <AlertTriangle size={12} /> 피드(정부 권장사항·보안 뉴스·기관 게시물)는 실데이터, 체크리스트는 정적 데이터입니다.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* ── 보안 점검 체크리스트 (정적 — 후속: 스캔결과 연동 예정) ── */}
        <section style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldAlert size={18} color="var(--orange)" /> 보안 점검 체크리스트
            </h2>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{doneCount}/{CHECKLIST.length} 완료 ({pct}%)</span>
          </div>
          <div style={{ height: 6, background: 'var(--bg-3)', borderRadius: 3, overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ width: `${pct}%`, height: '100%', background: 'var(--orange)' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {CHECKLIST.map((c) => {
              const sev = SEV_META[c.severity];
              return (
                <div key={c.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 4px', borderBottom: '1px solid var(--hairline)' }}>
                  {c.done
                    ? <CheckCircle2 size={16} color="#16a34a" style={{ flexShrink: 0, marginTop: 2 }} />
                    : <Circle size={16} color="var(--text-tertiary)" style={{ flexShrink: 0, marginTop: 2 }} />}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: c.done ? 'var(--text-secondary)' : 'var(--text-primary)', textDecoration: c.done ? 'line-through' : 'none' }}>{c.label}</span>
                      <span style={{ fontSize: 9, fontWeight: 700, color: sev.color, border: `1px solid ${sev.color}55`, borderRadius: 4, padding: '1px 5px' }}>{sev.label}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{c.hint}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── 정부 권장 사항 (실데이터: GET /api/v1/compliance/feed) ── */}
        <section style={cardStyle}>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Landmark size={18} color="var(--orange)" /> 정부 권장 사항
          </h2>
          <FeedSectionContent
            isLoading={feedLoading}
            error={feedError}
            items={feedData?.govRecommendations}
            emptyMessage="등록된 정부 권장사항이 없습니다."
          >
            {(items) => (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {items.map((r) => (
                  <a key={r.id} href={r.sourceUrl ?? '#'} target="_blank" rel="noreferrer" style={{ display: 'block', padding: 14, background: 'var(--bg-2)', border: '1px solid var(--border-2)', borderRadius: 8, textDecoration: 'none', color: 'inherit' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--orange)', background: 'var(--orange-dim)', borderRadius: 4, padding: '2px 7px' }}>{r.agency}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>{toYearMonth(r.publishedDate)}</span>
                      <span style={{ fontSize: 14, fontWeight: 600, marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>{r.title} <ExternalLink size={12} color="var(--text-tertiary)" /></span>
                    </div>
                    {r.summary && (
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{r.summary}</p>
                    )}
                  </a>
                ))}
              </div>
            )}
          </FeedSectionContent>
        </section>

        {/* ── 최신 보안 뉴스 (실데이터: GET /api/v1/compliance/feed) ── */}
        <section style={cardStyle}>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Newspaper size={18} color="var(--orange)" /> 최신 보안 뉴스
          </h2>
          <FeedSectionContent
            isLoading={feedLoading}
            error={feedError}
            items={feedData?.securityNews}
            emptyMessage="등록된 보안 뉴스가 없습니다."
          >
            {(items) => (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {items.map((n) => (
                  <a key={n.id} href={n.sourceUrl ?? '#'} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 4px', borderBottom: '1px solid var(--hairline)', textDecoration: 'none', color: 'inherit' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', flexShrink: 0, width: 78 }}>{n.publishedDate}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--orange)', border: '1px solid rgba(249,115,22,0.3)', borderRadius: 4, padding: '1px 6px', flexShrink: 0 }}>{n.category}</span>
                    <span style={{ fontSize: 13, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0 }}>{n.agency}</span>
                  </a>
                ))}
              </div>
            )}
          </FeedSectionContent>
        </section>

        {/* ── 기관 보안 게시물 (실데이터: GET /api/v1/compliance/feed) ── */}
        <section style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Landmark size={18} color="var(--orange)" /> 기관 보안 게시물
            </h2>
            {feedData?.agencyPosts[0]?.publishedDate && (
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                최신 {feedData.agencyPosts[0].publishedDate}
              </span>
            )}
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
            KISA 등 기관 보안 게시판에서 자동 수집·요약한 자료입니다. 첨부파일은 원문에서 다운로드하세요.
          </p>
          <FeedSectionContent
            isLoading={feedLoading}
            error={feedError}
            items={feedData?.agencyPosts}
            emptyMessage="등록된 기관 게시물이 없습니다."
          >
            {(items) => (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {items.map((item) => (
                  <div key={item.id} style={{ padding: 16, background: 'var(--bg-2)', border: '1px solid var(--border-2)', borderRadius: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--orange)', background: 'var(--orange-dim)', borderRadius: 4, padding: '2px 7px' }}>{item.agency}</span>
                      {item.category && (
                        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', border: '1px solid var(--border-2)', borderRadius: 4, padding: '2px 7px' }}>{item.category}</span>
                      )}
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginLeft: 'auto' }}>{item.publishedDate}</span>
                    </div>
                    <h3 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 6px' }}>{item.title}</h3>
                    {item.summary && (
                      <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 12px' }}>{item.summary}</p>
                    )}

                    {item.files && item.files.length > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Paperclip size={12} /> 첨부파일 {item.files.length}건
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {item.files.map((f) => (
                            <div key={f.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, padding: '6px 10px', background: 'var(--bg-1)', border: '1px solid var(--hairline)', borderRadius: 6 }}>
                              <FileText size={13} color="var(--orange)" />
                              <span style={{ flex: 1, color: 'var(--text-primary)' }}>{f.name}</span>
                              <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{f.type} · {f.size}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {item.sourceUrl && (
                      <a href={item.sourceUrl} target="_blank" rel="noreferrer" style={{ ...linkBtn, fontSize: 12, padding: '6px 12px' }}>
                        <Download size={13} /> 원문에서 파일 다운로드
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </FeedSectionContent>
        </section>

        {/* ── 규제/인증 프레임워크 레퍼런스 (기존 KISA 링크 — 정적 유지) ── */}
        <section style={cardStyle}>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={18} color="var(--orange)" /> 규제/인증 프레임워크
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
            SecureAI가 취약점 점검 결과를 매핑해 자동 생성하는 규제/인증 문서의 공식 레퍼런스입니다.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ paddingBottom: 16, borderBottom: '1px solid var(--hairline)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <strong style={{ fontSize: 14 }}>정보보호 및 개인정보보호 관리체계 인증 (ISMS-P)</strong>
                <span style={{ background: 'var(--orange-dim)', color: 'var(--orange)', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>2.5v</span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 12px' }}>
                KISA 주관 ISMS-P 인증 기준. 소프트웨어 개발보안(2.8)·운영보안(2.9) 통제항목 증적을 자동 생성합니다.
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <a href="https://isms.kisa.or.kr/" target="_blank" rel="noreferrer" style={{ ...linkBtn, color: 'var(--orange)', background: 'var(--orange-dim)', borderColor: 'rgba(249,115,22,0.3)' }}><ExternalLink size={14} /> 공식 포털 바로가기</a>
              </div>
            </div>

            <div style={{ paddingBottom: 16, borderBottom: '1px solid var(--hairline)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <strong style={{ fontSize: 14 }}>행정안전부 소프트웨어 개발보안 가이드</strong>
                <span style={{ background: 'var(--orange-dim)', color: 'var(--orange)', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>47개 항목</span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 12px' }}>
                공공 정보화 사업 의무 준수 47개 보안약점 진단 항목. 조치 여부 점검표를 자동 작성합니다.
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <a href="https://www.kisa.or.kr/2060204/form?postSeq=5&page=1" target="_blank" rel="noreferrer" style={linkBtn}><Download size={14} /> 가이드라인 PDF</a>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <strong style={{ fontSize: 14 }}>CISO 우수사례 및 해킹 진단 도구</strong>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 12px' }}>
                CISO 우수사례집 및 KISA 보호나라의 보안 권고문. 경영진 보고용 양식을 제공합니다.
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <a href="https://www.boho.or.kr/kr/main.do" target="_blank" rel="noreferrer" style={linkBtn}><ShieldAlert size={14} /> 보호나라 자료실</a>
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
