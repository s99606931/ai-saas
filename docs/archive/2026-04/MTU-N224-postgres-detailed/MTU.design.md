# MTU-N224: PostgreSQL 데이터베이스 상세 모니터링 -- 설계 문서

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-10 | 초안 작성 | PM Lead |

## 1. 설계 방향

B안: postgres-exporter 메트릭 기반 Recording Rules + 6개 영역 대시보드

## 2. 상세 설계

### 2.1 대시보드 구조

```
Row 1: DB 개요 (가동시간 + 연결 수 + TPS + 캐시히트)
Row 2: 쿼리 성능 (활성 쿼리 + 느린 쿼리 + 쿼리별 시간)
Row 3: 연결 관리 (총 연결/최대 + 상태별 + idle in transaction)
Row 4: 락/대기 (락 대기 수 + 데드락 + 락 유형별)
Row 5: 복제 (복제 지연 + WAL 크기 + 복제 슬롯)
Row 6: 테이블/인덱스 (테이블 크기 Top10 + 인덱스 사용률 + Bloat)
```

### 2.2 알림 규칙

| 알림 | 조건 | 심각도 |
|------|------|--------|
| PostgresConnectionsNearMax | 연결 > 80% max | warning |
| PostgresConnectionsCritical | 연결 > 95% max | critical |
| PostgresDeadlockDetected | 데드락 > 0 | warning |
| PostgresLongRunningQuery | 쿼리 > 5분 | warning |
| PostgresReplicationLagHigh | 복제 지연 > 100MB | warning |
| PostgresCacheHitRateLow | 캐시 히트 < 95% | warning |
| PostgresSlowQueryRate | 느린 쿼리/s > 1 | warning |

## 3. Design Anchor

- Plan: FR-N224.1~N224.3
- CSAP: D-06 감사, D-09 암호화, D-12 시스템 보안
