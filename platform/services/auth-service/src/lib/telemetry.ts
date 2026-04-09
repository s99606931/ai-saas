// OpenTelemetry 계측 초기화 (선택적 로딩)
// Design Ref: SVC-AUTH-R1 DESIGN §6
// Plan SC: FR-AUTH.6
// CSAP: D-06 침해사고 관리 보완 — 분산 추적

const OTEL_ENABLED = process.env['OTEL_ENABLED'] === 'true';

let sdkInstance: { shutdown: () => Promise<void> } | null = null;

/**
 * OpenTelemetry SDK 초기화
 *
 * 환경 변수 OTEL_ENABLED=true 시에만 활성화됩니다.
 * 의존성이 설치되지 않은 환경에서는 경고만 출력하고 건너뜁니다.
 *
 * 서비스 시작 전 (Fastify 인스턴스 생성 전) 호출해야 합니다.
 */
export function initTelemetry(): void {
  if (!OTEL_ENABLED) {
    return;
  }

  // 선택적 로딩: OTel 패키지 미설치 시 graceful 처리
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { NodeSDK } = require('@opentelemetry/sdk-node') as {
      NodeSDK: new (config: Record<string, unknown>) => { start: () => void; shutdown: () => Promise<void> };
    };
    const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http') as {
      OTLPTraceExporter: new (config: { url: string }) => unknown;
    };
    const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node') as {
      getNodeAutoInstrumentations: (config: Record<string, unknown>) => unknown[];
    };
    const { Resource } = require('@opentelemetry/resources') as {
      Resource: new (attrs: Record<string, string>) => unknown;
    };

    const endpoint = process.env['OTEL_EXPORTER_OTLP_ENDPOINT'] ?? 'http://localhost:4318';

    const sdk = new NodeSDK({
      resource: new Resource({
        'service.name': 'auth-service',
        'service.version': '0.2.0',
      }),
      traceExporter: new OTLPTraceExporter({
        url: `${endpoint}/v1/traces`,
      }),
      instrumentations: getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-dns': { enabled: false },
      }),
    });

    sdk.start();
    sdkInstance = sdk;
  } catch {
    // OTel 패키지 미설치 시 경고만 출력
    process.stderr.write(
      '[telemetry] OpenTelemetry 패키지가 설치되지 않았습니다. 분산 추적이 비활성화됩니다.\n',
    );
  }
}

/**
 * OpenTelemetry SDK 종료 (graceful shutdown 시 호출)
 */
export async function shutdownTelemetry(): Promise<void> {
  if (sdkInstance) {
    await sdkInstance.shutdown();
  }
}
