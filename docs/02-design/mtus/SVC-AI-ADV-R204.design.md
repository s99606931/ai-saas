# SVC-AI-ADV-R204 Design — AI기반 자동 장애 근본원인 분석 v2

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 장애 MTTR 단축을 위한 근본원인 자동 분류 |
| SCOPE | 구현 파일: `rca-engine-ai-v2.ts` |

## 근본원인 신호 키워드

| 카테고리 | 신호 |
|---------|------|
| INFRASTRUCTURE | oom, disk full, cpu spike, memory |
| APPLICATION | exception, error, timeout, null pointer |
| DATABASE | deadlock, connection pool, query timeout |
| NETWORK | connection refused, dns, 네트워크 |
| HUMAN_ERROR | config change, deploy, 배포 |

- maxScore 카테고리 선택, confidence = min(matchCount/3, 1.0)

## 추적성 매트릭스

| FR ID | 구현 | 테스트 | CSAP |
|-------|------|--------|------|
| FR-R204.1 | registerIncident/addEvent | 등록 | D-12 |
| FR-R204.2 | analyze | 근본원인 분류 | D-12 |
| FR-R204.3 | analyze | confidence 산출 | D-12 |
| FR-R204.4 | analyze | 타임라인 + 예방조치 | D-12 |
| FR-R204.5 | getAuditLog | 감사 로그 | D-06 |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-12 | 최초 작성 | ai-impl-a |
