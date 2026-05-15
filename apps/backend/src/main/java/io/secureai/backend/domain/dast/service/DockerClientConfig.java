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

    private static final String DOCKER_SOCKET = "unix:///var/run/docker.sock";

    @Bean
    public DockerClient dockerClient() {
        com.github.dockerjava.core.DockerClientConfig config =
                DefaultDockerClientConfig.createDefaultConfigBuilder()
                        .withDockerHost(DOCKER_SOCKET)
                        .build();
        DockerHttpClient httpClient = new ApacheDockerHttpClient.Builder()
                .dockerHost(URI.create(DOCKER_SOCKET))
                .build();
        return DockerClientImpl.getInstance(config, httpClient);
    }
}
