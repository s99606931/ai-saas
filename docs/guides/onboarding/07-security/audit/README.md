# 감사 로그 학습 순서

> **목표**: CSAP D-06 요건에 맞는 감사 로그를 올바르게 작성할 수 있다

---

## 감사 로그란?

감사 로그(Audit Log)는 "누가 언제 무엇을 했는가"를 기록하는 특별한 로그입니다.

```
일반 운영 로그:
  "2026-04-11 09:15:32 INFO UserService: user found"
  목적: 디버깅, 성능 분석

감사 로그:
  "2026-04-11 09:15:32 | actor:admin-001 | action:USER_DELETE | target:user-123 | ip:192.168.1.1"
  목적: CSAP 증거, 법적 책임 추적, 보안 조사
```

공공기관에서는 감사 로그가 법적 증거 자료가 될 수 있습니다.

---

## 학습 순서

1. **`01-audit-logging.md`** — 무엇을 로깅해야 하는가, auditLog() 사용법, audit.jsonl 구조, 실습

---

## 관련 코드 위치

```
platform/services/compliance-service/src/lib/audit.ts
platform/services/security-service/src/lib/audit.ts
platform/services/ai-service/src/handlers/ai-agent.handler.ts
.claude/audit.jsonl
```
