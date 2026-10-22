'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Card, LoadingState, PageHeader, Spinner } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { currentMonth, formatMoney, formatMonth } from '@/lib/format';
import { useAsync } from '@/lib/use-async';

function StatCard({ label, value, href, loading }: { label: string; value: string | undefined; href: string; loading: boolean }) {
  return (
    <Link href={href} className="group">
      <Card className="p-5 transition group-hover:border-indigo-300 group-hover:shadow">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
          {loading && value === undefined ? <Spinner className="text-indigo-600" /> : (value ?? '—')}
        </p>
      </Card>
    </Link>
  );
}

export default function DashboardPage() {
  // The month depends on the viewer's clock, so it is resolved after mount. Computing it during
  // the static prerender would freeze the build-time month into the HTML (hydration mismatch).
  const [month, setMonth] = useState<string | null>(null);
  useEffect(() => setMonth(currentMonth()), []);

  if (!month) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <LoadingState />
      </>
    );
  }
  return <Dashboard month={month} />;
}

function Dashboard({ month }: { month: string }) {
  const students = useAsync(useCallback(() => api.listStudents(), []));
  const debtors = useAsync(useCallback(() => api.getDebtors(month), [month]));
  const balanceDebtors = useAsync(useCallback(() => api.getBalanceDebtors(month), [month]));

  return (
    <>
      <PageHeader title="Dashboard" description={`Overview for ${formatMonth(month)}`} />

      <div className="space-y-3">
        {students.error !== undefined && (
          <Alert tone="error" onRetry={students.reload}>
            Could not load students: {errorMessage(students.error)}
          </Alert>
        )}
        {debtors.error !== undefined && (
          <Alert tone="error" onRetry={debtors.reload}>
            Could not load debtors: {errorMessage(debtors.error)}
          </Alert>
        )}
        {balanceDebtors.error !== undefined && (
          <Alert tone="error" onRetry={balanceDebtors.reload}>
            Could not load balances: {errorMessage(balanceDebtors.error)}
          </Alert>
        )}
      </div>

      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total students" value={students.data?.length.toString()} href="/students" loading={students.loading} />
        <StatCard
          label={`Debtors in ${formatMonth(month)}`}
          value={debtors.data?.count.toString()}
          href={`/debtors?month=${month}`}
          loading={debtors.loading}
        />
        <StatCard
          label="Outstanding this month"
          value={debtors.data ? formatMoney(debtors.data.totalDebt) : undefined}
          href={`/debtors?month=${month}`}
          loading={debtors.loading}
        />
        <StatCard
          label="Debtors by running balance"
          value={balanceDebtors.data?.count.toString()}
          href={`/debtors?month=${month}&view=balance`}
          loading={balanceDebtors.loading}
        />
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/payments/new" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
          Record a payment
        </Link>
        <Link
          href="/students"
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Manage students
        </Link>
      </div>
    </>
  );
}
