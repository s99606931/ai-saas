/**
 * DS-MOL-R1 — FormField 분자 컴포넌트
 * Design Ref: docs/02-design/mtus/DS-MOL-R1.design.md §결정 1
 * Plan SC: FR-DSM.1, FR-DSM.2
 *
 * Label + input + error/helper를 하나의 필드로 통합.
 * children으로 임의의 입력 컴포넌트 주입 가능.
 */

import {
  Children,
  cloneElement,
  isValidElement,
  useId,
  type ReactElement,
  type ReactNode,
} from 'react';
import { cn } from '../../atoms/lib/cn.js';
import { Label } from '../../atoms/Label/index.js';

export interface FormFieldProps {
  /** 필드 라벨 */
  label?: ReactNode;
  /** 필수 표시 */
  required?: boolean;
  /** 선택 표시 */
  optional?: boolean;
  /** 에러 메시지 */
  error?: string;
  /** 도움말 텍스트 */
  helper?: string;
  /** 입력 컴포넌트 (Input/Textarea/Select 등) */
  children: ReactNode;
  /** 래퍼 className */
  className?: string;
  /** 라벨-입력 레이아웃 */
  layout?: 'vertical' | 'horizontal';
}

export function FormField({
  label,
  required,
  optional,
  error,
  helper,
  children,
  className,
  layout = 'vertical',
}: FormFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const helperId = `${id}-helper`;

  const hasError = Boolean(error);
  const describedBy =
    [hasError ? errorId : null, helper && !hasError ? helperId : null]
      .filter(Boolean)
      .join(' ') || undefined;

  // children에 id와 aria 자동 주입
  const enhanced = Children.map(children, (child) => {
    if (!isValidElement(child)) return child;
    const element = child as ReactElement<Record<string, unknown>>;
    return cloneElement(element, {
      id: (element.props.id as string | undefined) ?? id,
      'aria-invalid':
        (element.props['aria-invalid'] as boolean | undefined) ?? (hasError || undefined),
      'aria-describedby':
        (element.props['aria-describedby'] as string | undefined) ?? describedBy,
      'aria-required':
        (element.props['aria-required'] as boolean | undefined) ?? required,
    });
  });

  return (
    <div
      className={cn(
        'w-full',
        layout === 'horizontal'
          ? 'flex flex-row items-start gap-[var(--space-4)]'
          : 'flex flex-col gap-[var(--space-1)]',
        className
      )}
    >
      {label && (
        <Label
          htmlFor={id}
          required={required}
          optional={optional}
          className={cn(
            layout === 'horizontal' && 'min-w-[8rem] pt-[var(--space-2)]'
          )}
        >
          {label}
        </Label>
      )}
      <div className={cn('w-full', layout === 'horizontal' && 'flex-1')}>
        {enhanced}
        {error && (
          <p
            id={errorId}
            role="alert"
            aria-live="polite"
            className="mt-1 text-[length:var(--font-size-xs)] text-[var(--color-error)]"
          >
            {error}
          </p>
        )}
        {helper && !error && (
          <p
            id={helperId}
            className="mt-1 text-[length:var(--font-size-xs)] text-[var(--color-on-surface-muted)]"
          >
            {helper}
          </p>
        )}
      </div>
    </div>
  );
}

FormField.displayName = 'FormField';
