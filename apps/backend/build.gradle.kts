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
	
	// Spring Boot 4.0.5에서 찾을 수 없는 스타터 대신 직접 의존성 추가
	// implementation("org.springframework:spring-aspects:7.0.6")
	// implementation("org.springframework:spring-aop:7.0.6")
	implementation("org.flywaydb:flyway-core:10.20.0")
	implementation("org.flywaydb:flyway-database-postgresql:10.20.0")

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
	testRuntimeOnly("org.junit.platform:junit-platform-launcher:1.11.3")
	testAnnotationProcessor("org.projectlombok:lombok:1.18.36")
}

tasks.withType<Test> {
	useJUnitPlatform()
}