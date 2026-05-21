'use client';
import { useState, useCallback, useEffect } from 'react';
import { useSecureStore } from '@/store/useSecureStore';
import { isTauri, pickDirectoryNative, readDirectoryNative, dirNameFromPath } from '@/lib/tauri';
import type { FileNode } from '@/lib/mockData';

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

const SKIP_DIRS  = new Set(['node_modules', '.git', '.next', 'dist', 'build', 'out',
  'target', '.gradle', '__pycache__', '.pytest_cache', 'coverage', '.idea', '.vscode']);
const TEXT_EXTS  = /\.(ts|tsx|js|jsx|java|kt|py|go|rs|rb|php|cs|cpp|c|h|sql|json|yaml|yml|xml|md|txt|env\.example|gitignore|properties|toml|sh|bash|zsh)$/i;
const MAX_SIZE   = 500_000; // 500 KB

type UploadStatus = 'idle' | 'picking' | 'reading' | 'uploading' | 'done' | 'error';

// FileSystemDirectoryHandle 재귀 읽기
async function readDir(
  handle: FileSystemDirectoryHandle,
  prefix: string,
  collected: Array<{ path: string; content: string }>,
) {
  for await (const [name, entry] of handle as any) {
    if (entry.kind === 'directory') {
      if (SKIP_DIRS.has(name)) continue;
      await readDir(entry as FileSystemDirectoryHandle, prefix ? `${prefix}/${name}` : name, collected);
    } else {
      const filePath = prefix ? `${prefix}/${name}` : name;
      if (!TEXT_EXTS.test(name)) continue;
      const file: File = await (entry as FileSystemFileHandle).getFile();
      if (file.size > MAX_SIZE) continue;
      const content = await file.text();
      collected.push({ path: filePath, content });
    }
  }
}

// 백엔드 tree → FileNode 변환
function toFileNode(node: any): FileNode {
  return {
    name: node.name,
    path: node.path,
    type: node.type === 'dir' ? 'dir' : 'file',
    expanded: node.type === 'dir',
    children: node.children?.map(toFileNode),
  };
}

export function useWorkspace() {
  const [status, setStatus]   = useState<UploadStatus>('idle');
  const [progress, setProgress] = useState('');

  const workspaceId         = useSecureStore((s) => s.workspaceId);
  const setWorkspaceId      = useSecureStore((s) => s.setWorkspaceId);
  const setWorkspaceName    = useSecureStore((s) => s.setWorkspaceName);
  const setWorkspaceTree    = useSecureStore((s) => s.setWorkspaceTree);
  const setProjectId        = useSecureStore((s) => s.setProjectId);
  const addExtraWorkspace   = useSecureStore((s) => s.addExtraWorkspace);
  const setActiveWorkspaceId = useSecureStore((s) => s.setActiveWorkspaceId);

  // 새로고침 후 persist된 workspaceId가 Redis에서 만료됐는지 확인
  useEffect(() => {
    if (!workspaceId) return;
    fetch(`${BACKEND}/api/workspace/${workspaceId}/tree`)
      .then((r) => {
        if (!r.ok) {
          // 만료 또는 없는 워크스페이스 → 상태 초기화
          setWorkspaceId(null);
          setWorkspaceTree([]);
          setStatus('idle');
        }
      })
      .catch(() => {}); // 네트워크 오류는 무시 (오프라인 등)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 마운트 시 1회만

  // 폴더 선택 → 파일 읽기 → 백엔드 업로드 → 트리 반환 (공통 로직)
  const pickAndUpload = useCallback(async (): Promise<{
    id: string; name: string; tree: FileNode[];
  } | null> => {
    setStatus('picking');

    let projectName: string;
    let files: Array<{ path: string; content: string }>;

    if (isTauri()) {
      const dirPath = await pickDirectoryNative();
      if (!dirPath) { setStatus('idle'); return null; }
      projectName = dirNameFromPath(dirPath);
      setStatus('reading');
      setProgress('파일 읽는 중...');
      files = await readDirectoryNative(dirPath);
    } else {
      if (!('showDirectoryPicker' in window)) {
        alert('이 브라우저는 폴더 선택을 지원하지 않습니다. Chrome 또는 Edge를 사용해 주세요.');
        setStatus('idle');
        return null;
      }
      const dirHandle: FileSystemDirectoryHandle = await (window as any).showDirectoryPicker({ mode: 'read' });
      projectName = dirHandle.name;
      setStatus('reading');
      setProgress('파일 읽는 중...');
      const collected: Array<{ path: string; content: string }> = [];
      await readDir(dirHandle, '', collected);
      files = collected;
    }

    setProgress(`${files.length}개 파일 읽음 — 업로드 중...`);
    setStatus('uploading');

    const res = await fetch(`${BACKEND}/api/workspace`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectName, files }),
    });
    if (!res.ok) throw new Error(`업로드 실패: ${res.status}`);
    const { workspaceId: newId } = await res.json();

    const treeRes = await fetch(`${BACKEND}/api/workspace/${newId}/tree`);
    if (!treeRes.ok) throw new Error('트리 로드 실패');
    const treeData: any[] = await treeRes.json();
    const tree: FileNode[] = treeData.map(toFileNode);

    return { id: newId, name: projectName, tree };
  }, []);

  // 기본 워크스페이스 교체 (기존 동작 유지)
  const openFolder = useCallback(async () => {
    try {
      const result = await pickAndUpload();
      if (!result) return;
      const { id, name, tree } = result;

      setWorkspaceId(id);
      setWorkspaceName(name);
      setProjectId(null);
      setWorkspaceTree(tree);
      setActiveWorkspaceId(id);

      const firstFile = findFirstFile(tree);
      const store = useSecureStore.getState();
      store.setSelectedPath(firstFile ?? '');
      useSecureStore.setState({
        openTabs: firstFile
          ? [{ path: firstFile, label: firstFile.split('/').pop() ?? firstFile }]
          : [],
      });

      setStatus('done');
      setProgress('');
    } catch (err: any) {
      if (err?.name === 'AbortError') { setStatus('idle'); return; }
      console.error(err);
      setStatus('error');
      setProgress(err?.message ?? '알 수 없는 오류');
    }
  }, [pickAndUpload, setWorkspaceId, setWorkspaceName, setProjectId, setWorkspaceTree, setActiveWorkspaceId]);

  // 추가 워크스페이스 (기존 워크스페이스 유지하며 폴더 추가)
  const addFolder = useCallback(async () => {
    try {
      const result = await pickAndUpload();
      if (!result) return;
      addExtraWorkspace(result);
      setStatus('done');
      setProgress('');
    } catch (err: any) {
      if (err?.name === 'AbortError') { setStatus('idle'); return; }
      console.error(err);
      setStatus('error');
      setProgress(err?.message ?? '알 수 없는 오류');
    }
  }, [pickAndUpload, addExtraWorkspace]);

  return { openFolder, addFolder, status, progress };
}

function findFirstFile(nodes: FileNode[]): string | null {
  for (const n of nodes) {
    if (n.type === 'file') return n.path;
    if (n.children) {
      const found = findFirstFile(n.children);
      if (found) return found;
    }
  }
  return null;
}
