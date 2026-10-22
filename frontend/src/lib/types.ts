/**
 * Mirrors the backend response DTOs (backend/src/modules/*\/*.service.ts).
 * Money values are decimal strings with two places (e.g. "500000.00") and are never
 * converted to JavaScript numbers in the UI.
 */

export interface Student {
  id: string;
  name: string;
  phone: string;
  groupName: string;
  monthlyFee: string;
  /** First billed month, YYYY-MM (used by the running balance). */
  startMonth: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudentInput {
  name: string;
  phone: string;
  groupName: string;
  monthlyFee: string;
  startMonth: string;
}

/**
 * Running balance: every month from startMonth is billed, and all payments together pay the
 * oldest months first, so an overpayment covers following months (GET /students/:id/balance).
 */
export interface StudentBalance {
  studentId: string;
  month: string;
  startMonth: string;
  monthlyFee: string;
  monthsBilled: number;
  totalDue: string;
  totalPaid: string;
  debtAmount: string;
  creditAmount: string;
  unpaidMonths: number;
  paidThroughMonth: string | null;
}

export interface BalanceDebtor {
  studentId: string;
  name: string;
  phone: string;
  groupName: string;
  monthlyFee: string;
  startMonth: string;
  monthsBilled: number;
  totalDue: string;
  totalPaid: string;
  debtAmount: string;
  unpaidMonths: number;
  paidThroughMonth: string | null;
}

export interface BalanceDebtorsReport {
  month: string;
  count: number;
  totalDebt: string;
  debtors: BalanceDebtor[];
}

export interface Payment {
  id: string;
  studentId: string;
  amount: string;
  /** YYYY-MM-DD */
  paymentDate: string;
  createdAt: string;
}

export interface PaymentInput {
  studentId: string;
  amount: string;
  /** YYYY-MM-DD */
  paymentDate: string;
}

export interface Debtor {
  studentId: string;
  name: string;
  phone: string;
  groupName: string;
  monthlyFee: string;
  totalPaid: string;
  debtAmount: string;
}

export interface DebtorsReport {
  /** YYYY-MM */
  month: string;
  count: number;
  totalDebt: string;
  debtors: Debtor[];
}

export interface ValidationIssue {
  path: string;
  message: string;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
