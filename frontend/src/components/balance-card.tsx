'use client';

import { errorMessage } from '@/lib/api';
import { formatMoney, formatMonth } from '@/lib/format';
import type { AsyncResult } from '@/lib/use-async';
import type { StudentBalance } from '@/lib/types';
import { Alert, Card, LoadingState, Spinner, cx } from './ui';

const isZero = (money: string) => !/[1-9]/.test(money);

/** Running balance from the API: overpayments cover following months, oldest unpaid month first. */
export function BalanceCard({ balance }: { balance: AsyncResult<StudentBalance> }) {
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold text-slate-900">Balance</h2>
        {balance.loading && balance.data && <Spinner className="text-indigo-600" />}
      </div>
      {balance.error !== undefined ? (
        <Alert tone="error" onRetry={balance.reload}>
          Could not load balance: {errorMessage(balance.error)}
        </Alert>
      ) : !balance.data ? (
        <LoadingState label="Loading balance…" />
      ) : (
        <BalanceDetails b={balance.data} />
      )}
    </Card>
  );
}

function BalanceDetails({ b }: { b: StudentBalance }) {
  const inDebt = !isZero(b.debtAmount);
  const prepaid = !isZero(b.creditAmount);

  return (
    <div className="space-y-3 text-sm">
      <div
        className={cx(
          'rounded-lg px-3 py-2',
          inDebt ? 'bg-rose-50 text-rose-800' : prepaid ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-50 text-slate-700',
        )}
      >
        {inDebt ? (
          <>
            <p className="text-lg font-semibold tabular-nums">Owes {formatMoney(b.debtAmount)}</p>
            <p>
              {b.unpaidMonths} unpaid {b.unpaidMonths === 1 ? 'month' : 'months'} up to {formatMonth(b.month)}
            </p>
          </>
        ) : prepaid ? (
          <>
            <p className="text-lg font-semibold tabular-nums">Prepaid {formatMoney(b.creditAmount)}</p>
            <p>Covers months after {formatMonth(b.month)}</p>
          </>
        ) : (
          <p className="font-medium">{b.monthsBilled === 0 ? 'Billing has not started yet' : 'Up to date'}</p>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
        <dt className="text-slate-500">Paid through</dt>
        <dd className="text-right font-medium text-slate-900">
          {b.paidThroughMonth ? formatMonth(b.paidThroughMonth) : '—'}
        </dd>
        <dt className="text-slate-500">Billed since</dt>
        <dd className="text-right text-slate-700">{formatMonth(b.startMonth)}</dd>
        <dt className="text-slate-500">Due ({b.monthsBilled} mo.)</dt>
        <dd className="text-right tabular-nums text-slate-700">{formatMoney(b.totalDue)}</dd>
        <dt className="text-slate-500">Total paid</dt>
        <dd className="text-right tabular-nums text-slate-700">{formatMoney(b.totalPaid)}</dd>
      </dl>
    </div>
  );
}
