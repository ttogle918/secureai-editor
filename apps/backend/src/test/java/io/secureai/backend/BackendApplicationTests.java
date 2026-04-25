package io.secureai.backend;

import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
@Disabled("DB 연결 필요 — docker compose up 환경에서만 실행")
class BackendApplicationTests {

	@Test
	void contextLoads() {
	}

}
