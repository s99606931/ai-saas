/**
 * DS-MOL-R4 — DatePicker 분자 컴포넌트
 * Design Ref: docs/02-design/mtus/DS-MOL-R4.design.md
 * Plan SC: FR-DSM.31, FR-DSM.31.1~3
 *
 * 네이티브 <input type="date"> 기반. YYYY-MM-DD ISO 형식.
 */

import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import { Calendar } from 'lucide-react';
import { cn } from '../../atoms/lib/cn.js';
import { inputVariants } from '../../atoms/Input/Input.variants.js';

export interface DatePickerProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'type' | 'size' | 'onChange'
  > {
  size?: 'sm' | 'md' | 'lg';
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  error?: boolean | string;
  helperText?: ReactNode;
  wrapperClassName?: string;
}

export const DatePicker = forwardRef<HTMLInputElement, DatePickerProps>(
  (
    {
      className,
      wrapperClassName,
      size = 'md',
      value,
      defaultValue,
      onChange,
      error,
      helperText,
      id: providedId,
      'aria-describedby': ariaDescribedBy,
      required,
      min,
      max,
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
          <span
            className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[var(--color-on-surface-muted)]"
            aria-hidden="true"
          >
            <Calendar size={16} />
          </span>
          <input
            ref={ref}
            id={id}
            type="date"
            value={value}
            defaultValue={defaultValue}
            min={min}
            max={max}
            required={required}
            onChange={(e) => onChange?.(e.target.value)}
            aria-invalid={hasError || undefined}
            aria-describedby={describedBy}
            aria-required={required || undefined}
            className={cn(
              inputVariants({
                size,
                withLeadingIcon: true,
                withTrailingIcon: false,
              }),
              'appearance-none',
              className
            )}
            {...props}
          />
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

DatePicker.displayName = 'DatePicker';

/**
 * ISO 날짜 문자열 (YYYY-MM-DD) → 한국어 표시 문자열 변환
 * "2026-04-14" → "2026년 4월 14일"
 * 유효하지 않으면 빈 문자열 반환.
 */
export function formatKoreanDate(iso: string): string {
  if (!iso || typeof iso !== 'string') return '';
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(iso);
  if (!match) return '';
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (!y || !m || !d || m < 1 || m > 12 || d < 1 || d > 31) return '';
  return `${y}년 ${m}월 ${d}일`;
}
