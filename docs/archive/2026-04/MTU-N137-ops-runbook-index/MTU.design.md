# MTU-N137: 운영 런북 인덱스 — Design

> 버전: 1.0 | 작성일: 2026-04-10 | 작성자: PM Lead

## Design Anchor

| 항목 | 내용 |
|------|------|
| Plan 참조 | docs/01-plan/mtus/MTU-N137.plan.md |
| 아키텍처 선택 | Pragmatic Balance — 스크립트 헤더 파싱 + 키워드 매핑 |
| 핵심 결정 | runbook-auto-*.sh 파일 자동 탐색, 알림명-키워드 매핑 |

## 1. 인덱싱 방식

### 1.1 메타데이터 추출

```
스크립트 헤더에서 추출:
  - 파일명 → 런북 ID
  - 주석 첫 줄 → 설명
  - Design Ref → 관련 MTU
  - CSAP → 관련 보안 통제
  - 사용법 → 실행 방법
```

### 1.2 알림-런북 매핑

| 알림 패턴 | 추천 런북 |
|----------|----------|
| *CrashLoop* | runbook-auto-crashloop.sh |
| *DiskPressure*, *DiskUsage* | runbook-auto-disk-cleanup.sh |
| *HighLatency*, *SlowResponse* | runbook-auto-high-latency.sh |
| *OOMKilled*, *MemoryPressure* | runbook-auto-oom.sh |

### 1.3 카테고리 분류

- 컴퓨팅: CPU, OOM, CrashLoop
- 스토리지: Disk, PVC
- 네트워크: Latency, DNS, Timeout
- 보안: Auth, Certificate

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-10 | 초기 설계 | PM Lead |
