package io.secureai.backend.domain.auth.controller;

import io.secureai.backend.domain.auth.dto.BounceWebhookRequest;
import io.secureai.backend.domain.auth.entity.SuppressionReason;
import io.secureai.backend.domain.auth.service.EmailSuppressionService;
import io.secureai.backend.domain.auth.service.EmailWebhookSignatureVerifier;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * 이메일 바운스/스팸 신고 웹훅 수신 엔드포인트.
 *
 * SecurityConfig에서 permitAll 처리 — JWT 불필요.
 * 임의 외부인 조작 방지: X-Webhook-Secret 헤더로 공유 시크릿 검증.
 *
 * 입력 검증(@Valid)은 Controller 레이어에서만 수행 (general.md 규칙).
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/webhooks/email")
@RequiredArgsConstructor
public class EmailWebhookController {

    private final EmailWebhookSignatureVerifier signatureVerifier;
    private final EmailSuppressionService suppressionService;

    /**
     * 바운스/스팸 신고 이벤트를 수신하여 suppression 목록에 등록한다.
     *
     * @param secret  X-Webhook-Secret 헤더 (env: EMAIL_WEBHOOK_SECRET)
     * @param request 이메일 주소와 억제 사유 (BOUNCE 또는 COMPLAINT)
     * @return 200 OK
     */
    @PostMapping("/bounce")
    public ResponseEntity<Void> receiveBounce(
            @RequestHeader(value = "X-Webhook-Secret", required = false) String secret,
            @Valid @RequestBody BounceWebhookRequest request) {

        signatureVerifier.verify(secret);

        SuppressionReason reason = SuppressionReason.valueOf(request.reason().toUpperCase());
        suppressionService.suppress(request.email(), reason);

        log.info("[email-webhook] suppression registered email={} reason={}", request.email(), reason);
        return ResponseEntity.ok().build();
    }
}
