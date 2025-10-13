'use client';

import { useState } from 'react';
import { FiDownload, FiTrash2, FiEdit2, FiEye, FiSearch } from 'react-icons/fi';
import { formatFileSize, getFileTypeInfo, canPreviewFile } from '@/lib/file-utils';
import FilePreview from './FilePreview';

interface Document {
  id: number;
  fileName: string;
  fileSize: number;
  fileType: string;
  fileUrl: string;
  uploadedBy: string;
  uploadedAt: string;
}

interface FileListProps {
  documents: Document[];
  isAdmin: boolean;
  onRefresh: () => void;
}

export default function FileList({ documents, isAdmin, onRefresh }: FileListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [previewFile, setPreviewFile] = useState<Document | null>(null);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [newFileName, setNewFileName] = useState('');

  const filteredDocuments = documents.filter((doc) =>
    doc.fileName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDownload = (doc: Document) => {
    window.open(`/api/documents/${doc.id}/download`, '_blank');
  };

  const handlePreview = (doc: Document) => {
    if (canPreviewFile(doc.fileType)) {
      setPreviewFile(doc);
    } else {
      handleDownload(doc);
    }
  };

  const handleDelete = async (id: number, fileName: string) => {
    if (!confirm(`Are you sure you want to delete "${fileName}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/documents/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        alert('File deleted successfully');
        onRefresh();
      } else {
        const data = await response.json();
        alert(`Failed to delete: ${data.error}`);
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete file');
    }
  };

  const startRename = (doc: Document) => {
    setRenamingId(doc.id);
    setNewFileName(doc.fileName);
  };

  const cancelRename = () => {
    setRenamingId(null);
    setNewFileName('');
  };

  const handleRename = async (id: number) => {
    if (!newFileName.trim()) {
      alert('File name cannot be empty');
      return;
    }

    try {
      const response = await fetch(`/api/documents/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newName: newFileName.trim() }),
      });

      if (response.ok) {
        alert('File renamed successfully');
        cancelRename();
        onRefresh();
      } else {
        const data = await response.json();
        alert(`Failed to rename: ${data.error}`);
      }
    } catch (error) {
      console.error('Rename error:', error);
      alert('Failed to rename file');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">
          All Documents ({filteredDocuments.length})
        </h3>

        {/* Search */}
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Table */}
      {filteredDocuments.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg mb-2">No documents found</p>
          <p className="text-sm">
            {searchQuery ? 'Try a different search term' : 'Upload some files to get started'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Size
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Uploaded By
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredDocuments.map((doc) => {
                const fileInfo = getFileTypeInfo(doc.fileType);
                const isRenaming = renamingId === doc.id;

                return (
                  <tr key={doc.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="text-2xl">{fileInfo.icon}</span>
                    </td>
                    <td className="px-4 py-3">
                      {isRenaming ? (
                        <div className="flex items-center space-x-2">
                          <input
                            type="text"
                            value={newFileName}
                            onChange={(e) => setNewFileName(e.target.value)}
                            className="px-2 py-1 border border-gray-300 rounded text-sm flex-1"
                            autoFocus
                          />
                          <button
                            onClick={() => handleRename(doc.id)}
                            className="text-green-600 hover:text-green-700 text-sm font-medium"
                          >
                            Save
                          </button>
                          <button
                            onClick={cancelRename}
                            className="text-gray-600 hover:text-gray-700 text-sm font-medium"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div>
                          <p className="text-sm font-medium text-gray-900">{doc.fileName}</p>
                          <p className="text-xs text-gray-500">{fileInfo.category}</p>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatFileSize(doc.fileSize)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{doc.uploadedBy}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatDate(doc.uploadedAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        {/* Preview */}
                        {canPreviewFile(doc.fileType) && (
                          <button
                            onClick={() => handlePreview(doc)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Preview"
                          >
                            <FiEye />
                          </button>
                        )}

                        {/* Download */}
                        <button
                          onClick={() => handleDownload(doc)}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Download"
                        >
                          <FiDownload />
                        </button>

                        {/* Rename (Admin only) */}
                        {isAdmin && !isRenaming && (
                          <button
                            onClick={() => startRename(doc)}
                            className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
                            title="Rename"
                          >
                            <FiEdit2 />
                          </button>
                        )}

                        {/* Delete (Admin only) */}
                        {isAdmin && (
                          <button
                            onClick={() => handleDelete(doc.id, doc.fileName)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <FiTrash2 />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Preview Modal */}
      {previewFile && (
        <FilePreview
          fileId={previewFile.id}
          fileName={previewFile.fileName}
          fileType={previewFile.fileType}
          fileUrl={previewFile.fileUrl}
          onClose={() => setPreviewFile(null)}
        />
      )}
    </div>
  );
}
