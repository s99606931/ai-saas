/**
 * DS-ATOM-R2 — Input variants
 * Plan SC: FR-DSA.12, FR-DSA.13
 */

import { cva } from '../lib/cva.js';

export const inputVariants = cva(
  [
    'w-full',
    'bg-[var(--input-bg)]',
    'text-[var(--input-fg)]',
    'placeholder:text-[var(--input-placeholder)]',
    'border border-[var(--input-border)]',
    'rounded-[var(--input-radius)]',
    'transition-[border-color,box-shadow,background-color]',
    'duration-[var(--motion-duration-fast)]',
    'ease-[var(--motion-ease-out)]',
    'hover:border-[var(--input-border-hover)]',
    'focus:outline-none',
    'focus:border-[var(--input-border-focus)]',
    'focus:shadow-[var(--input-shadow-focus)]',
    'disabled:bg-[var(--color-disabled-bg)]',
    'disabled:text-[var(--color-disabled-fg)]',
    'disabled:cursor-not-allowed',
    'disabled:border-[var(--color-disabled-border)]',
    'aria-[invalid=true]:border-[var(--input-border-error)]',
    'aria-[invalid=true]:focus:shadow-[0_0_0_3px_rgb(220_38_38_/_0.15)]',
  ].join(' '),
  {
    variants: {
      size: {
        sm: 'h-[var(--input-height-sm)] text-[length:var(--font-size-sm)] px-[var(--space-2)]',
        md: 'h-[var(--input-height-md)] text-[length:var(--input-font-size)] px-[var(--input-padding-x)]',
        lg: 'h-[var(--input-height-lg)] text-[length:var(--font-size-lg)] px-[var(--space-4)]',
      },
      withLeadingIcon: {
        true: 'pl-10',
        false: '',
      },
      withTrailingIcon: {
        true: 'pr-10',
        false: '',
      },
    },
    defaultVariants: {
      size: 'md',
      withLeadingIcon: false,
      withTrailingIcon: false,
    },
  }
);
