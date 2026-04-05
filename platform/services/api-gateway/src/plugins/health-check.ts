// API 게이트웨이 — 다운스트림 서비스 능동 헬스체크
// Design Ref: DESIGN-MTU-P04
// Plan SC: FR-P04.9 (보완)
// 목적: /ready 및 /health/services 엔드포인트에서 실제 서비스 상태 확인

const HEALTH_TIMEOUT_MS = 2000;

interface ServiceEntry {
  url: string;
  requireAuth: boolean;
}

interface ServiceHealthResult {
  name: string;
  url: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
  latencyMs?: number;
  error?: string;
}

/**
 * 등록된 모든 서비스의 /health 엔드포인트를 병렬로 확인
 * 타임아웃: 2초 (응답 없으면 unhealthy)
 */
export async function checkServicesHealth(
  registry: Record<string, ServiceEntry>,
): Promise<ServiceHealthResult[]> {
  const checks = Object.entries(registry).map(async ([name, entry]): Promise<ServiceHealthResult> => {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);

      const response = await fetch(`${entry.url}/health`, {
        signal: controller.signal,
        headers: { 'accept': 'application/json' },
      });
      clearTimeout(timeoutId);

      return {
        name,
        url: entry.url,
        status: response.ok ? 'healthy' : 'unhealthy',
        latencyMs: Date.now() - start,
      };
    } catch (error) {
      const err = error as Error;
      return {
        name,
        url: entry.url,
        status: 'unhealthy',
        latencyMs: Date.now() - start,
        error: err.name === 'AbortError' ? 'timeout' : 'connection_refused',
      };
    }
  });

  return Promise.all(checks);
}
