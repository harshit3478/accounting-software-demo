'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';
import Navigation from '@/components/Navigation';
import FileUpload from '@/components/FileUpload';
import StorageIndicator from '@/components/StorageIndicator';
import FolderTree from '@/components/documents/FolderTree';
import Breadcrumb from '@/components/documents/Breadcrumb';
import DocumentsTable from '@/components/documents/DocumentsTable';
import FolderModal from '@/components/documents/FolderModal';
import DeleteConfirmModal from '@/components/documents/DeleteConfirmModal';
import RenameFileModal from '@/components/documents/RenameFileModal';
import FilePreview from '@/components/FilePreview';
import { ToastProvider, useToastContext } from '@/components/ToastContext';
import { Upload, FolderPlus, Trash2 } from 'lucide-react';

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

function DocumentsPageContent() {
  const router = useRouter();
  const { isAuthenticated, canUpload, canRename, canDelete, isAdmin } = useAuth();
  const { showSuccess, showError } = useToastContext();
  
  // State
  const [documents, setDocuments] = useState<Document[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  // Modal states
  const [folderModal, setFolderModal] = useState<{
    isOpen: boolean;
    mode: 'create' | 'rename';
    parentId?: number | null;
    folderId?: number;
    currentName?: string;
  }>({ isOpen: false, mode: 'create' });
  
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    id: number;
    name: string;
    type: 'file' | 'folder';
  } | null>(null);

  const [showUpload, setShowUpload] = useState(false);
  const [previewFile, setPreviewFile] = useState<Document | null>(null);
  const [renameFileModal, setRenameFileModal] = useState<{
    isOpen: boolean;
    fileId: number;
    currentName: string;
  } | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    fetchDocuments();
  }, [isAuthenticated, currentFolderId]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const folderParam = currentFolderId !== null ? `?folderId=${currentFolderId}` : '';
      const response = await fetch(`/api/documents${folderParam}`);
      
      if (!response.ok) {
        throw new Error('Failed to load documents');
      }
      
      const data = await response.json();
      setDocuments(data.documents || []);
    } catch (error: any) {
      console.error('Error fetching documents:', error);
      showError(error.message || 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const handleFolderSelect = (folderId: number | null) => {
    setCurrentFolderId(folderId);
  };

  const handleCreateFolder = (parentId: number | null) => {
    setFolderModal({
      isOpen: true,
      mode: 'create',
      parentId
    });
  };

  const handleRenameFolder = (folderId: number, currentName: string) => {
    setFolderModal({
      isOpen: true,
      mode: 'rename',
      folderId,
      currentName
    });
  };

  const handleDeleteFolder = (folderId: number, name: string) => {
    setDeleteModal({
      isOpen: true,
      id: folderId,
      name,
      type: 'folder'
    });
  };

  const handleDeleteFile = (fileId: number, name: string) => {
    setDeleteModal({
      isOpen: true,
      id: fileId,
      name,
      type: 'file'
    });
  };

  const handleViewFile = (doc: Document) => {
    setPreviewFile(doc);
  };

  const handleRenameFile = (fileId: number, currentName: string) => {
    setRenameFileModal({
      isOpen: true,
      fileId,
      currentName
    });
  };

  const handleRenameFileSuccess = () => {
    fetchDocuments();
    showSuccess('File renamed successfully');
  };

  const handleFolderSuccess = () => {
    fetchDocuments();
    setRefreshTrigger(prev => prev + 1);
    showSuccess(`Folder ${folderModal.mode === 'create' ? 'created' : 'renamed'} successfully`);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteModal) return;

    try {
      const endpoint = deleteModal.type === 'folder'
        ? `/api/documents/folders/${deleteModal.id}`
        : `/api/documents/${deleteModal.id}`;
      
      const response = await fetch(endpoint, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete');
      }

      showSuccess(`${deleteModal.type === 'folder' ? 'Folder' : 'File'} moved to trash`);
      fetchDocuments();
      setRefreshTrigger(prev => prev + 1);
    } catch (error: any) {
      throw error; // Let the modal handle the error
    }
  };

  const handleUploadComplete = () => {
    fetchDocuments();
    setShowUpload(false);
    showSuccess('Files uploaded successfully');
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <div className="flex h-[calc(100vh-64px)]">
        {/* Sidebar - Folder Tree */}
        <div className="w-64 bg-white border-r border-gray-200 overflow-y-auto">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Folders</h2>
              {canUpload && (
                <button
                  onClick={() => handleCreateFolder(null)}
                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                  title="Create folder"
                >
                  <FolderPlus className="w-5 h-5" />
                </button>
              )}
            </div>
            <FolderTree
              currentFolderId={currentFolderId}
              onFolderSelect={handleFolderSelect}
              onCreateFolder={handleCreateFolder}
              refreshTrigger={refreshTrigger}
            />
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Breadcrumb */}
          <Breadcrumb
            currentFolderId={currentFolderId}
            onNavigate={handleFolderSelect}
          />

          {/* Page Header */}
          <div className="px-6 py-4 bg-white border-b">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
                <p className="text-sm text-gray-600 mt-1">
                  {currentFolderId === null 
                    ? 'All documents and folders' 
                    : 'Browse and manage your files'
                  }
                </p>
              </div>
              <div className="flex items-center gap-3">
                {isAdmin && (
                  <Link
                    href="/documents/trash"
                    className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg border border-red-200 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Trash</span>
                  </Link>
                )}
                {canUpload && (
                  <button
                    onClick={() => setShowUpload(!showUpload)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Upload Files</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-7xl mx-auto space-y-6">
              {/* Storage Indicator */}
              <StorageIndicator />

              {/* File Upload */}
              {canUpload && showUpload && (
                <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Upload Files</h3>
                    <button
                      onClick={() => setShowUpload(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      ×
                    </button>
                  </div>
                  <FileUpload
                    onUploadComplete={handleUploadComplete}
                    onUploadSuccess={showSuccess}
                    onUploadError={showError}
                    folderId={currentFolderId}
                  />
                </div>
              )}

              {/* Documents Table */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <DocumentsTable
                  documents={documents}
                  loading={loading}
                  onFolderClick={handleFolderSelect}
                  onRenameFolder={handleRenameFolder}
                  onDeleteFolder={handleDeleteFolder}
                  onDeleteFile={handleDeleteFile}
                  onViewFile={handleViewFile}
                  onRenameFile={canRename ? handleRenameFile : undefined}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <FolderModal
        isOpen={folderModal.isOpen}
        onClose={() => setFolderModal({ ...folderModal, isOpen: false })}
        onSuccess={handleFolderSuccess}
        mode={folderModal.mode}
        parentId={folderModal.parentId}
        folderId={folderModal.folderId}
        currentName={folderModal.currentName}
      />

      {deleteModal && (
        <DeleteConfirmModal
          isOpen={deleteModal.isOpen}
          onClose={() => setDeleteModal(null)}
          onConfirm={handleDeleteConfirm}
          itemName={deleteModal.name}
          itemType={deleteModal.type}
        />
      )}

      {/* File Rename Modal */}
      {renameFileModal && (
        <RenameFileModal
          isOpen={renameFileModal.isOpen}
          onClose={() => setRenameFileModal(null)}
          onSuccess={handleRenameFileSuccess}
          fileId={renameFileModal.fileId}
          currentName={renameFileModal.currentName}
        />
      )}

      {/* File Preview Modal */}
      {previewFile && previewFile.fileUrl && (
        <FilePreview
          fileId={previewFile.id}
          fileName={previewFile.name}
          fileType={previewFile.fileType || ''}
          fileUrl={previewFile.fileUrl}
          onClose={() => setPreviewFile(null)}
        />
      )}
    </div>
  );
}

export default function DocumentsPage() {
  return (
    <ToastProvider>
      <DocumentsPageContent />
    </ToastProvider>
  );
}
