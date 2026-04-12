# MTU-N432: OpenTelemetry 자동 계측 SDK

## WHY
- 코드 수정 없이 분산 추적 구현 — 레거시 시스템 커버 필수
- 기관별 100+ 서비스 수동 계측 현실적 불가

## FR
- FR-N432.1 HTTP/gRPC/DB 클라이언트 자동 래핑
- FR-N432.2 TraceContext 전파 (W3C Trace Context)
- FR-N432.3 Span 속성 자동 태깅 (서비스/버전/환경)
- FR-N432.4 샘플링 정책 동적 조정 (오류율 기반 증폭)
- FR-N432.5 OTLP Exporter 전송 통계

## Success Criteria
- 계측 커버리지 90%+ (주요 라이브러리)
- 오버헤드 <5% p99 지연시간
- Trace 완결성(누락 Span 없음) 99%+
