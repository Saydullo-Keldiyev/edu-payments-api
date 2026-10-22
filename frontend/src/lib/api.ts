import type {
  ApiErrorBody,
  BalanceDebtorsReport,
  DebtorsReport,
  Payment,
  PaymentInput,
  Student,
  StudentBalance,
  StudentInput,
  ValidationIssue,
} from './types';

export class ApiError extends Error {
  constructor(
    message: string,
    /** HTTP status, or 0 when the API could not be reached at all. */
    public readonly status: number,
    public readonly code: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Field-level messages from a 400 VALIDATION_ERROR, keyed by field name. */
  get fieldErrors(): Record<string, string> {
    if (this.code !== 'VALIDATION_ERROR' || !Array.isArray(this.details)) return {};
    const result: Record<string, string> = {};
    for (const issue of this.details as ValidationIssue[]) {
      if (issue.path && !(issue.path in result)) result[issue.path] = issue.message;
    }
    return result;
  }
}

function baseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) {
    throw new ApiError('NEXT_PUBLIC_API_URL is not configured. Copy .env.example to .env.local.', 0, 'CONFIG_ERROR');
  }
  return url.replace(/\/+$/, '');
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    'error' in value &&
    typeof (value as ApiErrorBody).error?.message === 'string'
  );
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = `${baseUrl()}${path}`;
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
      cache: 'no-store',
    });
  } catch {
    throw new ApiError(`Cannot reach the API at ${baseUrl()}. Is the backend running?`, 0, 'NETWORK_ERROR');
  }

  if (response.status === 204) return undefined as T;

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    if (isApiErrorBody(body)) {
      throw new ApiError(body.error.message, response.status, body.error.code, body.error.details);
    }
    throw new ApiError(`Request failed with status ${response.status}`, response.status, 'HTTP_ERROR');
  }
  return body as T;
}

const json = (data: unknown): string => JSON.stringify(data);

export const api = {
  listStudents: () => request<Student[]>('/students'),
  getStudent: (id: string) => request<Student>(`/students/${encodeURIComponent(id)}`),
  createStudent: (input: StudentInput) => request<Student>('/students', { method: 'POST', body: json(input) }),
  updateStudent: (id: string, input: StudentInput) =>
    request<Student>(`/students/${encodeURIComponent(id)}`, { method: 'PUT', body: json(input) }),
  deleteStudent: (id: string) => request<void>(`/students/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  listStudentPayments: (studentId: string) =>
    request<Payment[]>(`/students/${encodeURIComponent(studentId)}/payments`),
  createPayment: (input: PaymentInput) => request<Payment>('/payments', { method: 'POST', body: json(input) }),

  getDebtors: (month: string) => request<DebtorsReport>(`/debtors?month=${encodeURIComponent(month)}`),

  getStudentBalance: (studentId: string, month: string) =>
    request<StudentBalance>(`/students/${encodeURIComponent(studentId)}/balance?month=${encodeURIComponent(month)}`),
  getBalanceDebtors: (month: string) =>
    request<BalanceDebtorsReport>(`/balances/debtors?month=${encodeURIComponent(month)}`),
};

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Something went wrong';
}
