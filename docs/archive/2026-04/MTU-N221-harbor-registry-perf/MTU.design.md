# MTU-N221: Harbor 레지스트리 성능 모니터링 -- 설계 문서

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-10 | 초안 작성 | PM Lead |

## 1. 설계 방향

B안 (Pragmatic Balance): Harbor 메트릭 엔드포인트 기반 Recording Rules + 5개 영역 대시보드

## 2. 상세 설계

### 2.1 Recording Rules (FR-N221.1)

핵심 메트릭:
- `harbor:api:request_rate` — API 요청 속도
- `harbor:api:latency_p99` — API P99 지연
- `harbor:api:error_rate` — API 에러율
- `harbor:storage:usage_ratio` — 스토리지 사용률
- `harbor:push:latency_p99` — 이미지 Push P99 지연
- `harbor:pull:latency_p99` — 이미지 Pull P99 지연
- `harbor:replication:success_rate` — 복제 성공률
- `harbor:gc:duration` — GC 실행 시간
- `harbor:overall:health_score` — 종합 건강도

### 2.2 대시보드 구조 (FR-N221.2)

```
Row 1: API 상태 (요청율 + 에러율 + P99 지연 + 가용성)
Row 2: 이미지 작업 (Push/Pull 지연 + 처리량 + 에러)
Row 3: 스토리지 (사용량 + 프로젝트별 분포 + 증가 추세)
Row 4: 복제 (성공률 + 지연 + 대기열 + 정책별 상태)
Row 5: GC/유지보수 (GC 실행 시간 + 삭제된 Blob + 스캔 상태)
```

### 2.3 알림 규칙 (FR-N221.3)

| 알림 | 조건 | 심각도 |
|------|------|--------|
| HarborAPILatencyHigh | P99 > 5초 | warning |
| HarborAPIDown | 가용성 < 99% (5분) | critical |
| HarborStorageNearFull | 사용률 > 80% | warning |
| HarborStorageCritical | 사용률 > 95% | critical |
| HarborReplicationFailed | 성공률 < 90% | warning |
| HarborGCDurationHigh | GC > 30분 | warning |
| HarborPushLatencyHigh | Push P99 > 30초 | warning |

## 3. Design Anchor

- Plan: FR-N221.1~N221.3
- CSAP: D-12 시스템 개발 보안
- N2SF: O등급 운영 메트릭
