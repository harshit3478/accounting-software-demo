"use client";

import { useEffect, useState } from "react";
import Navigation from "../../components/Navigation";
import { ToastProvider, useToastContext } from "../../components/ToastContext";
import { useAuth } from "../../lib/AuthContext";

function TermsManager() {
  const { user, isAdmin } = useAuth();
  const { showSuccess, showError } = useToastContext();
  const [terms, setTerms] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [lines, setLines] = useState<string[]>([""]);
  const [isDefault, setIsDefault] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetchTerms();
  }, [user]);

  const fetchTerms = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/terms");
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
    if (!isAdmin) return showError("Forbidden");
    const payload = { title, lines: lines.filter((l) => l.trim()), isDefault };
    try {
      const res = await fetch("/api/terms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        showSuccess("Terms created");
        setTitle("");
        setLines([""]);
        setIsDefault(false);
        fetchTerms();
      } else {
        const err = await res.json();
        showError(err.error || "Failed to create");
      }
    } catch (err) {
      console.error(err);
      showError("Failed to create");
    }
  };

  const handleDelete = async (id: number) => {
    if (!isAdmin) return showError("Forbidden");
    try {
      const res = await fetch("/api/terms", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        showSuccess("Deleted");
        fetchTerms();
      } else {
        const err = await res.json();
        showError(err.error || "Failed to delete");
      }
    } catch (err) {
      console.error(err);
      showError("Failed to delete");
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      <Navigation />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Terms & Conditions</h1>
          <p className="text-gray-600">
            Manage the Terms & Conditions templates used when creating invoices.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-white rounded-xl p-6 border">
            <h3 className="font-semibold mb-3">Create New Terms</h3>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Optional title"
              className="w-full mb-2 px-3 py-2 border rounded"
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
                  className="w-full px-3 py-2 border rounded"
                />
              ))}
            </div>
            <div className="flex gap-2 mb-4">
              <button
                className="px-3 py-1 bg-gray-100 rounded"
                onClick={() => lines.length < 5 && setLines([...lines, ""])}
              >
                Add line
              </button>
              <button
                className="px-3 py-1 bg-gray-100 rounded"
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
                className="mr-2"
              />
              <label>Set as default terms</label>
            </div>
            <div>
              <button
                onClick={handleCreate}
                className="px-4 py-2 bg-blue-600 text-white rounded"
              >
                Create
              </button>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl p-6 border">
              <h3 className="font-semibold mb-4">Available Terms</h3>
              {isLoading ? (
                <div>Loading...</div>
              ) : (
                <div className="space-y-3">
                  {terms.map((t) => (
                    <div key={t.id} className="border rounded p-3 bg-gray-50">
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="text-sm font-medium">
                            {t.title || "Untitled"}
                          </div>
                          <div className="text-xs text-gray-500">
                            By {t.creator?.name || "Unknown"} •{" "}
                            {new Date(t.updatedAt).toLocaleString()}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() =>
                              navigator.clipboard.writeText(
                                JSON.stringify(t.lines)
                              )
                            }
                            className="px-2 py-1 text-sm bg-white border rounded"
                          >
                            Copy
                          </button>
                          <button
                            onClick={() => handleDelete(t.id)}
                            className="px-2 py-1 text-sm bg-red-50 border border-red-200 text-red-700 rounded"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      <ol className="list-decimal pl-5 mt-3 space-y-1">
                        {t.lines.map((ln: string, i: number) => (
                          <li key={i} className="text-sm text-gray-800">
                            {ln}
                          </li>
                        ))}
                      </ol>
                      {t.isDefault && (
                        <div className="mt-2 text-xs text-green-700">
                          Default
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TermsPage() {
  return (
    <ToastProvider>
      <TermsManager />
    </ToastProvider>
  );
}
