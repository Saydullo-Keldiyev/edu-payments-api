'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useState } from 'react';
import { PaymentForm } from '@/components/payment-form';
import { Alert, Card, EmptyState, LoadingState, PageHeader } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import type { Payment } from '@/lib/types';
import { useAsync } from '@/lib/use-async';

function NewPaymentView() {
  const searchParams = useSearchParams();
  const students = useAsync(useCallback(() => api.listStudents(), []));
  const [lastPayment, setLastPayment] = useState<Payment | null>(null);

  const requestedId = searchParams.get('studentId') ?? '';
  const initialStudentId = students.data?.some((s) => s.id === requestedId) ? requestedId : '';

  return (
    <>
      <PageHeader title="Record payment" description="Add a payment to a student's history." />
      <Card className="max-w-2xl p-5 sm:p-6">
        {students.error !== undefined ? (
          <Alert tone="error" onRetry={students.reload}>
            Could not load students: {errorMessage(students.error)}
          </Alert>
        ) : !students.data ? (
          <LoadingState label="Loading students…" />
        ) : students.data.length === 0 ? (
          <EmptyState
            title="No students yet"
            description="Add a student before recording payments."
            action={
              <Link href="/students" className="text-sm font-medium text-indigo-600 hover:underline">
                Go to students
              </Link>
            }
          />
        ) : (
          <>
            <PaymentForm
              key={initialStudentId}
              students={students.data}
              initialStudentId={initialStudentId}
              onRecorded={setLastPayment}
            />
            {lastPayment && (
              <p className="mt-4 text-sm text-slate-500">
                <Link href={`/students/${lastPayment.studentId}`} className="font-medium text-indigo-600 hover:underline">
                  View this student&apos;s payment history
                </Link>
              </p>
            )}
          </>
        )}
      </Card>
    </>
  );
}

export default function NewPaymentPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <NewPaymentView />
    </Suspense>
  );
}
