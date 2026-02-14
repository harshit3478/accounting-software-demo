'use client';

import { useEffect, useState } from 'react';

interface TermsConditionsTabProps {
  showSuccess: (msg: string) => void;
  showError: (msg: string) => void;
}

export default function TermsConditionsTab({ showSuccess, showError }: TermsConditionsTabProps) {
  const [terms, setTerms] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [lines, setLines] = useState<string[]>(['']);
  const [isDefault, setIsDefault] = useState(false);

  useEffect(() => {
    fetchTerms();
  }, []);

  const fetchTerms = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/terms');
      if (res.ok) {
        const data = await res.json();
        setTerms(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    const payload = { title, lines: lines.filter((l) => l.trim()), isDefault };
    try {
      const res = await fetch('/api/terms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        showSuccess('Terms created');
        setTitle('');
        setLines(['']);
        setIsDefault(false);
        fetchTerms();
      } else {
        const err = await res.json();
        showError(err.error || 'Failed to create');
      }
    } catch (err) {
      console.error(err);
      showError('Failed to create');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch('/api/terms', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        showSuccess('Deleted');
        fetchTerms();
      } else {
        const err = await res.json();
        showError(err.error || 'Failed to delete');
      }
    } catch (err) {
      console.error(err);
      showError('Failed to delete');
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Terms & Conditions</h2>
        <p className="text-gray-600 text-sm">Manage the Terms & Conditions templates used when creating invoices.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create Form */}
        <div className="lg:col-span-1 bg-gray-50 rounded-xl p-6 border border-gray-200">
          <h3 className="font-semibold text-gray-900 mb-3">Create New Terms</h3>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Optional title"
            className="w-full mb-2 px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
          />
          <div className="space-y-2 mb-2">
            {lines.map((l, idx) => (
              <input
                key={idx}
                value={l}
                onChange={(e) => {
                  const c = [...lines];
                  c[idx] = e.target.value;
                  setLines(c);
                }}
                placeholder={`Line ${idx + 1}`}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
              />
            ))}
          </div>
          <div className="flex gap-2 mb-4">
            <button
              className="px-3 py-1 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
              onClick={() => lines.length < 5 && setLines([...lines, ''])}
            >
              Add line
            </button>
            <button
              className="px-3 py-1 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
              onClick={() => lines.length > 1 && setLines(lines.slice(0, -1))}
            >
              Remove
            </button>
          </div>
          <div className="flex items-center mb-4">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="mr-2 w-4 h-4 text-blue-600 rounded"
            />
            <label className="text-sm text-gray-700">Set as default terms</label>
          </div>
          <button
            onClick={handleCreate}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            Create
          </button>
        </div>

        {/* Terms List */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-4">Available Terms</h3>
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <div className="space-y-3">
                {terms.length === 0 ? (
                  <p className="text-gray-500 text-sm">No terms created yet.</p>
                ) : (
                  terms.map((t) => (
                    <div key={t.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{t.title || 'Untitled'}</div>
                          <div className="text-xs text-gray-500">
                            By {t.creator?.name || 'Unknown'} &bull; {new Date(t.updatedAt).toLocaleString()}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => navigator.clipboard.writeText(JSON.stringify(t.lines))}
                            className="px-2 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50"
                          >
                            Copy
                          </button>
                          <button
                            onClick={() => handleDelete(t.id)}
                            className="px-2 py-1 text-sm bg-red-50 border border-red-200 text-red-700 rounded hover:bg-red-100"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      <ol className="list-decimal pl-5 mt-3 space-y-1">
                        {t.lines.map((ln: string, i: number) => (
                          <li key={i} className="text-sm text-gray-800">{ln}</li>
                        ))}
                      </ol>
                      {t.isDefault && (
                        <div className="mt-2 text-xs text-green-700 font-medium">Default</div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
