package io.secureai.backend.domain.compliance.service;

import io.secureai.backend.domain.analysis.service.VulnerabilityQueryService;
import io.secureai.backend.domain.compliance.dto.ComplianceResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * OWASP Top 10 → ISO 27001 / NIST CSF 컴플라이언스 매핑 서비스.
 *
 * <p>취약점의 {@code owasp} 필드(예: "A01", "A03")를 기준으로 그룹화하고,
 * 각 OWASP 카테고리의 취약점 건수에 따라 컨트롤 준수 여부를 판단한다.
 *
 * <p>cross-domain 데이터 접근: analysis 도메인 Repository를 직접 주입하지 않고
 * {@link VulnerabilityQueryService}를 경유한다 (도메인 격리 원칙).
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ComplianceMappingService {

    // ── 지원 framework 상수 ────────────────────────────────────────────────────
    public static final String FRAMEWORK_ISO27001 = "ISO27001";
    public static final String FRAMEWORK_NIST_CSF  = "NIST_CSF";

    // ── OWASP → ISO 27001 매핑 (controlId → controlName) ─────────────────────
    private static final Map<String, String[]> ISO_MAP = Map.of(
            "A01", new String[]{"A.9.4.1",  "Use of Privileged Utility Programs"},
            "A02", new String[]{"A.10.1.1", "Policy on the use of cryptographic controls"},
            "A03", new String[]{"A.14.2.5", "Secure system engineering principles"},
            "A05", new String[]{"A.14.1.2", "Securing application services on public networks"},
            "A06", new String[]{"A.12.6.1", "Management of technical vulnerabilities"},
            "A07", new String[]{"A.9.2.1",  "User registration and de-registration"},
            "A09", new String[]{"A.12.4.1", "Event logging"},
            "A10", new String[]{"A.6.1.2",  "Segregation of duties"}
    );

    // ── OWASP → NIST CSF 매핑 ─────────────────────────────────────────────────
    private static final Map<String, String[]> NIST_MAP = Map.of(
            "A01", new String[]{"PR.AC-4",  "Access permissions and authorizations are managed"},
            "A02", new String[]{"PR.DS-1",  "Data-at-rest is protected"},
            "A03", new String[]{"DE.CM-4",  "Malicious code is detected"},
            "A05", new String[]{"PR.IP-12", "Vulnerability management plan developed/implemented"},
            "A06", new String[]{"ID.RA-1",  "Asset vulnerabilities are identified and documented"},
            "A07", new String[]{"PR.AC-1",  "Identities and credentials are managed"},
            "A09", new String[]{"DE.AE-3",  "Event data are aggregated and correlated"},
            "A10", new String[]{"PR.AC-4",  "Access permissions and authorizations are managed"}
    );

    // ── OWASP 카테고리 표시명 ──────────────────────────────────────────────────
    private static final Map<String, String> OWASP_LABELS = Map.of(
            "A01", "A01 Broken Access Control",
            "A02", "A02 Cryptographic Failures",
            "A03", "A03 Injection",
            "A05", "A05 Security Misconfiguration",
            "A06", "A06 Vulnerable and Outdated Components",
            "A07", "A07 Identification and Authentication Failures",
            "A09", "A09 Security Logging and Monitoring Failures",
            "A10", "A10 Server-Side Request Forgery"
    );

    // cross-domain: analysis Repository 직접 주입 대신 서비스 경유.
    // 세션-프로젝트 바인딩 및 멤버십 검증도 VulnerabilityQueryService가 담당한다.
    private final VulnerabilityQueryService vulnerabilityQueryService;

    /**
     * 특정 세션의 컴플라이언스 보고서를 반환한다.
     *
     * <p>framework 유효성 검증은 Controller 레이어에서 수행되므로 여기서 재검증하지 않는다.
     *
     * @param projectId        프로젝트 ID
     * @param sessionId        분석 세션 ID
     * @param framework        "ISO27001" 또는 "NIST_CSF" (Controller에서 검증 완료)
     * @param requestingUserId 요청자 ID (멤버 검증용)
     * @return 컴플라이언스 응답
     * @throws io.secureai.backend.global.exception.BusinessException
     *         SESSION_NOT_FOUND(세션 없음/타 프로젝트 소속) 또는 PROJECT_ACCESS_DENIED(멤버 아님)
     */
    public ComplianceResponse getComplianceReport(
            UUID projectId, UUID sessionId, String framework, UUID requestingUserId) {

        // 1. 세션-프로젝트 바인딩 + 멤버십 검증 후 OWASP 코드 목록 조회.
        //    VulnerabilityQueryService가 세션이 projectId 소속인지까지 확인하여
        //    타 프로젝트 sessionId로 우회 조회하는 IDOR을 차단한다.
        List<String> owaspCodes =
                vulnerabilityQueryService.findOwaspCodesBySession(requestingUserId, projectId, sessionId);

        // 3. OWASP 카테고리별 취약점 수 집계
        Map<String, String[]> mapping = FRAMEWORK_ISO27001.equals(framework) ? ISO_MAP : NIST_MAP;

        List<ComplianceResponse.ControlResult> controls = new ArrayList<>();
        for (var owaspCode : OWASP_LABELS.keySet()) {
            String[] controlInfo = mapping.get(owaspCode);
            if (controlInfo == null) continue;

            long count = owaspCodes.stream()
                    .filter(raw -> owaspCode.equalsIgnoreCase(extractOwaspCode(raw)))
                    .count();

            controls.add(new ComplianceResponse.ControlResult(
                    controlInfo[0],
                    controlInfo[1],
                    OWASP_LABELS.get(owaspCode),
                    count == 0,
                    (int) count
            ));
        }

        // 미준수 → 준수 순, 같으면 controlId 순
        controls.sort((a, b) -> {
            if (a.compliant() != b.compliant()) return a.compliant() ? 1 : -1;
            return a.controlId().compareTo(b.controlId());
        });

        return new ComplianceResponse(framework, controls);
    }

    /**
     * OWASP 필드에서 카테고리 코드(A01 ~ A10)를 추출한다.
     * 값이 "A01:2021 …" 형식이면 "A01"만 반환, 이미 "A01"이면 그대로 반환.
     */
    private String extractOwaspCode(String owasp) {
        if (owasp == null || owasp.isBlank()) return "";
        // "A01", "A01:2021", "A01:2021 Broken Access Control" 모두 "A01" 반환
        return owasp.trim().substring(0, Math.min(3, owasp.trim().length())).toUpperCase();
    }
}
