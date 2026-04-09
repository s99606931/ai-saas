# Plan: SVC-COMP-R1 -- 준수 현황 서비스 고도화

> 작성일: 2026-04-10 | 버전: 1.0

## 기능 요구사항

### FR-COMP.1: Rate Limiting
### FR-COMP.2: 미준수 항목 상세
- `GET /compliance/csap/gaps` -- implementedItems < items인 분야와 미준수 사유 반환
### FR-COMP.3: 준수율 스냅샷 이력
- `GET /compliance/history` -- 점검 시마다 스냅샷 저장, 이력 조회
### FR-COMP.4: 감리 준비도 상세
- readinessHandler 응답에 gaps 배열 추가 (미준수 항목 + 조치 권고)
