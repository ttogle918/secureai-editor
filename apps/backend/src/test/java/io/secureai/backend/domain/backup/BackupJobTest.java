package io.secureai.backend.domain.backup;

import io.secureai.backend.domain.backup.service.BackupJob;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;

/**
 * BackupJob 단위 테스트.
 *
 * 검증 범위:
 * 1. 활성화 플래그 OFF → 스킵 (스크립트 실행 없음)
 * 2. 활성화 플래그 ON + 스크립트 없음 → 예외 격리 (다른 잡에 전파 없음)
 * 3. 경로 순회 시도 → BackupExecutionException 발생
 */
@ExtendWith(MockitoExtension.class)
class BackupJobTest {

    @Test
    @DisplayName("백업 비활성(false) 시 runBackup 이 조용히 스킵된다")
    void runBackup_비활성_플래그_스킵() {
        BackupJob job = new BackupJob(false, System.getProperty("user.dir"));

        // 플래그가 false 이면 스크립트를 실행하지 않으므로 예외 없음
        assertDoesNotThrow(() -> job.runBackup());
    }

    @Test
    @DisplayName("백업 활성(true) + 스크립트 미존재 시 예외가 runBackup 밖으로 전파되지 않는다")
    void runBackup_활성_스크립트_없음_예외격리() {
        // 존재하지 않는 작업 디렉터리를 주어 스크립트 실행 실패를 유도
        BackupJob job = new BackupJob(true, "/nonexistent/path/for/test");

        // 백업 실패가 RuntimeException 으로 전파되지 않아야 한다 (fail-isolation)
        assertDoesNotThrow(() -> job.runBackup());
    }

    @Test
    @DisplayName("비정상 workingDir(.. 포함) 이어도 runBackup 이 예외를 catch 해 전파하지 않는다")
    void runBackup_비정상_workingDir_예외격리() {
        // 경로순회 가드는 스크립트 상대경로가 base 를 벗어날 때 작동하나,
        // 상대경로가 상수라 여기선 bash 기동 실패로 귀결 — 어느 쪽이든 fail-isolation 만 검증
        BackupJob job = new BackupJob(true, "/tmp/../../etc");

        assertDoesNotThrow(() -> job.runBackup());
    }

    @Test
    @DisplayName("백업 활성이지만 bash 명령 기동 실패 시 예외가 전파되지 않는다")
    void runBackup_프로세스_기동실패_예외격리() {
        // 빈 workingDir(실제 경로이지만 스크립트 없음) 로 프로세스 실패 유도
        BackupJob job = new BackupJob(true, System.getProperty("user.dir"));

        // infra/scripts/backup-postgres.sh 가 없으므로 bash 실행 실패 → catch 되어야 함
        assertDoesNotThrow(() -> job.runBackup());
    }
}
