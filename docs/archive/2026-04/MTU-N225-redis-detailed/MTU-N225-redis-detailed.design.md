# MTU-N225: Redis 캐시 성능 상세 모니터링 -- 설계 문서

## 1. 설계 방향

B안: redis-exporter 메트릭 기반 Recording Rules + 5개 영역 대시보드

## 2. 상세 설계

### 2.1 대시보드 구조

```
Row 1: 개요 (가동시간, OPS, 히트율, 메모리)
Row 2: 커맨드 (커맨드별 OPS, 지연, Slow Log)
Row 3: 메모리 (사용량, 조각화, 키 수, 만료 키)
Row 4: 연결/복제 (클라이언트 수, 차단 클라이언트, 복제 지연)
Row 5: 지속성 (RDB/AOF 상태, 최근 저장 시간, Fork 지연)
```

## 3. Design Anchor

- Plan: FR-N225.1~N225.3
- CSAP: D-12 시스템 보안
