// components/editor/FileTree.tsx
// MCP 파일 트리 — 이모지 → lucide-react 아이콘 교체
// UI/UX REVISIONS.md §1 대응
'use client';
import { useState } from 'react';
import {
  Folder, FolderOpen, File, FileCode2,
  ChevronRight, ChevronDown,
} from 'lucide-react';
import type { FileNode } from '@/lib/mockData';
import { SeverityDot } from '@/components/ui/SeverityDot';
import type { SeverityLevel } from '@/types';

// 파일 확장자 → 언어 아이콘 판별
function getFileIcon(name: string) {
  if (/\.(tsx?|jsx?)$/.test(name))
    return <FileCode2 size={13} color="#569cd6" aria-hidden="true" />;
  if (/\.(java|kt)$/.test(name))
    return <FileCode2 size={13} color="#4ec9b0" aria-hidden="true" />;
  if (/\.(py)$/.test(name))
    return <FileCode2 size={13} color="#f59e0b" aria-hidden="true" />;
  return <File size={13} color="#555560" aria-hidden="true" />;
}

// vulnCount → worst severity
function countToSeverity(count: number): SeverityLevel | null {
  if (count === 0) return null;
  if (count >= 3) return 'critical';
  if (count >= 2) return 'high';
  return 'medium';
}

// ── TreeNode ─────────────────────────────────────────────
function TreeNode({
  node,
  depth,
  selectedPath,
  onSelect,
}: {
  node: FileNode;
  depth: number;
  selectedPath: string | null;
  onSelect: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(node.expanded ?? depth === 0);
  const isSelected = node.path === selectedPath;
  const indent     = depth * 12;

  if (node.type === 'dir') {
    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          aria-label={`${node.name} 폴더 ${expanded ? '접기' : '펼치기'}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            width: '100%',
            paddingLeft: indent + 8,
            paddingRight: 8,
            paddingTop: 5,
            paddingBottom: 5,
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            color: '#555560',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            borderRadius: 2,
            textAlign: 'left',
            transition: 'background 0.1s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
        >
          {expanded
            ? <ChevronDown size={11} aria-hidden="true" />
            : <ChevronRight size={11} aria-hidden="true" />
          }
          {expanded
            ? <FolderOpen size={13} color="#e2a53a" aria-hidden="true" />
            : <Folder     size={13} color="#e2a53a" aria-hidden="true" />
          }
          <span>{node.name}</span>
        </button>
        {expanded &&
          node.children?.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelect={onSelect}
            />
          ))}
      </div>
    );
  }

  const severity = countToSeverity(node.vulnCount ?? 0);

  return (
    <button
      onClick={() => onSelect(node.path)}
      aria-selected={isSelected}
      aria-label={`${node.name}${severity ? ` — ${severity} 취약점` : ''}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 6,
        width: '100%',
        paddingLeft: indent + 8,
        paddingRight: 8,
        paddingTop: 4,
        paddingBottom: 4,
        fontSize: 11,
        fontFamily: 'var(--font-mono)',
        background: isSelected ? 'rgba(255,255,255,0.07)' : 'transparent',
        color: isSelected ? '#e8e8ee' : '#9494a0',
        border: 'none',
        cursor: 'pointer',
        borderRadius: 2,
        textAlign: 'left',
        transition: 'all 0.1s',
        borderLeft: isSelected ? '2px solid #ea580c' : '2px solid transparent',
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
          e.currentTarget.style.color = '#e8e8ee';
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = '#9494a0';
        }
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        {getFileIcon(node.name)}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {node.name}
        </span>
      </div>
      {severity && <SeverityDot level={severity} size={6} />}
    </button>
  );
}

// ── FileTree ─────────────────────────────────────────────
interface FileTreeProps {
  tree: FileNode[];
  selectedPath: string | null;
  onSelect: (path: string) => void;
}

export function FileTree({ tree, selectedPath, onSelect }: FileTreeProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflowY: 'auto',
      }}
      role="tree"
      aria-label="프로젝트 파일 탐색기"
    >
      <div style={{ flex: 1, paddingTop: 4, paddingBottom: 4 }}>
        {tree.map((node) => (
          <TreeNode
            key={node.path}
            node={node}
            depth={0}
            selectedPath={selectedPath}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}

// 기존 default export 유지 (하위 호환)
export default FileTree;
