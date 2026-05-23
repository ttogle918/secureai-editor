package io.secureai.backend.domain.workspace.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.secureai.backend.domain.workspace.dto.WorkspaceTreeNode;
import io.secureai.backend.domain.workspace.dto.WorkspaceUploadRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.TimeUnit;

@Service
@RequiredArgsConstructor
public class WorkspaceService {

    private static final String PREFIX     = "secureai:ws:";
    private static final long   TTL_HOURS  = 24;

    private final RedisTemplate<String, String> redisTemplate;
    private final ObjectMapper objectMapper;

    public String upload(String projectName, List<WorkspaceUploadRequest.WorkspaceFile> files) {
        String workspaceId = UUID.randomUUID().toString().replace("-", "").substring(0, 12);

        // 파일 내용 저장 (Hash: path → content)
        String filesKey = PREFIX + workspaceId + ":files";
        for (var file : files) {
            redisTemplate.opsForHash().put(filesKey, file.getPath(), file.getContent());
        }
        redisTemplate.expire(filesKey, TTL_HOURS, TimeUnit.HOURS);

        // 파일 트리 생성 및 저장
        List<WorkspaceTreeNode> tree = buildTree(projectName, files.stream()
                .map(WorkspaceUploadRequest.WorkspaceFile::getPath)
                .toList());
        try {
            String treeJson = objectMapper.writeValueAsString(tree);
            String treeKey  = PREFIX + workspaceId + ":tree";
            redisTemplate.opsForValue().set(treeKey, treeJson, TTL_HOURS, TimeUnit.HOURS);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("파일 트리 직렬화 실패", e);
        }

        // 메타 저장
        String metaKey = PREFIX + workspaceId + ":meta";
        redisTemplate.opsForHash().put(metaKey, "projectName", projectName);
        redisTemplate.opsForHash().put(metaKey, "fileCount", String.valueOf(files.size()));
        redisTemplate.expire(metaKey, TTL_HOURS, TimeUnit.HOURS);

        return workspaceId;
    }

    public List<WorkspaceTreeNode> getTree(String workspaceId) {
        String treeJson = redisTemplate.opsForValue().get(PREFIX + workspaceId + ":tree");
        if (treeJson == null) return null;
        try {
            return objectMapper.readValue(treeJson, new TypeReference<>() {});
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("파일 트리 역직렬화 실패", e);
        }
    }

    public String getFileContent(String workspaceId, String path) {
        Object content = redisTemplate.opsForHash().get(PREFIX + workspaceId + ":files", path);
        return content != null ? content.toString() : null;
    }

    public Map<String, String> getAllFiles(String workspaceId) {
        Map<Object, Object> raw = redisTemplate.opsForHash().entries(PREFIX + workspaceId + ":files");
        if (raw.isEmpty()) return null;
        Map<String, String> files = new LinkedHashMap<>();
        raw.forEach((k, v) -> files.put(k.toString(), v.toString()));
        return files;
    }

    public Map<String, String> getMeta(String workspaceId) {
        Map<Object, Object> raw = redisTemplate.opsForHash().entries(PREFIX + workspaceId + ":meta");
        Map<String, String> meta = new LinkedHashMap<>();
        raw.forEach((k, v) -> meta.put(k.toString(), v.toString()));
        return meta;
    }

    // 경로 목록 → 트리 구조 변환
    private List<WorkspaceTreeNode> buildTree(String rootName, List<String> paths) {
        WorkspaceTreeNode root = WorkspaceTreeNode.builder()
                .name(rootName)
                .path("")
                .type("dir")
                .children(new ArrayList<>())
                .build();

        for (String filePath : paths) {
            String[] parts = filePath.split("/");
            WorkspaceTreeNode current = root;

            for (int i = 0; i < parts.length - 1; i++) {
                String part    = parts[i];
                String dirPath = String.join("/", Arrays.copyOfRange(parts, 0, i + 1));
                WorkspaceTreeNode dir = findOrCreateDir(current.getChildren(), part, dirPath);
                current = dir;
            }

            current.getChildren().add(WorkspaceTreeNode.builder()
                    .name(parts[parts.length - 1])
                    .path(filePath)
                    .type("file")
                    .build());
        }

        sortTree(root.getChildren());
        return root.getChildren();
    }

    private WorkspaceTreeNode findOrCreateDir(List<WorkspaceTreeNode> nodes, String name, String path) {
        return nodes.stream()
                .filter(n -> n.getName().equals(name) && "dir".equals(n.getType()))
                .findFirst()
                .orElseGet(() -> {
                    WorkspaceTreeNode dir = WorkspaceTreeNode.builder()
                            .name(name).path(path).type("dir").children(new ArrayList<>())
                            .build();
                    nodes.add(dir);
                    return dir;
                });
    }

    // 디렉토리 먼저, 그 다음 파일 이름순 정렬
    private void sortTree(List<WorkspaceTreeNode> nodes) {
        nodes.sort(Comparator
                .comparing((WorkspaceTreeNode n) -> "file".equals(n.getType()) ? 1 : 0)
                .thenComparing(WorkspaceTreeNode::getName, String.CASE_INSENSITIVE_ORDER));
        nodes.forEach(n -> {
            if (n.getChildren() != null) sortTree(n.getChildren());
        });
    }
}
