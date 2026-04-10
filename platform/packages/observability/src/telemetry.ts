// OpenTelemetry 계측 초기화 -- 공유 패키지
// Design Ref: SVC-OTEL-R3 DESIGN Section 2
// Plan SC: FR-OTEL.1
// CSAP: D-06 침해사고 관리 보완 -- 분산 추적

/**
 * 텔레메트리 설정 인터페이스
 */
export interface TelemetryConfig {
  /** 서비스 식별자 (예: 'user-service') */
  serviceName: string;
  /** 서비스 버전 (예: '0.1.0') */
  serviceVersion: string;
}

const OTEL_ENABLED = process.env['OTEL_ENABLED'] === 'true';

let sdkInstance: { shutdown: () => Promise<void> } | null = null;

/**
 * OpenTelemetry SDK 초기화
 *
 * - 환경 변수 OTEL_ENABLED=true 시에만 활성화
 * - OTel 패키지 미설치 환경에서는 경고만 출력하고 건너뜀 (graceful fallback)
 * - 서비스 시작 전 (Fastify 인스턴스 생성 전) 호출 필수
 *
 * @param config - 서비스명 및 버전 정보
 */
export function initTelemetry(config: TelemetryConfig): void {
  if (!OTEL_ENABLED) {
    return;
  }

  try {
    // 선택적 로딩: OTel 패키지 미설치 시 graceful 처리
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { NodeSDK } = require('@opentelemetry/sdk-node') as {
      NodeSDK: new (cfg: Record<string, unknown>) => {
        start: () => void;
        shutdown: () => Promise<void>;
      };
    };
    const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http') as {
      OTLPTraceExporter: new (cfg: { url: string }) => unknown;
    };
    const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node') as {
      getNodeAutoInstrumentations: (cfg: Record<string, unknown>) => unknown[];
    };
    const { Resource } = require('@opentelemetry/resources') as {
      Resource: new (attrs: Record<string, string>) => unknown;
    };

    const endpoint = process.env['OTEL_EXPORTER_OTLP_ENDPOINT'] ?? 'http://localhost:4318';

    const sdk = new NodeSDK({
      resource: new Resource({
        'service.name': config.serviceName,
        'service.version': config.serviceVersion,
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
    process.stderr.write(
      `[telemetry] OpenTelemetry 패키지가 설치되지 않았습니다 (${config.serviceName}). 분산 추적이 비활성화됩니다.\n`,
    );
  }
}

/**
 * OpenTelemetry SDK 종료 (graceful shutdown 시 호출)
 */
export async function shutdownTelemetry(): Promise<void> {
  if (sdkInstance) {
    await sdkInstance.shutdown();
    sdkInstance = null;
  }
}

/**
 * OTel SDK 활성화 상태 확인 (테스트 용도)
 */
export function isTelemetryActive(): boolean {
  return sdkInstance !== null;
}
