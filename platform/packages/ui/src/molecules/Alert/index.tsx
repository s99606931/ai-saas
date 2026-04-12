/**
 * DS-MOL-R1 — Alert 분자 컴포넌트
 * Design Ref: docs/02-design/mtus/DS-MOL-R1.design.md §결정 2
 * Plan SC: FR-DSM.3, FR-DSM.4
 */

import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Info,
  AlertTriangle,
  X,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '../../atoms/lib/cn.js';
import { type VariantProps } from '../../atoms/lib/cva.js';
import { alertVariants, type AlertVariant } from './Alert.variants.js';

const DEFAULT_ICONS: Record<AlertVariant, LucideIcon> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: AlertCircle,
};

const ROLE_MAP: Record<AlertVariant, 'alert' | 'status'> = {
  info: 'status',
  success: 'status',
  warning: 'alert',
  error: 'alert',
};

export interface AlertProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  /** 제목 */
  title?: ReactNode;
  /** 커스텀 아이콘 (variant 기본 아이콘 대체) */
  icon?: ReactNode | false;
  /** 닫기 가능 여부 */
  dismissible?: boolean;
  /** 닫기 콜백 */
  onDismiss?: () => void;
}

export const Alert = forwardRef<HTMLDivElement, AlertProps>(
  (
    { className, variant = 'info', title, icon, dismissible, onDismiss, children, ...props },
    ref
  ) => {
    const resolvedVariant = (variant ?? 'info') as AlertVariant;
    const Icon = DEFAULT_ICONS[resolvedVariant];
    const role = ROLE_MAP[resolvedVariant];

    return (
      <div
        ref={ref}
        role={role}
        aria-live={role === 'alert' ? 'assertive' : 'polite'}
        className={cn(alertVariants({ variant }), className)}
        {...props}
      >
        {icon !== false && (
          <span aria-hidden="true" className="shrink-0 mt-0.5">
            {icon ?? <Icon size={20} />}
          </span>
        )}
        <div className="flex-1 min-w-0">
          {title && (
            <div className="font-[var(--font-weight-semibold)] mb-1">{title}</div>
          )}
          {children && <div>{children}</div>}
        </div>
        {dismissible && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="닫기"
            className={cn(
              'shrink-0 inline-flex items-center justify-center',
              'h-6 w-6 rounded-[var(--radius-sm)]',
              'hover:bg-black/5 dark:hover:bg-white/10',
              'focus-visible:outline-none',
              'focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]',
              'transition-colors duration-[var(--motion-duration-fast)]'
            )}
          >
            <X size={16} />
          </button>
        )}
      </div>
    );
  }
);

Alert.displayName = 'Alert';
