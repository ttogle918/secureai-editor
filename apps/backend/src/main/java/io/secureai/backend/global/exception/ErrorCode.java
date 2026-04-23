package io.secureai.backend.global.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
public enum ErrorCode {

    AUTH_INVALID_CREDENTIALS(HttpStatus.UNAUTHORIZED, "이메일 또는 비밀번호가 올바르지 않습니다."),
    AUTH_ACCOUNT_LOCKED(HttpStatus.UNAUTHORIZED, "로그인 실패가 5회를 초과하여 계정이 잠겼습니다."),
    AUTH_EMAIL_NOT_VERIFIED(HttpStatus.FORBIDDEN, "이메일 인증이 필요합니다."),
    AUTH_TOKEN_EXPIRED(HttpStatus.UNAUTHORIZED, "Access Token이 만료되었습니다."),
    AUTH_REFRESH_INVALID(HttpStatus.UNAUTHORIZED, "Refresh Token이 유효하지 않거나 재사용되었습니다."),
    AUTH_EMAIL_ALREADY_EXISTS(HttpStatus.CONFLICT, "이미 사용 중인 이메일입니다."),
    AUTH_USERNAME_ALREADY_EXISTS(HttpStatus.CONFLICT, "이미 사용 중인 사용자명입니다."),

    PLAN_FEATURE_NOT_ALLOWED(HttpStatus.FORBIDDEN, "현재 플랜에서 지원하지 않는 기능입니다."),
    PLAN_LIMIT_EXCEEDED(HttpStatus.FORBIDDEN, "월별 사용 한도를 초과했습니다."),

    RATE_LIMIT_EXCEEDED(HttpStatus.TOO_MANY_REQUESTS, "API 호출 횟수를 초과했습니다."),

    USER_NOT_FOUND(HttpStatus.NOT_FOUND, "사용자를 찾을 수 없습니다."),
    USER_INVALID_PASSWORD(HttpStatus.BAD_REQUEST, "현재 비밀번호가 올바르지 않습니다."),

    PROJECT_NOT_FOUND(HttpStatus.NOT_FOUND, "프로젝트를 찾을 수 없습니다."),
    PROJECT_ACCESS_DENIED(HttpStatus.FORBIDDEN, "프로젝트에 대한 접근 권한이 없습니다."),
    PROJECT_DUPLICATE_NAME(HttpStatus.CONFLICT, "동일한 이름의 프로젝트가 이미 존재합니다."),
    PROJECT_MEMBER_LIMIT_EXCEEDED(HttpStatus.FORBIDDEN, "플랜의 최대 멤버 수를 초과했습니다."),
    PROJECT_MEMBER_NOT_FOUND(HttpStatus.NOT_FOUND, "팀 멤버를 찾을 수 없습니다."),
    PROJECT_MEMBER_ALREADY_EXISTS(HttpStatus.CONFLICT, "이미 팀 멤버입니다."),

    SESSION_NOT_FOUND(HttpStatus.NOT_FOUND, "분석 세션을 찾을 수 없습니다."),
    SESSION_ALREADY_RUNNING(HttpStatus.CONFLICT, "해당 프로젝트에 진행 중인 분석이 있습니다."),

    VULN_NOT_FOUND(HttpStatus.NOT_FOUND, "취약점을 찾을 수 없습니다."),

    DAST_DOMAIN_NOT_VERIFIED(HttpStatus.FORBIDDEN, "도메인 소유권이 확인되지 않았습니다."),
    DAST_RATE_LIMIT_EXCEEDED(HttpStatus.TOO_MANY_REQUESTS, "도메인별 DAST 횟수를 초과했습니다."),

    GITHUB_AUTH_REQUIRED(HttpStatus.FORBIDDEN, "GitHub 연동이 필요합니다."),
    GITHUB_WEBHOOK_INVALID(HttpStatus.BAD_REQUEST, "Webhook 서명이 유효하지 않습니다."),

    REPORT_NOT_FOUND(HttpStatus.NOT_FOUND, "리포트를 찾을 수 없습니다."),

    INVALID_INPUT(HttpStatus.BAD_REQUEST, "입력값이 유효하지 않습니다."),
    INTERNAL_SERVER_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "서버 내부 오류가 발생했습니다.");

    private final HttpStatus httpStatus;
    private final String message;

    ErrorCode(HttpStatus httpStatus, String message) {
        this.httpStatus = httpStatus;
        this.message = message;
    }
}
