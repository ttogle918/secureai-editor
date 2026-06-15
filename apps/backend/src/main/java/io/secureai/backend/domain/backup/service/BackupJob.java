package io.secureai.backend.domain.backup.service;

import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * 매일 03:00 KST 자동 PostgreSQL 백업 Job.
 *
 * [설계 주석] 백업 실행은 infra/scripts/backup-postgres.sh 에 위임(SRP).
 * 이 Job은 스케줄 트리거·활성화 플래그·프로세스 감시만 담당한다.
 * 백업 실패는 catch 후 로그만 남기고 다른 스케줄 잡에 전파하지 않는다(fail-isolation).
 *
 * BACKUP_ENABLED 환경변수가 "true" 가 아니면 스킵 — 로컬/개발 환경 안전 기동 보장.
 */
@Slf4j
@Component
public class BackupJob {

    private static final String BACKUP_SCRIPT_RELATIVE_PATH = "infra/scripts/backup-postgres.sh";

    private final boolean backupEnabled;
    private final String workingDir;

    public BackupJob(
            @Value("${backup.enabled:false}") boolean backupEnabled,
            @Value("${app.working-dir:#{systemProperties['user.dir']}}") String workingDir
    ) {
        this.backupEnabled = backupEnabled;
        this.workingDir = workingDir;
    }

    @Scheduled(cron = "0 0 3 * * *", zone = "Asia/Seoul")
    @SchedulerLock(name = "backupJob", lockAtMostFor = "PT2H", lockAtLeastFor = "PT5M")
    public void runBackup() {
        if (!backupEnabled) {
            log.info("[backup] BACKUP_ENABLED 비활성 — 백업 스킵");
            return;
        }

        log.info("[backup] 자동 백업 시작");
        try {
            executeBackupScript();
            log.info("[backup] 자동 백업 완료");
        } catch (BackupExecutionException e) {
            // 백업 실패는 이 Job 내에서 격리 — 다른 스케줄 잡에 영향 없음
            log.error("[backup] 자동 백업 실패 — 원인: {}", e.getMessage(), e);
        }
    }

    private void executeBackupScript() throws BackupExecutionException {
        Path scriptPath = resolveScriptPath();

        ProcessBuilder pb = buildProcess(scriptPath);
        pb.redirectErrorStream(true);

        int exitCode;
        try {
            Process process = pb.start();
            logProcessOutput(process);
            exitCode = process.waitFor();
        } catch (Exception e) {
            throw new BackupExecutionException("백업 프로세스 기동 실패: " + e.getMessage(), e);
        }

        if (exitCode != 0) {
            throw new BackupExecutionException("backup-postgres.sh 비정상 종료 (exit=" + exitCode + ")");
        }
    }

    private Path resolveScriptPath() throws BackupExecutionException {
        // 경로 순회 방어: normalize 후 workingDir 하위인지 검증
        Path base = Paths.get(workingDir).toAbsolutePath().normalize();
        Path script = base.resolve(BACKUP_SCRIPT_RELATIVE_PATH).normalize();

        if (!script.startsWith(base)) {
            throw new BackupExecutionException("스크립트 경로가 허용 범위를 벗어났습니다: " + script);
        }
        return script;
    }

    private ProcessBuilder buildProcess(Path scriptPath) {
        ProcessBuilder pb = new ProcessBuilder("bash", scriptPath.toString());
        pb.directory(scriptPath.getParent().toFile());
        return pb;
    }

    private void logProcessOutput(Process process) {
        // 별도 스레드로 프로세스 출력 소비 — 버퍼 차단 방지
        Thread outputReader = Thread.ofVirtual().start(() -> {
            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(process.getInputStream()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    // 민감 정보(비밀번호) 필터링 후 로그 출력
                    if (!containsSensitiveKeyword(line)) {
                        log.info("[backup-script] {}", line);
                    }
                }
            } catch (Exception e) {
                log.warn("[backup] 프로세스 출력 읽기 오류: {}", e.getMessage());
            }
        });
        // 출력 리더 스레드는 백그라운드에서 실행되며 process.getInputStream() EOF 시 자연 종료.
        // waitFor() 이후 스트림이 닫히므로 리더 스레드도 곧 완료된다.
        // (Virtual Thread — JVM 종료를 막지 않음)
        log.debug("[backup] 출력 리더 스레드 시작: {}", outputReader.threadId());
    }

    /**
     * 로그 출력 전 민감 키워드 포함 여부 확인.
     * PGPASSWORD, password, secret, key 계열 문자열이 포함된 줄은 로그 출력 금지.
     */
    private boolean containsSensitiveKeyword(String line) {
        String lower = line.toLowerCase();
        return lower.contains("password") || lower.contains("pgpassword")
                || lower.contains("secret") || lower.contains("access_key");
    }

    /**
     * 백업 실행 중 발생하는 예외.
     * RuntimeException 이 아닌 checked exception 으로 정의하여
     * 호출 측에서 명시적 처리를 강제한다.
     */
    public static class BackupExecutionException extends Exception {
        public BackupExecutionException(String message) {
            super(message);
        }

        public BackupExecutionException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
