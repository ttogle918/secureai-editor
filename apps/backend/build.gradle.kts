plugins {
	java
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
	maven { url = uri("https://repo.spring.io/release") }
	maven { url = uri("https://repo.spring.io/milestone") }
	maven { url = uri("https://repo.spring.io/snapshot") }
}

dependencies {
	implementation("org.springframework.boot:spring-boot-starter-actuator:4.0.5")
	implementation("org.springframework.boot:spring-boot-starter-data-jpa:4.0.5")
	implementation("org.springframework.boot:spring-boot-starter-data-redis:4.0.5")
	implementation("org.springframework.boot:spring-boot-starter-cache:4.0.5")
	implementation("org.springframework.boot:spring-boot-starter-security:4.0.5")
	implementation("org.springframework.boot:spring-boot-starter-validation:4.0.5")
	implementation("org.springframework.boot:spring-boot-starter-web:4.0.5")
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

	// PDF 생성 — OpenPDF (LGPL)
	implementation("com.github.librepdf:openpdf:1.3.30")
}

tasks.withType<Test> {
	useJUnitPlatform()
}