// 공유 관측성 패키지 -- 공개 API
// Design Ref: SVC-OTEL-R3 DESIGN, SVC-OBSERVE-R15 Plan
// Plan SC: FR-OTEL.1, FR-OTEL.2, FR-OBS.1~4

export { initTelemetry, shutdownTelemetry, isTelemetryActive } from './telemetry.js';
export type { TelemetryConfig } from './telemetry.js';
export { responseTimePlugin } from './response-time.js';
export {
  StructuredLogger,
  type LogLevel,
  type LogEntry,
  type StructuredLoggerOptions,
} from './structured-logger.js';
export {
  MetricsCollector,
  Counter,
  Gauge,
  Histogram,
  type MetricType,
  type MetricLabels,
} from './metrics-collector.js';
export {
  AlertManager,
  type AlertState,
  type AlertRule,
  type AlertStatus,
  type AlertEvent,
} from './alert-manager.js';
