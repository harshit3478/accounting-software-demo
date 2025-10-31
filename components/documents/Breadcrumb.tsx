import React, { useEffect, useState } from 'react';
import { ChevronRight, Home, Loader2 } from 'lucide-react';

interface BreadcrumbItem {
  id: number;
  name: string;
  type: 'folder';
}

interface BreadcrumbProps {
  currentFolderId: number | null;
  onNavigate: (folderId: number | null) => void;
}

export default function Breadcrumb({ currentFolderId, onNavigate }: BreadcrumbProps) {
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (currentFolderId === null || currentFolderId === 0) {
      setBreadcrumb([]);
      return;
    }

    loadBreadcrumb();
  }, [currentFolderId]);

  const loadBreadcrumb = async () => {
    if (!currentFolderId) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/documents/breadcrumb/${currentFolderId}`);
      
      if (!response.ok) {
        throw new Error('Failed to load breadcrumb');
      }
      
      const data = await response.json();
      // Remove the root "All Documents" item as we'll render our own
      setBreadcrumb(data.breadcrumb.filter((item: BreadcrumbItem) => item.id > 0));
    } catch (err) {
      console.error('Error loading breadcrumb:', err);
      setBreadcrumb([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2 px-4 py-3 bg-white border-b overflow-x-auto">
      {/* Home / Root */}
      <button
        onClick={() => onNavigate(null)}
        className={`
          flex items-center gap-1.5 px-2 py-1 rounded-md text-sm
          transition-colors flex-shrink-0
          ${currentFolderId === null 
            ? 'bg-blue-50 text-blue-700 font-medium' 
            : 'text-gray-600 hover:bg-gray-100'
          }
        `}
      >
        <Home className="w-4 h-4" />
        <span>All Documents</span>
      </button>

      {loading && (
        <>
          <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
        </>
      )}

      {/* Breadcrumb Items */}
      {breadcrumb.map((item, index) => {
        const isLast = index === breadcrumb.length - 1;
        
        return (
          <React.Fragment key={item.id}>
            <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <button
              onClick={() => onNavigate(item.id)}
              className={`
                px-2 py-1 rounded-md text-sm transition-colors flex-shrink-0
                ${isLast
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-100'
                }
              `}
            >
              {item.name}
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}
