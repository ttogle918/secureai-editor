import { LegalPageShell, legalH2 } from '@/components/legal/LegalPageShell';

export const metadata = { title: '개인정보처리방침 — Kkebi' };

export default function PrivacyPage() {
  return (
    <LegalPageShell title="개인정보처리방침" updated="2026-05-30">
      <p>Kkebi는 「개인정보 보호법」(PIPA) 제30조 및 GDPR 제13조에 따라 다음과 같이 개인정보 처리방침을 수립·공개합니다.</p>

      <h2 style={legalH2}>1. 수집하는 개인정보 항목</h2>
      <p>이메일, 사용자명, 표시 이름, (선택) GitHub 연동 정보, 분석 대상 코드 메타데이터, 서비스 이용 기록·IP·기기 정보.</p>

      <h2 style={legalH2}>2. 수집·이용 목적</h2>
      <p>계정 인증, 보안 분석 서비스 제공, 리포트 생성·전송, 요금 정산, 고지·알림, 서비스 개선.</p>

      <h2 style={legalH2}>3. 보유 및 이용 기간</h2>
      <p>회원 탈퇴 시 지체 없이 파기하되, 관련 법령에 따라 보존이 필요한 경우 해당 기간 동안 보관합니다. 분석 산출물(리포트 등)은 90일 후 자동 삭제됩니다.</p>

      <h2 style={legalH2}>4. 처리 위탁 및 제3자 제공</h2>
      <p>AI 분석을 위해 Anthropic(Claude API), 인프라 제공을 위해 클라우드 제공자에 데이터가 처리될 수 있습니다. 자세한 하위 처리자 목록은 요청 시 제공합니다.</p>

      <h2 style={legalH2}>5. 정보주체의 권리 (GDPR/PIPA)</h2>
      <p>이용자는 열람·정정·삭제·처리정지·데이터 이동(Export) 권리를 가지며, 서비스 내 GDPR Export/Delete 기능 또는 문의를 통해 행사할 수 있습니다.</p>

      <h2 style={legalH2}>6. 개인정보 보호책임자</h2>
      <p>문의: privacy@secureai.dev (베타 — 정식 연락처는 법무 검토 후 갱신).</p>
    </LegalPageShell>
  );
}
