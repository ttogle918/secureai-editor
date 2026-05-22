package io.secureai.backend.domain.dast.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import io.secureai.backend.domain.analysis.service.AiAgentClient;
import io.secureai.backend.domain.dast.dto.DastExecuteRequest;
import io.secureai.backend.domain.dast.dto.DastExecuteResponse;
import io.secureai.backend.domain.dast.dto.DastStartRequest;
import io.secureai.backend.domain.dast.entity.ExploitResult;
import io.secureai.backend.domain.dast.entity.ScanStatus;
import io.secureai.backend.domain.dast.repository.ExploitResultRepository;
import io.secureai.backend.global.exception.BusinessException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Docker 샌드박스에서 DAST 취약점 익스플로잇을 실행하고 결과를 저장한다.
 * targetUrl, params 는 보안 정책상 로그에 출력하지 않는다.
 * DB 저장 트랜잭션은 ExploitResultPersister 에 위임한다.
 */
@Slf4j
@Service
public class DastExecutionService {

    private static final String DAST_IMAGE = "secureai/dast-runner:latest";
    private static final long TIMEOUT_SECONDS = 300L;

    private final DockerSandboxManager dockerSandboxManager;
    private final ExploitResultPersister exploitResultPersister;
    private final ExploitResultRepository exploitResultRepository;
    private final ObjectMapper objectMapper;
    private final AiAgentClient aiAgentClient;
    private final Timer dastDurationTimer;

    public DastExecutionService(
            DockerSandboxManager dockerSandboxManager,
            ExploitResultPersister exploitResultPersister,
            ExploitResultRepository exploitResultRepository,
            ObjectMapper objectMapper,
            AiAgentClient aiAgentClient,
            MeterRegistry registry) {
        this.dockerSandboxManager = dockerSandboxManager;
        this.exploitResultPersister = exploitResultPersister;
        this.exploitResultRepository = exploitResultRepository;
        this.objectMapper = objectMapper;
        this.aiAgentClient = aiAgentClient;
        this.dastDurationTimer = Timer.builder("secureai_dast_duration_seconds")
                .description("DAST sandbox execution duration")
                .publishPercentileHistogram()
                .register(registry);
    }

    /**
     * DAST 분석을 AI Engine에 위임한다. Controller는 이 메서드만 호출한다.
     * targetUrl, params 는 로그에 출력하지 않는다.
     *
     * @throws BusinessException AI_AGENT_UNAVAILABLE — AI Engine 호출 실패
     */
    public void initiateDastScan(DastStartRequest req) {
        aiAgentClient.startDast(
                req.sessionId(),
                req.vulnId(),
                req.vulnType(),
                req.targetUrl(),
                req.endpoint(),
                req.params()
        );
        log.info("DAST scan delegated to AI Engine: sessionId={} vulnType={}", req.sessionId(), req.vulnType());
    }

    /**
     * 지정된 취약점에 대해 Docker 샌드박스에서 익스플로잇을 실행한다.
     * DB 저장은 ExploitResultPersister 가 트랜잭션으로 처리하며,
     * 컨테이너 실행(최대 300초) 중에는 트랜잭션이 열리지 않는다.
     *
     * @param req 실행 요청 (targetUrl, params 는 로그 금지)
     * @return 실행 결과
     */
    public DastExecuteResponse execute(DastExecuteRequest req) {
        UUID vulnId = parseVulnId(req.vulnId());

        ExploitResult result;
        try {
            result = exploitResultPersister.saveInitial(vulnId, req);
        } catch (Exception e) {
            log.error("DAST initial save failed: vulnType={} error={}", req.vulnType(), e.getMessage());
            return failureResponse("초기 상태 저장 실패: " + e.getMessage(), null);
        }

        ContainerConfig config = buildContainerConfig();
        List<String> command = buildCommand();
        List<String> envVars = buildEnvVars(req);

        String[] containerIdHolder = {null};
        long startMs = System.currentTimeMillis();

        return dastDurationTimer.record(() -> {
            try {
                containerIdHolder[0] = dockerSandboxManager.createAndStart(config, command, envVars);
                log.info("DAST execution started: vulnType={} containerId={}", req.vulnType(), containerIdHolder[0]);

                result.setContainerId(containerIdHolder[0]);
                dockerSandboxManager.waitForExit(containerIdHolder[0], TIMEOUT_SECONDS);

                String logs = dockerSandboxManager.collectLogs(containerIdHolder[0]);
                DastExecuteResponse response = parseOutcome(logs, containerIdHolder[0]);

                long durationMs = System.currentTimeMillis() - startMs;
                exploitResultPersister.saveSuccess(result, response, durationMs);

                log.info("DAST execution completed: vulnType={} success={} containerId={}",
                        req.vulnType(), response.success(), containerIdHolder[0]);
                return response;

            } catch (DockerSandboxException e) {
                long durationMs = System.currentTimeMillis() - startMs;
                safelyPersistFailure(result, e.getStatus(), e.getMessage(), durationMs);
                log.error("DAST sandbox error: vulnType={} status={}", req.vulnType(), e.getStatus());
                return failureResponse(e.getMessage(), containerIdHolder[0]);

            } catch (Exception e) {
                long durationMs = System.currentTimeMillis() - startMs;
                safelyPersistFailure(result, ScanStatus.FAILED, e.getMessage(), durationMs);
                log.warn("DAST execution failed: vulnType={} error={}", req.vulnType(), e.getMessage());
                return failureResponse(e.getMessage(), containerIdHolder[0]);

            } finally {
                if (containerIdHolder[0] != null) {
                    dockerSandboxManager.forceRemove(containerIdHolder[0]);
                }
            }
        });
    }

    // ── private helpers ───────────────────────────────────────────────────────

    private UUID parseVulnId(String vulnId) {
        try {
            return UUID.fromString(vulnId);
        } catch (IllegalArgumentException e) {
            // vulnId 가 UUID 형식이 아닌 경우 새 UUID로 대체 (AI Engine 호환성 보장)
            log.warn("vulnId is not a UUID format, generating new UUID. provided={}", vulnId);
            return UUID.randomUUID();
        }
    }

    private ContainerConfig buildContainerConfig() {
        ContainerConfig defaultConfig = ContainerConfig.defaultConfig();
        return new ContainerConfig(
                DAST_IMAGE,
                defaultConfig.networkMode(),
                defaultConfig.memoryLimitBytes(),
                defaultConfig.cpuQuota(),
                defaultConfig.timeoutSeconds(),
                defaultConfig.readOnlyRootFs()
        );
    }

    /**
     * 사용자 데이터가 전혀 포함되지 않은 정적 Python 스크립트를 명령으로 반환한다.
     * targetUrl, endpoint, params 등 모든 사용자 입력은 buildEnvVars() 를 통해
     * Docker 환경변수로 분리 전달되어 Shell Injection 을 원천 차단한다.
     */
    private List<String> buildCommand() {
        String script = """
                import asyncio, json, os, sys
                sys.path.insert(0, '/app')
                from agent.nodes.dast.dast_runner import run_dast
                result = asyncio.run(run_dast(
                    os.environ['DAST_VULN_TYPE'],
                    os.environ['DAST_ENDPOINT'],
                    os.environ['DAST_TARGET_URL'],
                    json.loads(os.environ.get('DAST_PARAMS', '{}'))
                ))
                print(json.dumps(result))
                """;
        return List.of("python", "-c", script);
    }

    private List<String> buildEnvVars(DastExecuteRequest req) {
        String paramsJson = toJsonString(req.params());
        return List.of(
                "DAST_VULN_TYPE=" + req.vulnType(),
                "DAST_ENDPOINT=" + req.endpoint(),
                "DAST_TARGET_URL=" + req.targetUrl(),
                "DAST_PARAMS=" + paramsJson
        );
    }

    /**
     * 컨테이너 로그에서 마지막 JSON 라인을 파싱하여 실행 결과를 추출한다.
     * 파싱 실패 시 success=false 로 응답한다.
     */
    private DastExecuteResponse parseOutcome(String logs, String containerId) {
        String[] lines = logs.split("\\n");
        for (int i = lines.length - 1; i >= 0; i--) {
            String line = lines[i].trim();
            if (line.startsWith("{")) {
                try {
                    Map<String, Object> parsed = objectMapper.readValue(
                            line, new TypeReference<>() {});
                    return buildResponseFromMap(parsed, containerId);
                } catch (JsonProcessingException e) {
                    log.error("Failed to parse DAST runner JSON output: containerId={}", containerId);
                }
            }
        }
        log.error("No valid JSON output found in DAST container logs: containerId={}", containerId);
        return new DastExecuteResponse(false, null, "log parse failed", null, "log parse failed", containerId);
    }

    private DastExecuteResponse buildResponseFromMap(Map<String, Object> map, String containerId) {
        boolean success = Boolean.TRUE.equals(map.get("success"));
        String payload = (String) map.get("payload");
        String evidence = (String) map.get("evidence");
        String responseSnippet = (String) map.get("response_snippet");
        String error = (String) map.get("error");
        return new DastExecuteResponse(success, payload, evidence, responseSnippet, error, containerId);
    }

    private DastExecuteResponse failureResponse(String errorMessage, String containerId) {
        return new DastExecuteResponse(false, null, null, null, errorMessage, containerId);
    }

    private void safelyPersistFailure(ExploitResult result, ScanStatus status, String message, long durationMs) {
        try {
            exploitResultPersister.saveFailed(result, status, message, durationMs);
        } catch (Exception persistEx) {
            log.error("Failed to persist DAST failure result: {}", persistEx.getMessage());
        }
    }

    private String toJsonString(Map<String, String> params) {
        if (params == null || params.isEmpty()) {
            return "{}";
        }
        try {
            return objectMapper.writeValueAsString(params);
        } catch (JsonProcessingException e) {
            log.error("Failed to serialize params to JSON");
            return "{}";
        }
    }
}
