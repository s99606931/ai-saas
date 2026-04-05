// 메뉴 타입
// Design Ref: D-P00.2

import type { UserRole } from './user.js';

/**
 * 메뉴 아이템
 */
export interface MenuItem {
  id: string;
  tenantId: string | null;
  parentId: string | null;
  label: string;
  path: string;
  icon: string | null;
  order: number;
  isVisible: boolean;
  roles: UserRole[] | null;
  children?: MenuItem[];
}
