'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Navigation from '../components/Navigation';
import MetricCard from '../components/MetricCard';
import Chart from '../components/Chart';
import Typed from 'typed.js';

export default function Dashboard() {
  const [metrics, setMetrics] = useState({
    outstanding: 0,
    pending: 0,
    revenue: 0,
    customers: 0,
  });

  useEffect(() => {
    // Initialize typed text
    const typed = new Typed('#typed-text', {
      strings: ['Accounting Workflow', 'Payment Processing', 'Invoice Management', 'Financial Reporting'],
      typeSpeed: 80,
      backSpeed: 50,
      backDelay: 2000,
      loop: true,
      showCursor: true,
      cursorChar: '|'
    });

    // Load metrics
    setTimeout(() => {
      setMetrics({
        outstanding: 124750,
        pending: 23,
        revenue: 89200,
        customers: 156,
      });
    }, 500);

    return () => {
      typed.destroy();
    };
  }, []);

  const revenueChartOption = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#e2e8f0',
      borderWidth: 1,
      textStyle: {
        color: '#374151'
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
      data: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      axisLine: {
        lineStyle: {
          color: '#e2e8f0'
        }
      },
      axisLabel: {
        color: '#6b7280'
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
        formatter: '${value}k'
      },
      splitLine: {
        lineStyle: {
          color: '#f3f4f6'
        }
      }
    },
    series: [{
      data: [45, 52, 48, 61, 58, 67, 72, 69, 75, 82, 89, 95],
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
  };

  const paymentChartOption = {
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#e2e8f0',
      borderWidth: 1,
      textStyle: {
        color: '#374151'
      }
    },
    legend: {
      orient: 'vertical',
      left: 'left'
    },
    series: [{
      name: 'Payment Methods',
      type: 'pie',
      radius: '50%',
      data: [
        { value: 45, name: 'Credit Card' },
        { value: 30, name: 'Bank Transfer' },
        { value: 15, name: 'Cash' },
        { value: 10, name: 'Check' }
      ],
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowOffsetX: 0,
          shadowColor: 'rgba(0, 0, 0, 0.5)'
        }
      }
    }]
  };

  return (
    <div className="bg-gray-50 hero-pattern min-h-screen">
      <Navigation />

      {/* Hero Section */}
      <div className="relative bg-gradient-to-br from-blue-50 to-indigo-100 py-16 overflow-hidden">
        <div className="absolute inset-0 bg-white opacity-20"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl font-bold text-gray-900 mb-4">
                Streamline Your <span id="typed-text" className="text-blue-600"></span>
              </h2>
              <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                Centralized invoice management, automated payment processing, and intelligent duplicate detection.
                Transform your accounting workflow with our comprehensive solution.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button className="bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors card-hover">
                  Upload Payments
                </button>
                <button className="border border-gray-300 text-gray-700 px-8 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors card-hover">
                  Manage Invoices
                </button>
              </div>
            </div>
            <div className="relative">
              <Image
                src="/hero-dashboard.png"
                alt="Financial Dashboard"
                width={600}
                height={400}
                className="w-full h-auto rounded-2xl shadow-2xl"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-blue-900/20 to-transparent rounded-2xl"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <div className="animate-fade-in-up stagger-1">
            <MetricCard
              title="Total Outstanding"
              value={`$${metrics.outstanding.toLocaleString()}`}
              change="+12% from last month"
              changeType="positive"
              icon={
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
                </svg>
              }
              iconBgColor="bg-blue-100"
              iconColor="text-blue-600"
            />
          </div>
          <div className="animate-fade-in-up stagger-2">
            <MetricCard
              title="Pending Payments"
              value={metrics.pending.toString()}
              change="Requires attention"
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
              title="Monthly Revenue"
              value={`$${metrics.revenue.toLocaleString()}`}
              change="+8% this month"
              changeType="positive"
              icon={
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>
                </svg>
              }
              iconBgColor="bg-green-100"
              iconColor="text-green-600"
            />
          </div>
          <div className="animate-fade-in-up stagger-4">
            <MetricCard
              title="Active Customers"
              value={metrics.customers.toString()}
              change="+5 new this month"
              changeType="positive"
              icon={
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                </svg>
              }
              iconBgColor="bg-purple-100"
              iconColor="text-purple-600"
            />
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          <div className="chart-container p-6 rounded-xl shadow-lg border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Trends</h3>
            <Chart option={revenueChartOption as any} />
          </div>
          <div className="chart-container p-6 rounded-xl shadow-lg border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Methods</h3>
            <Chart option={paymentChartOption as any} />
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
            <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">View All</button>
          </div>
          <div className="space-y-4">
            {/* Mock activity items */}
            <div className="flex items-center space-x-4">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <div className="flex-1">
                <p className="text-sm text-gray-900">Payment received from ABC Corp - $2,450</p>
                <p className="text-xs text-gray-500">2 hours ago</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <div className="flex-1">
                <p className="text-sm text-gray-900">Invoice #1234 sent to XYZ Ltd</p>
                <p className="text-xs text-gray-500">4 hours ago</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
              <div className="flex-1">
                <p className="text-sm text-gray-900">Overdue payment reminder sent</p>
                <p className="text-xs text-gray-500">1 day ago</p>
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
