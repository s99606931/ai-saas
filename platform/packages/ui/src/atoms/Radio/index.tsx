/**
 * DS-ATOM-R3 — Radio / RadioGroup 컴포넌트
 * Design Ref: docs/02-design/mtus/DS-ATOM-R3.design.md §2
 * Plan SC: FR-DSA.22, FR-DSA.22.1, FR-DSA.22.2
 *
 * 네이티브 <input type="radio"> + Context 기반 그룹.
 * 화살표 키 이동은 브라우저 네이티브 동작에 위임.
 */

import {
  createContext,
  forwardRef,
  useContext,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import { cn } from '../lib/cn.js';

// ─────────── Context ───────────

interface RadioGroupContextValue {
  name: string;
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  error?: boolean;
}

const RadioGroupContext = createContext<RadioGroupContextValue | null>(null);

// ─────────── RadioGroup ───────────

export interface RadioGroupProps {
  /** 폼 필드명 (필수 — 라디오 그룹 연결) */
  name: string;
  /** 제어 선택값 */
  value?: string;
  /** 비제어 기본값 */
  defaultValue?: string;
  /** 변경 핸들러 */
  onChange?: (value: string) => void;
  /** 방향 */
  orientation?: 'horizontal' | 'vertical';
  /** 그룹 전체 비활성화 */
  disabled?: boolean;
  /** 그룹 전체 에러 */
  error?: boolean;
  /** 필수 여부 */
  required?: boolean;
  /** 라디오 목록 */
  children: ReactNode;
  /** 래퍼 className */
  className?: string;
  /** 접근성: 라벨 텍스트 */
  'aria-label'?: string;
  /** 접근성: 라벨 요소 id */
  'aria-labelledby'?: string;
}

export function RadioGroup({
  name,
  value,
  defaultValue,
  onChange,
  orientation = 'vertical',
  disabled,
  error,
  required,
  children,
  className,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
}: RadioGroupProps) {
  // 비제어 모드: 내부 상태 없이 native에 위임 (defaultValue는 Radio의 defaultChecked로 전달 필요 없음 — native가 관리)
  const contextValue: RadioGroupContextValue = {
    name,
    value,
    onChange,
    disabled,
    error,
  };

  return (
    <RadioGroupContext.Provider value={contextValue}>
      <div
        role="radiogroup"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-required={required || undefined}
        aria-invalid={error || undefined}
        aria-disabled={disabled || undefined}
        data-orientation={orientation}
        data-default-value={defaultValue}
        className={cn(
          'flex',
          orientation === 'vertical' ? 'flex-col gap-2' : 'flex-row gap-4',
          className
        )}
      >
        {children}
      </div>
    </RadioGroupContext.Provider>
  );
}

RadioGroup.displayName = 'RadioGroup';

// ─────────── Radio ───────────

export interface RadioProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  /** 라벨 (inline) */
  label?: ReactNode;
  /** 에러 표시 */
  error?: boolean;
  /** 선택값 — 그룹 내에서 필수 */
  value: string;
}

export const Radio = forwardRef<HTMLInputElement, RadioProps>(
  (
    {
      className,
      label,
      error: propError,
      value,
      name: propName,
      checked: propChecked,
      onChange: propOnChange,
      disabled: propDisabled,
      id,
      ...props
    },
    ref
  ) => {
    const group = useContext(RadioGroupContext);

    // Context가 있으면 그룹 값이 우선. 없으면 props 사용.
    const name = group?.name ?? propName;
    const disabled = group?.disabled ?? propDisabled;
    const error = group?.error ?? propError;

    const isControlledByGroup = group !== null && group.value !== undefined;
    const checked = isControlledByGroup ? group.value === value : propChecked;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.checked && group?.onChange) {
        group.onChange(value);
      }
      propOnChange?.(e);
    };

    const content = (
      <span
        className={cn(
          'inline-flex items-center gap-2',
          disabled && 'cursor-not-allowed opacity-60',
          !disabled && 'cursor-pointer'
        )}
      >
        <input
          ref={ref}
          id={id}
          type="radio"
          name={name}
          value={value}
          checked={checked}
          onChange={handleChange}
          disabled={disabled}
          aria-invalid={error || undefined}
          className={cn(
            'h-4 w-4 shrink-0',
            'rounded-full',
            'border-[1.5px] border-[var(--color-outline-strong)]',
            'text-[var(--color-primary)]',
            'transition-colors duration-[var(--motion-duration-fast)]',
            'focus-visible:outline-none',
            'focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]',
            'focus-visible:ring-offset-2',
            'checked:border-[var(--color-primary)]',
            'disabled:cursor-not-allowed',
            'aria-[invalid=true]:border-[var(--color-error)]',
            className
          )}
          {...props}
        />
        {label && (
          <span className="text-[length:var(--font-size-sm)] text-[var(--color-on-surface)]">
            {label}
          </span>
        )}
      </span>
    );

    return label ? <label>{content}</label> : content;
  }
);

Radio.displayName = 'Radio';
