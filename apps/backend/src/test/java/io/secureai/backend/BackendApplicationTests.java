package io.secureai.backend;

import io.secureai.backend.config.DataInitializer;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

@SpringBootTest
@ActiveProfiles("test")
class BackendApplicationTests {

	@MockitoBean
	DataInitializer dataInitializer;

	// Redis 인프라 없이도 컨텍스트 로딩이 가능하도록 Listener Container를 Mock 처리한다
	@MockitoBean
	RedisMessageListenerContainer redisListenerContainer;

	@Test
	void contextLoads() {
	}

}
