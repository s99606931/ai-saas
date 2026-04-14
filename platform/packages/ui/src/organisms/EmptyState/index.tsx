/**
 * DS-ORG-R2 — EmptyState
 * Design Ref: docs/02-design/mtus/DS-ORG-R2.design.md §EmptyState
 * Plan SC: FR-DSO.23, FR-DSO.23.1
 */

import { forwardRef, type ReactNode } from 'react';
import { Inbox, Search, Lock, AlertCircle } from 'lucide-react';
import { cn } from '../../atoms/lib/cn.js';

export type EmptyStateVariant = 'default' | 'search' | 'forbidden' | 'error';

export interface EmptyStateProps {
  variant?: EmptyStateVariant;
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

const VARIANT_META: Record<
  EmptyStateVariant,
  {
    defaultIcon: ReactNode;
    role: 'status' | 'alert';
    colorClass: string;
  }
> = {
  default: {
    defaultIcon: <Inbox size={48} />,
    role: 'status',
    colorClass: 'text-[var(--color-on-surface-muted)]',
  },
  search: {
    defaultIcon: <Search size={48} />,
    role: 'status',
    colorClass: 'text-[var(--color-on-surface-muted)]',
  },
  forbidden: {
    defaultIcon: <Lock size={48} />,
    role: 'alert',
    colorClass: 'text-[var(--color-warning)]',
  },
  error: {
    defaultIcon: <AlertCircle size={48} />,
    role: 'alert',
    colorClass: 'text-[var(--color-error)]',
  },
};

export const EmptyState = forwardRef<HTMLDivElement, EmptyStateProps>(
  (
    {
      variant = 'default',
      icon,
      title,
      description,
      action,
      className,
    },
    ref
  ) => {
    const meta = VARIANT_META[variant];
    const displayIcon = icon ?? meta.defaultIcon;

    return (
      <div
        ref={ref}
        role={meta.role}
        data-variant={variant}
        className={cn(
          'flex flex-col items-center justify-center text-center py-12 px-4',
          className
        )}
      >
        <div
          aria-hidden={icon ? undefined : true}
          className={cn('mb-4', meta.colorClass)}
        >
          {displayIcon}
        </div>
        <h3 className="text-[length:var(--font-size-lg)] font-semibold text-[var(--color-on-background)]">
          {title}
        </h3>
        {description && (
          <p className="mt-2 max-w-md text-[length:var(--font-size-sm)] text-[var(--color-on-surface-muted)]">
            {description}
          </p>
        )}
        {action && <div className="mt-6">{action}</div>}
      </div>
    );
  }
);

EmptyState.displayName = 'EmptyState';
