/**
 * DS-ORG-R2 — PageHeader
 * Design Ref: docs/02-design/mtus/DS-ORG-R2.design.md §PageHeader
 * Plan SC: FR-DSO.21, FR-DSO.21.1
 */

import { forwardRef, type ReactNode } from 'react';
import { cn } from '../../atoms/lib/cn.js';

export interface PageHeaderBreadcrumb {
  label: string;
  path?: string;
}

export interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  breadcrumbs?: PageHeaderBreadcrumb[];
  actions?: ReactNode;
  as?: 'h1' | 'h2';
  className?: string;
}

export const PageHeader = forwardRef<HTMLElement, PageHeaderProps>(
  (
    { title, subtitle, breadcrumbs, actions, as = 'h1', className },
    ref
  ) => {
    const Heading = as;
    return (
      <header
        ref={ref}
        className={cn(
          'mb-6 pb-4 border-b border-[var(--color-border)]',
          className
        )}
      >
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav
            aria-label="경로"
            className="mb-2 text-[length:var(--font-size-xs)] text-[var(--color-on-surface-muted)]"
          >
            <ol className="flex items-center gap-1 flex-wrap">
              {breadcrumbs.map((crumb, i) => (
                <li
                  key={`${crumb.label}-${i}`}
                  className="flex items-center gap-1"
                >
                  {i > 0 && <span aria-hidden="true">/</span>}
                  {crumb.path ? (
                    <a href={crumb.path} className="hover:underline">
                      {crumb.label}
                    </a>
                  ) : (
                    <span>{crumb.label}</span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        )}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <Heading className="text-[length:var(--font-size-2xl)] font-bold text-[var(--color-on-background)] truncate">
              {title}
            </Heading>
            {subtitle && (
              <p className="mt-1 text-[length:var(--font-size-sm)] text-[var(--color-on-surface-muted)]">
                {subtitle}
              </p>
            )}
          </div>
          {actions && (
            <div className="flex items-center gap-2 flex-shrink-0">
              {actions}
            </div>
          )}
        </div>
      </header>
    );
  }
);

PageHeader.displayName = 'PageHeader';
