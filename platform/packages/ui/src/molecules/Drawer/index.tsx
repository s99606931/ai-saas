/**
 * DS-MOL-R3 — Drawer 분자 컴포넌트
 * Design Ref: docs/02-design/mtus/DS-MOL-R3.design.md §3
 * Plan SC: FR-DSM.23, FR-DSM.23.1
 *
 * 측면 슬라이드 패널. Modal과 동일한 focus trap + ESC 동작.
 */

import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from 'react';
import { X } from 'lucide-react';
import { cn } from '../../atoms/lib/cn.js';
import { useFocusTrap } from '../../atoms/lib/useFocusTrap.js';

export type DrawerSide = 'left' | 'right';
export type DrawerSize = 'sm' | 'md' | 'lg';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  side?: DrawerSide;
  size?: DrawerSize;
  title?: ReactNode;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  hideCloseButton?: boolean;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  'aria-label'?: string;
}

const sideClass: Record<DrawerSide, string> = {
  left: 'left-0 top-0 h-full',
  right: 'right-0 top-0 h-full',
};

const sizeClass: Record<DrawerSize, string> = {
  sm: 'w-72',
  md: 'w-96',
  lg: 'w-[32rem]',
};

const motionInClass: Record<DrawerSide, string> = {
  left: 'motion-safe:slide-in-from-left',
  right: 'motion-safe:slide-in-from-right',
};

export function Drawer({
  open,
  onClose,
  side = 'right',
  size = 'md',
  title,
  closeOnBackdrop = true,
  closeOnEscape = true,
  hideCloseButton = false,
  children,
  footer,
  className,
  'aria-label': ariaLabel,
}: DrawerProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useFocusTrap(open, dialogRef);

  useEffect(() => {
    if (!open || !closeOnEscape) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, closeOnEscape, onClose]);

  if (!open) return null;

  return (
    <div role="presentation" className="fixed inset-0 z-50">
      <div
        aria-hidden="true"
        onClick={closeOnBackdrop ? onClose : undefined}
        className="absolute inset-0 bg-black/50"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={!title ? ariaLabel : undefined}
        data-side={side}
        tabIndex={-1}
        className={cn(
          'absolute',
          sideClass[side],
          sizeClass[size],
          'max-w-[95vw]',
          'bg-[var(--color-surface)]',
          'border-[var(--color-outline)]',
          side === 'left' ? 'border-r' : 'border-l',
          'shadow-[var(--shadow-lg)]',
          'flex flex-col',
          'motion-safe:animate-in',
          motionInClass[side],
          'motion-safe:duration-[var(--motion-duration-base)]',
          className
        )}
      >
        {(title || !hideCloseButton) && (
          <header
            className={cn(
              'flex items-center justify-between gap-4',
              'p-[var(--space-4)]',
              'border-b border-[var(--color-outline-variant)]'
            )}
          >
            {title && (
              <h2
                id={titleId}
                className={cn(
                  'text-[length:var(--font-size-lg)]',
                  'font-[var(--font-weight-semibold)]',
                  'text-[var(--color-on-surface)]',
                  'min-w-0 truncate'
                )}
              >
                {title}
              </h2>
            )}
            {!hideCloseButton && (
              <button
                type="button"
                onClick={onClose}
                aria-label="닫기"
                className={cn(
                  'shrink-0 inline-flex items-center justify-center',
                  'h-8 w-8 rounded-[var(--radius-md)]',
                  'text-[var(--color-on-surface-muted)]',
                  'hover:bg-[var(--color-surface-alt)]',
                  'hover:text-[var(--color-on-surface)]',
                  'focus-visible:outline-none',
                  'focus-visible:ring-2',
                  'focus-visible:ring-[var(--color-focus-ring)]'
                )}
              >
                <X size={18} />
              </button>
            )}
          </header>
        )}
        <div className="flex-1 overflow-y-auto p-[var(--space-4)]">
          {children}
        </div>
        {footer && (
          <footer
            className={cn(
              'flex items-center justify-end gap-[var(--space-2)]',
              'p-[var(--space-4)]',
              'border-t border-[var(--color-outline-variant)]'
            )}
          >
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}

Drawer.displayName = 'Drawer';
