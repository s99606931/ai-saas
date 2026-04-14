# SVC-AI-ADV-R498 Plan — api-response-quality-evaluator-v2.ts

## 요구사항
FR-R498.1: API 엔드포인트 등록 (endpointId, path, method)
FR-R498.2: 응답 품질 기록 (endpointId, statusCode, latencyMs, dataGrade?)
FR-R498.3: 품질 점수 조회 (getQualityScore) — (2xx비율*60 + (1-avgLatency/1000)*40), min 0 max 100
FR-R498.4: 저품질 엔드포인트 조회 (getLowQualityEndpoints) — score < 60
FR-R498.5: 감사 로그 조회 (getAuditLog)

## 성공 기준
SC-R498.1: N2SF N-05 C/S 등급 차단
SC-R498.2: CSAP D-06 감사 로그 append-only
