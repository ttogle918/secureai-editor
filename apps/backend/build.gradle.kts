plugins {
	java
	jacoco
	id("org.springframework.boot") version "4.0.5"
	id("io.spring.dependency-management") version "1.1.4"
}

group = "io.secureai"
version = "0.0.1-SNAPSHOT"

java {
	toolchain {
		languageVersion = JavaLanguageVersion.of(21)
	}
}

repositories {
	mavenCentral()
	// Spring 사설 리포는 org.springframework / io.spring / io.micrometer / io.opentelemetry 계열만 탐색.
	// 그 외 패키지(openhtmltopdf 등)는 mavenCentral에서만 해결하여 401 오류를 방지한다.
	maven {
		url = uri("https://repo.spring.io/release")
		content {
			includeGroupByRegex("org\\.springframework.*")
			includeGroupByRegex("io\\.spring.*")
			includeGroup("io.micrometer")
			includeGroup("io.opentelemetry")
		}
	}
	maven {
		url = uri("https://repo.spring.io/milestone")
		content {
			includeGroupByRegex("org\\.springframework.*")
			includeGroupByRegex("io\\.spring.*")
			includeGroup("io.micrometer")
			includeGroup("io.opentelemetry")
		}
	}
	maven {
		url = uri("https://repo.spring.io/snapshot")
		content {
			includeGroupByRegex("org\\.springframework.*")
			includeGroupByRegex("io\\.spring.*")
			includeGroup("io.micrometer")
			includeGroup("io.opentelemetry")
		}
	}
}

dependencies {
	implementation("org.springframework.boot:spring-boot-starter-actuator:4.0.5")
	implementation("io.micrometer:micrometer-registry-prometheus")
	implementation("org.springframework.boot:spring-boot-starter-data-jpa:4.0.5")
	implementation("org.springframework.boot:spring-boot-starter-data-redis:4.0.5")
	implementation("org.springframework.boot:spring-boot-starter-cache:4.0.5")
	implementation("org.springframework.boot:spring-boot-starter-security:4.0.5")
	implementation("org.springframework.boot:spring-boot-starter-validation:4.0.5")
	implementation("org.springframework.boot:spring-boot-starter-web:4.0.5")
	implementation("org.springframework.boot:spring-boot-starter-webflux:4.0.5")
	implementation("org.springframework.boot:spring-boot-starter-mail:4.0.5")
	
	// spring-aop + aspectjweaver 는 기존 스타터들의 전이 의존성으로 이미 포함됨
	// AspectJ 프록시 활성화를 위해 spring-aspects만 추가
	implementation("org.springframework:spring-aspects:7.0.6")
	implementation("org.springframework.boot:spring-boot-starter-flyway")
	implementation("org.flywaydb:flyway-database-postgresql")

	// JWT
	implementation("io.jsonwebtoken:jjwt-api:0.12.6")
	runtimeOnly("io.jsonwebtoken:jjwt-impl:0.12.6")
	runtimeOnly("io.jsonwebtoken:jjwt-jackson:0.12.6")

	implementation("org.postgresql:postgresql:42.7.4")
	compileOnly("org.projectlombok:lombok:1.18.36")
	developmentOnly("org.springframework.boot:spring-boot-devtools:4.0.5")
	annotationProcessor("org.projectlombok:lombok:1.18.36")

	testImplementation("org.springframework.boot:spring-boot-starter-test:4.0.5")
	testImplementation("org.springframework.security:spring-security-test:7.0.0")
	testCompileOnly("org.projectlombok:lombok:1.18.36")
	testRuntimeOnly("org.junit.platform:junit-platform-launcher")
	testAnnotationProcessor("org.projectlombok:lombok:1.18.36")

	// TestContainers — Redis + PostgreSQL 통합 테스트
	testImplementation("org.testcontainers:testcontainers:1.20.4")
	testImplementation("org.testcontainers:junit-jupiter:1.20.4")
	testImplementation("org.testcontainers:postgresql:1.20.4")

	// Docker Java SDK — DAST 샌드박스 컨테이너 관리
	implementation("com.github.docker-java:docker-java-core:3.3.6")
	implementation("com.github.docker-java:docker-java-transport-httpclient5:3.3.6")

	// Swagger / OpenAPI
	implementation("org.springdoc:springdoc-openapi-starter-webmvc-ui:2.8.8")

	// PDF 생성 — OpenPDF (LGPL, 기존 파이프라인 전용)
	implementation("com.github.librepdf:openpdf:1.3.30")

	// 보안 문서 PDF 생성 — OpenHTMLtoPDF + Thymeleaf (Flying Saucer 대체)
	// 1.0.20은 Maven Central 미배포 — 1.1.37(최신 stable) 사용
	implementation("org.springframework.boot:spring-boot-starter-thymeleaf")
	implementation("io.github.openhtmltopdf:openhtmltopdf-pdfbox:1.1.37")

	// Firebase Admin SDK — FCM Push 알림 (선택적 활성화)
	implementation("com.google.firebase:firebase-admin:9.2.0")

	// Resilience4j — Circuit Breaker (spring-boot3 명명이지만 Spring Boot 4 호환)
	implementation("io.github.resilience4j:resilience4j-spring-boot3:2.2.0")

	// ShedLock — Redis Provider (분산 스케줄러 중복 실행 방지)
	implementation("net.javacrumbs.shedlock:shedlock-spring:6.3.0")
	implementation("net.javacrumbs.shedlock:shedlock-provider-redis-spring:6.3.0")

	// TOTP (2FA) — HMAC-based One-Time Password (RFC 6238)
	implementation("dev.samstevens.totp:totp-spring-boot-starter:1.7.1")

	// OpenTelemetry — Micrometer OTLP 트레이싱 (Spring Boot 4 호환)
	// spring-boot-micrometer-tracing: Spring Boot 4에서 트레이싱 자동구성이 별도 모듈로 분리됨
	implementation("org.springframework.boot:spring-boot-micrometer-tracing:4.0.5")
	implementation("io.micrometer:micrometer-tracing-bridge-otel")
	implementation("io.opentelemetry:opentelemetry-exporter-otlp")
}

tasks.withType<Test> {
	useJUnitPlatform()
	// test 완료(성공/실패 무관) 시 리포트를 생성한다.
	// finalizedBy는 선행 task가 실패해도 후행 task를 실행한다.
	finalizedBy(tasks.jacocoTestReport)
}

jacoco {
	toolVersion = "0.8.12"
}

tasks.jacocoTestReport {
	// mustRunAfter: test 이후 실행 순서만 보장하되, 직접 호출 시 test를 재실행하지 않는다.
	// CI에서는 build 스텝(test 포함)이 먼저 실행되고, 별도 스텝에서 jacocoTestReport만 호출한다.
	// 로컬 개발 시: ./gradlew test jacocoTestReport 순서로 함께 실행하면 된다.
	mustRunAfter(tasks.test)
	reports {
		xml.required.set(true)
		html.required.set(true)
	}
}

// ── 커버리지 게이트 ────────────────────────────────────────────────────────
// 실측 라인 커버리지: 59.73% (2026-06-14 기준, .exec 파일 기반 정상 측정)
// 이전 1.1% 는 .exec 파일 없이 측정한 잘못된 값이었음.
// 현재 실측(59.73%)에서 안전 마진 2%를 두어 임계 58%로 설정한다.
// 목표: Sprint 13 → 65%, Sprint 14 → 70%(백로그 원래 목표)
// CI 실행 순서:
//   Step 1: ./gradlew build (continue-on-error) → test 실행 + .exec 파일 생성
//   Step 2: ./gradlew jacocoTestReport          → .exec → XML/HTML 리포트 생성
//   Step 3: ./gradlew jacocoTestCoverageVerification → 리포트 읽어 임계 검사
tasks.jacocoTestCoverageVerification {
	// mustRunAfter: jacocoTestReport 이후 실행 순서만 보장. test 재실행 없음.
	mustRunAfter(tasks.jacocoTestReport)
	violationRules {
		rule {
			limit {
				counter = "LINE"
				value = "COVEREDRATIO"
				// 실측 59.73% 기준 — 안전 마진 2% 적용하여 0.58로 설정.
				// TODO(sprint13): 0.65로, TODO(sprint14): 0.70으로 상향
				minimum = "0.58".toBigDecimal()
			}
		}
	}
}