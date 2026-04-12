/**
 * DS-ATOM-R2 — Switch 컴포넌트
 * Design Ref: docs/02-design/mtus/DS-ATOM-R2.design.md §Switch
 * Plan SC: FR-DSA.16
 *
 * role="switch" + 시각 토글. 네이티브 checkbox 기반.
 */

import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../lib/cn.js';

export interface SwitchProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = {
  sm: { track: 'h-4 w-7', thumb: 'h-3 w-3', translate: 'peer-checked:translate-x-3' },
  md: { track: 'h-5 w-9', thumb: 'h-4 w-4', translate: 'peer-checked:translate-x-4' },
  lg: { track: 'h-6 w-11', thumb: 'h-5 w-5', translate: 'peer-checked:translate-x-5' },
} as const;

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, label, size = 'md', disabled, checked, id, ...props }, ref) => {
    const sz = sizeMap[size];

    const toggle = (
      <span
        className={cn(
          'relative inline-flex items-center',
          disabled && 'opacity-60 cursor-not-allowed',
          !disabled && 'cursor-pointer'
        )}
      >
        <input
          ref={ref}
          id={id}
          type="checkbox"
          role="switch"
          checked={checked}
          disabled={disabled}
          className="peer sr-only"
          {...props}
        />
        <span
          aria-hidden="true"
          className={cn(
            'relative inline-block rounded-full',
            'bg-[var(--color-outline-strong)]',
            'transition-colors duration-[var(--motion-duration-base)]',
            'peer-checked:bg-[var(--color-primary)]',
            'peer-focus-visible:ring-2',
            'peer-focus-visible:ring-[var(--color-focus-ring)]',
            'peer-focus-visible:ring-offset-2',
            sz.track
          )}
        >
          <span
            className={cn(
              'absolute left-0.5 top-1/2 -translate-y-1/2',
              'inline-block rounded-full bg-white shadow',
              'transition-transform duration-[var(--motion-duration-base)]',
              'ease-[var(--motion-ease-out)]',
              sz.thumb,
              sz.translate
            )}
          />
        </span>
      </span>
    );

    if (!label) return <span className={className}>{toggle}</span>;

    return (
      <label className={cn('inline-flex items-center gap-3', className)}>
        {toggle}
        <span className="text-[length:var(--font-size-sm)] text-[var(--color-on-surface)]">
          {label}
        </span>
      </label>
    );
  }
);

Switch.displayName = 'Switch';
