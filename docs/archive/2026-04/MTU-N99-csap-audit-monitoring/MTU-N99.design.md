# MTU-N99: CSAP D-06 감사 로그 모니터링 통합 — Design

> **버전**: 1.0.0 | **작성일**: 2026-04-10 | **작성자**: PM Lead

---

## 1. CSAP D-06 감사 로그 요건

| 요건 | 내용 | 검증 방법 |
|------|------|----------|
| D-06-1 | 모든 민감 작업 전수 기록 | 감사 이벤트 수 > 0 |
| D-06-2 | 로그 보존 최소 1년 | VictoriaMetrics 365일 보존 확인 |
| D-06-3 | 로그 무결성 (수정/삭제 불가) | append-only 구조 확인 |
| D-06-4 | 이상 접근 감지 | 비정상 접근 패턴 알림 |

---

## 2. 모니터링 규칙

### 2.1 감사 로그 메트릭 (FR-N99.1)

```yaml
- record: audit:events:rate5m
  expr: sum(rate(audit_events_total[5m]))

- record: audit:events:total_24h
  expr: sum(increase(audit_events_total[24h]))
```

### 2.2 감사 로그 무결성 알림 (FR-N99.2)

```yaml
- alert: AuditLogIntegrityViolation
  expr: audit_log_modifications_total > 0
```

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM Lead |
