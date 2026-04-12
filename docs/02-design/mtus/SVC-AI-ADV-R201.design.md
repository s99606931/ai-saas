# SVC-AI-ADV-R201 Design — AI기반 코드 취약점 자동 패치

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | CVE 패치 자동화로 공급망 보안 강화 |
| SCOPE | 구현 파일: `code-vuln-auto-patcher.ts` |

## 패치 전략 결정 기준

| 조건 | strategy |
|------|----------|
| CRITICAL/HIGH + 동일 메이저 | AUTO |
| MEDIUM + 동일 메이저 | SEMI_AUTO |
| 메이저 버전 변경 | MANUAL |

## 추적성 매트릭스

| FR ID | 구현 | 테스트 | CSAP |
|-------|------|--------|------|
| FR-R201.1 | registerVuln | 취약점 등록 | D-12 |
| FR-R201.2 | suggestPatch | AUTO/MANUAL 전략 | D-12 |
| FR-R201.3 | applyPatch | APPLIED/PENDING | D-12 |
| FR-R201.4 | getPendingVulns | 미패치 목록 | D-06 |
| FR-R201.5 | getAuditLog | 감사 로그 | D-06 |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-12 | 최초 작성 | ai-impl-a |
