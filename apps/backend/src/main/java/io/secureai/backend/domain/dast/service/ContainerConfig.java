package io.secureai.backend.domain.dast.service;

/**
 * Docker 컨테이너 실행 설정 값 객체.
 * networkMode는 보안 격리를 위해 반드시 "dast-isolated-net"을 사용해야 한다.
 */
public record ContainerConfig(
        String image,
        String networkMode,
        long memoryLimitBytes,
        int cpuQuota,
        long timeoutSeconds,
        boolean readOnlyRootFs
) {

    private static final String REQUIRED_NETWORK = "dast-isolated-net";

    public ContainerConfig {
        // 보안: host 네트워크 또는 임의 네트워크 격리 우회 방지
        if (!REQUIRED_NETWORK.equals(networkMode)) {
            throw new IllegalArgumentException(
                    "networkMode must be '" + REQUIRED_NETWORK + "' for DAST isolation. Received: " + networkMode
            );
        }
    }

    public static ContainerConfig defaultConfig() {
        return new ContainerConfig(
                "python:3.12-slim",
                "dast-isolated-net",
                512 * 1024 * 1024L,
                50000,
                300L,
                true
        );
    }
}
