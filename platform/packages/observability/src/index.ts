// 공유 관측성 패키지 -- 공개 API
// Design Ref: SVC-OTEL-R3 DESIGN
// Plan SC: FR-OTEL.1, FR-OTEL.2

export { initTelemetry, shutdownTelemetry, isTelemetryActive } from './telemetry.js';
export type { TelemetryConfig } from './telemetry.js';
export { responseTimePlugin } from './response-time.js';
