# SVC-AI-ADV-R177 Design — AI기반 사용자 행동 이상 탐지

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 내부자 위협 및 계정 탈취 조기 탐지 |
| WHO | 보안팀, 감사팀 |
| RISK | 오탐(false positive)으로 정상 사용자 차단 |
| SUCCESS | 4가지 이상 패턴 탐지 자동화 |
| SCOPE | 구현 파일: `user-behavior-anomaly-detector.ts` |

## 클래스 설계

### `UserBehaviorAnomalyDetector`

| 메서드 | 설명 |
|--------|------|
| `recordEvent(event)` | 사용자 이벤트 기록 |
| `registerBaseline(baseline)` | 정상 패턴 베이스라인 등록 |
| `detect(userId)` | 이상 탐지 (4가지 유형) |
| `getAuditLog()` | CSAP D-06 감사 로그 반환 |

## 탐지 유형

| 유형 | 조건 |
|------|------|
| EXCESSIVE_REQUESTS | 요청 수 > 베이스라인 × 3 |
| CREDENTIAL_STUFFING | 짧은 시간 다수 로그인 시도 |
| BULK_EXPORT | 대량 내보내기 이벤트 |
| UNUSUAL_TIME | 베이스라인 외 시간대 접근 |

## 추적성 매트릭스

| FR ID | 구현 메서드 | 테스트 케이스 | CSAP |
|-------|-----------|--------------|------|
| FR-R177.1 | recordEvent | 이벤트 기록 | D-06 |
| FR-R177.2 | registerBaseline | 베이스라인 등록 | D-08 |
| FR-R177.3 | detect | 4가지 이상 탐지 | D-08 |
| FR-R177.4 | detect | 심각도 분류 | D-08 |
| FR-R177.5 | getAuditLog | 감사 로그 | D-06 |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-12 | 최초 작성 | ai-impl-a |
