/**
 * DS-MOL-R3 — Modal 분자 컴포넌트
 * Design Ref: docs/02-design/mtus/DS-MOL-R3.design.md §1
 * Plan SC: FR-DSM.21, FR-DSM.21.1, FR-DSM.21.2
 *
 * 백드롭 + dialog + focus trap + ESC.
 */

import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type RefObject,
} from 'react';
import { X } from 'lucide-react';
import { cn } from '../../atoms/lib/cn.js';
import { useFocusTrap } from '../../atoms/lib/useFocusTrap.js';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  size?: ModalSize;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  hideCloseButton?: boolean;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  initialFocusRef?: RefObject<HTMLElement | null>;
  'aria-label'?: string;
}

const sizeClass: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-[95vw]',
};

export function Modal({
  open,
  onClose,
  title,
  description,
  size = 'md',
  closeOnBackdrop = true,
  closeOnEscape = true,
  hideCloseButton = false,
  children,
  footer,
  className,
  initialFocusRef,
  'aria-label': ariaLabel,
}: ModalProps) {
  const titleId = useId();
  const descId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useFocusTrap(open, dialogRef, initialFocusRef);

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
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
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
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn(
          'relative w-full',
          sizeClass[size],
          'bg-[var(--color-surface)]',
          'border border-[var(--color-outline)]',
          'rounded-[var(--radius-lg)]',
          'shadow-[var(--shadow-lg)]',
          'flex flex-col max-h-[90vh]',
          'motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95',
          'motion-safe:duration-[var(--motion-duration-base)]',
          className
        )}
      >
        {(title || !hideCloseButton) && (
          <header
            className={cn(
              'flex items-start justify-between gap-4',
              'p-[var(--space-4)]',
              'border-b border-[var(--color-outline-variant)]'
            )}
          >
            <div className="flex-1 min-w-0">
              {title && (
                <h2
                  id={titleId}
                  className={cn(
                    'text-[length:var(--font-size-lg)]',
                    'font-[var(--font-weight-semibold)]',
                    'text-[var(--color-on-surface)]'
                  )}
                >
                  {title}
                </h2>
              )}
              {description && (
                <p
                  id={descId}
                  className={cn(
                    'mt-1 text-[length:var(--font-size-sm)]',
                    'text-[var(--color-on-surface-muted)]'
                  )}
                >
                  {description}
                </p>
              )}
            </div>
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

Modal.displayName = 'Modal';
