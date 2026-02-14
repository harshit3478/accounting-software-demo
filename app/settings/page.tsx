'use client';

import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Navigation from '../../components/Navigation';
import { ToastProvider, useToastContext } from '../../components/ToastContext';
import PaymentMethodsTab from '../../components/settings/PaymentMethodsTab';
import UserManagementTab from '../../components/settings/UserManagementTab';
import TermsConditionsTab from '../../components/settings/TermsConditionsTab';
import QuickBooksTab from '../../components/settings/QuickBooksTab';
import { CreditCard, Users, FileText, Link2 } from 'lucide-react';

const TABS = [
  { id: 'payment-methods', label: 'Payment Methods', icon: CreditCard },
  { id: 'users', label: 'User Management', icon: Users },
  { id: 'terms', label: 'Terms & Conditions', icon: FileText },
  { id: 'quickbooks', label: 'QuickBooks', icon: Link2 },
] as const;

type TabId = typeof TABS[number]['id'];

function SettingsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { showSuccess, showError } = useToastContext();

  const activeTab = (searchParams.get('tab') as TabId) || 'payment-methods';

  const setActiveTab = (tab: TabId) => {
    router.push(`/settings?tab=${tab}`);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'payment-methods':
        return <PaymentMethodsTab showSuccess={showSuccess} showError={showError} />;
      case 'users':
        return <UserManagementTab showSuccess={showSuccess} showError={showError} />;
      case 'terms':
        return <TermsConditionsTab showSuccess={showSuccess} showError={showError} />;
      case 'quickbooks':
        return <QuickBooksTab showSuccess={showSuccess} showError={showError} />;
      default:
        return <PaymentMethodsTab showSuccess={showSuccess} showError={showError} />;
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      <Navigation />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600 mt-1">Manage your system configuration and preferences</p>
        </div>

        <div className="flex gap-6">
          {/* Sidebar */}
          <div className="w-56 flex-shrink-0">
            <nav className="space-y-1 sticky top-24">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'text-gray-700 hover:bg-gray-100 border border-transparent'
                    }`}
                  >
                    <Icon size={18} className={isActive ? 'text-blue-600' : 'text-gray-400'} />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              {renderTabContent()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <ToastProvider>
      <Suspense
        fallback={
          <div className="bg-gray-50 min-h-screen">
            <Navigation />
            <div className="max-w-7xl mx-auto px-4 py-8">
              <div className="animate-pulse">
                <div className="h-8 bg-gray-200 rounded w-48 mb-8"></div>
                <div className="flex gap-6">
                  <div className="w-56">
                    <div className="space-y-2">
                      <div className="h-10 bg-gray-200 rounded"></div>
                      <div className="h-10 bg-gray-200 rounded"></div>
                      <div className="h-10 bg-gray-200 rounded"></div>
                      <div className="h-10 bg-gray-200 rounded"></div>
                    </div>
                  </div>
                  <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="h-6 bg-gray-200 rounded w-64 mb-4"></div>
                    <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        }
      >
        <SettingsContent />
      </Suspense>
    </ToastProvider>
  );
}
