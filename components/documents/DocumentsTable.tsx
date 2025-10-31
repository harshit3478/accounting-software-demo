import React from 'react';
import { Folder, File, MoreVertical, Download, Edit, Trash2, Eye } from 'lucide-react';
import { formatFileSize } from '@/lib/file-utils';

interface Document {
  id: number;
  type: 'file' | 'folder';
  name: string;
  fileName?: string | null;
  fileSize?: number | null;
  fileType?: string | null;
  fileUrl?: string | null;
  uploadedBy: string;
  uploadedByEmail: string;
  uploadedAt: string;
  updatedAt: string;
  parentId: number | null;
}

interface DocumentsTableProps {
  documents: Document[];
  loading: boolean;
  onFolderClick: (folderId: number) => void;
  onRenameFolder: (folderId: number, currentName: string) => void;
  onDeleteFolder: (folderId: number, name: string) => void;
  onDeleteFile: (fileId: number, name: string) => void;
  onViewFile?: (doc: Document) => void;
  onRenameFile?: (fileId: number, currentName: string) => void;
}

export default function DocumentsTable({
  documents,
  loading,
  onFolderClick,
  onRenameFolder,
  onDeleteFolder,
  onDeleteFile,
  onViewFile,
  onRenameFile
}: DocumentsTableProps) {
  const [openMenuId, setOpenMenuId] = React.useState<number | null>(null);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleDownload = async (doc: Document) => {
    if (doc.type === 'folder' || !doc.fileUrl) return;

    try {
      const response = await fetch(doc.fileUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading file:', error);
      alert('Failed to download file');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent" />
          <p className="mt-2 text-sm text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-12">
        <Folder className="w-16 h-16 mx-auto text-gray-300 mb-4" />
        <p className="text-gray-600 mb-2">This folder is empty</p>
        <p className="text-sm text-gray-500">Upload files or create folders to get started</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto pb-40">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Name
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Type
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Size
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Uploaded By
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Modified
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {documents.map((doc) => (
            <tr
              key={doc.id}
              className="hover:bg-gray-50 transition-colors"
            >
              {/* Name */}
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center gap-3">
                  {doc.type === 'folder' ? (
                    <Folder className="w-5 h-5 text-blue-500 flex-shrink-0" />
                  ) : (
                    <File className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  )}
                  <button
                    onClick={() => doc.type === 'folder' && onFolderClick(doc.id)}
                    className={`text-sm font-medium truncate max-w-44 ${
                      doc.type === 'folder'
                        ? 'text-blue-600 hover:text-blue-800 cursor-pointer'
                        : 'text-gray-900'
                    }`}
                    title={doc.name}
                  >
                    {doc.name}
                  </button>
                </div>
              </td>

              {/* Type */}
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="text-sm text-gray-600 truncate max-w-40 block" title={doc.type === 'folder' ? 'Folder' : doc.fileType || 'File'}>
                  {doc.type === 'folder' ? 'Folder' : doc.fileType || 'File'}
                </span>
              </td>

              {/* Size */}
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="text-sm text-gray-600">
                  {doc.type === 'file' && doc.fileSize
                    ? formatFileSize(doc.fileSize)
                    : '—'}
                </span>
              </td>

              {/* Uploaded By */}
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-900">{doc.uploadedBy}</div>
                <div className="text-xs text-gray-500">{doc.uploadedByEmail}</div>
              </td>

              {/* Modified */}
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                {formatDate(doc.updatedAt)}
              </td>

              {/* Actions */}
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <div className="relative inline-block">
                  <button
                    onClick={() => setOpenMenuId(openMenuId === doc.id ? null : doc.id)}
                    className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100"
                  >
                    <MoreVertical className="w-5 h-5" />
                  </button>

                  {/* Dropdown Menu */}
                  {openMenuId === doc.id && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setOpenMenuId(null)}
                      />
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-50 border border-gray-200">
                        {doc.type === 'file' && (
                          <>
                            {onViewFile && (
                              <button
                                onClick={() => {
                                  onViewFile(doc);
                                  setOpenMenuId(null);
                                }}
                                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                              >
                                <Eye className="w-4 h-4" />
                                View
                              </button>
                            )}
                            <button
                              onClick={() => {
                                handleDownload(doc);
                                setOpenMenuId(null);
                              }}
                              className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            >
                              <Download className="w-4 h-4" />
                              Download
                            </button>
                            {onRenameFile && (
                              <button
                                onClick={() => {
                                  onRenameFile(doc.id, doc.name);
                                  setOpenMenuId(null);
                                }}
                                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                              >
                                <Edit className="w-4 h-4" />
                                Rename
                              </button>
                            )}
                          </>
                        )}
                        {doc.type === 'folder' && (
                          <button
                            onClick={() => {
                              onRenameFolder(doc.id, doc.name);
                              setOpenMenuId(null);
                            }}
                            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          >
                            <Edit className="w-4 h-4" />
                            Rename
                          </button>
                        )}
                        <button
                          onClick={() => {
                            if (doc.type === 'folder') {
                              onDeleteFolder(doc.id, doc.name);
                            } else {
                              onDeleteFile(doc.id, doc.name);
                            }
                            setOpenMenuId(null);
                          }}
                          className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
