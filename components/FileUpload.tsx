'use client';

import { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { FiUploadCloud, FiX, FiFile } from 'react-icons/fi';
import { formatFileSize, isValidFileSize, isValidFileType } from '@/lib/file-utils';

interface FileWithPreview {
  file: File;
  id: string;
  error?: string;
}

interface FileUploadProps {
  onUploadComplete?: () => void;
}

export default function FileUpload({ onUploadComplete }: FileUploadProps) {
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      addFiles(selectedFiles);
    }
  };

  const addFiles = (newFiles: File[]) => {
    const filesWithPreview: FileWithPreview[] = newFiles.map((file) => {
      let error: string | undefined;

      if (!isValidFileSize(file.size)) {
        error = `File size exceeds 20MB limit`;
      } else if (!isValidFileType(file.type)) {
        error = 'File type not supported';
      }

      return {
        file,
        id: `${Date.now()}-${Math.random()}`,
        error,
      };
    });

    setFiles((prev) => [...prev, ...filesWithPreview]);
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleUpload = async () => {
    const validFiles = files.filter((f) => !f.error);

    if (validFiles.length === 0) {
      alert('No valid files to upload');
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      validFiles.forEach((fileItem) => {
        formData.append('files', fileItem.file);
      });

      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        alert(`Successfully uploaded ${data.uploaded.length} file(s)`);
        setFiles([]);
        if (onUploadComplete) {
          onUploadComplete();
        }
      } else {
        alert(`Upload failed: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Upload Documents</h3>

      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <FiUploadCloud className="mx-auto text-5xl text-gray-400 mb-4" />
        <p className="text-gray-700 font-medium mb-2">
          Drag & drop files here, or click to select
        </p>
        <p className="text-sm text-gray-500 mb-4">
          Maximum file size: 20MB. Supports images, PDFs, documents, spreadsheets, and more.
        </p>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Select Files
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar"
        />
      </div>

      {/* Selected Files List */}
      {files.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-gray-700 mb-3">
            Selected Files ({files.length})
          </h4>
          <div className="space-y-2">
            {files.map((fileItem) => (
              <div
                key={fileItem.id}
                className={`flex items-center justify-between p-3 rounded-lg ${
                  fileItem.error ? 'bg-red-50 border border-red-200' : 'bg-gray-50'
                }`}
              >
                <div className="flex items-center space-x-3 flex-1">
                  <FiFile className={`text-xl ${fileItem.error ? 'text-red-500' : 'text-gray-500'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {fileItem.file.name}
                    </p>
                    <p className={`text-xs ${fileItem.error ? 'text-red-600' : 'text-gray-500'}`}>
                      {fileItem.error || formatFileSize(fileItem.file.size)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => removeFile(fileItem.id)}
                  className="text-gray-400 hover:text-gray-600 ml-2"
                  disabled={isUploading}
                >
                  <FiX className="text-xl" />
                </button>
              </div>
            ))}
          </div>

          {/* Upload Button */}
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleUpload}
              disabled={isUploading || files.every((f) => f.error)}
              className={`px-6 py-2 rounded-lg font-medium ${
                isUploading || files.every((f) => f.error)
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {isUploading ? 'Uploading...' : `Upload ${files.filter((f) => !f.error).length} File(s)`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
