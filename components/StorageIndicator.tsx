'use client';

import { useEffect, useState } from 'react';
import { FiHardDrive } from 'react-icons/fi';
import { formatFileSize, getStorageStatusColor } from '@/lib/file-utils';

interface StorageStats {
  used: number;
  total: number;
  percentage: number;
  usedFormatted: string;
  totalFormatted: string;
  fileCount: number;
  available: number;
  availableFormatted: string;
}

export default function StorageIndicator() {
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/documents/storage-stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching storage stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
          <div className="h-8 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const statusColor = getStorageStatusColor(stats.percentage);
  const colorClasses: Record<string, string> = {
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500',
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <FiHardDrive className="text-2xl text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Storage Usage</h3>
        </div>
        <span className="text-sm text-gray-600">
          {stats.fileCount} file{stats.fileCount !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="mb-3">
        <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
          <div
            className={`h-full ${colorClasses[statusColor]} transition-all duration-500 ease-out`}
            style={{ width: `${Math.min(stats.percentage, 100)}%` }}
          ></div>
        </div>
      </div>

      {/* Stats */}
      <div className="flex justify-between items-center text-sm">
        <span className="text-gray-600">
          <span className="font-medium text-gray-900">{stats.usedFormatted}</span> used
        </span>
        <span className="text-gray-600">
          <span className="font-medium text-gray-900">{stats.percentage}%</span>
        </span>
        <span className="text-gray-600">
          <span className="font-medium text-gray-900">{stats.availableFormatted}</span> free
        </span>
      </div>

      {/* Total */}
      <p className="text-xs text-gray-500 mt-2 text-center">
        Total capacity: {stats.totalFormatted}
      </p>

      {/* Warning */}
      {stats.percentage >= 90 && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-xs text-red-800 font-medium">
            ⚠️ Storage is almost full! Please delete unused files or contact support.
          </p>
        </div>
      )}
      {stats.percentage >= 70 && stats.percentage < 90 && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-xs text-yellow-800 font-medium">
            ⚠️ Storage is running low. Consider cleaning up old files.
          </p>
        </div>
      )}
    </div>
  );
}
