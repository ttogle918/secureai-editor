package io.secureai.backend.domain.dast.service;

import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.secureai.backend.domain.dast.entity.ScanTarget;
import io.secureai.backend.domain.dast.repository.ScanTargetRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;
import javax.naming.Context;
import javax.naming.NamingEnumeration;
import javax.naming.directory.Attribute;
import javax.naming.directory.Attributes;
import javax.naming.directory.DirContext;
import javax.naming.directory.InitialDirContext;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Hashtable;
import java.util.UUID;

/**
 * 도메인 소유권 검증 서비스.
 * DNS TXT 레코드 조회와 HTTP Well-Known 경로 조회 두 가지 방식을 사용하며,
 * 하나만 성공해도 소유권이 확인된 것으로 처리한다.
 */
@Slf4j
@Service
public class DomainVerificationService {

    private static final String RATE_KEY_PREFIX = "secureai:dast:rate:";
    private static final int MAX_SCANS_PER_HOUR = 3;
    private static final long RATE_TTL_SECONDS = 3600L;
    private static final int DNS_TIMEOUT_SECONDS = 10;
    private static final int HTTP_TIMEOUT_MS = 10_000;

    @Value("${secureai.dast.verification-prefix:secureai-verify=}")
    private String verificationPrefix;

    private final ScanTargetRepository scanTargetRepository;
    private final DistributedLockService distributedLockService;
    private final RedisTemplate<String, String> redisTemplate;
    private final RestClient restClient;

    public DomainVerificationService(
            ScanTargetRepository scanTargetRepository,
            DistributedLockService distributedLockService,
            RedisTemplate<String, String> redisTemplate) {
        this.scanTargetRepository = scanTargetRepository;
        this.distributedLockService = distributedLockService;
        this.redisTemplate = redisTemplate;
        this.restClient = buildRestClient();
    }

    /**
     * 도메인에 대한 검증 토큰을 생성하고 저장한다.
     * DNS TXT 레코드: {@code _secureai-verify.{domain} TXT "{token}"}
     *
     * @param projectId 프로젝트 ID
     * @param domain    스캔 대상 도메인
     * @return 생성된 ScanTarget
     */
    @Transactional
    public ScanTarget initVerification(UUID projectId, String domain) {
        return scanTargetRepository.findByProjectIdAndDomain(projectId, domain)
                .orElseGet(() -> {
                    String token = UUID.randomUUID().toString().replace("-", "");
                    ScanTarget target = ScanTarget.builder()
                            .projectId(projectId)
                            .domain(domain)
                            .verificationToken(token)
                            .build();
                    return scanTargetRepository.save(target);
                });
    }

    /**
     * DNS TXT 조회와 HTTP Well-Known 경로 조회로 도메인 소유권을 확인한다.
     * 둘 중 하나만 성공해도 통과한다.
     *
     * @param scanTargetId 검증할 ScanTarget ID
     * @return 소유권 확인 성공 시 true
     * @throws DomainVerificationException ScanTarget을 찾을 수 없는 경우
     */
    @Transactional
    @CircuitBreaker(name = "dnsLookup", fallbackMethod = "verifyFallback")
    public boolean verify(UUID scanTargetId) throws DomainVerificationException {
        ScanTarget target = scanTargetRepository.findById(scanTargetId)
                .orElseThrow(() -> new DomainVerificationException("ScanTarget not found: " + scanTargetId));

        String domain = target.getDomain();
        String token = target.getVerificationToken();

        boolean verified = verifyViaDns(domain, token) || verifyViaHttp(domain, token);

        if (verified) {
            target.markVerified();
            scanTargetRepository.save(target);
            log.info("Domain ownership verified for domain={}", domain);
        } else {
            log.info("Domain ownership verification failed for domain={}", domain);
        }

        return verified;
    }

    @SuppressWarnings("unused")
    private boolean verifyFallback(UUID scanTargetId, Throwable t) {
        log.warn("[circuit] verify fallback triggered scanTargetId={} cause={}", scanTargetId, t.getMessage());
        return false;
    }

    /**
     * DAST 실행 가능 여부를 통합 검증한다.
     * 순서: 소유권 확인 → 면책 동의 확인 → Rate Limit 확인 → 분산 락 획득.
     *
     * @param projectId 프로젝트 ID
     * @param domain    스캔 대상 도메인
     * @param clientIp  요청자 IP (감사 목적으로 전달되며 이 메서드에서는 로그에 출력하지 않음)
     * @throws DomainNotVerifiedException 도메인 소유권 미확인 시 (HTTP 403)
     * @throws ConsentRequiredException   면책 동의 미수령 시 (HTTP 403)
     * @throws RateLimitExceededException Rate Limit 초과 시 (HTTP 429)
     * @throws ConcurrentScanException    분산 락 획득 실패 시 (HTTP 409)
     */
    public void assertDastAllowed(UUID projectId, String domain, String clientIp) {
        assertDomainVerified(projectId, domain);
        assertConsentGiven(projectId, domain);
        assertRateLimit(domain);
        assertDistributedLock(domain);
    }

    private void assertDomainVerified(UUID projectId, String domain) {
        if (!scanTargetRepository.existsByProjectIdAndDomainAndVerifiedTrue(projectId, domain)) {
            throw new DomainNotVerifiedException(domain);
        }
    }

    private void assertConsentGiven(UUID projectId, String domain) {
        scanTargetRepository.findByProjectIdAndDomain(projectId, domain)
                .filter(ScanTarget::isConsentGiven)
                .orElseThrow(() -> new ConsentRequiredException(domain));
    }

    /**
     * Redis INCR + EXPIRE 패턴으로 Rate Limit을 적용한다.
     * getAndSet 방식은 카운터 손실 위험이 있으므로 사용하지 않는다.
     */
    private void assertRateLimit(String domain) {
        String hourBucket = Instant.now().truncatedTo(ChronoUnit.HOURS).toString();
        String key = RATE_KEY_PREFIX + domain + ":" + hourBucket;

        Long count = redisTemplate.opsForValue().increment(key);
        if (count != null && count == 1L) {
            redisTemplate.expire(key, Duration.ofSeconds(RATE_TTL_SECONDS));
        }
        if (count != null && count > MAX_SCANS_PER_HOUR) {
            throw new RateLimitExceededException(domain);
        }
    }

    private void assertDistributedLock(String domain) {
        if (!distributedLockService.tryAcquire(domain)) {
            throw new ConcurrentScanException(domain);
        }
    }

    /**
     * DNS TXT 레코드를 통해 도메인 소유권을 확인한다.
     * 조회 대상: {@code _secureai-verify.{domain}}
     * JDK 내장 JNDI DNS를 사용하여 외부 의존성 없이 TXT 레코드를 조회한다.
     * 오류 발생 시 false를 반환하여 HTTP 확인으로 폴백한다.
     */
    private boolean verifyViaDns(String domain, String token) {
        String lookupName = "_secureai-verify." + domain;
        try {
            Hashtable<String, String> env = new Hashtable<>();
            env.put(Context.INITIAL_CONTEXT_FACTORY, "com.sun.jndi.dns.DnsContextFactory");
            env.put(Context.PROVIDER_URL, "dns:");
            env.put("com.sun.jndi.dns.timeout.initial", String.valueOf(DNS_TIMEOUT_SECONDS * 1000));
            env.put("com.sun.jndi.dns.timeout.retries", "1");

            DirContext ctx = new InitialDirContext(env);
            Attributes attrs = ctx.getAttributes(lookupName, new String[]{"TXT"});
            Attribute txtAttr = attrs.get("TXT");

            if (txtAttr == null) {
                log.debug("No TXT records found for name={}", lookupName);
                return false;
            }

            NamingEnumeration<?> values = txtAttr.getAll();
            while (values.hasMore()) {
                if (values.next().toString().contains(token)) {
                    return true;
                }
            }
            return false;

        } catch (Exception e) {
            log.warn("DNS lookup failed for name={}, falling back to HTTP verification. error={}",
                    lookupName, e.getMessage());
            return false;
        }
    }

    /**
     * HTTP Well-Known 경로를 통해 도메인 소유권을 확인한다.
     * 요청 URL: {@code http://{domain}/.well-known/secureai-verify}
     */
    private boolean verifyViaHttp(String domain, String token) {
        String url = "http://" + domain + "/.well-known/secureai-verify";
        try {
            String body = restClient.get()
                    .uri(url)
                    .retrieve()
                    .body(String.class);

            boolean matched = body != null && body.contains(token);
            if (!matched) {
                log.debug("HTTP verification token not found in response from url={}", url);
            }
            return matched;

        } catch (Exception e) {
            log.warn("HTTP verification failed for url={} error={}", url, e.getMessage());
            return false;
        }
    }

    private static RestClient buildRestClient() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(HTTP_TIMEOUT_MS);
        factory.setReadTimeout(HTTP_TIMEOUT_MS);
        return RestClient.builder()
                .requestFactory(factory)
                .build();
    }
}
