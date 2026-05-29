import { LegalPageShell, legalH2 } from '@/components/legal/LegalPageShell';

export const metadata = { title: '쿠키 정책 — SecureAI' };

export default function CookiePage() {
  return (
    <LegalPageShell title="쿠키 정책" updated="2026-05-30">
      <p>SecureAI는 서비스 제공과 개선을 위해 쿠키 및 유사 기술을 사용합니다. 첫 방문 시 표시되는 배너에서 동의 범위를 선택할 수 있습니다.</p>

      <h2 style={legalH2}>1. 필수 쿠키</h2>
      <p>인증 세션 유지, 보안(CSRF 방지) 등 서비스 작동에 반드시 필요한 쿠키로, 동의 없이 사용되며 거부할 수 없습니다.</p>

      <h2 style={legalH2}>2. 분석 쿠키 (선택)</h2>
      <p>서비스 이용 패턴 분석·개선을 위한 쿠키로, &ldquo;전체 허용&rdquo;에 동의한 경우에만 설정됩니다. &ldquo;필수만 허용&rdquo; 선택 시 설정되지 않습니다.</p>

      <h2 style={legalH2}>3. 동의 철회</h2>
      <p>브라우저의 로컬 저장소에서 동의 기록(secureai-cookie-consent)을 삭제하면 배너가 다시 표시되어 선택을 변경할 수 있습니다.</p>
    </LegalPageShell>
  );
}
