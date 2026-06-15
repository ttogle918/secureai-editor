package io.secureai.backend.domain.auth.service;

import io.secureai.backend.domain.auth.entity.EmailSuppression;
import io.secureai.backend.domain.auth.entity.SuppressionReason;
import io.secureai.backend.domain.auth.repository.EmailSuppressionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 이메일 억제 목록 관리 서비스.
 *
 * 바운스/스팸 신고 웹훅 수신 시 suppression 등록을 처리한다.
 * 이미 등록된 주소는 중복 등록하지 않는다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EmailSuppressionService {

    private final EmailSuppressionRepository suppressionRepository;

    /**
     * 이메일 주소를 억제 목록에 등록한다.
     * 동일 주소가 이미 등록된 경우 무시한다 (idempotent).
     */
    @Transactional
    public void suppress(String emailAddress, SuppressionReason reason) {
        if (suppressionRepository.existsByEmailAddress(emailAddress)) {
            log.info("[suppression] already suppressed email={}", emailAddress);
            return;
        }
        suppressionRepository.save(
            EmailSuppression.builder()
                .emailAddress(emailAddress)
                .reason(reason)
                .build()
        );
        log.info("[suppression] registered email={} reason={}", emailAddress, reason);
    }
}
