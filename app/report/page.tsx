'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function FreeReportPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard?flow=free-report');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Redirecting to your report...</div>
    </div>
  );
}


