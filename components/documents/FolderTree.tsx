import React, { useEffect, useState } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen, Plus, Loader2 } from 'lucide-react';

interface TreeNode {
  id: number;
  name: string;
  type: 'folder';
  parentId: number | null;
  children: TreeNode[];
  itemCount?: number;
}

interface FolderTreeProps {
  currentFolderId: number | null;
  onFolderSelect: (folderId: number | null) => void;
  onCreateFolder: (parentId: number | null) => void;
  refreshTrigger?: number;
}

export default function FolderTree({
  currentFolderId,
  onFolderSelect,
  onCreateFolder,
  refreshTrigger = 0
}: FolderTreeProps) {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(new Set());

  // Load folder tree
  useEffect(() => {
    loadTree();
  }, [refreshTrigger]);

  const loadTree = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/documents/tree');
      
      if (!response.ok) {
        throw new Error('Failed to load folder tree');
      }
      
      const data = await response.json();
      setTree(data.tree || []);
      
      // Auto-expand folders in current path
      if (currentFolderId) {
        await expandPathToFolder(currentFolderId);
      }
    } catch (err: any) {
      console.error('Error loading folder tree:', err);
      setError(err.message || 'Failed to load folders');
    } finally {
      setLoading(false);
    }
  };

  // Expand all folders in path to specific folder
  const expandPathToFolder = async (folderId: number) => {
    try {
      const response = await fetch(`/api/documents/breadcrumb/${folderId}`);
      if (response.ok) {
        const data = await response.json();
        const folderIds = data.breadcrumb
          .filter((item: any) => item.id > 0)
          .map((item: any) => item.id);
        
        setExpandedFolders(prev => {
          const newSet = new Set(prev);
          folderIds.forEach((id: number) => newSet.add(id));
          return newSet;
        });
      }
    } catch (err) {
      console.error('Error expanding path:', err);
    }
  };

  const toggleFolder = (folderId: number) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  };

  const renderTreeNode = (node: TreeNode, depth: number = 0) => {
    const isExpanded = expandedFolders.has(node.id);
    const isSelected = currentFolderId === node.id;
    const hasChildren = node.children && node.children.length > 0;
    const paddingLeft = depth * 16 + 8;

    return (
      <div key={node.id} className="select-none group">
        <div
          className={`
            flex items-center gap-1 py-1.5 px-2 cursor-pointer rounded-md
            hover:bg-gray-100 transition-colors
            ${isSelected ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}
          `}
          style={{ paddingLeft: `${paddingLeft}px` }}
          onClick={() => onFolderSelect(node.id)}
        >
          {/* Expand/Collapse Icon */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (hasChildren) {
                toggleFolder(node.id);
              }
            }}
            className="p-0.5 hover:bg-gray-200 rounded"
            disabled={!hasChildren}
          >
            {hasChildren ? (
              isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )
            ) : (
              <div className="w-4 h-4" />
            )}
          </button>

          {/* Folder Icon */}
          {isExpanded && hasChildren ? (
            <FolderOpen className="w-4 h-4 text-blue-500 flex-shrink-0" />
          ) : (
            <Folder className="w-4 h-4 text-gray-500 flex-shrink-0" />
          )}

          {/* Folder Name */}
          <span className="flex-1 truncate text-sm">{node.name}</span>

          {/* Item Count */}
          {node.itemCount !== undefined && node.itemCount > 0 && (
            <span className="text-xs text-gray-400 flex-shrink-0">
              {node.itemCount}
            </span>
          )}

          {/* Create Subfolder Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCreateFolder(node.id);
            }}
            className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-gray-200 rounded"
            title="Create subfolder"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Render Children */}
        {isExpanded && hasChildren && (
          <div>
            {node.children.map(child => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center">
        <p className="text-sm text-red-600 mb-2">{error}</p>
        <button
          onClick={loadTree}
          className="text-sm text-blue-600 hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Root Level */}
      <div
        className={`
          flex items-center gap-2 py-2 px-3 cursor-pointer rounded-md
          hover:bg-gray-100 transition-colors mb-1
          ${currentFolderId === null ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}
        `}
        onClick={() => onFolderSelect(null)}
      >
        <Folder className="w-4 h-4 text-gray-500" />
        <span className="flex-1 text-sm">All Documents</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCreateFolder(null);
          }}
          className="p-0.5 hover:bg-gray-200 rounded"
          title="Create folder at root"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto">
        {tree.length === 0 ? (
          <div className="text-center py-8">
            <Folder className="w-12 h-12 mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-500">No folders yet</p>
            <button
              onClick={() => onCreateFolder(null)}
              className="text-sm text-blue-600 hover:underline mt-2"
            >
              Create your first folder
            </button>
          </div>
        ) : (
          tree.map(node => renderTreeNode(node, 0))
        )}
      </div>
    </div>
  );
}
