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
    AUTH_OAUTH_STATE_INVALID(HttpStatus.BAD_REQUEST, "유효하지 않은 OAuth state 파라미터입니다. CSRF 공격이 의심됩니다."),
    AUTH_OAUTH_CODE_INVALID(HttpStatus.BAD_REQUEST, "유효하지 않거나 만료된 OAuth 인증 코드입니다."),

    PLAN_FEATURE_NOT_ALLOWED(HttpStatus.FORBIDDEN, "현재 플랜에서 지원하지 않는 기능입니다."),
    PLAN_LIMIT_EXCEEDED(HttpStatus.FORBIDDEN, "월별 사용 한도를 초과했습니다."),
    TOKEN_LIMIT_EXCEEDED(HttpStatus.FORBIDDEN, "이번 달 토큰 사용 한도를 초과했습니다. BYOK를 사용하면 한도 없이 분석할 수 있습니다."),

    RATE_LIMIT_EXCEEDED(HttpStatus.TOO_MANY_REQUESTS, "API 호출 횟수를 초과했습니다."),

    USER_NOT_FOUND(HttpStatus.NOT_FOUND, "사용자를 찾을 수 없습니다."),
    USER_INVALID_PASSWORD(HttpStatus.BAD_REQUEST, "현재 비밀번호가 올바르지 않습니다."),
    TOTP_INVALID_CODE(HttpStatus.BAD_REQUEST, "유효하지 않은 인증 코드입니다."),
    TOTP_NOT_SETUP(HttpStatus.BAD_REQUEST, "2단계 인증이 설정되어 있지 않습니다."),
    TOTP_ALREADY_ENABLED(HttpStatus.CONFLICT, "2단계 인증이 이미 활성화되어 있습니다."),

    PROJECT_NOT_FOUND(HttpStatus.NOT_FOUND, "프로젝트를 찾을 수 없습니다."),
    PROJECT_ACCESS_DENIED(HttpStatus.FORBIDDEN, "프로젝트에 대한 접근 권한이 없습니다."),
    PROJECT_DUPLICATE_NAME(HttpStatus.CONFLICT, "동일한 이름의 프로젝트가 이미 존재합니다."),
    PROJECT_MEMBER_LIMIT_EXCEEDED(HttpStatus.FORBIDDEN, "플랜의 최대 멤버 수를 초과했습니다."),
    PROJECT_MEMBER_NOT_FOUND(HttpStatus.NOT_FOUND, "팀 멤버를 찾을 수 없습니다."),
    PROJECT_MEMBER_ALREADY_EXISTS(HttpStatus.CONFLICT, "이미 팀 멤버입니다."),

    SESSION_NOT_FOUND(HttpStatus.NOT_FOUND, "분석 세션을 찾을 수 없습니다."),
    USER_SESSION_NOT_FOUND(HttpStatus.NOT_FOUND, "세션을 찾을 수 없습니다."),
    USER_SESSION_ACCESS_DENIED(HttpStatus.FORBIDDEN, "해당 세션에 대한 접근 권한이 없습니다."),
    SESSION_ALREADY_RUNNING(HttpStatus.CONFLICT, "해당 프로젝트에 진행 중인 분석이 있습니다."),
    SESSION_NOT_RESUMABLE(HttpStatus.CONFLICT, "재개하거나 취소할 수 없는 상태의 세션입니다."),
    /** STAGE-2: 이미 실행 중이거나 완료된 세션에 재컨펌 시도. */
    SESSION_ALREADY_CONFIRMED(HttpStatus.CONFLICT, "이미 컨펌되거나 실행 중인 세션입니다."),
    /** STAGE-2: 컨펌 대기 상태가 아닌 세션에 컨펌 시도. */
    SESSION_NOT_AWAITING_CONFIRMATION(HttpStatus.CONFLICT, "컨펌 대기 중인 세션이 아닙니다."),

    AI_AGENT_UNAVAILABLE(HttpStatus.SERVICE_UNAVAILABLE, "AI 분석 서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요."),

    VULN_NOT_FOUND(HttpStatus.NOT_FOUND, "취약점을 찾을 수 없습니다."),
    PROGRESS_LOG_NOT_FOUND(HttpStatus.NOT_FOUND, "진행 로그를 찾을 수 없습니다."),

    DAST_DOMAIN_NOT_VERIFIED(HttpStatus.FORBIDDEN, "도메인 소유권이 확인되지 않았습니다."),
    DAST_CONSENT_REQUIRED(HttpStatus.FORBIDDEN, "DAST 실행 전 면책 동의가 필요합니다."),
    DAST_RATE_LIMIT_EXCEEDED(HttpStatus.TOO_MANY_REQUESTS, "도메인별 DAST 횟수를 초과했습니다."),
    DAST_CONCURRENT_SCAN(HttpStatus.CONFLICT, "해당 도메인에 이미 진행 중인 DAST가 있습니다."),

    GITHUB_AUTH_REQUIRED(HttpStatus.FORBIDDEN, "GitHub 연동이 필요합니다."),
    GITHUB_WEBHOOK_INVALID(HttpStatus.BAD_REQUEST, "Webhook 서명이 유효하지 않습니다."),

    EMAIL_WEBHOOK_INVALID(HttpStatus.UNAUTHORIZED, "이메일 웹훅 서명이 유효하지 않습니다."),
    GITHUB_REPO_NOT_FOUND(HttpStatus.NOT_FOUND, "GitHub 레포지토리를 찾을 수 없습니다."),
    INVALID_GITHUB_URL(HttpStatus.BAD_REQUEST, "유효하지 않은 GitHub URL 형식입니다."),
    GITHUB_RATE_LIMIT_EXCEEDED(HttpStatus.TOO_MANY_REQUESTS, "GitHub API 호출 횟수를 초과했습니다. 잠시 후 다시 시도해주세요."),
    GITHUB_APP_AUTH_FAILED(HttpStatus.UNAUTHORIZED, "GitHub App 인증에 실패했습니다."),

    PATCH_NOT_FOUND(HttpStatus.NOT_FOUND, "패치 제안을 찾을 수 없습니다."),
    PATCH_ACCESS_DENIED(HttpStatus.FORBIDDEN, "해당 패치에 대한 접근 권한이 없습니다."),
    PATCH_BRANCH_CONFLICT(HttpStatus.CONFLICT, "동일한 브랜치명이 이미 존재합니다."),
    PATCH_CONTENT_UNAVAILABLE(HttpStatus.UNPROCESSABLE_ENTITY, "패치를 안전하게 적용할 수 없습니다. 원본 코드 구간을 찾지 못했습니다."),

    REPORT_NOT_FOUND(HttpStatus.NOT_FOUND, "리포트를 찾을 수 없습니다."),
    SECURITY_DOC_NOT_FOUND(HttpStatus.NOT_FOUND, "보안 문서 요청을 찾을 수 없습니다."),
    SECURITY_DOC_TOKEN_EXPIRED(HttpStatus.GONE, "다운로드 토큰이 만료되었습니다."),
    SECURITY_DOC_NOT_COMPLETED(HttpStatus.CONFLICT, "보안 문서 생성이 완료되지 않았습니다."),

    ADMIN_SELF_MODIFICATION_DENIED(HttpStatus.FORBIDDEN, "자기 자신의 플랜 또는 상태를 변경할 수 없습니다."),
    ADMIN_PLAN_NOT_FOUND(HttpStatus.NOT_FOUND, "플랜을 찾을 수 없습니다."),
    ADMIN_CREDIT_DELTA_INVALID(HttpStatus.BAD_REQUEST, "크레딧 delta 범위가 유효하지 않습니다."),

    ORG_NOT_FOUND(HttpStatus.NOT_FOUND, "조직을 찾을 수 없습니다."),
    ORG_ACCESS_DENIED(HttpStatus.FORBIDDEN, "조직에 대한 접근 권한이 없습니다."),
    ORG_ALREADY_MEMBER(HttpStatus.CONFLICT, "이미 조직 멤버입니다."),
    ORG_SLUG_DUPLICATE(HttpStatus.CONFLICT, "이미 사용 중인 조직 슬러그입니다."),
    INVITATION_NOT_FOUND(HttpStatus.NOT_FOUND, "초대를 찾을 수 없습니다."),
    INVITATION_EXPIRED(HttpStatus.GONE, "만료된 초대입니다."),

    IP_BLOCKED(HttpStatus.FORBIDDEN, "허용되지 않은 IP 주소에서의 접근입니다."),
    INVALID_CIDR_FORMAT(HttpStatus.BAD_REQUEST, "유효하지 않은 CIDR 형식입니다."),

    INVALID_INPUT(HttpStatus.BAD_REQUEST, "입력값이 유효하지 않습니다."),
    INTERNAL_SERVER_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "서버 내부 오류가 발생했습니다.");

    private final HttpStatus httpStatus;
    private final String message;

    ErrorCode(HttpStatus httpStatus, String message) {
        this.httpStatus = httpStatus;
        this.message = message;
    }
}
