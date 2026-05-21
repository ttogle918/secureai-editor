package io.secureai.backend.config;

import io.micrometer.tracing.Tracer;
import io.micrometer.tracing.otel.bridge.OtelCurrentTraceContext;
import io.micrometer.tracing.otel.bridge.OtelPropagator;
import io.micrometer.tracing.otel.bridge.OtelTracer;
import io.micrometer.tracing.propagation.Propagator;
import io.opentelemetry.api.OpenTelemetry;
import io.opentelemetry.context.propagation.ContextPropagators;
import io.opentelemetry.exporter.otlp.http.trace.OtlpHttpSpanExporter;
import io.opentelemetry.api.trace.propagation.W3CTraceContextPropagator;
import io.opentelemetry.sdk.OpenTelemetrySdk;
import io.opentelemetry.sdk.resources.Resource;
import io.opentelemetry.sdk.trace.SdkTracerProvider;
import io.opentelemetry.sdk.trace.export.BatchSpanProcessor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

// Spring Boot 4.0에서 OTel 트레이싱 자동구성이 분리됨 — Micrometer 브리지까지 수동 연결
@Configuration
@ConditionalOnClass(OtlpHttpSpanExporter.class)
public class OtelConfig {

    @Value("${management.otlp.tracing.endpoint:http://localhost:4318/v1/traces}")
    private String otlpEndpoint;

    @Value("${spring.application.name:secureai-backend}")
    private String serviceName;

    @Bean
    @ConditionalOnMissingBean
    public OtlpHttpSpanExporter otlpHttpSpanExporter() {
        return OtlpHttpSpanExporter.builder()
                .setEndpoint(otlpEndpoint)
                .build();
    }

    @Bean
    @ConditionalOnMissingBean
    public SdkTracerProvider sdkTracerProvider(OtlpHttpSpanExporter spanExporter) {
        Resource resource = Resource.getDefault().merge(
                Resource.create(io.opentelemetry.api.common.Attributes.of(
                        io.opentelemetry.semconv.ServiceAttributes.SERVICE_NAME, serviceName
                ))
        );
        return SdkTracerProvider.builder()
                .setResource(resource)
                .addSpanProcessor(BatchSpanProcessor.builder(spanExporter).build())
                .build();
    }

    @Bean
    @ConditionalOnMissingBean(OpenTelemetry.class)
    public OpenTelemetry openTelemetry(SdkTracerProvider tracerProvider) {
        return OpenTelemetrySdk.builder()
                .setTracerProvider(tracerProvider)
                .setPropagators(ContextPropagators.create(W3CTraceContextPropagator.getInstance()))
                .buildAndRegisterGlobal();
    }

    @Bean
    @ConditionalOnMissingBean
    public OtelCurrentTraceContext otelCurrentTraceContext() {
        return new OtelCurrentTraceContext();
    }

    // MicrometerTracingAutoConfiguration이 찾는 Tracer 빈 — OtelTracer 3-arg constructor 사용
    @Bean
    @ConditionalOnMissingBean(Tracer.class)
    public Tracer otelTracer(OpenTelemetry openTelemetry, OtelCurrentTraceContext currentTraceContext) {
        io.opentelemetry.api.trace.Tracer apiTracer = openTelemetry.getTracer(serviceName);
        return new OtelTracer(apiTracer, currentTraceContext, event -> {});
    }

    @Bean
    @ConditionalOnMissingBean(Propagator.class)
    public Propagator otelPropagator(OpenTelemetry openTelemetry) {
        io.opentelemetry.api.trace.Tracer apiTracer = openTelemetry.getTracer(serviceName);
        return new OtelPropagator(openTelemetry.getPropagators(), apiTracer);
    }
}
