'use client';

import type { ReactNode } from 'react';
import { AuthProvider } from '@/lib/auth';
import { QueryProvider } from '@/lib/query';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <QueryProvider>
      <AuthProvider>
        {children}
      </AuthProvider>
    </QueryProvider>
  );
}
