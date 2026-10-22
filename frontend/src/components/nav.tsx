'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cx } from './ui';

const links = [
  { href: '/', label: 'Dashboard' },
  { href: '/debtors', label: 'Debtors' },
  { href: '/payments/new', label: 'Record payment' },
  { href: '/students', label: 'Students' },
];

export function Nav() {
  const pathname = usePathname();
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <Link href="/" className="font-semibold text-slate-900">
          EduPay <span className="font-normal text-slate-500">Admin</span>
        </Link>
        <nav className="-mx-1 flex gap-1 overflow-x-auto pb-1 sm:pb-0">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(link.href) ? 'page' : undefined}
              className={cx(
                'whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition',
                isActive(link.href) ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100',
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
