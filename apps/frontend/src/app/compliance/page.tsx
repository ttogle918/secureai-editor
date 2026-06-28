'use client';
import React from 'react';
import {
  ShieldAlert, BookOpen, FileText, ExternalLink, Download,
  CheckCircle2, Circle, Landmark, Newspaper, AlertTriangle,
} from 'lucide-react';

// ──────────────────────────────────────────────────────────────
// ⚠️ 임시 mock 데이터 (데모용). 추후 백엔드 연동 시 교체.
//   - 체크리스트: GET /compliance/checklist (예정)
//   - 정부 권장사항/뉴스: 큐레이션 피드 또는 RSS 수집 (예정)
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

interface GovRec { agency: string; date: string; title: string; summary: string; link: string; }
const GOV_RECOMMENDATIONS: GovRec[] = [
  { agency: 'KISA', date: '2026-06', title: '생성형 AI 서비스 보안 가이드', summary: 'LLM 연동 서비스의 프롬프트 인젝션·민감정보 유출 대응 권고. API 키 분리 보관 및 출력 필터링 강조.', link: 'https://www.kisa.or.kr/' },
  { agency: '행정안전부', date: '2026-05', title: 'SW 개발보안 가이드 개정(47개 항목)', summary: '공공 정보화 사업 의무 적용 보안약점 진단 항목. 입력 검증·인증·에러처리 영역 보강.', link: 'https://www.kisa.or.kr/2060204/form?postSeq=5&page=1' },
  { agency: '개인정보보호위원회', date: '2026-04', title: '개인정보 안전성 확보조치 기준', summary: '암호화·접근권한·접속기록 보관(최소 1년) 등 기술적·관리적 보호조치 의무 사항.', link: 'https://www.pipc.go.kr/' },
];

interface NewsItem { date: string; source: string; title: string; tag: string; link: string; }
const SECURITY_NEWS: NewsItem[] = [
  { date: '2026-06-27', source: '보안뉴스', tag: '취약점', title: '오픈소스 인기 라이브러리서 원격코드실행(RCE) 취약점 발견 — 즉시 패치 권고', link: 'https://www.boannews.com/' },
  { date: '2026-06-25', source: 'KISA',     tag: '권고문', title: 'Apache 계열 서버 대상 대규모 스캐닝 탐지 — 최신 버전 업데이트 및 접근통제 점검', link: 'https://www.boho.or.kr/' },
  { date: '2026-06-23', source: '데일리시큐', tag: '랜섬웨어', title: '국내 제조업 대상 피싱 경유 랜섬웨어 다수 — 첨부파일 매크로 차단 강화 필요', link: 'https://www.dailysecu.com/' },
  { date: '2026-06-20', source: 'CVE',      tag: 'CVE', title: 'CVE-2026-XXXXX: 널리 쓰이는 JSON 파서 역직렬화 취약점(CVSS 9.1)', link: 'https://nvd.nist.gov/' },
];

const cardStyle: React.CSSProperties = { border: '1px solid var(--border-2)', borderRadius: 12, padding: 24, background: 'var(--bg-1)' };
const linkBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', background: 'var(--bg-2)', border: '1px solid var(--border-2)', padding: '8px 16px', borderRadius: 6, textDecoration: 'none' };

export default function ComplianceGuidelinePage() {
  const doneCount = CHECKLIST.filter((c) => c.done).length;
  const pct = Math.round((doneCount / CHECKLIST.length) * 100);

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
        <AlertTriangle size={12} /> 일부 항목은 데모용 예시 데이터입니다 (백엔드 연동 예정).
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* ── 보안 점검 체크리스트 ── */}
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

        {/* ── 정부 권장 사항 ── */}
        <section style={cardStyle}>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Landmark size={18} color="var(--orange)" /> 정부 권장 사항
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {GOV_RECOMMENDATIONS.map((r, i) => (
              <a key={i} href={r.link} target="_blank" rel="noreferrer" style={{ display: 'block', padding: 14, background: 'var(--bg-2)', border: '1px solid var(--border-2)', borderRadius: 8, textDecoration: 'none', color: 'inherit' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--orange)', background: 'var(--orange-dim)', borderRadius: 4, padding: '2px 7px' }}>{r.agency}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>{r.date}</span>
                  <span style={{ fontSize: 14, fontWeight: 600, marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>{r.title} <ExternalLink size={12} color="var(--text-tertiary)" /></span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{r.summary}</p>
              </a>
            ))}
          </div>
        </section>

        {/* ── 최신 보안 뉴스 ── */}
        <section style={cardStyle}>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Newspaper size={18} color="var(--orange)" /> 최신 보안 뉴스
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {SECURITY_NEWS.map((n, i) => (
              <a key={i} href={n.link} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 4px', borderBottom: '1px solid var(--hairline)', textDecoration: 'none', color: 'inherit' }}>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', flexShrink: 0, width: 78 }}>{n.date}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--orange)', border: '1px solid rgba(249,115,22,0.3)', borderRadius: 4, padding: '1px 6px', flexShrink: 0 }}>{n.tag}</span>
                <span style={{ fontSize: 13, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title}</span>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0 }}>{n.source}</span>
              </a>
            ))}
          </div>
        </section>

        {/* ── 규제/인증 프레임워크 레퍼런스 (기존 KISA 링크) ── */}
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
