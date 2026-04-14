/**
 * DS-ORG-R2 — FilterBar
 * Design Ref: docs/02-design/mtus/DS-ORG-R2.design.md §FilterBar
 * Plan SC: FR-DSO.22, FR-DSO.22.1
 */

import { forwardRef, type ReactNode } from 'react';
import { RotateCcw } from 'lucide-react';
import { cn } from '../../atoms/lib/cn.js';

export interface FilterBarProps {
  children: ReactNode;
  hasActiveFilters?: boolean;
  onReset?: () => void;
  resetLabel?: string;
  className?: string;
  'aria-label'?: string;
}

export const FilterBar = forwardRef<HTMLElement, FilterBarProps>(
  (
    {
      children,
      hasActiveFilters = false,
      onReset,
      resetLabel = '초기화',
      className,
      'aria-label': ariaLabel = '필터',
    },
    ref
  ) => {
    return (
      <section
        ref={ref}
        aria-label={ariaLabel}
        data-active={hasActiveFilters || undefined}
        className={cn(
          'mb-4 p-3 rounded-md border',
          hasActiveFilters
            ? 'border-[var(--color-primary)] bg-[var(--color-primary-container)]/30'
            : 'border-[var(--color-border)] bg-[var(--color-surface)]',
          className
        )}
      >
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 flex items-center gap-3 flex-wrap min-w-0">
            {children}
          </div>
          {onReset && (
            <button
              type="button"
              onClick={onReset}
              className="flex items-center gap-1 px-3 py-2 rounded-md text-[length:var(--font-size-sm)] text-[var(--color-on-surface)] hover:bg-[var(--color-surface-hover)] transition-colors"
            >
              <RotateCcw size={14} aria-hidden="true" />
              {resetLabel}
            </button>
          )}
        </div>
      </section>
    );
  }
);

FilterBar.displayName = 'FilterBar';
