# MTU-N222: etcd 클러스터 상세 운영 모니터링 -- 설계 문서

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-10 | 초안 작성 | PM Lead |

## 1. 설계 방향

B안: etcd 내부 운영 메트릭 Recording Rules + 5개 영역 대시보드

## 2. 상세 설계

### 2.1 Recording Rules (FR-N222.1)

- 컴팩션: 지속 시간 P99, 실행 빈도, 키 삭제 수
- 스냅샷: 저장 시간, 성공/실패 수, 크기
- 리더: 리더 변경 횟수, 현재 리더, 하트비트 지연
- 디스크: WAL fsync P99, DB 크기, 조각화율
- 클라이언트: gRPC 연결 수, Watch 수, 요청 지연

### 2.2 대시보드 구조 (FR-N222.2)

```
Row 1: 컴팩션 (지속 시간 + 빈도 + 키 삭제)
Row 2: 스냅샷 (저장 시간 + 크기 + 성공/실패)
Row 3: 리더 (리더 정보 + 변경 횟수 + 하트비트)
Row 4: 디스크 (WAL fsync + DB 크기 + 조각화)
Row 5: 클라이언트 (gRPC 연결 + Watch + 요청 분포)
```

### 2.3 알림 규칙 (FR-N222.3)

| 알림 | 조건 | 심각도 |
|------|------|--------|
| EtcdCompactionSlow | 컴팩션 P99 > 500ms | warning |
| EtcdSnapshotFailed | 스냅샷 실패 > 0 | critical |
| EtcdLeaderChanged | 1시간 리더 변경 > 3회 | warning |
| EtcdDBSizeLarge | DB 크기 > 4GB | warning |
| EtcdDBSizeCritical | DB 크기 > 7GB | critical |
| EtcdWALFsyncSlow | WAL fsync P99 > 100ms | warning |
| EtcdFragmentationHigh | 조각화율 > 50% | warning |

## 3. Design Anchor

- Plan: FR-N222.1~N222.3
- CSAP: D-06 감사, D-12 시스템 운영
