package io.secureai.backend.domain.analysis.service;

import io.secureai.backend.domain.user.entity.User;
import io.secureai.backend.domain.user.repository.UserRepository;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * GitHub URL 파싱 + 사용자 토큰 복호화 + 레포 접근 검증을 담당한다(SRP).
 *
 * 실제 HTTP 호출은 GitHubRestClient에 위임한다(DIP — 구체 구현 분리).
 * JPA @Convert(AesEncryptionConverter)로 githubToken은 DB 조회 시 자동 복호화된다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class GitHubApiService {

    private final UserRepository userRepository;
    private final GitHubRestClient gitHubRestClient;

    /**
     * GitHub URL에서 owner/repo를 파싱하고 사용자의 암호화된 토큰을 복호화해 검증한다.
     *
     * @param userId   요청 사용자 ID
     * @param repoUrl  GitHub 레포지토리 URL (예: "https://github.com/owner/repo")
     * @param ref      branch/tag/commit (nullable)
     * @return GithubRepoInfo — owner, repo, ref, token(nullable)
     */
    @Transactional(readOnly = true)
    public GithubRepoInfo resolveAndValidate(UUID userId, String repoUrl, String ref) {
        String[] ownerRepo = parseOwnerRepo(repoUrl);
        String owner = ownerRepo[0];
        String repo = ownerRepo[1];

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));

        // JPA @Convert(AesEncryptionConverter) 가 자동 복호화 — 복호화된 값을 그대로 사용
        String token = user.getGithubToken();

        if (token != null) {
            // 토큰이 있으면 접근 가능 여부 확인 (토큰은 로그에 출력 금지)
            gitHubRestClient.validateRepoAccess(owner, repo, token);
        } else {
            // 토큰 없음 → 공개 레포로 가정, 접근 불가 시 GITHUB_AUTH_REQUIRED 발생
            log.info("[github-api] no github token for userId={}, treating repo as public", userId);
        }

        log.info("[github-api] resolved owner={} repo={} ref={}", owner, repo, ref);
        return new GithubRepoInfo(owner, repo, ref, token);
    }

    /**
     * GitHub URL에서 owner와 repo 이름을 추출한다.
     *
     * 지원 형식:
     * - "https://github.com/owner/repo"
     * - "https://github.com/owner/repo.git"
     * - "http://github.com/owner/repo"
     *
     * @throws BusinessException INVALID_GITHUB_URL — 형식이 맞지 않는 URL
     */
    static String[] parseOwnerRepo(String repoUrl) {
        if (repoUrl == null || repoUrl.isBlank()) {
            throw new BusinessException(ErrorCode.INVALID_GITHUB_URL);
        }

        String normalized = repoUrl.trim()
                .replaceAll("^https?://github\\.com/", "")
                .replaceAll("\\.git$", "");

        String[] parts = normalized.split("/");
        if (parts.length < 2 || parts[0].isBlank() || parts[1].isBlank()) {
            throw new BusinessException(ErrorCode.INVALID_GITHUB_URL);
        }

        return new String[]{parts[0], parts[1]};
    }

    public record GithubRepoInfo(String owner, String repo, String ref, String token) {}
}
