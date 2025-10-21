'use client';

import { createContext, useContext, ReactNode } from 'react';
import { useToast, ToastContainer, ToastType } from './Toast';

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
  showWarning: (message: string) => void;
  showInfo: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const { toasts, addToast, removeToast } = useToast();

  const showToast = (message: string, type: ToastType = 'info', duration = 3000) => {
    addToast(message, type, duration);
  };

  const showSuccess = (message: string) => addToast(message, 'success', 3000);
  const showError = (message: string) => addToast(message, 'error', 5000);
  const showWarning = (message: string) => addToast(message, 'warning', 4000);
  const showInfo = (message: string) => addToast(message, 'info', 3000);

  return (
    <ToastContext.Provider value={{ showToast, showSuccess, showError, showWarning, showInfo }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToastContext() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToastContext must be used within ToastProvider');
  }
  return context;
}
