# SVC-AI-ADV-R176 Design — AI기반 자연어 DB 쿼리 최적화

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 비개발자 대상 자연어 데이터 조회 인터페이스 |
| WHO | 정책 담당자, 데이터 분석팀 |
| RISK | SQL 주입, 잘못된 쿼리 생성 |
| SUCCESS | 자연어 → SQL 변환 + 보안 검사 |
| SCOPE | 구현 파일: `nl-query-optimizer.ts` |

## 클래스 설계

### `NlQueryOptimizer`

| 메서드 | 설명 |
|--------|------|
| `registerQuery(query)` | 자연어 쿼리 등록 |
| `parse(queryId)` | 자연어 → SQL 파싱 |
| `optimize(queryId)` | 인덱스 힌트 최적화 |
| `securityCheck(sql)` | SQL 주입/주석 인젝션 탐지 |
| `getAuditLog()` | CSAP D-06 감사 로그 반환 |

## 보안 설계 (CSAP D-12)

- SQL 주입 패턴: `DROP`, `DELETE`, `INSERT`, `UPDATE`, `--`, `/*` 탐지
- 매개변수화 쿼리 권고 메시지 포함

## 추적성 매트릭스

| FR ID | 구현 메서드 | 테스트 케이스 | CSAP |
|-------|-----------|--------------|------|
| FR-R176.1 | registerQuery | 쿼리 등록 | D-12 |
| FR-R176.2 | parse | SELECT/집계/JOIN | D-12 |
| FR-R176.3 | optimize | 집계 파티셔닝 힌트 | D-12 |
| FR-R176.4 | securityCheck | SQL 주입 탐지 | D-12 |
| FR-R176.5 | getAuditLog | 감사 로그 | D-06 |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-12 | 최초 작성 | ai-impl-a |
