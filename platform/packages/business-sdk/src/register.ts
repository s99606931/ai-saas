// 서비스 등록 함수
// Design Ref: DESIGN-MTU-P18 §2 — registerService()

import type { ServiceManifest } from './types.js';

/**
 * 비즈니스 서비스를 플랫폼에 등록합니다.
 *
 * 등록 시:
 * 1. 카탈로그 서비스에 서비스 메타데이터 등록
 * 2. 메뉴 서비스에 메뉴 항목 자동 등록
 * 3. API 게이트웨이에 프록시 라우트 등록
 *
 * @param manifest - 서비스 매니페스트
 */
export async function registerService(manifest: ServiceManifest): Promise<{
  success: boolean;
  serviceId: string;
  registeredAt: string;
}> {
  const gatewayUrl = process.env['API_GATEWAY_URL'] ?? 'http://localhost:3003';

  // 1. 카탈로그 등록
  const catalogResponse = await fetch(`${gatewayUrl}/api/catalog/services`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: manifest.name,
      description: manifest.description,
      category: manifest.category,
      version: manifest.version,
      status: 'published',
    }),
  });

  if (!catalogResponse.ok) {
    throw new Error(`카탈로그 등록 실패: ${catalogResponse.status}`);
  }

  // 2. 메뉴 자동 등록
  if (manifest.menuItems) {
    for (const item of manifest.menuItems) {
      await fetch(`${gatewayUrl}/api/menu/menu`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: item.label,
          path: item.path,
          icon: item.icon ?? manifest.icon,
          order: item.order ?? 0,
          serviceId: manifest.id,
        }),
      });
    }
  }

  return {
    success: true,
    serviceId: manifest.id,
    registeredAt: new Date().toISOString(),
  };
}
