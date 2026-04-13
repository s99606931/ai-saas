# SVC-AI-ADV-R501~R510 Plan — 공공 AI 모듈 10종

## Executive Summary
| 관점 | 내용 |
|------|------|
| WHY | 공공기관 운영·재정·보건·교육·인프라 영역의 AI 의사결정 지원 모듈 10종 추가 |
| WHO | 기획재정부, 행정안전부, 보건복지부, 교육부, 환경부, 국토부 |
| WHAT | 예산집행 모니터링부터 정부 부채 리스크까지 10개 도메인 클래스 |
| HOW | 순수 TypeScript 로직 + N2SF 차단 가드 + append-only 감사 로그 |

## Context Anchor
- WHY: 공공 SaaS 프레임워크 lib/ 1148 → 1158, R500 이정표 이후 후속 라운드
- WHO: 공공기관 정책·운영 담당자
- RISK: C/S 등급 데이터 AI 전송 차단 강제
- SUCCESS: 10개 모듈 + 60 unit test + tsc 0 errors
- SCOPE: `platform/services/ai-service/src/lib/{10 files}.ts` + `__tests__/`

## 요구사항

### FR-R501 AI Budget Execution Monitor
- FR-R501.1: 예산 항목 등록(BudgetItem) + 집행 기록(ExecutionRecord)
- FR-R501.2: 집행률 산출 + NORMAL/UNDER_EXECUTED/OVER_EXECUTED/CRITICAL 4상태
- FR-R501.3: 잔액·권고사항 자동 산출

### FR-R502 Gov Asset Depreciation AI
- FR-R502.1: STRAIGHT_LINE/DECLINING_BALANCE/UNITS_OF_PRODUCTION 3가지 감가상각법
- FR-R502.2: 장부가액·내용연수 계산 + needsReplacement 자동 판정
- FR-R502.3: 잔존가치/취득원가 범위 검증

### FR-R503 AI Public Procurement Fraud
- FR-R503.1: 4가지 부정 신호 (SINGLE_BID, PRICE_CLUSTERING, NEAR_ESTIMATE_WIN, SAME_SUBMIT_TIME, SUSPICIOUSLY_LOW_BID)
- FR-R503.2: 누적 점수 → LOW/MEDIUM/HIGH/CRITICAL 4단계
- FR-R503.3: 낙찰 vendorId 추적

### FR-R504 Smart Traffic Signal Optimizer
- FR-R504.1: 교차로 등록(min/max green, yellow)
- FR-R504.2: 남북/동서 우세 판정 + 보행자 가중치 (10명 초과 시 0.8 factor)
- FR-R504.3: 동적 녹색시간 산출 (min~max 범위 내)

### FR-R505 AI Public Event Coordinator
- FR-R505.1: 4종 자원 (VENUE/STAFF/EQUIPMENT/PERMIT) 검증
- FR-R505.2: PLANNED/READY/ATTENTION/BLOCKED 4상태 (PERMIT 부족 시 BLOCKED 우선)
- FR-R505.3: 1000명 초과 행사 시 안전관리계획 권고

### FR-R506 Healthcare Resource Allocator AI
- FR-R506.1: 동일 지역 우선 배분 → 다른 지역 대체
- FR-R506.2: OK/PARTIAL/UNMET 3상태 + 자원 차감
- FR-R506.3: priority 1~5 검증

### FR-R507 AI Climate Adaptation Planner
- FR-R507.1: 4지표 (avgTemp, precipitation, extremeEvents, seaLevel) 종합 점수
- FR-R507.2: LOW/MODERATE/HIGH/SEVERE 4단계
- FR-R507.3: 4범주 (INFRASTRUCTURE/HEALTH/AGRICULTURE/ECOSYSTEM) 액션 자동 생성

### FR-R508 School Performance Analytics AI
- FR-R508.1: 4지표 가중 (졸업률 30% + 출석 25% + 학업 35% + 교사비율 10%)
- FR-R508.2: EXCELLENT/GOOD/AVERAGE/NEEDS_IMPROVEMENT 4티어
- FR-R508.3: strengths/improvements 자동 분류 + 백분위

### FR-R509 AI Park Maintenance Scheduler
- FR-R509.1: MOWING(14일)/PRUNING(90일)/INSPECTION(30일) 주기 기반
- FR-R509.2: ROUTINE/SOON/URGENT 3단계 (cycleDays * 1.5 기준)
- FR-R509.3: 방문자 100/500명 임계 CLEANING 추가

### FR-R510 Government Debt Risk AI
- FR-R510.1: 3지표 (debtToGdp, interestToRevenue, shortTermRatio) + 추세
- FR-R510.2: STABLE/MONITORING/WARNING/CRITICAL 4단계
- FR-R510.3: 5종 플래그 + 권고사항

## 공통 비기능 요구사항
- NFR-1: TypeScript strict (noUnusedLocals, noUncheckedIndexedAccess) 0 errors
- NFR-2: N2SF C/S 등급 차단 (blockClassifiedData)
- NFR-3: append-only 감사 로그 + getAuditLog() (CSAP D-06)
- NFR-4: 외부 API 호출 없음 — 순수 결정론 로직
- NFR-5: 모듈당 6개 이상 unit test (vitest)

## 추적성
FR-R501~R510.* ↔ `{filename}.ts` ↔ `__tests__/{filename}.test.ts` ↔ CSAP D-06 + N2SF N-05
