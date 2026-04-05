// Organism 컴포넌트 타입
// Design Ref: D-P00.5
// MTU-U1 디자인 시스템: 동적 사이드바, 테넌트 커스터마이제이션

import type { ReactNode } from 'react';
import type { MenuItem } from '@public-saas/types';

export interface SidebarProps {
  menuItems: MenuItem[];
  currentPath: string;
  variant?: 'default' | 'compact' | 'floating';
  logo?: ReactNode;
  footer?: ReactNode;
  onNavigate?: (path: string) => void;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

export interface HeaderProps {
  title: string;
  breadcrumbs?: Array<{ label: string; path?: string }>;
  actions?: ReactNode;
  user?: {
    name: string;
    email: string;
    avatarUrl?: string;
  };
  notifications?: number;
  onLogout?: () => void;
}
