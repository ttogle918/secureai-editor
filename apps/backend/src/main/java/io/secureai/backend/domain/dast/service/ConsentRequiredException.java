package io.secureai.backend.domain.dast.service;

import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;

/**
 * DAST 실행에 필요한 면책 동의가 수령되지 않은 경우 발생한다.
 * HTTP 403 으로 매핑된다.
 */
public class ConsentRequiredException extends BusinessException {

    public ConsentRequiredException(String domain) {
        super(ErrorCode.DAST_CONSENT_REQUIRED, "domain=" + domain);
    }
}
