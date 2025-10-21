'use client';

import { useEffect } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl';
  headerColor?: 'blue' | 'green' | 'red' | 'purple' | 'gray';
}

export default function Modal({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  footer, 
  maxWidth = '2xl',
  headerColor = 'blue' 
}: ModalProps) {
  // Handle ESC key to close modal
  useEffect(() => {
    if (!isOpen) return;
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
    
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
    '6xl': 'max-w-6xl',
  };

  const headerColorClasses = {
    blue: 'bg-gradient-to-r from-blue-600 to-blue-700',
    green: 'bg-gradient-to-r from-green-600 to-green-700',
    red: 'bg-gradient-to-r from-red-600 to-red-700',
    purple: 'bg-gradient-to-r from-purple-600 to-purple-700',
    gray: 'bg-gradient-to-r from-gray-700 to-gray-800',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      {/* Enhanced backdrop with blur */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-md transition-all duration-300"
        onClick={onClose}
        aria-hidden="true"
      ></div>
      
      {/* Modal content */}
      <div 
        className={`relative bg-white rounded-2xl shadow-2xl ${maxWidthClasses[maxWidth]} w-full max-h-[90vh] overflow-hidden animate-scale-in`}
        role="dialog"
        aria-modal="true"
      >
        {/* Sticky header */}
        <div className={`sticky top-0 z-10 ${headerColorClasses[headerColor]} px-8 py-6 rounded-t-2xl shadow-lg`}>
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-bold text-white drop-shadow-sm">{title}</h3>
            <button
              onClick={onClose}
              className="text-white/90 hover:text-white hover:bg-white/10 rounded-lg p-2 transition-all duration-200"
              aria-label="Close modal"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto max-h-[calc(90vh-180px)] px-8 py-6">
          {children}
        </div>

        {/* Sticky footer */}
        {footer && (
          <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-8 py-6 rounded-b-2xl shadow-inner">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
