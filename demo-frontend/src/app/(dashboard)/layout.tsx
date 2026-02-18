import type { ReactNode } from 'react';
import { Navbar } from '@/components/layout';
import { DashboardShell } from './dashboard-shell';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <DashboardShell>{children}</DashboardShell>
      </main>
    </div>
  );
}
