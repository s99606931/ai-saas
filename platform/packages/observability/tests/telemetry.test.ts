// OpenTelemetry 공유 패키지 단위 테스트
// Design Ref: SVC-OTEL-R3 DESIGN
// Plan SC: FR-OTEL.4
// CSAP: D-06 분산 추적 검증

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('@public-saas/observability -- telemetry', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('OTEL_ENABLED=false 시 initTelemetry는 SDK를 초기화하지 않는다', async () => {
    vi.stubEnv('OTEL_ENABLED', 'false');
    const { initTelemetry, isTelemetryActive } = await import('../src/telemetry.js');
    initTelemetry({ serviceName: 'test-service', serviceVersion: '0.1.0' });
    expect(isTelemetryActive()).toBe(false);
  });

  it('OTEL_ENABLED 미설정 시 initTelemetry는 SDK를 초기화하지 않는다', async () => {
    vi.stubEnv('OTEL_ENABLED', '');
    const { initTelemetry, isTelemetryActive } = await import('../src/telemetry.js');
    initTelemetry({ serviceName: 'test-service', serviceVersion: '0.1.0' });
    expect(isTelemetryActive()).toBe(false);
  });

  it('OTEL_ENABLED=true + OTel 패키지 미설치 시 graceful 처리한다', async () => {
    vi.stubEnv('OTEL_ENABLED', 'true');
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { initTelemetry, isTelemetryActive } = await import('../src/telemetry.js');
    // OTel 패키지가 실제로 설치되지 않았으므로 require 실패 -> graceful fallback
    initTelemetry({ serviceName: 'test-service', serviceVersion: '0.1.0' });

    // SDK 미활성화 상태
    expect(isTelemetryActive()).toBe(false);
    // stderr에 경고 출력
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('OpenTelemetry 패키지가 설치되지 않았습니다'));

    stderrSpy.mockRestore();
  });

  it('shutdownTelemetry는 SDK 미초기화 시 안전하게 반환한다', async () => {
    vi.stubEnv('OTEL_ENABLED', 'false');
    const { shutdownTelemetry } = await import('../src/telemetry.js');
    // 에러 없이 완료되어야 함
    await expect(shutdownTelemetry()).resolves.toBeUndefined();
  });

  it('TelemetryConfig 인터페이스는 serviceName, serviceVersion을 요구한다', async () => {
    vi.stubEnv('OTEL_ENABLED', 'false');
    const { initTelemetry } = await import('../src/telemetry.js');
    // TypeScript 타입 검사: 필수 필드 존재 확인
    const config = { serviceName: 'my-service', serviceVersion: '1.0.0' };
    expect(() => initTelemetry(config)).not.toThrow();
  });
});

describe('@public-saas/observability -- index exports', () => {
  it('index.ts에서 모든 공개 API가 내보내진다', async () => {
    const exports = await import('../src/index.js');
    expect(typeof exports.initTelemetry).toBe('function');
    expect(typeof exports.shutdownTelemetry).toBe('function');
    expect(typeof exports.isTelemetryActive).toBe('function');
    expect(typeof exports.responseTimePlugin).toBe('function');
  });
});
