"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Navigation from "../../components/Navigation";
import { useAuth } from "../../lib/AuthContext";
import { ToastProvider, useToastContext } from "../../components/ToastContext";
import PaymentMethodsTab from "../../components/settings/PaymentMethodsTab";
import UserManagementTab from "../../components/settings/UserManagementTab";
import RegularizationsTab from "../../components/settings/RegularizationsTab";
import UnitsTab from "../../components/settings/UnitsTab";
import CustomersTab from "../../components/settings/CustomersTab";
import LiveTypesTab from "../../components/settings/LiveTypesTab";
import TermsConditionsTab from "../../components/settings/TermsConditionsTab";
import ShippingFeeRulesTab from "../../components/settings/ShippingFeeRulesTab";
import InsuranceRulesTab from "../../components/settings/InsuranceRulesTab";
import QuickBooksTab from "../../components/settings/QuickBooksTab";
import LayawaySettingsTab from "../../components/settings/LayawaySettingsTab";
import LateFeeTab from "../../components/settings/LateFeeTab";
import EarlyPaymentDiscountTab from "../../components/settings/EarlyPaymentDiscountTab";
import DueReminderTab from "../../components/settings/DueReminderTab";
import DepositFeeRulesTab from "../../components/settings/DepositFeeRulesTab";
import RestockingFeeTab from "../../components/settings/RestockingFeeTab";
import RecalculationFeeTab from "../../components/settings/RecalculationFeeTab";
import MigratedInvoiceEditTab from "../../components/settings/MigratedInvoiceEditTab";
import DueDateReasonsTab from "../../components/settings/DueDateReasonsTab";
import ProfileTab from "../../components/settings/ProfileTab";
import {
  CreditCard,
  UserCircle,
  Users,
  CalendarCheck2,
  UsersRound,
  FileText,
  Link2,
  Ruler,
  Layers,
  Truck,
  CalendarClock,
  Shield,
  MapPinned,
} from "lucide-react";

const PROFILE_TAB = {
  id: "profile",
  label: "My Profile",
  icon: UserCircle,
} as const;

const ADMIN_TABS = [
  { id: "payment-methods", label: "Payment Methods", icon: CreditCard },
  { id: "users", label: "User Management", icon: Users },
  { id: "regularizations", label: "Regularizations", icon: CalendarCheck2 },
  { id: "customers", label: "Clients", icon: UsersRound },
  { id: "units", label: "Units", icon: Ruler },
  { id: "live-types", label: "Live Types", icon: MapPinned },
  { id: "terms", label: "Terms & Conditions", icon: FileText },
  { id: "shipping-fee-rules", label: "Shipping Fee Rules", icon: Truck },
  { id: "insurance-rules", label: "Insurance Rules", icon: Shield },
  { id: "due-date-reasons", label: "Due Date Reasons", icon: CalendarClock },
  { id: "layaway", label: "Layaway", icon: Layers },
  { id: "late-fee", label: "Late Fee", icon: CalendarClock },
  {
    id: "early-payment-discount",
    label: "Early Payment Discount",
    icon: CalendarClock,
  },
  { id: "due-reminders", label: "Due Reminders", icon: CalendarClock },
  { id: "deposit-fees", label: "Deposit Fees", icon: Shield },
  { id: "restocking-fee", label: "Restocking Fee", icon: Shield },
  { id: "recalculation-fee", label: "Recalculation Fee", icon: CalendarClock },
  {
    id: "migrated-invoice-edit",
    label: "Migrated Invoice Edit",
    icon: FileText,
  },
  { id: "quickbooks", label: "QuickBooks", icon: Link2 },
] as const;

type TabId = typeof PROFILE_TAB.id | (typeof ADMIN_TABS)[number]["id"];

function SettingsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { showSuccess, showError } = useToastContext();
  const { hasSettingPermission } = useAuth();
  const visibleAdminTabs = ADMIN_TABS.filter((tab) =>
    hasSettingPermission(tab.id),
  );
  const visibleTabs = [PROFILE_TAB, ...visibleAdminTabs];

  const tabParam = searchParams.get("tab") as TabId | null;
  const activeTab: TabId =
    tabParam && visibleTabs.some((t) => t.id === tabParam)
      ? tabParam
      : "profile";

  const setActiveTab = (tab: TabId) => {
    router.push(`/settings?tab=${tab}`);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "profile":
        return <ProfileTab showSuccess={showSuccess} showError={showError} />;
      case "payment-methods":
        return (
          <PaymentMethodsTab showSuccess={showSuccess} showError={showError} />
        );
      case "users":
        return (
          <UserManagementTab showSuccess={showSuccess} showError={showError} />
        );
      case "regularizations":
        return (
          <RegularizationsTab showSuccess={showSuccess} showError={showError} />
        );
      case "customers":
        return <CustomersTab showSuccess={showSuccess} showError={showError} />;
      case "units":
        return <UnitsTab showSuccess={showSuccess} showError={showError} />;
      case "live-types":
        return <LiveTypesTab showSuccess={showSuccess} showError={showError} />;
      case "terms":
        return (
          <TermsConditionsTab showSuccess={showSuccess} showError={showError} />
        );
      case "shipping-fee-rules":
        return (
          <ShippingFeeRulesTab
            showSuccess={showSuccess}
            showError={showError}
          />
        );
      case "insurance-rules":
        return (
          <InsuranceRulesTab showSuccess={showSuccess} showError={showError} />
        );
      case "due-date-reasons":
        return (
          <DueDateReasonsTab showSuccess={showSuccess} showError={showError} />
        );
      case "layaway":
        return (
          <LayawaySettingsTab showSuccess={showSuccess} showError={showError} />
        );
      case "late-fee":
        return <LateFeeTab showSuccess={showSuccess} showError={showError} />;
      case "early-payment-discount":
        return (
          <EarlyPaymentDiscountTab
            showSuccess={showSuccess}
            showError={showError}
          />
        );
      case "due-reminders":
        return (
          <DueReminderTab showSuccess={showSuccess} showError={showError} />
        );
      case "deposit-fees":
        return (
          <DepositFeeRulesTab showSuccess={showSuccess} showError={showError} />
        );
      case "restocking-fee":
        return (
          <RestockingFeeTab showSuccess={showSuccess} showError={showError} />
        );
      case "recalculation-fee":
        return (
          <RecalculationFeeTab
            showSuccess={showSuccess}
            showError={showError}
          />
        );
      case "migrated-invoice-edit":
        return (
          <MigratedInvoiceEditTab
            showSuccess={showSuccess}
            showError={showError}
          />
        );
      case "quickbooks":
        return (
          <QuickBooksTab showSuccess={showSuccess} showError={showError} />
        );
      default:
        return (
          <PaymentMethodsTab showSuccess={showSuccess} showError={showError} />
        );
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      <Navigation />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600 mt-1">
            Manage your system configuration and preferences
          </p>
        </div>

        <div className="flex gap-6">
          {/* Sidebar */}
          <div className="w-56 flex-shrink-0">
            <nav className="space-y-1 sticky top-24">
              {visibleTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-blue-50 text-blue-700 border border-blue-200"
                        : "text-gray-700 hover:bg-gray-100 border border-transparent"
                    }`}
                  >
                    <Icon
                      size={18}
                      className={isActive ? "text-blue-600" : "text-gray-400"}
                    />
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
