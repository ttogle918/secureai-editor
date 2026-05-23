package io.secureai.backend.domain.dast.service;

import com.github.dockerjava.api.DockerClient;
import com.github.dockerjava.core.DefaultDockerClientConfig;
import com.github.dockerjava.core.DockerClientImpl;
import com.github.dockerjava.httpclient5.ApacheDockerHttpClient;
import com.github.dockerjava.transport.DockerHttpClient;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.net.URI;

@Configuration
public class DockerClientConfig {

    // DOCKER_HOST 환경변수로 오버라이드 가능 (Windows: tcp://host.docker.internal:2375)
    private static final String DEFAULT_DOCKER_HOST = "unix:///var/run/docker.sock";

    @Bean
    public DockerClient dockerClient() {
        String dockerHost = System.getenv().getOrDefault("DOCKER_HOST", DEFAULT_DOCKER_HOST);
        com.github.dockerjava.core.DockerClientConfig config =
                DefaultDockerClientConfig.createDefaultConfigBuilder()
                        .withDockerHost(dockerHost)
                        .build();
        DockerHttpClient httpClient = new ApacheDockerHttpClient.Builder()
                .dockerHost(URI.create(dockerHost))
                .build();
        return DockerClientImpl.getInstance(config, httpClient);
    }
}
