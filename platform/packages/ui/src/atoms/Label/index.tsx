/**
 * DS-ATOM-R2 — Label 컴포넌트
 * Design Ref: docs/02-design/mtus/DS-ATOM-R2.design.md §Label
 * Plan SC: FR-DSA.17
 */

import { forwardRef, type LabelHTMLAttributes } from 'react';
import { cn } from '../lib/cn.js';

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  /** 필수 항목 표시 (*) */
  required?: boolean;
  /** 선택 항목 표시 */
  optional?: boolean;
  /** 비활성 상태 표시 */
  disabled?: boolean;
}

export const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, required, optional, disabled, children, ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={cn(
          'inline-flex items-center gap-1',
          'text-[length:var(--font-size-sm)]',
          'font-[var(--font-weight-medium)]',
          'text-[var(--color-on-surface)]',
          disabled && 'opacity-60 cursor-not-allowed',
          className
        )}
        {...props}
      >
        {children}
        {required && (
          <span
            aria-label="필수 입력"
            className="text-[var(--color-error)]"
          >
            *
          </span>
        )}
        {optional && !required && (
          <span className="text-[var(--color-on-surface-muted)] text-[length:var(--font-size-xs)]">
            (선택)
          </span>
        )}
      </label>
    );
  }
);

Label.displayName = 'Label';
