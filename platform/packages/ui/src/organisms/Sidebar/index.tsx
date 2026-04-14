/**
 * DS-ORG-R1 — Sidebar (좌측 네비게이션)
 * Design Ref: docs/02-design/mtus/DS-ORG-R1.design.md §API Sidebar
 * Plan SC: FR-DSO.13, FR-DSO.13.1
 */

import {
  forwardRef,
  useState,
  type ReactNode,
  type KeyboardEvent,
} from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '../../atoms/lib/cn.js';

export interface SidebarMenuItem {
  id: string;
  label: string;
  path?: string;
  icon?: ReactNode;
  children?: SidebarMenuItem[];
}

export interface SidebarProps {
  menuItems: SidebarMenuItem[];
  currentPath: string;
  logo?: ReactNode;
  footer?: ReactNode;
  onNavigate?: (path: string) => void;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  className?: string;
  'aria-label'?: string;
}

function isActive(path: string | undefined, currentPath: string): boolean {
  if (!path) return false;
  return path === currentPath || currentPath.startsWith(`${path}/`);
}

interface MenuItemRowProps {
  item: SidebarMenuItem;
  currentPath: string;
  level: number;
  onNavigate?: (path: string) => void;
}

function MenuItemRow({
  item,
  currentPath,
  level,
  onNavigate,
}: MenuItemRowProps) {
  const hasChildren = !!item.children && item.children.length > 0;
  const active = isActive(item.path, currentPath);
  const [expanded, setExpanded] = useState<boolean>(
    hasChildren &&
      (item.children?.some((c) => isActive(c.path, currentPath)) ?? false)
  );

  const handleClick = () => {
    if (hasChildren) {
      setExpanded((v) => !v);
    } else if (item.path) {
      onNavigate?.(item.path);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <li>
      <button
        type="button"
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        aria-current={active ? 'page' : undefined}
        aria-expanded={hasChildren ? expanded : undefined}
        className={cn(
          'w-full flex items-center gap-2 text-left rounded-md transition-colors',
          'px-3 py-2 text-[length:var(--font-size-sm)]',
          active
            ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)]'
            : 'text-[var(--color-on-surface)] hover:bg-[var(--color-surface-hover)]'
        )}
        style={{ paddingLeft: `${12 + level * 16}px` }}
      >
        {item.icon && (
          <span className="flex-shrink-0" aria-hidden="true">
            {item.icon}
          </span>
        )}
        <span className="flex-1 truncate">{item.label}</span>
        {hasChildren &&
          (expanded ? (
            <ChevronDown size={16} aria-hidden="true" />
          ) : (
            <ChevronRight size={16} aria-hidden="true" />
          ))}
      </button>
      {hasChildren && expanded && (
        <ul className="mt-1 space-y-1">
          {item.children!.map((child) => (
            <MenuItemRow
              key={child.id}
              item={child}
              currentPath={currentPath}
              level={level + 1}
              onNavigate={onNavigate}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export const Sidebar = forwardRef<HTMLElement, SidebarProps>(
  (
    {
      menuItems,
      currentPath,
      logo,
      footer,
      onNavigate,
      collapsed,
      className,
      'aria-label': ariaLabel = '주 메뉴',
    },
    ref
  ) => {
    return (
      <nav
        ref={ref}
        role="navigation"
        aria-label={ariaLabel}
        data-collapsed={collapsed || undefined}
        className={cn(
          'h-full flex flex-col bg-[var(--color-surface)]',
          className
        )}
      >
        {logo && (
          <div className="p-4 border-b border-[var(--color-border)]">
            {logo}
          </div>
        )}
        <ul className="flex-1 p-2 space-y-1 overflow-y-auto">
          {menuItems.map((item) => (
            <MenuItemRow
              key={item.id}
              item={item}
              currentPath={currentPath}
              level={0}
              onNavigate={onNavigate}
            />
          ))}
        </ul>
        {footer && (
          <div className="p-4 border-t border-[var(--color-border)]">
            {footer}
          </div>
        )}
      </nav>
    );
  }
);

Sidebar.displayName = 'Sidebar';
