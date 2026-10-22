'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, type ReactNode } from 'react';
import { Alert, Card, EmptyState, Input, LoadingState, PageHeader, Spinner, cx } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { MONTH_PATTERN, currentMonth, formatMoney, formatMonth } from '@/lib/format';
import type { BalanceDebtor, BalanceDebtorsReport, Debtor, DebtorsReport } from '@/lib/types';
import { useAsync } from '@/lib/use-async';

type View = 'month' | 'balance';

type Loaded = { view: 'month'; report: DebtorsReport } | { view: 'balance'; report: BalanceDebtorsReport };

const views: Array<{ id: View; label: string; description: string }> = [
  {
    id: 'month',
    label: 'This month only',
    description: 'Payments dated in the selected month compared with the monthly fee. Overpayments do not carry over.',
  },
  {
    id: 'balance',
    label: 'Running balance',
    description:
      'All payments since the start month pay the oldest months first, so an overpayment covers the following months.',
  },
];

/** One debtor row, rendered as a table row on wide screens and as a card on small ones. */
interface Row {
  studentId: string;
  name: string;
  groupName: string;
  phone: string;
  cells: ReactNode[];
  debt: string;
  mobileSummary: ReactNode;
}

function monthRows(debtors: Debtor[]): Row[] {
  return debtors.map((d) => ({
    studentId: d.studentId,
    name: d.name,
    groupName: d.groupName,
    phone: d.phone,
    cells: [formatMoney(d.monthlyFee), formatMoney(d.totalPaid)],
    debt: d.debtAmount,
    mobileSummary: `Paid ${formatMoney(d.totalPaid)} of ${formatMoney(d.monthlyFee)}`,
  }));
}

function balanceRows(debtors: BalanceDebtor[]): Row[] {
  return debtors.map((d) => ({
    studentId: d.studentId,
    name: d.name,
    groupName: d.groupName,
    phone: d.phone,
    cells: [
      formatMoney(d.monthlyFee),
      d.paidThroughMonth ? formatMonth(d.paidThroughMonth) : '—',
      `${d.unpaidMonths}`,
    ],
    debt: d.debtAmount,
    mobileSummary: `${d.unpaidMonths} unpaid ${d.unpaidMonths === 1 ? 'month' : 'months'} · paid through ${
      d.paidThroughMonth ? formatMonth(d.paidThroughMonth) : '—'
    }`,
  }));
}

const columns: Record<View, string[]> = {
  month: ['Monthly fee', 'Paid this month'],
  balance: ['Monthly fee', 'Paid through', 'Unpaid months'],
};

function DebtorsTable({ view, rows }: { view: View; rows: Row[] }) {
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Student</th>
              <th className="px-4 py-3 font-medium">Group</th>
              <th className="px-4 py-3 font-medium">Phone</th>
              {columns[view].map((c) => (
                <th key={c} className="px-4 py-3 text-right font-medium">
                  {c}
                </th>
              ))}
              <th className="px-4 py-3 text-right font-medium">Debt</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.studentId} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-900">
                  <Link href={`/students/${r.studentId}`} className="hover:text-indigo-700 hover:underline">
                    {r.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">{r.groupName}</td>
                <td className="px-4 py-3 text-slate-600">{r.phone}</td>
                {r.cells.map((cell, i) => (
                  <td key={i} className="px-4 py-3 text-right tabular-nums">
                    {cell}
                  </td>
                ))}
                <td className="px-4 py-3 text-right font-semibold tabular-nums text-rose-700">{formatMoney(r.debt)}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/payments/new?studentId=${r.studentId}`} className="text-indigo-600 hover:underline">
                    Record payment
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-slate-100 md:hidden">
        {rows.map((r) => (
          <li key={r.studentId} className="space-y-2 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Link href={`/students/${r.studentId}`} className="font-medium text-slate-900 hover:text-indigo-700">
                  {r.name}
                </Link>
                <p className="text-xs text-slate-500">
                  {r.groupName} · {r.phone}
                </p>
              </div>
              <p className="text-right font-semibold tabular-nums text-rose-700">{formatMoney(r.debt)}</p>
            </div>
            <div className="flex justify-between gap-3 text-xs text-slate-500">
              <span>{r.mobileSummary}</span>
              <Link href={`/payments/new?studentId=${r.studentId}`} className="shrink-0 font-medium text-indigo-600">
                Record payment
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

function DebtorsView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requested = searchParams.get('month') ?? '';
  const month = MONTH_PATTERN.test(requested) ? requested : currentMonth();
  const view: View = searchParams.get('view') === 'balance' ? 'balance' : 'month';

  // All debt figures come from the API; the UI only displays them.
  const report = useAsync(
    useCallback(
      async (): Promise<Loaded> =>
        view === 'balance'
          ? { view, report: await api.getBalanceDebtors(month) }
          : { view, report: await api.getDebtors(month) },
      [month, view],
    ),
  );
  const loaded = report.data;
  const data = loaded?.report;
  const rows: Row[] = !loaded
    ? []
    : loaded.view === 'balance'
      ? balanceRows(loaded.report.debtors)
      : monthRows(loaded.report.debtors);

  function navigate(next: { month?: string; view?: View }) {
    const params = new URLSearchParams({ month: next.month ?? month });
    if ((next.view ?? view) === 'balance') params.set('view', 'balance');
    router.replace(`${pathname}?${params.toString()}`);
  }

  const current = views.find((v) => v.id === view) ?? views[0]!;

  return (
    <>
      <PageHeader
        title="Debtors"
        description={current.description}
        actions={
          <label className="flex items-center gap-2 text-sm text-slate-600">
            Month
            <Input
              type="month"
              value={month}
              onChange={(e) => MONTH_PATTERN.test(e.target.value) && navigate({ month: e.target.value })}
              className="w-44"
              required
            />
          </label>
        }
      />

      <div role="tablist" aria-label="Debt calculation" className="mb-4 inline-flex rounded-lg border border-slate-200 bg-white p-1">
        {views.map((v) => (
          <button
            key={v.id}
            type="button"
            role="tab"
            aria-selected={v.id === view}
            onClick={() => navigate({ view: v.id })}
            className={cx(
              'rounded-md px-3 py-1.5 text-sm font-medium transition',
              v.id === view ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100',
            )}
          >
            {v.label}
          </button>
        ))}
      </div>

      {report.error !== undefined ? (
        <Alert tone="error" onRetry={report.reload}>
          Could not load debtors: {errorMessage(report.error)}
        </Alert>
      ) : !data ? (
        <Card>
          <LoadingState label={`Loading debtors for ${formatMonth(month)}…`} />
        </Card>
      ) : (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 text-sm">
            <span className="font-medium text-slate-700">
              {formatMonth(data.month)} · {data.count} {data.count === 1 ? 'debtor' : 'debtors'}
              {report.loading && <Spinner className="ml-2 text-indigo-600" />}
            </span>
            <span className="text-slate-500">
              Total outstanding: <span className="font-semibold text-slate-900">{formatMoney(data.totalDebt)}</span>
            </span>
          </div>

          {data.count === 0 ? (
            <EmptyState
              title="No debtors"
              description={
                view === 'balance'
                  ? `Every student is paid up to ${formatMonth(data.month)}.`
                  : `Every student has paid in full for ${formatMonth(data.month)}.`
              }
            />
          ) : (
            <DebtorsTable view={loaded?.view ?? view} rows={rows} />
          )}
        </Card>
      )}
    </>
  );
}

export default function DebtorsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <DebtorsView />
    </Suspense>
  );
}
