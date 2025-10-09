'use client';

import { useState, useEffect } from 'react';
import Navigation from '../../components/Navigation';

interface PaymentSource {
  id: string;
  name: string;
  amount: number;
  count: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  label: string;
}

export default function PaymentsPage() {
  const [processedToday, setProcessedToday] = useState(0);

  const paymentSources: PaymentSource[] = [
    {
      id: 'zelle',
      name: 'Zelle Payments',
      amount: 2450,
      count: '3 payments',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"></path>
        </svg>
      ),
      iconBg: 'bg-green-100',
      iconColor: 'text-green-600',
      label: 'Today'
    },
    {
      id: 'credit-card',
      name: 'Credit Card',
      amount: 18200,
      count: 'QuickBooks Sync',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path>
        </svg>
      ),
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      label: 'Auto'
    },
    {
      id: 'cash',
      name: 'Cash Payments',
      amount: 850,
      count: '2 payments',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
        </svg>
      ),
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
      label: 'Manual'
    },
    {
      id: 'layaway',
      name: 'Layaway',
      amount: 3200,
      count: '5 active',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
      ),
      iconBg: 'bg-purple-100',
      iconColor: 'text-purple-600',
      label: 'Schedule'
    }
  ];

  const mockMatches = [
    {
      id: 1,
      payment: { amount: 1250, source: 'Zelle', client: 'Acme Corporation', date: '2024-01-15' },
      invoice: { id: 'INV-2024-0015', amount: 1250, client: 'Acme Corporation' },
      confidence: 95,
      status: 'suggested'
    },
    {
      id: 2,
      payment: { amount: 850, source: 'Credit Card', client: 'TechStart Inc', date: '2024-01-14' },
      invoice: { id: 'INV-2024-0023', amount: 850, client: 'TechStart Inc' },
      confidence: 88,
      status: 'suggested'
    }
  ];

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="bg-gray-50 hero-pattern min-h-screen">
      <Navigation />

      {/* Page Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">Payment Processing</h2>
              <p className="text-gray-600 mt-2">Upload, match, and reconcile payments from multiple sources</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm text-gray-500">Processed Today</p>
                <p className="text-2xl font-bold text-gray-900">${processedToday.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Sources */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {paymentSources.map((source, index) => (
            <div
              key={source.id}
              className={`bg-white p-6 rounded-xl shadow-lg border border-gray-200 card-hover cursor-pointer animate-fade-in-up stagger-${index + 1}`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 ${source.iconBg} rounded-full`}>
                  <div className={source.iconColor}>{source.icon}</div>
                </div>
                <span className="text-sm text-gray-500">{source.label}</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">{source.name}</h3>
              <p className="text-2xl font-bold text-gray-900 mb-2">${source.amount.toLocaleString()}</p>
              <p className="text-sm text-gray-600">{source.count}</p>
            </div>
          ))}
        </div>

        {/* Payment Matching Interface */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Payment Matching</h3>
              <div className="flex items-center space-x-3">
                <button className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700">
                  Auto Match All
                </button>
                <button className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
                  Review Matches
                </button>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="space-y-4">
              {mockMatches.map((match) => (
                <div key={match.id} className="match-item border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 font-semibold text-sm">{match.confidence}%</span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">${match.payment.amount.toLocaleString()}</p>
                        <p className="text-sm text-gray-600">{match.payment.client} • {match.payment.source}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700">
                        Confirm
                      </button>
                      <button className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700">
                        Reject
                      </button>
                      <button className="border border-gray-300 text-gray-700 px-3 py-1 rounded text-sm hover:bg-gray-50">
                        Manual
                      </button>
                    </div>
                  </div>
                  <div className="ml-13">
                    <p className="text-sm text-gray-600 mb-2">
                      Payment: {match.payment.source} on {formatDate(match.payment.date)}
                    </p>
                    <p className="text-sm text-gray-600">
                      Invoice: {match.invoice.id} for {match.invoice.client}
                    </p>
                    <div className="mt-2">
                      <div className="match-confidence">
                        <div className="confidence-indicator" style={{ width: `${match.confidence}%` }}></div>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Match confidence: {match.confidence}%</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Duplicate Detection */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Duplicate Detection</h3>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-sm text-gray-600">Active Monitoring</span>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="space-y-3">
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-red-900">Potential Duplicate Detected</p>
                    <p className="text-sm text-red-700">$500 payment from Smart Systems appears twice</p>
                  </div>
                  <button className="text-red-600 hover:text-red-700 text-sm font-medium">Review</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Payment Activity */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Recent Payment Activity</h3>
              <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">View All</button>
            </div>
          </div>

          <div className="p-6">
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm text-gray-900">Payment matched: $1,250 from Acme Corporation</p>
                  <p className="text-xs text-gray-500">2 hours ago</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm text-gray-900">File uploaded: Zelle payments January 2024</p>
                  <p className="text-xs text-gray-500">4 hours ago</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <p className="text-gray-500 text-sm">© 2024 FinanceFlow Accounting System. Professional invoice and payment management.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}