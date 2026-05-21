package io.secureai.backend.domain.dast.service;

import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;

/**
 * 해당 도메인에 이미 진행 중인 DAST가 있어 분산 락 획득에 실패한 경우 발생한다.
 * HTTP 409 로 매핑된다.
 */
public class ConcurrentScanException extends BusinessException {

    public ConcurrentScanException(String domain) {
        super(ErrorCode.DAST_CONCURRENT_SCAN, "domain=" + domain);
    }
}
