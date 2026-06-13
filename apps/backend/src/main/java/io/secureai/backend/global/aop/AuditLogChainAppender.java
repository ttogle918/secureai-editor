package io.secureai.backend.global.aop;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.util.concurrent.locks.ReentrantLock;

/**
 * 감사 로그 해시 체인 append 직렬화 컴포넌트.
 *
 * 왜 ReentrantLock인가:
 * Java 21 Virtual Threads 환경에서 {@code synchronized}를 사용하면
 * monitor 진입 시 carrier thread가 pinning되어 다른 virtual thread가 실행되지 못한다.
 * ReentrantLock은 JEP 444(Virtual Threads)와 호환되는 비 pinning 방식이므로
 * Virtual Threads 환경에서 안전하게 단일 라이터(single-writer)를 구현할 수 있다.
 *
 * 흐름:
 * 1. ReentrantLock으로 JVM 내 동시 append를 직렬화
 * 2. REPEATABLE_READ 트랜잭션 내에서 FOR UPDATE 비관적 락으로 직전 행을 읽음
 * 3. prev_hash 결정 → SHA-256 계산 → prevHash/currentHash 포함 엔트리 저장
 * 4. 락 범위는 최소화 — 저장 완료 후 즉시 락 해제
 * 5. 실패 시 원래 요청에 영향 없도록 AuditLogAspect의 try-catch가 격리
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AuditLogChainAppender {

    private final AuditLogRepository auditLogRepository;
    private final AuditLogHashService hashService;

    /** JVM 내 단일 라이터 보장용 락. Virtual Threads pinning 회피를 위해 ReentrantLock 사용. */
    private final ReentrantLock chainLock = new ReentrantLock();

    /**
     * 해시 체인에 새 엔트리를 추가한다.
     * ReentrantLock + REPEATABLE_READ + FOR UPDATE 비관적 락으로 순서를 보장한다.
     *
     * @param draft prev_hash/current_hash가 아직 설정되지 않은 엔트리 (createdAt 포함)
     */
    @Transactional(isolation = Isolation.REPEATABLE_READ)
    public void append(AuditLogEntry draft) {
        chainLock.lock();
        try {
            appendUnderLock(draft);
        } finally {
            chainLock.unlock();
        }
    }

    private void appendUnderLock(AuditLogEntry draft) {
        // FOR UPDATE 비관적 락으로 직전 행 조회 — 다른 트랜잭션의 동시 INSERT 차단
        String prevHash = auditLogRepository.findLatestWithHashForUpdate()
                .map(AuditLogEntry::getCurrentHash)
                .orElse(AuditLogHashService.GENESIS_PREV_HASH);

        String currentHash = hashService.compute(prevHash, draft);

        AuditLogEntry entry = AuditLogEntry.builder()
                .actorId(draft.getActorId())
                .action(draft.getAction())
                .resource(draft.getResource())
                .ipAddress(draft.getIpAddress())
                .outcome(draft.getOutcome())
                .createdAt(draft.getCreatedAt())
                .prevHash(prevHash)
                .currentHash(currentHash)
                .build();

        auditLogRepository.save(entry);
    }
}
