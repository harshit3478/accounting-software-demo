'use client';

import { useState, useEffect } from 'react';

interface LayawayDefaults {
  defaultMonths: number;
  defaultFrequency: 'monthly' | 'bi-weekly' | 'weekly';
  defaultDownPaymentPercent: number;
  minMonths: number;
  maxMonths: number;
  policyText: string;
}

const DEFAULT_SETTINGS: LayawayDefaults = {
  defaultMonths: 3,
  defaultFrequency: 'monthly',
  defaultDownPaymentPercent: 20,
  minMonths: 1,
  maxMonths: 24,
  policyText: '',
};

const STORAGE_KEY = 'layaway-defaults';

interface LayawaySettingsTabProps {
  showSuccess: (msg: string) => void;
  showError: (msg: string) => void;
}

export default function LayawaySettingsTab({ showSuccess }: LayawaySettingsTabProps) {
  const [settings, setSettings] = useState<LayawayDefaults>(DEFAULT_SETTINGS);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) });
      }
    } catch {
      // ignore
    }
  }, []);

  const updateField = <K extends keyof LayawayDefaults>(key: K, value: LayawayDefaults[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    setHasChanges(false);
    showSuccess('Layaway defaults saved');
  };

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
    localStorage.removeItem(STORAGE_KEY);
    setHasChanges(false);
    showSuccess('Layaway defaults reset');
  };

  // Compute preview
  const sampleTotal = 1000;
  const dp = (sampleTotal * settings.defaultDownPaymentPercent) / 100;
  const remaining = sampleTotal - dp;
  let numInstallments: number;
  if (settings.defaultFrequency === 'monthly') numInstallments = settings.defaultMonths;
  else if (settings.defaultFrequency === 'bi-weekly') numInstallments = settings.defaultMonths * 2;
  else numInstallments = settings.defaultMonths * 4;
  const installmentAmt = numInstallments > 0 ? remaining / numInstallments : 0;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-1">Layaway Configuration</h2>
        <p className="text-sm text-gray-500">Set default values for layaway plans. These will pre-fill the layaway configuration when creating new invoices.</p>
      </div>

      {/* Default Plan Settings */}
      <div className="space-y-6">
        <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wider">Default Plan Settings</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Default Duration (months)</label>
            <input
              type="number"
              min={settings.minMonths}
              max={settings.maxMonths}
              value={settings.defaultMonths}
              onChange={(e) => updateField('defaultMonths', Math.min(settings.maxMonths, Math.max(settings.minMonths, parseInt(e.target.value) || 1)))}
              className="w-full px-4 py-2 border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Default Payment Frequency</label>
            <select
              value={settings.defaultFrequency}
              onChange={(e) => updateField('defaultFrequency', e.target.value as LayawayDefaults['defaultFrequency'])}
              className="w-full px-4 py-2 border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="monthly">Monthly</option>
              <option value="bi-weekly">Bi-Weekly</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Default Down Payment (%)</label>
            <input
              type="number"
              min="0"
              max="90"
              value={settings.defaultDownPaymentPercent}
              onChange={(e) => updateField('defaultDownPaymentPercent', Math.min(90, Math.max(0, parseFloat(e.target.value) || 0)))}
              className="w-full px-4 py-2 border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">Percentage of invoice total used as default down payment</p>
          </div>
        </div>
      </div>

      {/* Duration Limits */}
      <div className="space-y-6">
        <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wider">Duration Limits</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Duration (months)</label>
            <input
              type="number"
              min="1"
              max="12"
              value={settings.minMonths}
              onChange={(e) => updateField('minMonths', Math.min(12, Math.max(1, parseInt(e.target.value) || 1)))}
              className="w-full px-4 py-2 border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Maximum Duration (months)</label>
            <input
              type="number"
              min="1"
              max="36"
              value={settings.maxMonths}
              onChange={(e) => updateField('maxMonths', Math.min(36, Math.max(1, parseInt(e.target.value) || 1)))}
              className="w-full px-4 py-2 border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Policy Text */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wider">Policy Text</h3>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Layaway Policy (optional)</label>
          <textarea
            value={settings.policyText}
            onChange={(e) => updateField('policyText', e.target.value)}
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="e.g. All layaway payments are non-refundable. Items will be held for the duration of the plan."
          />
          <p className="text-xs text-gray-500 mt-1">This text can be included on invoices with layaway plans</p>
        </div>
      </div>

      {/* Preview */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
        <h3 className="text-sm font-semibold text-gray-800 mb-3">Preview (based on $1,000 invoice)</h3>
        <div className="space-y-2">
          {dp > 0 && (
            <div className="flex justify-between text-sm text-gray-700">
              <span>Down Payment ({settings.defaultDownPaymentPercent}%)</span>
              <span className="font-medium">${dp.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm text-gray-700">
            <span>
              {numInstallments} {settings.defaultFrequency === 'monthly' ? 'monthly' : settings.defaultFrequency === 'bi-weekly' ? 'bi-weekly' : 'weekly'} payment{numInstallments !== 1 ? 's' : ''}
            </span>
            <span className="font-medium">${installmentAmt.toFixed(2)} each</span>
          </div>
          <div className="border-t border-gray-300 pt-2 flex justify-between text-sm font-semibold text-gray-900">
            <span>Total</span>
            <span>${sampleTotal.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <button
          onClick={handleReset}
          className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Reset to Defaults
        </button>
        <button
          onClick={handleSave}
          disabled={!hasChanges}
          className="px-6 py-2 text-sm bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-blue-300 disabled:cursor-not-allowed"
        >
          Save Changes
        </button>
      </div>
    </div>
  );
}
