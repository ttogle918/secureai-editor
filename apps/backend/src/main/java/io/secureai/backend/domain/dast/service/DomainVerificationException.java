package io.secureai.backend.domain.dast.service;

/**
 * DNS 조회 또는 HTTP 확인 자체에서 기술적 오류가 발생한 경우 wrapping하는 예외.
 * 호출자는 이 예외를 catch하여 로그 후 검증 실패로 처리한다.
 */
public class DomainVerificationException extends RuntimeException {

    public DomainVerificationException(String message) {
        super(message);
    }

    public DomainVerificationException(String message, Throwable cause) {
        super(message, cause);
    }
}
