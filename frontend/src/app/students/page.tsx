'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { StudentForm } from '@/components/student-form';
import { Alert, Button, Card, EmptyState, Input, LoadingState, PageHeader, Spinner } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { formatMoney, formatMonth } from '@/lib/format';
import type { Student, StudentInput } from '@/lib/types';
import { useAsync } from '@/lib/use-async';

type Editor = { mode: 'create' } | { mode: 'edit'; student: Student } | null;

export default function StudentsPage() {
  const students = useAsync(useCallback(() => api.listStudents(), []));
  const [editor, setEditor] = useState<Editor>(null);
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!students.data || !q) return students.data ?? [];
    return students.data.filter((s) => [s.name, s.phone, s.groupName].some((v) => v.toLowerCase().includes(q)));
  }, [students.data, query]);

  async function save(input: StudentInput) {
    if (editor?.mode === 'edit') {
      const updated = await api.updateStudent(editor.student.id, input);
      setNotice({ tone: 'success', text: `Updated ${updated.name}.` });
    } else {
      const created = await api.createStudent(input);
      setNotice({ tone: 'success', text: `Added ${created.name}.` });
    }
    setEditor(null);
    students.reload();
  }

  async function remove(student: Student) {
    if (!window.confirm(`Delete ${student.name}? This cannot be undone.`)) return;
    setNotice(null);
    setDeletingId(student.id);
    try {
      await api.deleteStudent(student.id);
      setNotice({ tone: 'success', text: `Deleted ${student.name}.` });
      students.reload();
    } catch (error) {
      // The API refuses (409) to delete students that have payment history.
      setNotice({ tone: 'error', text: errorMessage(error) });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Students"
        description="Add, edit and remove students. Students with payment history cannot be deleted."
        actions={
          editor === null && (
            <Button
              onClick={() => {
                setNotice(null);
                setEditor({ mode: 'create' });
              }}
            >
              Add student
            </Button>
          )
        }
      />

      {notice && (
        <div className="mb-4">
          <Alert tone={notice.tone}>{notice.text}</Alert>
        </div>
      )}

      {editor && (
        <Card className="mb-6 p-5 sm:p-6">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">
            {editor.mode === 'edit' ? `Edit ${editor.student.name}` : 'New student'}
          </h2>
          <StudentForm
            key={editor.mode === 'edit' ? editor.student.id : 'new'}
            initial={editor.mode === 'edit' ? editor.student : undefined}
            submitLabel={editor.mode === 'edit' ? 'Save changes' : 'Add student'}
            onSubmit={save}
            onCancel={() => setEditor(null)}
          />
        </Card>
      )}

      <Card>
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
          <Input
            type="search"
            placeholder="Search by name, phone or group"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="sm:max-w-xs"
            aria-label="Search students"
          />
          {students.loading && students.data && <Spinner className="text-indigo-600" />}
        </div>

        {students.error !== undefined ? (
          <div className="p-4">
            <Alert tone="error" onRetry={students.reload}>
              Could not load students: {errorMessage(students.error)}
            </Alert>
          </div>
        ) : !students.data ? (
          <LoadingState label="Loading students…" />
        ) : students.data.length === 0 ? (
          <EmptyState
            title="No students yet"
            description="Add your first student to start tracking payments."
            action={editor === null && <Button onClick={() => setEditor({ mode: 'create' })}>Add student</Button>}
          />
        ) : filtered.length === 0 ? (
          <EmptyState title="No matches" description={`No student matches “${query}”.`} />
        ) : (
          <ul className="divide-y divide-slate-100">
            {filtered.map((s) => (
              <li key={s.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <Link href={`/students/${s.id}`} className="font-medium text-slate-900 hover:text-indigo-700 hover:underline">
                    {s.name}
                  </Link>
                  <p className="truncate text-sm text-slate-500">
                    {s.groupName} · {s.phone} · {formatMoney(s.monthlyFee)} / month · since {formatMonth(s.startMonth)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Link
                    href={`/students/${s.id}`}
                    className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
                  >
                    Payments
                  </Link>
                  <Button
                    variant="secondary"
                    className="py-1.5"
                    onClick={() => {
                      setNotice(null);
                      setEditor({ mode: 'edit', student: s });
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    Edit
                  </Button>
                  <Button variant="danger" className="py-1.5" disabled={deletingId === s.id} onClick={() => void remove(s)}>
                    {deletingId === s.id && <Spinner />}
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
