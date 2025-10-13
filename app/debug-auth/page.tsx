'use client';

import { useEffect, useState } from 'react';

export default function DebugAuth() {
  const [authStatus, setAuthStatus] = useState<any>(null);
  const [cookie, setCookie] = useState<string>('');

  useEffect(() => {
    fetch('/api/auth-check')
      .then(res => res.json())
      .then(data => setAuthStatus(data));
    
    // Access document.cookie only on client-side
    setCookie(document.cookie);
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Auth Debug</h1>
      <pre className="bg-gray-100 p-4 rounded">
        {JSON.stringify(authStatus, null, 2)}
      </pre>
      <div className="mt-4">
        <p>Cookie: {cookie}</p>
      </div>
    </div>
  );
}