'use client';

import { useState, useEffect } from 'react';
import { FiX, FiDownload } from 'react-icons/fi';

interface FilePreviewProps {
  fileId: number;
  fileName: string;
  fileType: string;
  fileUrl: string;
  onClose: () => void;
}

export default function FilePreview({
  fileId,
  fileName,
  fileType,
  fileUrl,
  onClose,
}: FilePreviewProps) {
  const [csvData, setCsvData] = useState<string[][] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Parse CSV if it's a CSV file
    if (fileType === 'text/csv') {
      fetchAndParseCSV();
    }
  }, [fileUrl, fileType]);

  const fetchAndParseCSV = async () => {
    setLoading(true);
    try {
      const response = await fetch(fileUrl);
      const text = await response.text();
      const rows = text.split('\n').map((row) =>
        row.split(',').map((cell) => cell.trim())
      );
      setCsvData(rows);
    } catch (error) {
      console.error('Error parsing CSV:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    window.open(`/api/documents/${fileId}/download`, '_blank');
  };

  const renderPreview = () => {
    // Image preview
    if (fileType.startsWith('image/')) {
      return (
        <div className="flex items-center justify-center p-4 bg-gray-50">
          <img
            src={fileUrl}
            alt={fileName}
            className="max-w-full max-h-[70vh] object-contain"
          />
        </div>
      );
    }

    // PDF preview
    if (fileType === 'application/pdf') {
      return (
        <div className="w-full h-[70vh]">
          <iframe
            src={fileUrl}
            className="w-full h-full border-0"
            title={fileName}
          />
        </div>
      );
    }

    // CSV preview
    if (fileType === 'text/csv' && csvData) {
      return (
        <div className="p-4 overflow-auto max-h-[70vh]">
          {loading ? (
            <p className="text-gray-500">Loading CSV data...</p>
          ) : (
            <table className="min-w-full border-collapse border border-gray-300">
              <tbody>
                {csvData.map((row, rowIndex) => (
                  <tr key={rowIndex} className={rowIndex === 0 ? 'bg-gray-100 font-medium' : ''}>
                    {row.map((cell, cellIndex) => (
                      <td
                        key={cellIndex}
                        className="border border-gray-300 px-4 py-2 text-sm"
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      );
    }

    // Unsupported file type
    return (
      <div className="flex flex-col items-center justify-center p-12 text-gray-500">
        <p className="text-lg mb-4">Preview not available for this file type</p>
        <button
          onClick={handleDownload}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
        >
          <FiDownload />
          <span>Download to view</span>
        </button>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 truncate flex-1">
            {fileName}
          </h3>
          <div className="flex items-center space-x-2 ml-4">
            <button
              onClick={handleDownload}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Download"
            >
              <FiDownload className="text-xl" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Close"
            >
              <FiX className="text-xl" />
            </button>
          </div>
        </div>

        {/* Preview Content */}
        <div className="flex-1 overflow-auto">
          {renderPreview()}
        </div>
      </div>
    </div>
  );
}
