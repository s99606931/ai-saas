# SVC-AI-ADV-R232 Design: AI기반 자동 API 모니터링

## 구현 파일
`platform/services/ai-service/src/lib/api-monitoring-ai.ts`

## 핵심 설계
- `ApiEndpointConfig`: endpointId, slaResponseMs, errorRateThreshold
- `ApiCallRecord`: responseMs, statusCode, success
- `analyze()`: SLA/에러율/무트래픽 알림 생성
- 감사 로그: `endpoint.register`, `endpoint.analyze`

## CSAP 준수
- D-06: 모든 분석 이벤트 감사 로그
- D-12: 입력 검증 (미등록 엔드포인트 예외)
