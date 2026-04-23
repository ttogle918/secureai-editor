'use client';
import { useState } from 'react';
import type { FileNode } from '@/lib/mockData';

interface Props {
  tree: FileNode[];
  selectedPath: string | null;
  onSelect: (path: string) => void;
}

function TreeNode({ node, depth, selectedPath, onSelect }: {
  node: FileNode;
  depth: number;
  selectedPath: string | null;
  onSelect: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(node.expanded ?? true);

  const isSelected = node.path === selectedPath;
  const indent = depth * 12;

  if (node.type === 'dir') {
    return (
      <div>
        <div
          className="flex items-center gap-1 py-0.5 cursor-pointer select-none text-xs"
          style={{
            paddingLeft: `${indent + 8}px`,
            color: 'var(--text-secondary)',
          }}
          onClick={() => setExpanded(!expanded)}
        >
          <span style={{ fontSize: 10 }}>{expanded ? '▾' : '▸'}</span>
          <span style={{ fontSize: 12 }}>📁</span>
          <span>{node.name}</span>
        </div>
        {expanded && node.children?.map((child) => (
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

  return (
    <div
      className="flex items-center justify-between py-0.5 cursor-pointer text-xs group"
      style={{
        paddingLeft: `${indent + 8}px`,
        paddingRight: 8,
        background: isSelected ? 'var(--bg-selected)' : 'transparent',
        color: isSelected ? '#fff' : 'var(--text-primary)',
      }}
      onClick={() => onSelect(node.path)}
    >
      <div className="flex items-center gap-1 min-w-0">
        <span style={{ fontSize: 11 }}>📄</span>
        <span className="truncate">{node.name}</span>
      </div>
      {(node.vulnCount ?? 0) > 0 && (
        <span
          className="text-xs px-1.5 rounded shrink-0"
          style={{
            background: node.vulnCount! >= 3 ? 'var(--critical-bg)' : 'var(--high-bg)',
            color: node.vulnCount! >= 3 ? 'var(--critical)' : 'var(--high)',
            fontSize: 10,
          }}
        >
          {node.vulnCount}
        </span>
      )}
    </div>
  );
}

export default function FileTree({ tree, selectedPath, onSelect }: Props) {
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* 헤더 */}
      <div
        className="flex items-center justify-between px-3 py-1.5 text-xs font-medium uppercase tracking-wider shrink-0"
        style={{
          color: 'var(--text-tertiary)',
          borderBottom: '1px solid var(--border)',
          letterSpacing: '0.06em',
        }}
      >
        <span>탐색기</span>
        <span
          className="px-1.5 py-0.5 rounded text-xs"
          style={{ background: 'var(--success-bg)', color: 'var(--success)', fontSize: 10 }}
        >
          MCP
        </span>
      </div>

      {/* 트리 */}
      <div className="flex-1 py-1">
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
