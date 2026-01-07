 'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface Crumb {
  label: string;
  href?: string;
}

export default function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  const router = useRouter();

  const handleClick = useCallback((e: React.MouseEvent, href?: string) => {
    if (!href) return;
    e.preventDefault();
    router.push(href);
  }, [router]);

  return (
    <nav className="text-sm text-gray-500 mb-6" aria-label="Breadcrumb">
      {crumbs.map((c, i) => (
        <span key={i} className="inline-flex items-center">
          {c.href ? (
            <a
              href={c.href}
              onClick={(e) => handleClick(e, c.href)}
              className="hover:text-gray-700 text-sm font-medium cursor-pointer"
            >
              {c.label}
            </a>
          ) : (
            <span className="text-gray-900 font-medium">{c.label}</span>
          )}
          {i < crumbs.length - 1 && <span className="mx-2">/</span>}
        </span>
      ))}
    </nav>
  );
}
