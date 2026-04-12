/**
 * DS-MOL-R1 — Alert variants
 * Plan SC: FR-DSM.3
 */

import { cva } from '../../atoms/lib/cva.js';

export const alertVariants = cva(
  [
    'relative flex items-start gap-3',
    'p-4',
    'rounded-[var(--radius-md)]',
    'border',
    'text-[length:var(--font-size-sm)]',
  ].join(' '),
  {
    variants: {
      variant: {
        info: [
          'bg-[var(--color-info-container)]',
          'text-[var(--color-on-info-container)]',
          'border-[var(--color-info)]/30',
        ].join(' '),
        success: [
          'bg-[var(--color-success-container)]',
          'text-[var(--color-on-success-container)]',
          'border-[var(--color-success)]/30',
        ].join(' '),
        warning: [
          'bg-[var(--color-warning-container)]',
          'text-[var(--color-on-warning-container)]',
          'border-[var(--color-warning)]/30',
        ].join(' '),
        error: [
          'bg-[var(--color-error-container)]',
          'text-[var(--color-on-error-container)]',
          'border-[var(--color-error)]/30',
        ].join(' '),
      },
    },
    defaultVariants: {
      variant: 'info',
    },
  }
);

export type AlertVariant = 'info' | 'success' | 'warning' | 'error';
