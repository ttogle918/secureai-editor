package io.secureai.backend.global.crypto;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.*;

class AesEncryptionConverterTest {

    private AesEncryptionConverter converter;

    // 64-char hex = 256-bit AES key
    private static final String TEST_KEY = "0000000000000000000000000000000000000000000000000000000000000000";

    @BeforeEach
    void setUp() throws Exception {
        converter = new AesEncryptionConverter();
        ReflectionTestUtils.setField(converter, "hexKey", TEST_KEY);
        converter.afterPropertiesSet();
    }

    @Test
    void encryptThenDecrypt_returnsOriginal() {
        String plaintext = "ghp_test_github_token_12345";
        byte[] encrypted = converter.convertToDatabaseColumn(plaintext);
        String decrypted = converter.convertToEntityAttribute(encrypted);
        assertThat(decrypted).isEqualTo(plaintext);
    }

    @Test
    void samePlaintext_producesDifferentCiphertext() {
        String plaintext = "same_token";
        byte[] enc1 = converter.convertToDatabaseColumn(plaintext);
        byte[] enc2 = converter.convertToDatabaseColumn(plaintext);
        assertThat(enc1).isNotEqualTo(enc2); // random IV ensures different output
    }

    @Test
    void nullInput_returnsNull() {
        assertThat(converter.convertToDatabaseColumn(null)).isNull();
        assertThat(converter.convertToEntityAttribute(null)).isNull();
    }

    @Test
    void invalidKey_throwsOnInit() {
        AesEncryptionConverter bad = new AesEncryptionConverter();
        ReflectionTestUtils.setField(bad, "hexKey", "tooshort");
        assertThatThrownBy(bad::afterPropertiesSet)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("256 bits");
    }
}
