'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '../components/Navigation';
import MetricCard from '../components/MetricCard';
import Chart from '../components/Chart';
import { CreateInvoiceModal } from '../components/invoices';
import { RecordPaymentModal } from '../components/payments';
import { ToastProvider, useToastContext } from '../components/ToastContext';
import { useClientCache, invalidateCachePattern } from '../hooks/useClientCache';
import Footer from '@/components/Footer';

function DashboardContent() {
  const router = useRouter();
  const { showSuccess, showError } = useToastContext();
  
  const [metrics, setMetrics] = useState({
    outstanding: 0,
    pending: 0,
    revenue: 0,
    customers: 0,
  });
  const [todayStats, setTodayStats] = useState({
    todayRevenue: 0,
    overdueInvoices: 0,
    overdueAmount: 0,
    layawayPlans: 0,
  });
  const [recentPayments, setRecentPayments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Chart data states
  const [chartPeriod, setChartPeriod] = useState('30');
  const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' });
  const [chartData, setChartData] = useState<any>(null);
  const [isLoadingCharts, setIsLoadingCharts] = useState(false);

  // Modal states
  const [showCreateInvoiceModal, setShowCreateInvoiceModal] = useState(false);
  const [showRecordPaymentModal, setShowRecordPaymentModal] = useState(false);

  // Use client-side cache for dashboard metrics
  const { 
    data: metricsData, 
    isLoading: metricsLoading,
    mutate: refreshMetrics 
  } = useClientCache(
    'dashboard-metrics',
    async () => {
      const res = await fetch('/api/dashboard');
      if (!res.ok) throw new Error('Failed to fetch metrics');
      return res.json();
    },
    { 
      staleTime: 2 * 60 * 1000, // 2 minutes (matches backend cache)
      refetchOnMount: false // Don't refetch on every mount
    }
  );

  // Use cache for invoices
  const { 
    data: invoicesData,
    isLoading: invoicesLoading 
  } = useClientCache(
    'dashboard-invoices',
    async () => {
      const res = await fetch('/api/invoices');
      if (!res.ok) throw new Error('Failed to fetch invoices');
      return res.json();
    },
    { 
      staleTime: 2 * 60 * 1000,
      refetchOnMount: false
    }
  );

  // Use cache for payments
  const { 
    data: paymentsData,
    isLoading: paymentsLoading 
  } = useClientCache(
    'dashboard-payments',
    async () => {
      const res = await fetch('/api/payments');
      if (!res.ok) throw new Error('Failed to fetch payments');
      return res.json();
    },
    { 
      staleTime: 2 * 60 * 1000,
      refetchOnMount: false
    }
  );

  // Compute derived metrics from cached data
  useEffect(() => {
    if (metricsData) {
      setMetrics(metricsData);
    }

    if (invoicesData) {
      const today = new Date();
      const overdue = invoicesData.filter((inv: any) => 
        inv.status !== 'paid' && new Date(inv.dueDate) < today
      );
      
      const overdueAmount = overdue.reduce((sum: number, inv: any) => 
        sum + (inv.amount - inv.paidAmount), 0
      );

      const layawayPlans = invoicesData.filter((inv: any) => inv.isLayaway && inv.status !== 'paid').length;

      setTodayStats(prev => ({
        ...prev,
        overdueInvoices: overdue.length,
        overdueAmount,
        layawayPlans,
      }));
    }

    if (paymentsData) {
      const todayStr = new Date().toISOString().split('T')[0];
      const todayPayments = paymentsData.filter((p: any) => {
        const paymentDate = p.paymentDate ? new Date(p.paymentDate).toISOString().split('T')[0] : null;
        return paymentDate === todayStr;
      });
      
      const todayRevenue = todayPayments.reduce((sum: number, p: any) => sum + p.amount, 0);
      
      setTodayStats(prev => ({ ...prev, todayRevenue }));
      
      const sortedPayments = paymentsData
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5);
      
      setRecentPayments(sortedPayments);
    }
  }, [metricsData, invoicesData, paymentsData]); // Removed loading states from deps

  // Separate effect for loading state
  useEffect(() => {
    setIsLoading(metricsLoading || invoicesLoading || paymentsLoading);
  }, [metricsLoading, invoicesLoading, paymentsLoading]);

  const fetchMetrics = async () => {
    // Refresh all cached data
    await refreshMetrics();
  };

  const fetchChartData = async () => {
    setIsLoadingCharts(true);
    try {
      let url = `/api/dashboard/charts?period=${chartPeriod}`;
      if (chartPeriod === 'custom' && customDateRange.start && customDateRange.end) {
        url += `&start=${customDateRange.start}&end=${customDateRange.end}`;
      }

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setChartData(data);
      }
    } catch (error) {
      console.error('Error fetching chart data:', error);
    } finally {
      setIsLoadingCharts(false);
    }
  };

  useEffect(() => {
    // Load metrics
    fetchMetrics();
  }, []);

  useEffect(() => {
    fetchChartData();
  }, [chartPeriod, customDateRange]);

  const revenueChartOption = chartData ? {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#e2e8f0',
      borderWidth: 1,
      textStyle: {
        color: '#374151'
      },
      formatter: (params: any) => {
        const value = params[0].value;
        return `${params[0].name}<br/>$${value.toFixed(2)}`;
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: chartData.revenueChart.dates,
      axisLine: {
        lineStyle: {
          color: '#e2e8f0'
        }
      },
      axisLabel: {
        color: '#6b7280',
        rotate: chartData.revenueChart.dates.length > 30 ? 45 : 0
      }
    },
    yAxis: {
      type: 'value',
      axisLine: {
        show: false
      },
      axisTick: {
        show: false
      },
      axisLabel: {
        color: '#6b7280',
        formatter: '${value}'
      },
      splitLine: {
        lineStyle: {
          color: '#f3f4f6'
        }
      }
    },
    series: [{
      data: chartData.revenueChart.values,
      type: 'line',
      smooth: true,
      lineStyle: {
        color: '#4299e1',
        width: 3
      },
      itemStyle: {
        color: '#4299e1'
      },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [{
            offset: 0,
            color: 'rgba(66, 153, 225, 0.3)'
          }, {
            offset: 1,
            color: 'rgba(66, 153, 225, 0.05)'
          }]
        }
      },
      animationDuration: 2000,
      animationEasing: 'cubicOut'
    }]
  } : null;

  const paymentChartOption = chartData ? {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#e2e8f0',
      borderWidth: 1,
      textStyle: {
        color: '#374151'
      },
      formatter: (params: any) => {
        let result = params[0].name + '<br/>';
        params.forEach((param: any) => {
          result += `${param.seriesName}: $${param.value.toFixed(2)}<br/>`;
        });
        return result;
      }
    },
    legend: {
      data: ['Cash', 'Zelle', 'QuickBooks', 'Layaway'],
      bottom: 0
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: chartData.paymentMethodsChart.dates,
      axisLabel: {
        rotate: chartData.paymentMethodsChart.dates.length > 30 ? 45 : 0,
        color: '#6b7280'
      },
      axisLine: {
        lineStyle: {
          color: '#e2e8f0'
        }
      }
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: '${value}',
        color: '#6b7280'
      },
      axisLine: {
        show: false
      },
      axisTick: {
        show: false
      },
      splitLine: {
        lineStyle: {
          color: '#f3f4f6'
        }
      }
    },
    series: [
      {
        name: 'Cash',
        type: 'bar',
        stack: 'total',
        data: chartData.paymentMethodsChart.cash,
        itemStyle: {
          color: '#48bb78'
        }
      },
      {
        name: 'Zelle',
        type: 'bar',
        stack: 'total',
        data: chartData.paymentMethodsChart.zelle,
        itemStyle: {
          color: '#4299e1'
        }
      },
      {
        name: 'QuickBooks',
        type: 'bar',
        stack: 'total',
        data: chartData.paymentMethodsChart.quickbooks,
        itemStyle: {
          color: '#ed8936'
        }
      },
      {
        name: 'Layaway',
        type: 'bar',
        stack: 'total',
        data: chartData.paymentMethodsChart.layaway,
        itemStyle: {
          color: '#9f7aea'
        }
      }
    ],
    animationDuration: 2000,
    animationEasing: 'cubicOut'
  } : null;

  return (
    <div className="bg-gray-50 hero-pattern min-h-screen">
      <Navigation />

      {/* Quick Actions Section */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>
          <div className="flex flex-col sm:flex-row gap-4">
            <button 
              onClick={() => setShowRecordPaymentModal(true)}
              className="group bg-blue-600 text-white px-10 py-5 rounded-xl font-semibold hover:bg-blue-700 transition-all duration-200 card-hover flex items-center justify-center gap-3 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              <svg className="w-6 h-6 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
              </svg>
              <span className="text-lg">Record Payment</span>
            </button>
            <button 
              onClick={() => setShowCreateInvoiceModal(true)}
              className="group bg-white border-2 border-gray-300 text-gray-700 px-10 py-5 rounded-xl font-semibold hover:border-blue-500 hover:text-blue-600 transition-all duration-200 card-hover flex items-center justify-center gap-3 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
            >
              <svg className="w-6 h-6 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
              <span className="text-lg">Create Invoice</span>
            </button>
          </div>
        </div>
      </div>

      {/* Daily Focus Metrics */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Today's Focus</h2>
              <p className="text-sm text-gray-500 mt-1">Key metrics for {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
              <div className="animate-fade-in-up stagger-1">
                <MetricCard
                  title="Today's Revenue"
                  value={`$${todayStats.todayRevenue.toLocaleString()}`}
                  change="Payments received today"
                  changeType="positive"
                  icon={
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"></path>
                    </svg>
                  }
                  iconBgColor="bg-green-100"
                  iconColor="text-green-600"
                />
              </div>
              <div className="animate-fade-in-up stagger-2">
                <MetricCard
                  title="Pending Invoices"
                  value={metrics.pending.toString()}
                  change="Awaiting payment"
                  changeType="neutral"
                  icon={
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                  }
                  iconBgColor="bg-amber-100"
                  iconColor="text-amber-600"
                />
              </div>
              <div className="animate-fade-in-up stagger-3">
                <MetricCard
                  title="Overdue Invoices"
                  value={todayStats.overdueInvoices.toString()}
                  change={`$${todayStats.overdueAmount.toLocaleString()} overdue`}
                  changeType={todayStats.overdueInvoices > 0 ? "negative" : "positive"}
                  icon={
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                  }
                  iconBgColor="bg-red-100"
                  iconColor="text-red-600"
                />
              </div>
              <div className="animate-fade-in-up stagger-4">
                <MetricCard
                  title="Layaway Plans"
                  value={todayStats.layawayPlans.toString()}
                  change="Active payment plans"
                  changeType="neutral"
                  icon={
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path>
                    </svg>
                  }
                  iconBgColor="bg-purple-100"
                  iconColor="text-purple-600"
                />
              </div>
            </div>

            {/* Big Picture Metrics */}
            <div className="mb-6 mt-12">
              <h2 className="text-lg font-semibold text-gray-900">Financial Overview</h2>
              <p className="text-sm text-gray-500 mt-1">Overall business performance</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
              <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 card-hover transform transition-all duration-200 hover:shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-gray-600">Total Outstanding</h3>
                  <div className="p-2 bg-blue-100 rounded-lg transition-transform hover:scale-110">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
                    </svg>
                  </div>
                </div>
                <p className="text-3xl font-bold text-gray-900">${metrics.outstanding.toLocaleString()}</p>
                <p className="text-sm text-gray-500 mt-2">Unpaid invoices</p>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 card-hover transform transition-all duration-200 hover:shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-gray-600">Total Revenue</h3>
                  <div className="p-2 bg-green-100 rounded-lg transition-transform hover:scale-110">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>
                    </svg>
                  </div>
                </div>
                <p className="text-3xl font-bold text-gray-900">${metrics.revenue.toLocaleString()}</p>
                <p className="text-sm text-gray-500 mt-2">All-time payments</p>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 card-hover transform transition-all duration-200 hover:shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-gray-600">Active Clients</h3>
                  <div className="p-2 bg-purple-100 rounded-lg transition-transform hover:scale-110">
                    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                    </svg>
                  </div>
                </div>
                <p className="text-3xl font-bold text-gray-900">{metrics.customers}</p>
                <p className="text-sm text-gray-500 mt-2">Unique clients</p>
              </div>
            </div>

            {/* Analytics Section */}
            <div className="mb-6 mt-12">
              <h2 className="text-lg font-semibold text-gray-900">Analytics</h2>
              <p className="text-sm text-gray-500 mt-1">Revenue and payment trends</p>
            </div>
          </>
        )}

        {/* Date Range Selector */}
        <div className="mb-6 bg-white p-4 rounded-xl shadow-sm border border-gray-200 transition-all duration-200 hover:shadow-md">
          <div className="flex flex-wrap items-center gap-4">
            <label className="text-sm font-medium text-gray-700">Chart Period:</label>
            <select
              value={chartPeriod}
              onChange={(e) => setChartPeriod(e.target.value)}
              className="px-4 py-2 border text-black border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
            >
              <option value="7">Last 7 Days</option>
              <option value="30">Last 30 Days</option>
              <option value="90">Last 90 Days</option>
              <option value="custom">Custom Range</option>
            </select>

            {chartPeriod === 'custom' && (
              <>
                <input
                  type="date"
                  value={customDateRange.start}
                  onChange={(e) => setCustomDateRange({ ...customDateRange, start: e.target.value })}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                />
                <span className="text-gray-500">to</span>
                <input
                  type="date"
                  value={customDateRange.end}
                  onChange={(e) => setCustomDateRange({ ...customDateRange, end: e.target.value })}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                />
              </>
            )}

            {isLoadingCharts && (
              <div className="flex items-center text-sm text-gray-500">
                <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Loading...
              </div>
            )}
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          <div className="chart-container p-6 rounded-xl shadow-lg border border-gray-200 transform transition-all duration-200 hover:shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Trends</h3>
            {revenueChartOption ? (
              <Chart option={revenueChartOption as any} />
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
                  <p>Loading chart data...</p>
                </div>
              </div>
            )}
          </div>
          <div className="chart-container p-6 rounded-xl shadow-lg border border-gray-200 transform transition-all duration-200 hover:shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Methods Breakdown</h3>
            {paymentChartOption ? (
              <Chart option={paymentChartOption as any} />
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
                  <p>Loading chart data...</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
          <p className="text-sm text-gray-500 mt-1">Latest payment transactions</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 transform transition-all duration-200 hover:shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Recent Payments</h3>
            <a href="/payments" className="text-blue-600 hover:text-blue-700 text-sm font-medium transition-colors duration-200 hover:underline">View All →</a>
          </div>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : recentPayments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
              <p className="text-sm">No recent payments</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentPayments.map((payment: any) => {
                const methodColors: Record<string, { bg: string; text: string; dot: string }> = {
                  cash: { bg: 'bg-green-100', text: 'text-green-800', dot: 'bg-green-500' },
                  zelle: { bg: 'bg-blue-100', text: 'text-blue-800', dot: 'bg-blue-500' },
                  quickbooks: { bg: 'bg-purple-100', text: 'text-purple-800', dot: 'bg-purple-500' },
                  layaway: { bg: 'bg-amber-100', text: 'text-amber-800', dot: 'bg-amber-500' }
                };
                const colors = methodColors[payment.method] || { bg: 'bg-gray-100', text: 'text-gray-800', dot: 'bg-gray-500' };
                
                // Calculate time ago
                const timeAgo = (() => {
                  const now = new Date();
                  const paymentDate = new Date(payment.createdAt);
                  const diffMs = now.getTime() - paymentDate.getTime();
                  const diffMins = Math.floor(diffMs / 60000);
                  const diffHours = Math.floor(diffMs / 3600000);
                  const diffDays = Math.floor(diffMs / 86400000);
                  
                  if (diffMins < 1) return 'Just now';
                  if (diffMins < 60) return `${diffMins} minutes ago`;
                  if (diffHours < 24) return `${diffHours} hours ago`;
                  if (diffDays < 7) return `${diffDays} days ago`;
                  return paymentDate.toLocaleDateString();
                })();

                return (
                  <div key={payment.id} className="flex items-center space-x-4 py-3 hover:bg-gray-50 rounded-lg px-2 transition-colors duration-150">
                    <div className={`w-2 h-2 ${colors.dot} rounded-full animate-pulse`}></div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm text-gray-900">
                          Payment received from <span className="font-semibold">{payment.invoice?.clientName || 'Unknown Client'}</span> - ${payment.amount.toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors.bg} ${colors.text}`}>
                          {payment.method.charAt(0).toUpperCase() + payment.method.slice(1)}
                        </span>
                        {payment.invoice && (
                          <span className="text-xs text-gray-500">
                            {payment.invoice.invoiceNumber}
                          </span>
                        )}
                        <span className="text-xs text-gray-500">{timeAgo}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <Footer />

      {/* Modals */}
      <CreateInvoiceModal
        isOpen={showCreateInvoiceModal}
        onClose={() => setShowCreateInvoiceModal(false)}
        onSuccess={() => {
          setShowCreateInvoiceModal(false);
          showSuccess('Invoice created successfully!');
          // Invalidate client cache to force refresh
          invalidateCachePattern('dashboard-.*');
          fetchMetrics();
        }}
        onError={showError}
      />

      <RecordPaymentModal
        isOpen={showRecordPaymentModal}
        onClose={() => setShowRecordPaymentModal(false)}
        onSuccess={() => {
          setShowRecordPaymentModal(false);
          showSuccess('Payment recorded successfully!');
          // Invalidate client cache to force refresh
          invalidateCachePattern('dashboard-.*');
          fetchMetrics();
        }}
      />
    </div>
  );
}

export default function Dashboard() {
  return (
    <ToastProvider>
      <DashboardContent />
    </ToastProvider>
  );
}
