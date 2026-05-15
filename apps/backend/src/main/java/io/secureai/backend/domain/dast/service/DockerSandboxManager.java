package io.secureai.backend.domain.dast.service;

import com.github.dockerjava.api.DockerClient;
import com.github.dockerjava.api.async.ResultCallback;
import com.github.dockerjava.api.command.CreateContainerResponse;
import com.github.dockerjava.api.command.WaitContainerResultCallback;
import com.github.dockerjava.api.model.Capability;
import com.github.dockerjava.api.model.Frame;
import com.github.dockerjava.api.model.HostConfig;
import io.secureai.backend.domain.dast.entity.ScanStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * Docker 컨테이너 생명주기를 관리한다.
 * 보안: 모든 컨테이너는 dast-isolated-net 네트워크에서만 실행되며
 * privileged 모드와 볼륨 마운트가 비활성화된다.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class DockerSandboxManager {

    private static final int MAX_LOG_BYTES = 10_000;

    private final DockerClient dockerClient;

    /**
     * 컨테이너를 생성하고 시작한다.
     *
     * @param config  컨테이너 설정 (networkMode 검증 포함)
     * @param command 실행할 명령
     * @return 생성된 컨테이너 ID
     */
    public String createAndStart(ContainerConfig config, List<String> command, List<String> envVars) {
        HostConfig hostConfig = buildSecureHostConfig(config);

        CreateContainerResponse container = dockerClient.createContainerCmd(config.image())
                .withCmd(command)
                .withEnv(envVars)
                .withHostConfig(hostConfig)
                .exec();

        String containerId = container.getId();
        log.info("DAST container created: {}", containerId);

        dockerClient.startContainerCmd(containerId).exec();
        log.info("DAST container started: {}", containerId);

        return containerId;
    }

    /**
     * 컨테이너 실행 완료를 대기한다.
     * timeoutSeconds 초과 시 컨테이너를 강제 종료하고 DockerSandboxException(TIMEOUT)을 던진다.
     *
     * @param containerId    대기할 컨테이너 ID
     * @param timeoutSeconds 대기 제한 시간
     * @return 컨테이너 종료 코드
     */
    public int waitForExit(String containerId, long timeoutSeconds) {
        try {
            Integer exitCode = dockerClient.waitContainerCmd(containerId)
                    .exec(new WaitContainerResultCallback())
                    .awaitStatusCode(timeoutSeconds, TimeUnit.SECONDS);

            log.info("DAST container exited: containerId={}, exitCode={}", containerId, exitCode);
            return exitCode != null ? exitCode : -1;

        } catch (Exception e) {
            log.error("DAST container timed out or failed: containerId={}", containerId);
            forceRemove(containerId);
            throw new DockerSandboxException(
                    "Container execution timed out after " + timeoutSeconds + "s: " + containerId,
                    ScanStatus.TIMEOUT,
                    e
            );
        }
    }

    /**
     * 컨테이너의 stdout + stderr 로그를 수집한다 (최대 10000자).
     *
     * @param containerId 로그를 수집할 컨테이너 ID
     * @return 수집된 로그 문자열
     */
    public String collectLogs(String containerId) {
        ByteArrayOutputStream outputStream = new ByteArrayOutputStream();

        try {
            dockerClient.logContainerCmd(containerId)
                    .withStdOut(true)
                    .withStdErr(true)
                    .withFollowStream(false)
                    .exec(new ResultCallback.Adapter<Frame>() {
                        @Override
                        public void onNext(Frame frame) {
                            try {
                                byte[] payload = frame.getPayload();
                                if (outputStream.size() + payload.length <= MAX_LOG_BYTES) {
                                    outputStream.write(payload);
                                } else {
                                    int remaining = MAX_LOG_BYTES - outputStream.size();
                                    if (remaining > 0) {
                                        outputStream.write(payload, 0, remaining);
                                    }
                                }
                            } catch (IOException ex) {
                                log.error("Failed to write container log frame: containerId={}", containerId);
                            }
                        }
                    })
                    .awaitCompletion(30, TimeUnit.SECONDS);

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.error("Log collection interrupted: containerId={}", containerId);
        } catch (Exception e) {
            log.error("Failed to collect logs: containerId={}", containerId);
        }

        return outputStream.toString(StandardCharsets.UTF_8);
    }

    /**
     * 컨테이너를 강제 종료하고 삭제한다.
     *
     * @param containerId 삭제할 컨테이너 ID
     */
    public void forceRemove(String containerId) {
        try {
            dockerClient.killContainerCmd(containerId).exec();
            log.info("DAST container killed: {}", containerId);
        } catch (Exception e) {
            // 이미 종료된 컨테이너는 kill 실패 가능 — 삭제는 계속 진행
            log.warn("Could not kill container (may already be stopped): containerId={}", containerId);
        }

        try {
            dockerClient.removeContainerCmd(containerId)
                    .withForce(true)
                    .withRemoveVolumes(true)
                    .exec();
            log.info("DAST container removed: {}", containerId);
        } catch (Exception e) {
            log.error("Failed to remove container: containerId={}", containerId);
        }
    }

    /**
     * 보안 요구사항이 강제 적용된 HostConfig를 생성한다.
     * - 네트워크: dast-isolated-net 고정
     * - privileged: false
     * - 볼륨 마운트: 없음 (Docker Socket 마운트 포함 금지)
     * - 모든 Linux Capability 제거
     */
    private HostConfig buildSecureHostConfig(ContainerConfig config) {
        return HostConfig.newHostConfig()
                .withNetworkMode(config.networkMode())   // ContainerConfig 생성자에서 이미 검증됨
                .withMemory(config.memoryLimitBytes())
                .withCpuQuota((long) config.cpuQuota())
                .withPrivileged(false)
                .withReadonlyRootfs(config.readOnlyRootFs())
                .withCapDrop(Capability.ALL)
                // 볼륨 마운트 없음 — Docker Socket 마운트 포함 금지
                .withBinds();
    }
}
