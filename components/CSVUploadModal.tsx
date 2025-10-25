'use client';

import { useState, useRef } from 'react';

interface ValidationResult {
  valid: boolean;
  totalRows: number;
  validRows: number;
  invalidRows: Array<{
    row: number;
    errors: string[];
  }>;
  duplicates: Array<{
    rows: number[];
    reason: string;
  }>;
}

interface CSVUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  title: string;
  type: 'invoices' | 'payments';
  templateUrl: string;
  validateUrl: string;
  uploadUrl: string;
}

export default function CSVUploadModal({
  isOpen,
  onClose,
  onSuccess,
  title,
  type,
  templateUrl,
  validateUrl,
  uploadUrl
}: CSVUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleClose = () => {
    setFile(null);
    setValidationResult(null);
    setError('');
    onClose();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type === 'text/csv') {
      handleFileSelect(droppedFile);
    } else {
      setError('Please upload a valid CSV file');
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  };

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    setError('');
    setValidationResult(null);

    // Auto-validate
    await validateFile(selectedFile);
  };

  const validateFile = async (fileToValidate: File) => {
    setIsValidating(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', fileToValidate);

      const res = await fetch(validateUrl, {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const result = await res.json();
        setValidationResult(result);
      } else {
        const errorData = await res.json();
        setError(errorData.error || 'Validation failed');
      }
    } catch (err) {
      setError('Failed to validate file');
      console.error('Validation error:', err);
    } finally {
      setIsValidating(false);
    }
  };

  const handleUpload = async () => {
    if (!file || !validationResult?.valid) return;

    setIsUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(uploadUrl, {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const result = await res.json();
        onSuccess();
        handleClose();
      } else {
        const errorData = await res.json();
        setError(errorData.error || 'Upload failed');
      }
    } catch (err) {
      setError('Failed to upload file');
      console.error('Upload error:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const downloadTemplate = async () => {
    try {
      const res = await fetch(templateUrl);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}-template.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download template:', err);
      setError('Failed to download template');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-scale-in">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Step 1: Download Template */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Step 1: Download Template</h3>
            <button
              onClick={downloadTemplate}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
              Download CSV Template
            </button>
          </div>

          {/* Step 2: Upload File */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Step 2: Upload Filled CSV</h3>
            
            {!file ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDragging
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                </svg>
                <p className="text-gray-600 font-medium mb-1">Drag & drop CSV file here</p>
                <p className="text-sm text-gray-500">or click to browse</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                    <span className="font-medium text-gray-900">{file.name}</span>
                    <span className="text-sm text-gray-500">({(file.size / 1024).toFixed(1)} KB)</span>
                  </div>
                  <button
                    onClick={() => {
                      setFile(null);
                      setValidationResult(null);
                    }}
                    className="text-red-600 hover:text-red-700 text-sm font-medium"
                  >
                    Remove
                  </button>
                </div>

                {/* Validation Progress */}
                {isValidating && (
                  <div className="flex items-center gap-2 text-blue-600">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <span className="text-sm">Validating {validationResult ? `${validationResult.validRows}/${validationResult.totalRows}` : '...'}</span>
                  </div>
                )}

                {/* Validation Result */}
                {!isValidating && validationResult && (
                  <div className="mt-3 space-y-3">
                    {validationResult.valid ? (
                      <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <svg className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-green-900">All rows valid!</p>
                          <p className="text-xs text-green-700 mt-1">
                            {validationResult.totalRows} row{validationResult.totalRows !== 1 ? 's' : ''} ready to upload
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                          <svg className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                          </svg>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-red-900">
                              {validationResult.invalidRows.length} invalid row{validationResult.invalidRows.length !== 1 ? 's' : ''}
                            </p>
                            <p className="text-xs text-red-700 mt-1">
                              Fix errors before uploading
                            </p>
                          </div>
                        </div>

                        {/* Error List */}
                        <div className="max-h-48 overflow-y-auto space-y-1">
                          {validationResult.invalidRows.map((item) => (
                            <div key={item.row} className="text-xs p-2 bg-red-50 rounded border border-red-100">
                              <span className="font-semibold text-red-900">Row {item.row}:</span>
                              <ul className="mt-1 space-y-0.5 ml-2">
                                {item.errors.map((err, idx) => (
                                  <li key={idx} className="text-red-700">• {err}</li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>

                        {/* Duplicates */}
                        {validationResult.duplicates.length > 0 && (
                          <div className="text-xs p-2 bg-yellow-50 rounded border border-yellow-200">
                            <p className="font-semibold text-yellow-900 mb-1">Duplicate entries detected:</p>
                            {validationResult.duplicates.map((dup, idx) => (
                              <p key={idx} className="text-yellow-700">
                                • Rows {dup.rows.join(', ')}: {dup.reason}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <svg className="w-5 h-5 text-red-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Info Banner for Payments */}
          {type === 'payments' && file && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
              <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <div className="flex-1 text-sm text-blue-800">
                <p className="font-medium">All uploaded payments will be unmatched.</p>
                <p className="mt-1">Use <span className="font-semibold">Payment Matching</span> to link them to invoices after upload.</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={handleClose}
            disabled={isUploading}
            className="px-6 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={!file || !validationResult?.valid || isValidating || isUploading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isUploading && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            )}
            {isUploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  );
}
