# MTU-N95: 인시던트 자동 분류 + 에스컬레이션 — Design

> **Phase**: 모니터링 Round 7
> **버전**: 1.0.0 | **작성일**: 2026-04-10 | **작성자**: PM Lead

---

## 1. 인시던트 분류 체계

### 1.1 카테고리

| 카테고리 | 매칭 조건 | 자동 라우팅 |
|---------|----------|-----------|
| 보안 | `Falco*`, `PolicyViolation*`, `Gatekeeper*`, `Kyverno*` | 보안팀 즉시 |
| 가용성 | `ServiceDown*`, `SLO*`, `ErrorBudget*` | SRE팀 |
| 성능 | `HighLatency*`, `AnomalyHigh*` | 개발팀 + SRE |
| 인프라 | `NodeDown*`, `DiskFull*`, `OOM*` | 인프라팀 |
| 배포 | `Flux*`, `Deployment*`, `Rollback*` | DevOps팀 |
| 데이터 | `PostgreSQL*`, `Database*`, `SlowQuery*` | DBA팀 |

### 1.2 우선순위

| 우선순위 | 조건 | SLA |
|---------|------|-----|
| P1 (긴급) | severity=critical + 가용성/보안 | 응답 15분, 해결 4시간 |
| P2 (높음) | severity=critical + 기타 | 응답 30분, 해결 8시간 |
| P3 (보통) | severity=warning | 응답 2시간, 해결 24시간 |
| P4 (낮음) | severity=info | 응답 8시간, 해결 72시간 |

---

## 2. 에스컬레이션 타임라인

```
P1: 알림 발생 → 15분 무응답 → 팀 리더 → 30분 → CTO → 1시간 → 전체 공지
P2: 알림 발생 → 30분 무응답 → 팀 리더 → 2시간 → CTO
P3: 알림 발생 → 2시간 무응답 → 팀 리더
P4: 알림 발생 → 다음 업무일 처리
```

---

## 3. SLO 위반 시 자동 롤백 조건 (FR-N95.3)

```yaml
# 자동 롤백 트리거 조건:
# 1. 에러 예산 소진율 > 200% (30분 burn rate)
# 2. 가용성 SLI < 99% (5분 연속)
# 3. P99 지연 > SLO 목표의 3배 (5분 연속)
#
# 자동 롤백 = Flux Helm Release를 이전 revision으로 되돌림
```

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM Lead |
