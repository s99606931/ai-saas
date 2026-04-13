/**
 * DS-ATOM-R3 — Avatar variants
 * Plan SC: FR-DSA.23, FR-DSA.23.1
 */

import { cva } from '../lib/cva.js';

export const avatarVariants = cva(
  [
    'relative inline-flex items-center justify-center',
    'overflow-hidden',
    'shrink-0',
    'bg-[var(--color-surface-alt)]',
    'text-[var(--color-on-surface)]',
    'font-medium',
    'select-none',
  ].join(' '),
  {
    variants: {
      size: {
        xs: 'h-6 w-6 text-[length:var(--font-size-xs)]',
        sm: 'h-8 w-8 text-[length:var(--font-size-sm)]',
        md: 'h-10 w-10 text-[length:var(--font-size-md)]',
        lg: 'h-14 w-14 text-[length:var(--font-size-lg)]',
        xl: 'h-20 w-20 text-[length:var(--font-size-xl)]',
      },
      shape: {
        circle: 'rounded-full',
        square: 'rounded-[var(--radius-md)]',
      },
    },
    defaultVariants: {
      size: 'md',
      shape: 'circle',
    },
  }
);

export const statusIndicatorVariants = cva(
  [
    'absolute bottom-0 right-0',
    'rounded-full',
    'border-2 border-[var(--color-surface)]',
  ].join(' '),
  {
    variants: {
      size: {
        xs: 'h-1.5 w-1.5',
        sm: 'h-2 w-2',
        md: 'h-2.5 w-2.5',
        lg: 'h-3 w-3',
        xl: 'h-4 w-4',
      },
      status: {
        online: 'bg-[var(--color-success)]',
        offline: 'bg-[var(--color-on-surface-muted)]',
        busy: 'bg-[var(--color-error)]',
        away: 'bg-[var(--color-warning)]',
      },
    },
    defaultVariants: {
      size: 'md',
      status: 'online',
    },
  }
);
