'use client';

import { useState, type FormEvent } from 'react';
import { ApiError, api, errorMessage } from '@/lib/api';
import { formatMoney, todayIsoDate } from '@/lib/format';
import { sanitizeMoney } from '@/lib/input';
import type { Payment, Student } from '@/lib/types';
import { Alert, Button, Field, Input, Select, Spinner } from './ui';

const MONEY_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;

interface PaymentFormProps {
  /** Students to choose from. Ignored when `fixedStudent` is given. */
  students?: Student[];
  /** Records the payment for this student without showing a selector. */
  fixedStudent?: Student;
  initialStudentId?: string;
  onRecorded?: (payment: Payment) => void;
}

type Errors = Partial<Record<'studentId' | 'amount' | 'paymentDate', string>>;

/** Light client-side checks for fast feedback; the API remains the authority and re-validates. */
function validate(studentId: string, amount: string, paymentDate: string): Errors {
  const errors: Errors = {};
  if (!studentId) errors.studentId = 'Choose a student';
  if (!MONEY_PATTERN.test(amount)) errors.amount = 'Enter an amount like 250000 or 250000.50';
  else if (!/[1-9]/.test(amount)) errors.amount = 'Amount must be greater than 0';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) errors.paymentDate = 'Choose a date';
  return errors;
}

export function PaymentForm({ students = [], fixedStudent, initialStudentId = '', onRecorded }: PaymentFormProps) {
  const [studentId, setStudentId] = useState(fixedStudent?.id ?? initialStudentId);
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(todayIsoDate);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const studentName = (id: string) => (fixedStudent?.id === id ? fixedStudent.name : students.find((s) => s.id === id)?.name);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setSuccess(null);

    const trimmedAmount = amount.trim().replace(/\s/g, '').replace(',', '.');
    const clientErrors = validate(studentId, trimmedAmount, paymentDate);
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length > 0) return;

    setSubmitting(true);
    try {
      const payment = await api.createPayment({ studentId, amount: trimmedAmount, paymentDate });
      setSuccess(`Recorded ${formatMoney(payment.amount)} for ${studentName(payment.studentId) ?? 'the student'} on ${payment.paymentDate}.`);
      setAmount('');
      onRecorded?.(payment);
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fieldErrors).length > 0) {
        setErrors(error.fieldErrors);
      }
      setFormError(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {success && <Alert tone="success">{success}</Alert>}
      {formError && <Alert tone="error">{formError}</Alert>}

      {!fixedStudent && (
        <Field label="Student" error={errors.studentId}>
          <Select value={studentId} onChange={(e) => setStudentId(e.target.value)} invalid={!!errors.studentId} disabled={submitting}>
            <option value="">Select a student…</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.groupName} · {s.phone}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Amount" error={errors.amount} hint="Up to 2 decimal places">
          <Input
            inputMode="decimal"
            autoComplete="off"
            placeholder="e.g. 500000"
            value={amount}
            onChange={(e) => setAmount(sanitizeMoney(e.target.value))}
            invalid={!!errors.amount}
            disabled={submitting}
          />
        </Field>
        <Field label="Payment date" error={errors.paymentDate}>
          <Input
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            invalid={!!errors.paymentDate}
            disabled={submitting}
          />
        </Field>
      </div>

      <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
        {submitting && <Spinner />}
        {submitting ? 'Saving…' : 'Record payment'}
      </Button>
    </form>
  );
}
