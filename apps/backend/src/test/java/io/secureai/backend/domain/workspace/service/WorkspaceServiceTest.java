package io.secureai.backend.domain.workspace.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.secureai.backend.domain.workspace.dto.WorkspaceTreeNode;
import io.secureai.backend.domain.workspace.dto.WorkspaceUploadRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.redis.core.HashOperations;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * WorkspaceService 단위 테스트.
 * Redis는 목으로 대체하고 ObjectMapper는 실제 인스턴스를 사용해
 * 파일 트리 빌드/정렬 같은 순수 비즈니스 로직을 검증한다.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class WorkspaceServiceTest {

    @Mock
    private RedisTemplate<String, String> redisTemplate;

    @Mock
    @SuppressWarnings("rawtypes")
    private HashOperations hashOperations;

    @Mock
    private ValueOperations<String, String> valueOperations;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private WorkspaceService service;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        when(redisTemplate.opsForHash()).thenReturn(hashOperations);
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        service = new WorkspaceService(redisTemplate, objectMapper);
    }

    private WorkspaceUploadRequest.WorkspaceFile file(String path, String content) {
        var f = org.mockito.Mockito.mock(WorkspaceUploadRequest.WorkspaceFile.class);
        lenient().when(f.getPath()).thenReturn(path);
        lenient().when(f.getContent()).thenReturn(content);
        return f;
    }

    @Test
    @DisplayName("upload — 대시 없는 12자리 workspaceId를 반환한다")
    void upload_returnsTwelveCharIdWithoutDashes() {
        String id = service.upload("proj", List.of(file("a.txt", "x")));

        assertThat(id).hasSize(12).doesNotContain("-");
    }

    @Test
    @DisplayName("upload — 각 파일을 files 해시에 저장하고 24시간 TTL을 건다")
    void upload_storesFilesWithTtl() {
        String id = service.upload("proj", List.of(
                file("src/Main.java", "code"),
                file("README.md", "docs")));

        String filesKey = "secureai:ws:" + id + ":files";
        verify(hashOperations).put(filesKey, "src/Main.java", "code");
        verify(hashOperations).put(filesKey, "README.md", "docs");
        verify(redisTemplate).expire(filesKey, 24L, TimeUnit.HOURS);
        verify(redisTemplate).expire("secureai:ws:" + id + ":meta", 24L, TimeUnit.HOURS);
    }

    @Test
    @DisplayName("upload — projectName과 fileCount 메타를 저장한다")
    void upload_storesMeta() {
        String id = service.upload("my-project", List.of(
                file("a.txt", "1"), file("b.txt", "2")));

        String metaKey = "secureai:ws:" + id + ":meta";
        verify(hashOperations).put(metaKey, "projectName", "my-project");
        verify(hashOperations).put(metaKey, "fileCount", "2");
    }

    @Test
    @DisplayName("upload — 디렉토리 우선·대소문자 무시 이름순으로 정렬된 중첩 트리를 직렬화한다")
    void upload_buildsSortedNestedTree() throws Exception {
        String id = service.upload("proj", List.of(
                file("README.md", "r"),
                file("src/zebra.txt", "z"),
                file("src/Apple.txt", "a"),
                file("src/sub/deep.txt", "d")));

        // tree 키에 set된 JSON을 캡처해 실제 ObjectMapper로 역직렬화한다
        ArgumentCaptor<String> treeJson = ArgumentCaptor.forClass(String.class);
        verify(valueOperations).set(eq("secureai:ws:" + id + ":tree"),
                treeJson.capture(), eq(24L), eq(TimeUnit.HOURS));

        List<WorkspaceTreeNode> tree = objectMapper.readValue(
                treeJson.getValue(), new TypeReference<>() {});

        // 최상위: 디렉토리(src)가 파일(README.md)보다 먼저
        assertThat(tree).extracting(WorkspaceTreeNode::getName)
                .containsExactly("src", "README.md");
        assertThat(tree).extracting(WorkspaceTreeNode::getType)
                .containsExactly("dir", "file");

        // src 내부: 디렉토리(sub) 먼저, 그 다음 파일은 대소문자 무시 이름순(Apple < zebra)
        WorkspaceTreeNode src = tree.get(0);
        assertThat(src.getPath()).isEqualTo("src");
        assertThat(src.getChildren()).extracting(WorkspaceTreeNode::getName)
                .containsExactly("sub", "Apple.txt", "zebra.txt");

        // 중첩 디렉토리의 파일 경로가 전체 경로로 기록된다
        WorkspaceTreeNode sub = src.getChildren().get(0);
        assertThat(sub.getChildren()).singleElement()
                .satisfies(n -> {
                    assertThat(n.getName()).isEqualTo("deep.txt");
                    assertThat(n.getPath()).isEqualTo("src/sub/deep.txt");
                    assertThat(n.getType()).isEqualTo("file");
                });
    }

    @Test
    @DisplayName("getTree — 저장된 트리가 없으면 null을 반환한다")
    void getTree_missing_returnsNull() {
        when(valueOperations.get("secureai:ws:abc:tree")).thenReturn(null);

        assertThat(service.getTree("abc")).isNull();
    }

    @Test
    @DisplayName("getTree — 저장된 JSON을 트리로 역직렬화한다")
    void getTree_present_deserializes() throws Exception {
        List<WorkspaceTreeNode> stored = List.of(
                WorkspaceTreeNode.builder().name("a.txt").path("a.txt").type("file").build());
        when(valueOperations.get("secureai:ws:abc:tree"))
                .thenReturn(objectMapper.writeValueAsString(stored));

        List<WorkspaceTreeNode> tree = service.getTree("abc");

        assertThat(tree).singleElement()
                .satisfies(n -> assertThat(n.getName()).isEqualTo("a.txt"));
    }

    @Test
    @DisplayName("getFileContent — 존재하면 문자열로, 없으면 null을 반환한다")
    void getFileContent_returnsValueOrNull() {
        when(hashOperations.get("secureai:ws:abc:files", "a.txt")).thenReturn("hello");
        when(hashOperations.get("secureai:ws:abc:files", "missing.txt")).thenReturn(null);

        assertThat(service.getFileContent("abc", "a.txt")).isEqualTo("hello");
        assertThat(service.getFileContent("abc", "missing.txt")).isNull();
    }

    @Test
    @DisplayName("getAllFiles — 비어 있으면 null, 있으면 path→content 맵을 반환한다")
    void getAllFiles_returnsMapOrNull() {
        when(hashOperations.entries("secureai:ws:empty:files")).thenReturn(Map.of());
        assertThat(service.getAllFiles("empty")).isNull();

        when(hashOperations.entries("secureai:ws:abc:files"))
                .thenReturn(Map.of("a.txt", "1", "b.txt", "2"));
        assertThat(service.getAllFiles("abc"))
                .containsEntry("a.txt", "1")
                .containsEntry("b.txt", "2");
    }

    @Test
    @DisplayName("getMeta — 저장된 메타 엔트리를 문자열 맵으로 변환한다")
    void getMeta_returnsMappedEntries() {
        when(hashOperations.entries("secureai:ws:abc:meta"))
                .thenReturn(Map.of("projectName", "proj", "fileCount", "3"));

        Map<String, String> meta = service.getMeta("abc");

        assertThat(meta).containsEntry("projectName", "proj").containsEntry("fileCount", "3");
    }
}
