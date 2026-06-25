import { LegalPageShell, legalH2 } from '@/components/legal/LegalPageShell';

export const metadata = { title: '이용약관 — Kkebi' };

export default function TermsPage() {
  return (
    <LegalPageShell title="이용약관" updated="2026-05-30">
      <h2 style={legalH2}>제1조 (목적)</h2>
      <p>본 약관은 Kkebi(이하 &ldquo;회사&rdquo;)가 제공하는 AI 기반 보안 분석 서비스(이하 &ldquo;서비스&rdquo;)의 이용과 관련하여 회사와 이용자 간의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.</p>

      <h2 style={legalH2}>제2조 (서비스의 내용)</h2>
      <p>회사는 정적 분석(SAST), 동적 분석(DAST), 취약점 패치 추천, 보안 리포트 생성 등의 기능을 제공합니다. 분석 대상 코드 및 데이터의 처리 범위는 개인정보처리방침에 따릅니다.</p>

      <h2 style={legalH2}>제3조 (이용자의 의무)</h2>
      <p>이용자는 본인이 소유하거나 정당한 권한을 가진 코드·도메인에 한하여 분석을 요청해야 하며, 타인의 시스템에 대한 무단 점검(DAST 포함)은 금지됩니다.</p>

      <h2 style={legalH2}>제4조 (요금 및 결제)</h2>
      <p>유료 플랜의 요금·결제·환불 정책은 별도 고지하며, 베타 기간 중 정책은 변경될 수 있습니다.</p>

      <h2 style={legalH2}>제5조 (책임의 제한)</h2>
      <p>회사는 분석 결과의 정확성을 위해 노력하나, 자동 분석의 특성상 모든 취약점의 탐지 또는 오탐 부재를 보증하지 않습니다.</p>

      <h2 style={legalH2}>제6조 (약관의 변경)</h2>
      <p>회사는 관련 법령을 준수하는 범위에서 약관을 변경할 수 있으며, 변경 시 서비스 내 공지합니다.</p>
    </LegalPageShell>
  );
}
