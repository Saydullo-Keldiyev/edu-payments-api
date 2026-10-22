'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback } from 'react';
import { BalanceCard } from '@/components/balance-card';
import { PaymentForm } from '@/components/payment-form';
import { Alert, Card, EmptyState, LoadingState, PageHeader, Spinner } from '@/components/ui';
import { ApiError, api, errorMessage } from '@/lib/api';
import { currentMonth, formatDate, formatMoney, formatMonth } from '@/lib/format';
import { useAsync } from '@/lib/use-async';

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const student = useAsync(useCallback(() => api.getStudent(id), [id]));
  const payments = useAsync(useCallback(() => api.listStudentPayments(id), [id]));
  const balance = useAsync(useCallback(() => api.getStudentBalance(id, currentMonth()), [id]));
  const { reload: reloadPayments } = payments;
  const { reload: reloadBalance } = balance;
  const onRecorded = useCallback(() => {
    reloadPayments();
    reloadBalance();
  }, [reloadPayments, reloadBalance]);

  if (student.error !== undefined) {
    const notFound = student.error instanceof ApiError && (student.error.status === 404 || student.error.status === 400);
    return (
      <>
        <PageHeader title={notFound ? 'Student not found' : 'Student'} />
        <Alert tone="error" onRetry={notFound ? undefined : student.reload}>
          {notFound ? 'This student does not exist or was deleted.' : errorMessage(student.error)}
        </Alert>
        <Link href="/students" className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:underline">
          ← Back to students
        </Link>
      </>
    );
  }

  if (!student.data) return <LoadingState label="Loading student…" />;
  const s = student.data;

  return (
    <>
      <Link href="/students" className="mb-3 inline-block text-sm text-slate-500 hover:text-slate-700">
        ← Students
      </Link>
      <PageHeader title={s.name} description={`${s.groupName} · ${s.phone} · ${formatMoney(s.monthlyFee)} / month · since ${formatMonth(s.startMonth)}`}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Card>
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h2 className="font-semibold text-slate-900">Payment history</h2>
            {payments.loading && payments.data && <Spinner className="text-indigo-600" />}
          </div>
          {payments.error !== undefined ? (
            <div className="p-4">
              <Alert tone="error" onRetry={payments.reload}>
                Could not load payments: {errorMessage(payments.error)}
              </Alert>
            </div>
          ) : !payments.data ? (
            <LoadingState label="Loading payments…" />
          ) : payments.data.length === 0 ? (
            <EmptyState title="No payments yet" description="Payments recorded for this student will appear here." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 text-right font-medium">Amount</th>
                    <th className="hidden px-4 py-3 text-right font-medium sm:table-cell">Recorded at</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payments.data.map((p) => (
                    <tr key={p.id}>
                      <td className="px-4 py-3 text-slate-700">{formatDate(p.paymentDate)}</td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums text-slate-900">{formatMoney(p.amount)}</td>
                      <td className="hidden px-4 py-3 text-right text-slate-500 sm:table-cell">
                        {new Date(p.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="space-y-6">
          <BalanceCard balance={balance} />
          <Card className="h-fit p-5">
            <h2 className="mb-4 font-semibold text-slate-900">Record payment</h2>
            <PaymentForm fixedStudent={s} onRecorded={onRecorded} />
          </Card>
        </div>
      </div>
    </>
  );
}
