'use client';

import { useState, useEffect, useRef } from 'react';
import Navigation from '../../components/Navigation';

interface Customer {
  id: number;
  name: string;
  email: string;
  balance: number;
  lastStatement: string;
}

export default function StatementsPage() {
  const animeRef = useRef<any>(null);
  const [activeCustomers, setActiveCustomers] = useState(0);
  const [selectedCustomers, setSelectedCustomers] = useState<Set<number>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  const customers: Customer[] = [
    { id: 1, name: 'Acme Corporation', email: 'billing@acme.com', balance: 5250, lastStatement: '2024-01-01' },
    { id: 2, name: 'TechStart Inc', email: 'accounts@techstart.com', balance: 3200, lastStatement: '2024-01-05' },
    { id: 3, name: 'Global Solutions Ltd', email: 'finance@globalsol.com', balance: 7800, lastStatement: '2023-12-15' },
    { id: 4, name: 'Creative Agency', email: 'billing@creative.com', balance: 1500, lastStatement: '2024-01-10' },
    { id: 5, name: 'Smart Systems', email: 'accounts@smart.com', balance: 4200, lastStatement: '2023-12-20' },
  ];

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    // Dynamically import anime.js
    import('animejs').then((animeModule: any) => {
      animeRef.current = animeModule.default || animeModule;
    });
  }, []);

  useEffect(() => {
    // Animate customer cards
    if (animeRef.current) {
      animeRef.current({
        targets: '.customer-card',
        translateY: [20, 0],
        opacity: [0, 1],
        delay: animeRef.current.stagger(50),
        duration: 600,
        easing: 'easeOutQuart'
      });
    }
  }, [filteredCustomers]);

  const toggleCustomer = (id: number) => {
    const newSelected = new Set(selectedCustomers);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedCustomers(newSelected);
  };

  const selectAll = () => {
    setSelectedCustomers(new Set(filteredCustomers.map(c => c.id)));
  };

  const clearSelection = () => {
    setSelectedCustomers(new Set());
  };

  const mockHistory = [
    {
      id: 1,
      customer: 'Acme Corporation',
      period: 'Jan 1 - Jan 31, 2024',
      generated: '2024-02-01',
      status: 'Sent',
      method: 'Email',
      amount: 5250
    },
    {
      id: 2,
      customer: 'TechStart Inc',
      period: 'Jan 1 - Jan 31, 2024',
      generated: '2024-02-01',
      status: 'Downloaded',
      method: 'PDF',
      amount: 3200
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
              <h2 className="text-3xl font-bold text-gray-900">Customer Statements</h2>
              <p className="text-gray-600 mt-2">Generate and manage customer account statements</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm text-gray-500">Active Customers</p>
                <p className="text-2xl font-bold text-gray-900">{activeCustomers}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Customer Selection and Statement Generation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Customer List */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-lg border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Select Customers</h3>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search customers..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-64"
                    />
                    <svg className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                    </svg>
                  </div>
                </div>
              </div>

              <div className="p-6">
                <div className="mb-4 flex items-center space-x-4">
                  <button onClick={selectAll} className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                    Select All
                  </button>
                  <button onClick={clearSelection} className="text-gray-600 hover:text-gray-700 text-sm font-medium">
                    Clear Selection
                  </button>
                  <span className="text-sm text-gray-500">{selectedCustomers.size} customers selected</span>
                </div>

                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {filteredCustomers.map((customer) => (
                    <div
                      key={customer.id}
                      className={`customer-card border border-gray-200 rounded-lg p-4 cursor-pointer transition-colors ${
                        selectedCustomers.has(customer.id) ? 'selected' : ''
                      }`}
                      onClick={() => toggleCustomer(customer.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            checked={selectedCustomers.has(customer.id)}
                            readOnly
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-3"
                          />
                          <div>
                            <p className="font-medium text-gray-900">{customer.name}</p>
                            <p className="text-sm text-gray-600">{customer.email}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-gray-900">${customer.balance.toLocaleString()}</p>
                          <p className="text-xs text-gray-500">Balance</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Statement Configuration */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 sticky top-24">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Statement Options</h3>
              </div>

              <div className="p-6 space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Statement Period</label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500">From</label>
                      <input
                        type="date"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">To</label>
                      <input
                        type="date"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Template</label>
                  <select className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                    <option value="detailed">Detailed Statement</option>
                    <option value="summary">Summary Statement</option>
                    <option value="professional">Professional Template</option>
                    <option value="simple">Simple Template</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Format</label>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input type="radio" name="format" value="pdf" defaultChecked className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                      <span className="ml-2 text-sm text-gray-700">PDF Document</span>
                    </label>
                    <label className="flex items-center">
                      <input type="radio" name="format" value="excel" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                      <span className="ml-2 text-sm text-gray-700">Excel Spreadsheet</span>
                    </label>
                    <label className="flex items-center">
                      <input type="radio" name="format" value="email" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                      <span className="ml-2 text-sm text-gray-700">Email Directly</span>
                    </label>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-6">
                  <button className="w-full bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 mb-3">
                    Preview Statement
                  </button>
                  <button className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
                    Generate Statements
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Statement History */}
        <div className="mt-8">
          <div className="bg-white rounded-xl shadow-lg border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Recent Statements</h3>
                <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">View All</button>
              </div>
            </div>

            <div className="p-6">
              <div className="space-y-4">
                {mockHistory.map((statement) => (
                  <div key={statement.id} className="flex items-center justify-between p-4 hover:bg-gray-50 rounded-lg transition-colors">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                        </svg>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{statement.customer}</p>
                        <p className="text-sm text-gray-600">{statement.period}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">${statement.amount.toLocaleString()}</p>
                      <p className="text-sm text-gray-500">{statement.status} • {statement.method}</p>
                    </div>
                  </div>
                ))}
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