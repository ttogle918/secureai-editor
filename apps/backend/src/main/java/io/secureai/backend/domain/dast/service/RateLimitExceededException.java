package io.secureai.backend.domain.dast.service;

import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;

/**
 * 시간당 DAST 실행 횟수(3회)를 초과한 경우 발생한다.
 * HTTP 429 로 매핑된다.
 */
public class RateLimitExceededException extends BusinessException {

    public RateLimitExceededException(String domain) {
        super(ErrorCode.DAST_RATE_LIMIT_EXCEEDED, "domain=" + domain);
    }
}
