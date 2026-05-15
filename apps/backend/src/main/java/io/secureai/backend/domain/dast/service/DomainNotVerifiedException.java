package io.secureai.backend.domain.dast.service;

import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;

/**
 * 도메인 소유권이 확인되지 않은 상태에서 DAST를 시도할 때 발생한다.
 * HTTP 403 으로 매핑된다.
 */
public class DomainNotVerifiedException extends BusinessException {

    public DomainNotVerifiedException(String domain) {
        super(ErrorCode.DAST_DOMAIN_NOT_VERIFIED, "domain=" + domain);
    }
}
