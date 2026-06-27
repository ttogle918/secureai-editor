import React from 'react';
import { ShieldAlert, BookOpen, FileText, ExternalLink, Download } from 'lucide-react';
import Link from 'next/link';

export default function ComplianceGuidelinePage() {
  return (
    <div style={{ padding: '32px 40px', maxWidth: 900, margin: '0 auto', color: 'var(--text-primary)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <BookOpen size={24} color="var(--orange)" />
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>규제/인증 가이드라인 및 도움말</h1>
      </div>
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 32 }}>
        SecureAI가 취약점 점검 결과를 매핑하여 자동 생성하는 각종 규제/인증 문서의 공식 레퍼런스입니다.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        
        {/* KISA ISMS-P */}
        <section style={{ border: '1px solid var(--border-2)', borderRadius: 12, padding: 24, background: 'var(--bg-1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              정보보호 및 개인정보보호 관리체계 인증 (ISMS-P)
            </h2>
            <span style={{ background: 'var(--orange-dim)', color: 'var(--orange)', padding: '4px 10px', borderRadius: 4, fontSize: 12, fontWeight: 600 }}>2.5v</span>
          </div>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>
            한국인터넷진흥원(KISA)에서 주관하는 ISMS-P 인증 기준입니다. SecureAI는 소프트웨어 개발 보안(2.8) 및 운영 보안(2.9) 통제 항목의 증적을 자동으로 생성합니다.
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <a href="https://isms-p.or.kr/ntcn/rcsrm/selectGnrlRcsrmDetail.do" target="_blank" rel="noreferrer" style={{
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, 
              color: 'var(--text-primary)', background: 'var(--bg-2)', border: '1px solid var(--border-2)', 
              padding: '8px 16px', borderRadius: 6, textDecoration: 'none'
            }}>
              <FileText size={14} />
              인증 신청서 양식 다운로드
            </a>
            <a href="https://isms.kisa.or.kr/" target="_blank" rel="noreferrer" style={{
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, 
              color: 'var(--orange)', background: 'var(--orange-dim)', border: '1px solid rgba(249,115,22,0.3)', 
              padding: '8px 16px', borderRadius: 6, textDecoration: 'none'
            }}>
              <ExternalLink size={14} />
              공식 포털 바로가기
            </a>
          </div>
        </section>

        {/* 행안부 SW개발보안 */}
        <section style={{ border: '1px solid var(--border-2)', borderRadius: 12, padding: 24, background: 'var(--bg-1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              행정안전부 소프트웨어 개발보안 가이드
            </h2>
            <span style={{ background: 'var(--orange-dim)', color: 'var(--orange)', padding: '4px 10px', borderRadius: 4, fontSize: 12, fontWeight: 600 }}>47개 항목</span>
          </div>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>
            공공 정보화 사업 시 의무적으로 준수해야 하는 행안부 47개 보안약점 진단 항목입니다. SecureAI는 분석 결과를 기반으로 조치 여부 점검표를 자동 작성합니다.
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <a href="https://www.kisa.or.kr/2060204/form?postSeq=5&page=1" target="_blank" rel="noreferrer" style={{
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, 
              color: 'var(--text-primary)', background: 'var(--bg-2)', border: '1px solid var(--border-2)', 
              padding: '8px 16px', borderRadius: 6, textDecoration: 'none'
            }}>
              <Download size={14} />
              가이드라인 PDF 다운로드
            </a>
          </div>
        </section>

        {/* CISO 보고서 */}
        <section style={{ border: '1px solid var(--border-2)', borderRadius: 12, padding: 24, background: 'var(--bg-1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              CISO 우수사례 및 해킹 진단 도구
            </h2>
          </div>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>
            정보보호최고책임자(CISO)를 위한 우수사례집 및 KISA 보호나라의 해킹 진단/보안 권고문입니다. 경영진 보고용 문서 작성 시 유용한 양식을 제공합니다.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <a href="https://www.boho.or.kr/kr/bbs/view.do?bbsId=B0000127&pageIndex=1&nttId=71946&menuNo=205021" target="_blank" rel="noreferrer" style={{
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, 
              color: 'var(--text-primary)', background: 'var(--bg-2)', border: '1px solid var(--border-2)', 
              padding: '8px 16px', borderRadius: 6, textDecoration: 'none'
            }}>
              <FileText size={14} />
              CISO 우수사례집 다운로드
            </a>
            <a href="https://www.boho.or.kr/kr/bbs/list.do?menuNo=205021&bbsId=B0000127" target="_blank" rel="noreferrer" style={{
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, 
              color: 'var(--text-primary)', background: 'var(--bg-2)', border: '1px solid var(--border-2)', 
              padding: '8px 16px', borderRadius: 6, textDecoration: 'none'
            }}>
              <ShieldAlert size={14} />
              자료실 및 해킹 진단 도구
            </a>
          </div>
        </section>

      </div>
    </div>
  );
}
