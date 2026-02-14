'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function TermsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/settings?tab=terms');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">Redirecting to Settings...</p>
    </div>
  );
}
