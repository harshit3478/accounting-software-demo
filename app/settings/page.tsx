'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Navigation from '../../components/Navigation';
import { ToastProvider, useToastContext } from '../../components/ToastContext';
import ConfirmModal from '../../components/ConfirmModal';
import { FiCheck, FiX, FiRefreshCw } from 'react-icons/fi';

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

function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showSuccess, showError } = useToastContext();
  
  const [qbConnection, setQbConnection] = useState<QuickBooksConnection | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

  useEffect(() => {
    fetchConnectionStatus();
    
    // Check for OAuth callback messages
    const qbSuccess = searchParams?.get('qb_success');
    const qbError = searchParams?.get('qb_error');
    
    if (qbSuccess) {
      showSuccess('Successfully connected to QuickBooks!');
      router.replace('/settings');
    }
    
    if (qbError) {
      showError(`QuickBooks connection failed: ${qbError}`);
      router.replace('/settings');
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
        // Redirect to QuickBooks authorization page
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

  const handleDisconnect = async () => {
    setShowDisconnectConfirm(true);
  };

  const confirmDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      const res = await fetch('/api/quickbooks/connection', {
        method: 'DELETE'
      });
      
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
    <div className="bg-gray-50 min-h-screen">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600 mt-2">Manage your integrations and preferences</p>
        </div>

        {/* QuickBooks Integration Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">QuickBooks Integration</h2>
              <p className="text-gray-600">
                Connect your QuickBooks account to automatically sync payments
              </p>
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
                    <p className="text-sm text-green-700 mt-1">
                      Company ID: {qbConnection.connection?.realmId}
                    </p>
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
                  onClick={handleDisconnect}
                  disabled={isDisconnecting}
                  className="px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
                </button>
                
                {qbConnection.connection?.isExpired && (
                  <button
                    onClick={handleConnect}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
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
                  <strong>How it works:</strong> When you receive a payment in QuickBooks, 
                  it will automatically create an unmatched payment entry in this system. 
                  You can then match it to invoices using the Payment Matching feature.
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

        {/* Webhook Information Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Webhook Configuration</h2>
          <p className="text-gray-600 mb-4">
            Configure this webhook URL in your QuickBooks Developer Dashboard to receive payment notifications:
          </p>
          
          <div className="bg-gray-50 border text-black border-gray-200 rounded-lg p-4 font-mono text-sm break-all">
            {process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/quickbooks/webhook
          </div>
          
          <p className="text-sm text-gray-500 mt-4">
            <strong>Note:</strong> For local development, you'll need to use a service like ngrok to expose 
            your local server to the internet, as QuickBooks requires a public HTTPS URL for webhooks.
          </p>
        </div>
      </div>

      {/* Disconnect Confirmation Modal */}
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

export default function SettingsPage() {
  return (
    <ToastProvider>
      <SettingsContent />
    </ToastProvider>
  );
}
