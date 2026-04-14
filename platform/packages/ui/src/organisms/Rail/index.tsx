/**
 * DS-ORG-R1 — Rail (축소형 아이콘 사이드바)
 * Design Ref: docs/02-design/mtus/DS-ORG-R1.design.md §API Rail
 * Plan SC: FR-DSO.14
 */

import { forwardRef, type ReactNode } from 'react';
import { cn } from '../../atoms/lib/cn.js';

export interface RailMenuItem {
  id: string;
  label: string;
  path?: string;
  icon: ReactNode;
}

export interface RailProps {
  menuItems: RailMenuItem[];
  currentPath: string;
  onNavigate?: (path: string) => void;
  className?: string;
  'aria-label'?: string;
}

function isActive(path: string | undefined, currentPath: string): boolean {
  if (!path) return false;
  return path === currentPath || currentPath.startsWith(`${path}/`);
}

export const Rail = forwardRef<HTMLElement, RailProps>(
  (
    {
      menuItems,
      currentPath,
      onNavigate,
      className,
      'aria-label': ariaLabel = '주 메뉴 (축소)',
    },
    ref
  ) => {
    return (
      <nav
        ref={ref}
        role="navigation"
        aria-label={ariaLabel}
        className={cn(
          'h-full w-16 flex flex-col items-center py-2 bg-[var(--color-surface)]',
          className
        )}
      >
        <ul className="flex-1 flex flex-col gap-1 w-full px-1">
          {menuItems.map((item) => {
            const active = isActive(item.path, currentPath);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  aria-label={item.label}
                  title={item.label}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => item.path && onNavigate?.(item.path)}
                  className={cn(
                    'w-full h-12 flex items-center justify-center rounded-md transition-colors',
                    active
                      ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)]'
                      : 'text-[var(--color-on-surface)] hover:bg-[var(--color-surface-hover)]'
                  )}
                >
                  <span aria-hidden="true">{item.icon}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }
);

Rail.displayName = 'Rail';
