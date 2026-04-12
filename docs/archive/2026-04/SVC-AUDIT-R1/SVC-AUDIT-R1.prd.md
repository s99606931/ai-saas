# PRD: audit-service 라운드 1 고도화

> MTU ID: SVC-AUDIT-R1 | 작성일: 2026-04-09

## WHY
감사 로그 서비스는 CSAP D-06의 핵심입니다. 현재 append-only + SHA-256 체인은 구현되었으나,
감사 이벤트 집계(일별/주별)와 검색 최적화가 필요합니다.

## SUCCESS
| ID | 기준 |
|----|------|
| SC-1 | 일별/주별/월별 감사 이벤트 집계 API |
| SC-2 | 행위자별/행위별 Top-N 통계 API |
| SC-3 | 테스트 커버리지 80% 이상 |
