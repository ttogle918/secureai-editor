'use client';
import { useState, useCallback, useEffect } from 'react';
import { useSecureStore } from '@/store/useSecureStore';
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

  const workspaceId      = useSecureStore((s) => s.workspaceId);
  const setWorkspaceId   = useSecureStore((s) => s.setWorkspaceId);
  const setWorkspaceName = useSecureStore((s) => s.setWorkspaceName);
  const setWorkspaceTree = useSecureStore((s) => s.setWorkspaceTree);
  const setProjectId     = useSecureStore((s) => s.setProjectId);

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

  const openFolder = useCallback(async () => {
    if (!('showDirectoryPicker' in window)) {
      alert('이 브라우저는 폴더 선택을 지원하지 않습니다. Chrome 또는 Edge를 사용해 주세요.');
      return;
    }

    try {
      setStatus('picking');
      const dirHandle: FileSystemDirectoryHandle = await (window as any).showDirectoryPicker({
        mode: 'read',
      });

      setStatus('reading');
      setProgress('파일 읽는 중...');
      const files: Array<{ path: string; content: string }> = [];
      await readDir(dirHandle, '', files);
      setProgress(`${files.length}개 파일 읽음 — 업로드 중...`);

      setStatus('uploading');
      const res = await fetch(`${BACKEND}/api/workspace`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectName: dirHandle.name, files }),
      });

      if (!res.ok) throw new Error(`업로드 실패: ${res.status}`);
      const { workspaceId } = await res.json();

      // 트리 로드
      const treeRes = await fetch(`${BACKEND}/api/workspace/${workspaceId}/tree`);
      if (!treeRes.ok) throw new Error('트리 로드 실패');
      const treeData: any[] = await treeRes.json();

      const tree: FileNode[] = treeData.map(toFileNode);
      setWorkspaceId(workspaceId);
      setWorkspaceName(dirHandle.name);
      setProjectId(null); // 새 폴더 열면 프로젝트 재생성
      setWorkspaceTree(tree);

      // 워크스페이스 열릴 때 mock 탭 초기화 후 첫 파일로 교체
      const firstFile = findFirstFile(tree);
      const store = useSecureStore.getState();
      store.setSelectedPath(firstFile ?? '');
      // openTabs를 첫 파일 하나로 교체 (mock 탭 제거)
      if (firstFile) {
        useSecureStore.setState({
          openTabs: [{ path: firstFile, label: firstFile.split('/').pop() ?? firstFile }],
        });
      } else {
        useSecureStore.setState({ openTabs: [] });
      }

      setStatus('done');
      setProgress('');
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        setStatus('idle'); // 사용자가 취소
        return;
      }
      console.error(err);
      setStatus('error');
      setProgress(err?.message ?? '알 수 없는 오류');
    }
  }, [setWorkspaceId, setWorkspaceName, setProjectId, setWorkspaceTree]);

  return { openFolder, status, progress };
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
