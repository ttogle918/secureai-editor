package io.secureai.backend.global.security;

import io.secureai.backend.domain.user.service.UserSessionService;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class JwtAuthenticationFilterBlacklistTest {

    @Mock TokenService tokenService;
    @Mock UserSessionService userSessionService;
    @Mock FilterChain filterChain;

    @InjectMocks JwtAuthenticationFilter filter;

    private static final String VALID_TOKEN = "valid.jwt.token";
    private static final String JTI = "test-jti-xyz";
    private static final UUID USER_ID = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("블랙리스트에 없는 유효한 JWT → 인증 성공")
    void validToken_notBlacklisted_setsAuthentication() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer " + VALID_TOKEN);
        MockHttpServletResponse response = new MockHttpServletResponse();

        when(tokenService.isValid(VALID_TOKEN)).thenReturn(true);
        when(tokenService.extractJti(VALID_TOKEN)).thenReturn(JTI);
        when(userSessionService.isJtiBlacklisted(JTI)).thenReturn(false);
        when(tokenService.extractUserId(VALID_TOKEN)).thenReturn(USER_ID);

        filter.doFilter(request, response, filterChain);

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNotNull();
        assertThat(SecurityContextHolder.getContext().getAuthentication().getPrincipal())
                .isEqualTo(USER_ID);
        verify(filterChain).doFilter(request, response);
    }

    @Test
    @DisplayName("블랙리스트에 있는 JWT → 인증 거부 (Authentication null)")
    void blacklistedToken_blocksAuthentication() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer " + VALID_TOKEN);
        MockHttpServletResponse response = new MockHttpServletResponse();

        when(tokenService.isValid(VALID_TOKEN)).thenReturn(true);
        when(tokenService.extractJti(VALID_TOKEN)).thenReturn(JTI);
        when(userSessionService.isJtiBlacklisted(JTI)).thenReturn(true);

        filter.doFilter(request, response, filterChain);

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verify(tokenService, never()).extractUserId(anyString());
        verify(filterChain).doFilter(request, response);
    }

    @Test
    @DisplayName("유효하지 않은 JWT → 인증 거부")
    void invalidToken_noAuthentication() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer invalid.token");
        MockHttpServletResponse response = new MockHttpServletResponse();

        when(tokenService.isValid("invalid.token")).thenReturn(false);

        filter.doFilter(request, response, filterChain);

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verify(filterChain).doFilter(request, response);
    }
}
