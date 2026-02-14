'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FiCheck, FiRefreshCw } from 'react-icons/fi';
import ConfirmModal from '../ConfirmModal';

interface QuickBooksConnection {
  connected: boolean;
  connection: {
    id: number;
    realmId: string;
    isActive: boolean;
    isExpired: boolean;
    lastSyncAt: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
}

interface QuickBooksTabProps {
  showSuccess: (msg: string) => void;
  showError: (msg: string) => void;
}

export default function QuickBooksTab({ showSuccess, showError }: QuickBooksTabProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [qbConnection, setQbConnection] = useState<QuickBooksConnection | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

  useEffect(() => {
    fetchConnectionStatus();

    const qbSuccess = searchParams?.get('qb_success');
    const qbError = searchParams?.get('qb_error');

    if (qbSuccess) {
      showSuccess('Successfully connected to QuickBooks!');
      router.replace('/settings?tab=quickbooks');
    }
    if (qbError) {
      showError(`QuickBooks connection failed: ${qbError}`);
      router.replace('/settings?tab=quickbooks');
    }
  }, [searchParams]);

  const fetchConnectionStatus = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/quickbooks/connection');
      if (res.ok) {
        const data = await res.json();
        setQbConnection(data);
      }
    } catch (error) {
      console.error('Failed to fetch connection status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const res = await fetch('/api/quickbooks/auth');
      if (res.ok) {
        const data = await res.json();
        window.location.href = data.authUri;
      } else {
        showError('Failed to initiate QuickBooks connection');
        setIsConnecting(false);
      }
    } catch (error) {
      console.error('Connection error:', error);
      showError('Failed to connect to QuickBooks');
      setIsConnecting(false);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/quickbooks/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ daysBack: 30 }),
      });
      if (res.ok) {
        const data = await res.json();
        showSuccess(`Sync completed: ${data.created} created, ${data.updated} updated, ${data.skipped} skipped`);
        fetchConnectionStatus();
      } else {
        const error = await res.json();
        showError(`Sync failed: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Sync error:', error);
      showError('Failed to sync with QuickBooks');
    } finally {
      setIsSyncing(false);
    }
  };

  const confirmDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      const res = await fetch('/api/quickbooks/connection', { method: 'DELETE' });
      if (res.ok) {
        showSuccess('Successfully disconnected from QuickBooks');
        setShowDisconnectConfirm(false);
        fetchConnectionStatus();
      } else {
        showError('Failed to disconnect from QuickBooks');
      }
    } catch (error) {
      console.error('Disconnect error:', error);
      showError('Failed to disconnect from QuickBooks');
    } finally {
      setIsDisconnecting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* QuickBooks Integration Card */}
      <div>
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">QuickBooks Integration</h2>
            <p className="text-gray-600">Connect your QuickBooks account to automatically sync payments</p>
          </div>
          <div className="flex-shrink-0">
            <img
              src="https://rksbusiness.com/wp-content/uploads/2022/09/QuickBooks-Logo-Preferred-RGB-1200x381.png"
              alt="QuickBooks"
              className="h-12"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : qbConnection?.connected ? (
          <div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <div className="flex items-center">
                <FiCheck className="text-green-600 text-xl mr-3" />
                <div className="flex-1">
                  <p className="font-medium text-green-900">Connected to QuickBooks</p>
                  <p className="text-sm text-green-700 mt-1">Company ID: {qbConnection.connection?.realmId}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Status</p>
                <p className="font-medium text-gray-900">
                  {qbConnection.connection?.isExpired ? (
                    <span className="text-amber-600">Token Expired - Reconnect</span>
                  ) : (
                    <span className="text-green-600">Active</span>
                  )}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Last Sync</p>
                <p className="font-medium text-gray-900">
                  {qbConnection.connection?.lastSyncAt
                    ? new Date(qbConnection.connection.lastSyncAt).toLocaleDateString()
                    : 'Never'}
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSync}
                disabled={isSyncing}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center disabled:opacity-50"
              >
                <FiRefreshCw className={`mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Syncing...' : 'Sync Now'}
              </button>
              <button
                onClick={() => setShowDisconnectConfirm(true)}
                disabled={isDisconnecting}
                className="px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
              </button>
              {qbConnection.connection?.isExpired && (
                <button
                  onClick={handleConnect}
                  className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors flex items-center"
                >
                  <FiRefreshCw className="mr-2" />
                  Reconnect
                </button>
              )}
            </div>
          </div>
        ) : (
          <div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-blue-800">
                <strong>How it works:</strong> When you receive a payment in QuickBooks, it will automatically create an unmatched payment entry in this system. You can then match it to invoices using the Payment Matching feature.
              </p>
            </div>
            <button
              onClick={handleConnect}
              disabled={isConnecting}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50"
            >
              {isConnecting ? 'Connecting...' : 'Connect to QuickBooks'}
            </button>
          </div>
        )}
      </div>

      {/* Webhook Configuration */}
      <div className="border-t border-gray-200 pt-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Webhook Configuration</h2>
        <p className="text-gray-600 mb-4">
          Configure this webhook URL in your QuickBooks Developer Dashboard to receive automatic payment notifications:
        </p>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 font-mono text-sm text-gray-900 break-all">
          {process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/quickbooks/webhook
        </div>
        <div className="mt-4 space-y-2">
          <p className="text-sm text-gray-700 font-medium">Setup Instructions:</p>
          <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
            <li>Go to <a href="https://developer.intuit.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">QuickBooks Developer Dashboard</a></li>
            <li>Navigate to your app &rarr; <strong>Webhooks</strong> section</li>
            <li>Generate a <strong>Verifier Token</strong> and add it to your <code className="bg-gray-100 px-1 rounded">QUICKBOOKS_WEBHOOK_VERIFIER</code> env variable</li>
            <li>Set the webhook URL above (must be HTTPS in production)</li>
            <li>Subscribe to <strong>Payment</strong> events (Create, Update)</li>
          </ol>
          <p className="text-sm text-amber-600 mt-3">
            <strong>Development:</strong> Use <a href="https://ngrok.com/" target="_blank" rel="noopener noreferrer" className="underline">ngrok</a> or similar to expose localhost. QuickBooks requires a public HTTPS URL for webhooks.
          </p>
        </div>
      </div>

      <ConfirmModal
        isOpen={showDisconnectConfirm}
        title="Disconnect QuickBooks"
        message="Are you sure you want to disconnect QuickBooks? This will stop automatic payment syncing."
        confirmText="Disconnect"
        cancelText="Cancel"
        onConfirm={confirmDisconnect}
        onCancel={() => setShowDisconnectConfirm(false)}
        isLoading={isDisconnecting}
        danger={true}
      />
    </div>
  );
}
