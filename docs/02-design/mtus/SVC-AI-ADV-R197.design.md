# SVC-AI-ADV-R197 Design — AI기반 보안 취약점 자동 수정

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 보안 취약점 자동 수정으로 보안 사고 예방 |
| RISK | 자동 수정 코드가 기존 로직 변경 가능 |
| SCOPE | 구현 파일: `security-vuln-auto-fixer.ts` |

## 수정 전략

| 카테고리 | 전략 | 자동 적용 |
|---------|------|----------|
| SQL_INJECTION | 매개변수화 쿼리 교체 | AUTO |
| XSS | innerHTML → textContent | AUTO |
| HARDCODED_SECRET | 환경 변수로 교체 | AUTO |
| WEAK_CRYPTO | sha256으로 교체 | AUTO |
| INSECURE_DESERIALIZATION | 수동 검토 필요 | MANUAL |
| PATH_TRAVERSAL | 수동 검토 필요 | MANUAL |

## 추적성 매트릭스

| FR ID | 구현 | 테스트 | CSAP |
|-------|------|--------|------|
| FR-R197.1 | registerVuln | 취약점 등록 | D-12 |
| FR-R197.2 | fix | SQL/XSS AUTO 수정 | D-12 |
| FR-R197.3 | fix | MANUAL_REQUIRED | D-12 |
| FR-R197.4 | fixAll | 전체 보고서 | D-06 |
| FR-R197.5 | getAuditLog | 감사 로그 | D-06 |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-12 | 최초 작성 | ai-impl-a |
