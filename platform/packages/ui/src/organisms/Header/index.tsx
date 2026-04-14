/**
 * DS-ORG-R1 — Header (상단 바)
 * Design Ref: docs/02-design/mtus/DS-ORG-R1.design.md §API Header
 * Plan SC: FR-DSO.12, FR-DSO.12.1
 */

import {
  forwardRef,
  useState,
  useRef,
  useEffect,
  type ReactNode,
} from 'react';
import { Menu, LogOut, Bell } from 'lucide-react';
import { cn } from '../../atoms/lib/cn.js';
import { Avatar } from '../../atoms/Avatar/index.js';
import { Badge } from '../../atoms/index.js';

export interface HeaderBreadcrumb {
  label: string;
  path?: string;
}

export interface HeaderUser {
  name: string;
  email: string;
  avatarUrl?: string;
}

export interface HeaderProps {
  title: string;
  breadcrumbs?: HeaderBreadcrumb[];
  actions?: ReactNode;
  user?: HeaderUser;
  /** 미읽음 알림 개수. 0이면 배지 숨김 */
  notifications?: number;
  onLogout?: () => void;
  /** 모바일 햄버거 버튼. 제공 시 버튼 표시 */
  onMenuToggle?: () => void;
  className?: string;
}

export const Header = forwardRef<HTMLElement, HeaderProps>(
  (
    {
      title,
      breadcrumbs,
      actions,
      user,
      notifications = 0,
      onLogout,
      onMenuToggle,
      className,
    },
    ref
  ) => {
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (!userMenuOpen) return;
      const handleClickOutside = (e: MouseEvent) => {
        if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
          setUserMenuOpen(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () =>
        document.removeEventListener('mousedown', handleClickOutside);
    }, [userMenuOpen]);

    return (
      <header
        ref={ref}
        role="banner"
        className={cn(
          'h-[60px] px-4 flex items-center gap-4 bg-[var(--color-surface)]',
          className
        )}
      >
        {onMenuToggle && (
          <button
            type="button"
            aria-label="메뉴 열기"
            onClick={onMenuToggle}
            className="md:hidden p-2 rounded-md hover:bg-[var(--color-surface-hover)]"
          >
            <Menu size={20} />
          </button>
        )}

        <div className="flex-1 min-w-0">
          <h1 className="text-[length:var(--font-size-lg)] font-semibold truncate">
            {title}
          </h1>
          {breadcrumbs && breadcrumbs.length > 0 && (
            <nav aria-label="경로" className="text-[length:var(--font-size-xs)] text-[var(--color-on-surface-muted)]">
              <ol className="flex items-center gap-1">
                {breadcrumbs.map((crumb, i) => (
                  <li key={`${crumb.label}-${i}`} className="flex items-center gap-1">
                    {i > 0 && <span aria-hidden="true">/</span>}
                    {crumb.path ? (
                      <a
                        href={crumb.path}
                        className="hover:underline"
                      >
                        {crumb.label}
                      </a>
                    ) : (
                      <span>{crumb.label}</span>
                    )}
                  </li>
                ))}
              </ol>
            </nav>
          )}
        </div>

        {actions && <div className="flex items-center gap-2">{actions}</div>}

        {notifications > 0 && (
          <button
            type="button"
            aria-label={`알림 ${notifications}개`}
            className="relative p-2 rounded-md hover:bg-[var(--color-surface-hover)]"
          >
            <Bell size={20} />
            <span className="absolute -top-1 -right-1">
              <Badge variant="error">
                {notifications > 99 ? '99+' : notifications}
              </Badge>
            </span>
          </button>
        )}

        {user && (
          <div ref={menuRef} className="relative">
            <button
              type="button"
              aria-label={`사용자 메뉴: ${user.name}`}
              aria-haspopup="menu"
              aria-expanded={userMenuOpen}
              onClick={() => setUserMenuOpen((v) => !v)}
              className="flex items-center gap-2 p-1 rounded-md hover:bg-[var(--color-surface-hover)]"
            >
              <Avatar
                src={user.avatarUrl}
                name={user.name}
                size="sm"
                alt={user.name}
              />
              <span className="hidden md:inline text-[length:var(--font-size-sm)]">
                {user.name}
              </span>
            </button>
            {userMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full mt-1 min-w-[200px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md shadow-lg z-10"
              >
                <div className="px-3 py-2 border-b border-[var(--color-border)]">
                  <p className="text-[length:var(--font-size-sm)] font-medium">
                    {user.name}
                  </p>
                  <p className="text-[length:var(--font-size-xs)] text-[var(--color-on-surface-muted)]">
                    {user.email}
                  </p>
                </div>
                {onLogout && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setUserMenuOpen(false);
                      onLogout();
                    }}
                    className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-[var(--color-surface-hover)] text-[length:var(--font-size-sm)]"
                  >
                    <LogOut size={16} />
                    로그아웃
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </header>
    );
  }
);

Header.displayName = 'Header';
