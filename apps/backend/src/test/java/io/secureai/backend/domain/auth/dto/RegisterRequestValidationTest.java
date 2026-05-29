package io.secureai.backend.domain.auth.dto;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/** TASK-1104 — 회원가입 동의(@AssertTrue) 검증. 동의 미체크 시 제약 위반(=400)이 발생하는지 확인. */
class RegisterRequestValidationTest {

    private static ValidatorFactory factory;
    private static Validator validator;

    @BeforeAll
    static void init() {
        factory = Validation.buildDefaultValidatorFactory();
        validator = factory.getValidator();
    }

    @AfterAll
    static void close() {
        factory.close();
    }

    private RegisterRequest newRequest(boolean terms, boolean privacy) {
        RegisterRequest r = new RegisterRequest();
        ReflectionTestUtils.setField(r, "email", "dev@example.com");
        ReflectionTestUtils.setField(r, "password", "Abcd1234");
        ReflectionTestUtils.setField(r, "username", "devuser");
        ReflectionTestUtils.setField(r, "termsAgreed", terms);
        ReflectionTestUtils.setField(r, "privacyAgreed", privacy);
        return r;
    }

    @Test
    @DisplayName("이용약관 미동의 시 termsAgreed 제약 위반이 발생한다")
    void termsNotAgreed_violation() {
        Set<ConstraintViolation<RegisterRequest>> v = validator.validate(newRequest(false, true));
        assertThat(v).anyMatch(c -> c.getPropertyPath().toString().equals("termsAgreed"));
    }

    @Test
    @DisplayName("개인정보처리방침 미동의 시 privacyAgreed 제약 위반이 발생한다")
    void privacyNotAgreed_violation() {
        Set<ConstraintViolation<RegisterRequest>> v = validator.validate(newRequest(true, false));
        assertThat(v).anyMatch(c -> c.getPropertyPath().toString().equals("privacyAgreed"));
    }

    @Test
    @DisplayName("필수 2개 모두 동의 시 동의 관련 위반이 없다")
    void bothAgreed_noConsentViolation() {
        Set<ConstraintViolation<RegisterRequest>> v = validator.validate(newRequest(true, true));
        assertThat(v).noneMatch(c -> {
            String p = c.getPropertyPath().toString();
            return p.equals("termsAgreed") || p.equals("privacyAgreed");
        });
    }
}
