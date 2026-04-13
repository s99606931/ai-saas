/**
 * DS-ATOM-R3 — Select 컴포넌트
 * Design Ref: docs/02-design/mtus/DS-ATOM-R3.design.md §1
 * Plan SC: FR-DSA.21, FR-DSA.21.1, FR-DSA.21.2
 *
 * 네이티브 <select> 기반. Input 패턴(inputVariants) 재사용.
 * 단일 선택, size 3단계, error/helper 지원.
 */

import {
  forwardRef,
  useId,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../lib/cn.js';
import { inputVariants } from '../Input/Input.variants.js';

export interface SelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

export interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  size?: 'sm' | 'md' | 'lg';
  options: SelectOption[];
  /** 비어있는 placeholder 항목 */
  placeholder?: string;
  /** 에러 상태(boolean) 또는 메시지(string) */
  error?: boolean | string;
  /** 좌측 아이콘 */
  leadingIcon?: ReactNode;
  /** 도움말 텍스트 */
  helperText?: ReactNode;
  /** 래퍼 className */
  wrapperClassName?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className,
      wrapperClassName,
      size = 'md',
      options,
      placeholder,
      error,
      leadingIcon,
      helperText,
      id: providedId,
      'aria-describedby': ariaDescribedBy,
      required,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const id = providedId ?? generatedId;
    const errorId = `${id}-error`;
    const helperId = `${id}-helper`;

    const hasError = Boolean(error);
    const errorMessage = typeof error === 'string' ? error : undefined;

    const describedBy =
      [
        ariaDescribedBy,
        errorMessage ? errorId : null,
        helperText && !errorMessage ? helperId : null,
      ]
        .filter(Boolean)
        .join(' ') || undefined;

    return (
      <div className={cn('w-full', wrapperClassName)}>
        <div className="relative">
          {leadingIcon && (
            <span
              className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[var(--color-on-surface-muted)]"
              aria-hidden="true"
            >
              {leadingIcon}
            </span>
          )}
          <select
            ref={ref}
            id={id}
            className={cn(
              inputVariants({
                size,
                withLeadingIcon: Boolean(leadingIcon),
                withTrailingIcon: true,
              }),
              'appearance-none cursor-pointer',
              className
            )}
            aria-invalid={hasError || undefined}
            aria-describedby={describedBy}
            aria-required={required || undefined}
            required={required}
            {...props}
          >
            {placeholder !== undefined && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))}
          </select>
          <span
            className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-[var(--color-on-surface-muted)]"
            aria-hidden="true"
          >
            <ChevronDown size={16} />
          </span>
        </div>
        {errorMessage && (
          <p
            id={errorId}
            role="alert"
            aria-live="polite"
            className="mt-1 text-[length:var(--font-size-xs)] text-[var(--color-error)]"
          >
            {errorMessage}
          </p>
        )}
        {helperText && !errorMessage && (
          <p
            id={helperId}
            className="mt-1 text-[length:var(--font-size-xs)] text-[var(--color-on-surface-muted)]"
          >
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';
