'use client';

import { useState, type FormEvent } from 'react';
import { ApiError, errorMessage } from '@/lib/api';
import { MONTH_PATTERN, currentMonth } from '@/lib/format';
import { sanitizeMoney, sanitizePhone } from '@/lib/input';
import type { Student, StudentInput } from '@/lib/types';
import { Alert, Button, Field, Input, Spinner } from './ui';

const MONEY_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;

type Errors = Partial<Record<keyof StudentInput, string>>;

function validate(input: StudentInput): Errors {
  const errors: Errors = {};
  if (!input.name) errors.name = 'Name is required';
  if (!/^\+?\d{7,15}$/.test(input.phone.replace(/[\s\-().]/g, ''))) {
    errors.phone = 'Enter 7 to 15 digits, optionally starting with +';
  }
  if (!input.groupName) errors.groupName = 'Group is required';
  if (!MONEY_PATTERN.test(input.monthlyFee)) errors.monthlyFee = 'Enter a fee like 500000 or 500000.50';
  if (!MONTH_PATTERN.test(input.startMonth)) errors.startMonth = 'Choose the first billed month';
  return errors;
}

interface StudentFormProps {
  initial?: Student;
  submitLabel: string;
  onSubmit: (input: StudentInput) => Promise<void>;
  onCancel?: () => void;
}

export function StudentForm({ initial, submitLabel, onSubmit, onCancel }: StudentFormProps) {
  const [values, setValues] = useState<StudentInput>({
    name: initial?.name ?? '',
    phone: initial?.phone ?? '',
    groupName: initial?.groupName ?? '',
    monthlyFee: initial?.monthlyFee ?? '',
    startMonth: initial?.startMonth ?? currentMonth(),
  });
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const set =
    (field: keyof StudentInput, sanitize: (value: string) => string = (value) => value) =>
    (e: { target: { value: string } }) =>
      setValues((v) => ({ ...v, [field]: sanitize(e.target.value) }));

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const input: StudentInput = {
      name: values.name.trim(),
      phone: values.phone.trim(),
      groupName: values.groupName.trim(),
      monthlyFee: values.monthlyFee.trim().replace(/\s/g, '').replace(',', '.'),
      startMonth: values.startMonth,
    };
    const clientErrors = validate(input);
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length > 0) return;

    setSubmitting(true);
    try {
      await onSubmit(input);
    } catch (error) {
      if (error instanceof ApiError) {
        // A 409 here is the unique phone conflict; show it on the field.
        if (error.status === 409) setErrors({ phone: error.message });
        else setErrors(error.fieldErrors);
      }
      setFormError(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {formError && <Alert tone="error">{formError}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" error={errors.name}>
          <Input value={values.name} onChange={set('name')} invalid={!!errors.name} disabled={submitting} maxLength={100} />
        </Field>
        <Field label="Phone" error={errors.phone} hint="Must be unique, e.g. +998901234567">
          <Input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+998 90 123 45 67"
            value={values.phone}
            onChange={set('phone', sanitizePhone)}
            invalid={!!errors.phone}
            disabled={submitting}
          />
        </Field>
        <Field label="Group" error={errors.groupName}>
          <Input value={values.groupName} onChange={set('groupName')} invalid={!!errors.groupName} disabled={submitting} maxLength={100} />
        </Field>
        <Field label="Monthly fee" error={errors.monthlyFee}>
          <Input
            inputMode="decimal"
            autoComplete="off"
            placeholder="e.g. 500000"
            value={values.monthlyFee}
            onChange={set('monthlyFee', sanitizeMoney)}
            invalid={!!errors.monthlyFee}
            disabled={submitting}
          />
        </Field>
        <Field label="Start month" error={errors.startMonth} hint="First month the student is billed for (running balance)">
          <Input
            type="month"
            value={values.startMonth}
            onChange={set('startMonth')}
            invalid={!!errors.startMonth}
            disabled={submitting}
            required
          />
        </Field>
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button variant="secondary" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={submitting}>
          {submitting && <Spinner />}
          {submitting ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
