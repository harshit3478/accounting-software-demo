// File size constants
export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB in bytes
export const MAX_TOTAL_STORAGE = 100 * 1024 * 1024 * 1024; // 100GB in bytes

// Accepted file types
export const ACCEPTED_FILE_TYPES = {
  // Images
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
  'image/svg+xml': ['.svg'],
  
  // Documents
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-powerpoint': ['.ppt'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  
  // Text files
  'text/plain': ['.txt'],
  'text/csv': ['.csv'],
  'text/html': ['.html'],
  'application/json': ['.json'],
  'application/xml': ['.xml'],
  
  // Archives
  'application/zip': ['.zip'],
  'application/x-rar-compressed': ['.rar'],
  'application/x-7z-compressed': ['.7z'],
};

/**
 * Format bytes to human-readable size
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Validate file type
 */
export function isValidFileType(mimeType: string): boolean {
  return Object.keys(ACCEPTED_FILE_TYPES).includes(mimeType);
}

/**
 * Validate file size
 */
export function isValidFileSize(size: number): boolean {
  return size > 0 && size <= MAX_FILE_SIZE;
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  return filename.slice(((filename.lastIndexOf('.') - 1) >>> 0) + 2);
}

/**
 * Generate unique filename
 */
export function generateUniqueFileName(originalName: string): string {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 15);
  const extension = getFileExtension(originalName);
  const baseName = originalName.replace(`.${extension}`, '').replace(/[^a-zA-Z0-9]/g, '-');
  
  return `${timestamp}-${randomString}-${baseName}.${extension}`;
}

/**
 * Get file icon/color based on file type
 */
export function getFileTypeInfo(mimeType: string): { icon: string; color: string; category: string } {
  if (mimeType.startsWith('image/')) {
    return { icon: '🖼️', color: '#10b981', category: 'Image' };
  }
  if (mimeType === 'application/pdf') {
    return { icon: '📄', color: '#ef4444', category: 'PDF' };
  }
  if (mimeType.includes('word') || mimeType.includes('document')) {
    return { icon: '📝', color: '#3b82f6', category: 'Document' };
  }
  if (mimeType.includes('sheet') || mimeType.includes('excel') || mimeType === 'text/csv') {
    return { icon: '📊', color: '#10b981', category: 'Spreadsheet' };
  }
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) {
    return { icon: '📊', color: '#f59e0b', category: 'Presentation' };
  }
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('7z')) {
    return { icon: '🗜️', color: '#8b5cf6', category: 'Archive' };
  }
  if (mimeType.startsWith('text/')) {
    return { icon: '📃', color: '#6b7280', category: 'Text' };
  }
  
  return { icon: '📎', color: '#6b7280', category: 'File' };
}

/**
 * Check if file can be previewed
 */
export function canPreviewFile(mimeType: string): boolean {
  return (
    mimeType.startsWith('image/') ||
    mimeType === 'application/pdf' ||
    mimeType === 'text/csv' ||
    mimeType.startsWith('text/plain')
  );
}

/**
 * Calculate storage percentage
 */
export function calculateStoragePercentage(used: number, total: number = MAX_TOTAL_STORAGE): number {
  return Math.round((used / total) * 100);
}

/**
 * Get storage status color
 */
export function getStorageStatusColor(percentage: number): string {
  if (percentage < 70) return 'green';
  if (percentage < 90) return 'yellow';
  return 'red';
}
