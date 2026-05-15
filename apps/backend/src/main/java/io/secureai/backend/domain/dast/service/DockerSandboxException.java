package io.secureai.backend.domain.dast.service;

import io.secureai.backend.domain.dast.entity.ScanStatus;

/**
 * Docker 샌드박스 작업 중 발생하는 예외.
 * status 필드로 타임아웃과 일반 실패를 구분한다.
 */
public class DockerSandboxException extends RuntimeException {

    private final ScanStatus status;

    public DockerSandboxException(String message, ScanStatus status) {
        super(message);
        this.status = status;
    }

    public DockerSandboxException(String message, ScanStatus status, Throwable cause) {
        super(message, cause);
        this.status = status;
    }

    public ScanStatus getStatus() {
        return status;
    }
}
