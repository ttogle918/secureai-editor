package io.secureai.backend;

import io.secureai.backend.config.DataInitializer;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("test")
class BackendApplicationTests {

	@MockBean
	DataInitializer dataInitializer;

	@Test
	void contextLoads() {
	}

}
