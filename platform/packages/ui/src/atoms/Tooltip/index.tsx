/**
 * DS-ATOM-R3 — Tooltip 컴포넌트
 * Design Ref: docs/02-design/mtus/DS-ATOM-R3.design.md §4
 * Plan SC: FR-DSA.24, FR-DSA.24.1, FR-DSA.24.2
 *
 * 커스텀 포지셔닝 (absolute). Portal 없음 — 부모 래퍼가 자동으로 relative 처리.
 * 포커스/호버 진입 시 delay 후 표시, ESC 및 이탈 시 즉시 닫기.
 * Reduced-motion 존중.
 */

import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import { cn } from '../lib/cn.js';

export type TooltipSide = 'top' | 'right' | 'bottom' | 'left';

export interface TooltipProps {
  /** 표시할 내용 */
  content: ReactNode;
  /** 트리거 요소 (단일 React element) */
  children: ReactElement;
  /** 표시 위치 */
  side?: TooltipSide;
  /** 표시 지연 (ms) */
  delay?: number;
  /** 비활성화 (표시 차단) */
  disabled?: boolean;
  /** 패널 className 추가 */
  className?: string;
  /** aria-describedby 용 명시적 id */
  id?: string;
}

const sidePositionClasses: Record<TooltipSide, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
};

type TriggerProps = {
  onMouseEnter?: (e: MouseEvent) => void;
  onMouseLeave?: (e: MouseEvent) => void;
  onFocus?: (e: FocusEvent) => void;
  onBlur?: (e: FocusEvent) => void;
  onKeyDown?: (e: KeyboardEvent) => void;
  'aria-describedby'?: string;
};

export function Tooltip({
  content,
  children,
  side = 'top',
  delay = 300,
  disabled = false,
  className,
  id: providedId,
}: TooltipProps) {
  const generatedId = useId();
  const tooltipId = providedId ?? generatedId;
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const show = useCallback(() => {
    if (disabled) return;
    clearTimer();
    timerRef.current = setTimeout(() => {
      setOpen(true);
    }, delay);
  }, [disabled, delay, clearTimer]);

  const hide = useCallback(() => {
    clearTimer();
    setOpen(false);
  }, [clearTimer]);

  useEffect(() => clearTimer, [clearTimer]);

  if (!isValidElement(children)) {
    if (typeof console !== 'undefined') {
      console.warn('[Tooltip] children must be a single React element');
    }
    return null;
  }

  const triggerElement = children as ReactElement<TriggerProps>;
  const triggerProps = triggerElement.props;

  const enhancedTrigger = cloneElement(triggerElement, {
    'aria-describedby': open
      ? tooltipId
      : triggerProps['aria-describedby'],
    onMouseEnter: (e: MouseEvent) => {
      triggerProps.onMouseEnter?.(e);
      show();
    },
    onMouseLeave: (e: MouseEvent) => {
      triggerProps.onMouseLeave?.(e);
      hide();
    },
    onFocus: (e: FocusEvent) => {
      triggerProps.onFocus?.(e);
      show();
    },
    onBlur: (e: FocusEvent) => {
      triggerProps.onBlur?.(e);
      hide();
    },
    onKeyDown: (e: KeyboardEvent) => {
      triggerProps.onKeyDown?.(e);
      if (e.key === 'Escape' && open) {
        hide();
      }
    },
  });

  return (
    <span className="relative inline-flex">
      {enhancedTrigger}
      {open && !disabled && (
        <span
          role="tooltip"
          id={tooltipId}
          data-side={side}
          className={cn(
            'absolute z-50 whitespace-nowrap pointer-events-none',
            'rounded-[var(--radius-sm)]',
            'bg-[var(--color-inverse-surface)]',
            'text-[var(--color-inverse-on-surface)]',
            'text-[length:var(--font-size-xs)]',
            'px-2 py-1',
            'shadow-[var(--shadow-md)]',
            'motion-safe:animate-in motion-safe:fade-in',
            'motion-safe:duration-[var(--motion-duration-fast)]',
            sidePositionClasses[side],
            className
          )}
        >
          {content}
        </span>
      )}
    </span>
  );
}

Tooltip.displayName = 'Tooltip';
