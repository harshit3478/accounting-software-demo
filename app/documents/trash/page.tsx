'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Navigation from '../../../components/Navigation';
import { ToastProvider, useToastContext } from '../../../components/ToastContext';
import TableSkeleton from '../../../components/TableSkeleton';
import { Folder, File, ArrowLeft, MoreVertical } from 'lucide-react';

interface DeletedDocument {
  id: number;
  originalDocId: number;
  userId: number;
  type: 'file' | 'folder';
  name: string;
  // File-specific fields
  fileName?: string | null;
  fileSize?: number | null;
  fileType?: string | null;
  fileUrl?: string | null;
  // Folder-specific fields
  folderContents?: {
    totalItems: number;
    files: number;
    folders: number;
  };
  originalParentId?: number | null;
  parentPath?: string | null;
  // Common fields
  uploadedAt: string;
  deletedAt: string;
  deleteReason: string | null;
  daysRemaining: number;
  expiryDate: string;
  isExpired: boolean;
  originalUploader: {
    id: number;
    name: string;
    email: string;
  };
  deleter: {
    id: number;
    name: string;
    email: string;
  };
}

function TrashPageContent() {
  const [deletedDocs, setDeletedDocs] = useState<DeletedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ type: 'recover' | 'delete' | 'cleanup'; doc?: DeletedDocument } | null>(null);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const { showToast } = useToastContext();

  const fetchDeletedDocs = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/documents/trash?showAll=${showAll}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch deleted documents');
      }

      setDeletedDocs(data);
    } catch (error: any) {
      showToast(error.message || 'Error fetching deleted documents', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeletedDocs();
  }, [showAll]);

  const handleRecover = async (doc: DeletedDocument) => {
    setProcessingId(doc.id);
    try {
      const res = await fetch(`/api/documents/trash/${doc.id}`, {
        method: 'POST',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to recover document');
      }

      showToast(data.message || 'Document recovered successfully', 'success');
      setConfirmModal(null);
      fetchDeletedDocs();
    } catch (error: any) {
      showToast(error.message || 'Error recovering document', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handlePermanentDelete = async (doc: DeletedDocument) => {
    setProcessingId(doc.id);
    try {
      const res = await fetch(`/api/documents/trash/${doc.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to permanently delete document');
      }

      showToast(data.message || 'Document permanently deleted', 'success');
      setConfirmModal(null);
      fetchDeletedDocs();
    } catch (error: any) {
      showToast(error.message || 'Error deleting document', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleCleanup = async () => {
    setProcessingId(-1); // Special ID for cleanup
    try {
      const res = await fetch('/api/documents/trash/cleanup', {
        method: 'POST',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to cleanup documents');
      }

      showToast(data.message || 'Cleanup completed', 'success');
      setConfirmModal(null);
      fetchDeletedDocs();
    } catch (error: any) {
      showToast(error.message || 'Error during cleanup', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const expiredDocs = deletedDocs.filter(doc => doc.isExpired);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link 
            href="/documents"
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Documents</span>
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Deleted Documents (Trash)</h1>
          <p className="text-gray-600 mt-2">
            Manage deleted documents. Documents are automatically deleted after 30 days.
          </p>
        </div>

        {/* Actions Bar */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={showAll}
                onChange={(e) => setShowAll(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Show expired documents</span>
            </label>
            
            {expiredDocs.length > 0 && (
              <span className="text-sm text-red-600 font-medium">
                {expiredDocs.length} document{expiredDocs.length !== 1 ? 's' : ''} past 30 days
              </span>
            )}
          </div>

          <button
            onClick={() => setConfirmModal({ type: 'cleanup' })}
            disabled={expiredDocs.length === 0 || processingId === -1}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {processingId === -1 ? 'Cleaning up...' : `Cleanup Expired (${expiredDocs.length})`}
          </button>
        </div>

        {/* Documents List */}
        {loading ? (
          <TableSkeleton />
        ) : deletedDocs.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No deleted documents</h3>
            <p className="mt-1 text-sm text-gray-500">Trash is empty</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm overflow-visible">
            <table className="min-w-full divide-y divide-gray-200 ">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    File Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Original Uploader
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Deleted By
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Deleted On
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Days Remaining
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Size
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {deletedDocs.map((doc) => (
                  <tr key={doc.id} className={doc.isExpired ? 'bg-red-50' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {doc.type === 'folder' ? (
                          <Folder className="h-5 w-5 text-blue-500 mr-2" />
                        ) : (
                          <File className="h-5 w-5 text-gray-400 mr-2" />
                        )}
                        <div>
                          <div className="text-sm font-medium text-gray-900 truncate max-w-40">{doc.name}</div>
                          {doc.type === 'folder' && doc.folderContents && (
                            <div className="text-xs text-gray-500">
                              {doc.folderContents.totalItems} items 
                              ({doc.folderContents.files} files, {doc.folderContents.folders} folders)
                            </div>
                          )}
                          {doc.type === 'file' && doc.fileType && (
                            <div className="text-xs text-gray-500 truncate max-w-40">{doc.fileType}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{doc.originalUploader.name}</div>
                      {/* <div className="text-xs text-gray-500">{doc.originalUploader.email}</div> */}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{doc.deleter.name}</div>
                      {/* <div className="text-xs text-gray-500">{doc.deleter.email}</div> */}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(doc.deletedAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {doc.isExpired ? (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                          Expired
                        </span>
                      ) : (
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          doc.daysRemaining <= 7 ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
                        }`}>
                          {doc.daysRemaining} days
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {doc.type === 'file' && doc.fileSize ? formatFileSize(doc.fileSize) : '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="relative inline-block text-left">
                        <button
                          onClick={() => setOpenMenuId(openMenuId === doc.id ? null : doc.id)}
                          disabled={processingId === doc.id}
                          className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <MoreVertical className="h-5 w-5 text-gray-400" />
                        </button>

                        {openMenuId === doc.id && processingId !== doc.id && (
                          <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white  z-50">
                            <div className="py-1">
                              <button
                                onClick={() => {
                                  setConfirmModal({ type: 'recover', doc });
                                  setOpenMenuId(null);
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-green-600 hover:bg-gray-100 flex items-center gap-2"
                              >
                                Recover
                              </button>
                              <button
                                onClick={() => {
                                  setConfirmModal({ type: 'delete', doc });
                                  setOpenMenuId(null);
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 flex items-center gap-2"
                              >
                                Permanent Delete
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Confirmation Modal */}
        {confirmModal && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setConfirmModal(null)}>
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
              <div className="px-6 py-4 border-b">
                <h3 className="text-lg font-semibold text-gray-900">
                  {confirmModal.type === 'cleanup' && 'Cleanup Expired Documents?'}
                  {confirmModal.type === 'recover' && 'Recover Document?'}
                  {confirmModal.type === 'delete' && 'Permanently Delete Document?'}
                </h3>
              </div>
              <div className="p-6">
                <p className="text-sm text-gray-600">
                    {confirmModal.type === 'cleanup' && `This will permanently delete ${expiredDocs.length} document(s) that are older than 30 days. This action cannot be undone.`}
                    {confirmModal.type === 'recover' && confirmModal.doc && (
                      <>
                        Recover "{confirmModal.doc.name}"?
                        {confirmModal.doc.type === 'folder' ? (
                          <> The folder will be restored to root level (contents not restored).</>
                        ) : (
                          <> It will be restored to your documents with [RECOVERED] prefix.</>
                        )}
                      </>
                    )}
                    {confirmModal.type === 'delete' && confirmModal.doc && (
                      <>
                        Permanently delete "{confirmModal.doc.name}"?
                        {confirmModal.doc.type === 'folder' && confirmModal.doc.folderContents ? (
                          <> This will remove the folder record and all its contents ({confirmModal.doc.folderContents.totalItems} items). This action cannot be undone.</>
                        ) : (
                          <> This will remove the file from storage. This action cannot be undone.</>
                        )}
                      </>
                    )}
                  </p>
                <div className="flex gap-4 px-6 py-4 bg-gray-50 rounded-b-lg">
                  <button
                    onClick={() => setConfirmModal(null)}
                    disabled={processingId !== null}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (confirmModal.type === 'cleanup') {
                        handleCleanup();
                      } else if (confirmModal.type === 'recover' && confirmModal.doc) {
                        handleRecover(confirmModal.doc);
                      } else if (confirmModal.type === 'delete' && confirmModal.doc) {
                        handlePermanentDelete(confirmModal.doc);
                      }
                    }}
                    disabled={processingId !== null}
                    className={`flex-1 px-4 py-2 rounded-lg text-white disabled:bg-gray-400 disabled:cursor-not-allowed ${
                      confirmModal.type === 'recover' 
                        ? 'bg-green-600 hover:bg-green-700' 
                        : 'bg-red-600 hover:bg-red-700'
                    }`}
                  >
                    {processingId !== null ? 'Processing...' : 'Confirm'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TrashPage() {
  return (
    <ToastProvider>
      <TrashPageContent />
    </ToastProvider>
  );
}
