// 비즈니스 서비스 매니페스트 타입
// Design Ref: DESIGN-MTU-P18 §2

export interface ServiceManifest {
  /** 서비스 고유 ID */
  id: string;
  /** 서비스 표시명 */
  name: string;
  /** 서비스 설명 */
  description: string;
  /** 서비스 버전 */
  version: string;
  /** 서비스 카테고리 */
  category: string;
  /** 서비스 아이콘 (emoji 또는 URL) */
  icon: string;
  /** API 라우트 정의 */
  routes: ServiceRoute[];
  /** 필요 권한 */
  permissions: ServicePermission[];
  /** 서비스 포트 */
  port: number;
  /** 메뉴 항목 (자동 등록) */
  menuItems?: MenuItemDef[];
}

export interface ServiceRoute {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  description: string;
  auth: boolean;
  roles?: string[];
}

export interface ServicePermission {
  resource: string;
  actions: ('create' | 'read' | 'update' | 'delete')[];
}

export interface MenuItemDef {
  label: string;
  path: string;
  icon?: string;
  order?: number;
}
