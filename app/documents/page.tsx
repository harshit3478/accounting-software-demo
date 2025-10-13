'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import Navigation from '@/components/Navigation';
import FileUpload from '@/components/FileUpload';
import StorageIndicator from '@/components/StorageIndicator';
import FileList from '@/components/FileList';
import { FiEdit2, FiCheck, FiX, FiFolder } from 'react-icons/fi';

interface Document {
  id: number;
  fileName: string;
  fileSize: number;
  fileType: string;
  fileUrl: string;
  uploadedBy: string;
  uploadedAt: string;
}

interface Folder {
  id: number;
  name: string;
  isDefault: boolean;
}

export default function DocumentsPage() {
  const router = useRouter();
  const { isAuthenticated, isAdmin } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [folder, setFolder] = useState<Folder | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditingFolder, setIsEditingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    fetchData();
  }, [isAuthenticated, router]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch documents and folder in parallel
      const [docsResponse, folderResponse] = await Promise.all([
        fetch('/api/documents'),
        fetch('/api/documents/folder'),
      ]);

      if (docsResponse.ok) {
        const docsData = await docsResponse.json();
        setDocuments(docsData.documents);
      }

      if (folderResponse.ok) {
        const folderData = await folderResponse.json();
        setFolder(folderData);
        setNewFolderName(folderData.name);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const startEditingFolder = () => {
    setIsEditingFolder(true);
    setNewFolderName(folder?.name || '');
  };

  const cancelEditingFolder = () => {
    setIsEditingFolder(false);
    setNewFolderName(folder?.name || '');
  };

  const handleRenameFolder = async () => {
    if (!newFolderName.trim()) {
      alert('Folder name cannot be empty');
      return;
    }

    try {
      const response = await fetch('/api/documents/folder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newName: newFolderName.trim() }),
      });

      if (response.ok) {
        const data = await response.json();
        setFolder(data.folder);
        setIsEditingFolder(false);
        alert('Folder renamed successfully');
      } else {
        const data = await response.json();
        alert(`Failed to rename folder: ${data.error}`);
      }
    } catch (error) {
      console.error('Rename error:', error);
      alert('Failed to rename folder');
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header with Folder Name */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <FiFolder className="text-4xl text-blue-600" />
              {isEditingFolder ? (
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    className="text-3xl font-bold text-gray-900 border-b-2 border-blue-500 focus:outline-none bg-transparent px-2"
                    autoFocus
                  />
                  <button
                    onClick={handleRenameFolder}
                    className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                    title="Save"
                  >
                    <FiCheck className="text-xl" />
                  </button>
                  <button
                    onClick={cancelEditingFolder}
                    className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg"
                    title="Cancel"
                  >
                    <FiX className="text-xl" />
                  </button>
                </div>
              ) : (
                <>
                  <h1 className="text-3xl font-bold text-gray-900">
                    {folder?.name || 'Documents'}
                  </h1>
                  {isAdmin && (
                    <button
                      onClick={startEditingFolder}
                      className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                      title="Rename Folder"
                    >
                      <FiEdit2 />
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
          <p className="text-gray-600 mt-2">
            Manage and access all your business documents in one place
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Storage Indicator */}
            <StorageIndicator />

            {/* File Upload (Admin Only) */}
            {isAdmin && (
              <FileUpload onUploadComplete={fetchData} />
            )}

            {/* File List */}
            <FileList
              documents={documents}
              isAdmin={isAdmin}
              onRefresh={fetchData}
            />
          </div>
        )}
      </div>
    </div>
  );
}
