# SVC-AI-ADV-R561~R570 — Plan

> 작성일: 2026-04-13
> 범위: 공공기관 AI 서비스 10종 신규 모듈 (R561~R570)
> 상위 MTU: SVC-AI-ADV 무한 고도화 루프

## Executive Summary (4관점)

| 관점 | 목표 | 산출물 | 검증 |
|------|------|--------|------|
| 감리 | CSAP D-06 감사 로그 + N2SF N-05 데이터 차단 | 10 × `getAuditLog()` + `blockClassifiedData` | 10 × C등급 차단 테스트 |
| 기능 | 10개 공공 AI 도메인 순수 로직 | `platform/services/ai-service/src/lib/*.ts` | 60 vitest (각 6) |
| 품질 | TypeScript strict + noUncheckedIndexedAccess | `tsc --noEmit` | 0 errors |
| 운영 | 외부 API 의존 없음, 결정적 실행 | 순수 함수 + 내부 상태 | 단위 테스트 결정성 |

## Context Anchor

- **WHY**: 공공기관 행정 자동화 수요 확대 — 국경/보육/소방/주차/해안/해변/동물/직원건강/정신건강/식품안전 10개 도메인의 의사결정 보조 AI가 필요.
- **WHO**: 출입국관리소, 보건복지부 보육정책과, 소방본부, 지자체 주차관리, 해양수산부, 환경부, 동물보호소, 인사혁신처, 정신건강복지센터, 식품의약품안전처.
- **RISK**: 민감 개인정보 오용 위험 → 익명 참조(`caseRef`/`staffRef`/`adopterId`) 강제 + C/S 등급 차단 가드로 차단. 응급 케이스(자살관념, 폐쇄 조치) 오분류 위험 → 결정론적 임계값 + 감사 로그 전수 기록.
- **SUCCESS**: 60/60 vitest 통과, tsc 0 errors, C등급 차단 10건 100% 검증.
- **SCOPE**: 로직 전용 — HTTP 라우트·DB 영속화·외부 API 호출 미포함 (후속 라운드에서 서비스 통합).

## 요구사항 (FR)

### FR-R561.x — AI Border Control Risk Analyzer
- FR-R561.1 고위험 국적 등록
- FR-R561.2 여행자 요청 위험도 평가 (watchlist/국적/체류초과/장기체류/후원자)
- FR-R561.3 일괄 평가
- FR-R561.4 수준별 집계 (allow/review/enhanced/deny)
- FR-R561.5 수준 필터 조회
- FR-R561.6 감사 로그

### FR-R562.x — Public Daycare Quality AI
- FR-R562.1 어린이집 등록 (교사 비율/위생/안전/프로그램/만족도/사고)
- FR-R562.2 교사 비율 계단 점수 함수
- FR-R562.3 가중 합산 + 사고 감점 + A/B/C/D 등급 + 개선 권고
- FR-R562.4 품질 순위 조회
- FR-R562.5 센터 목록
- FR-R562.6 감사 로그

### FR-R563.x — AI Firefighter Dispatch Optimizer
- FR-R563.1 소방서 등록 (가용 차량 + 장비)
- FR-R563.2 Haversine 거리 계산
- FR-R563.3 장비 매칭 + 최근접 + 심각도 기반 배차
- FR-R563.4 차량 복귀
- FR-R563.5 배차 이력
- FR-R563.6 감사 로그

### FR-R564.x — Smart Parking Revenue AI
- FR-R564.1 주차장 등록 (용량/기본요금/점유/피크시간)
- FR-R564.2 동적 요금 계산 (피크 1.5× / 포화 1.3× / 저점유 0.85×)
- FR-R564.3 수익 예측
- FR-R564.4 점유 업데이트
- FR-R564.5 요금 이력
- FR-R564.6 감사 로그

### FR-R565.x — AI Coastal Erosion Monitor
- FR-R565.1 해안선 읽기 추가
- FR-R565.2 연도 간격 계산
- FR-R565.3 후퇴율 평가 + 4단계 심각도 + 10년 예측 + 양빈/방파제/대피 권고
- FR-R565.4 사이트 목록
- FR-R565.5 읽기 조회
- FR-R565.6 감사 로그

### FR-R566.x — Public Beach Safety AI
- FR-R566.1 조건 평가 → 4색 깃발 + 구조요원 요구량
- FR-R566.2 일괄 평가
- FR-R566.3 깃발별 집계
- FR-R566.4 깃발 필터 조회
- FR-R566.5 결정 초기화
- FR-R566.6 감사 로그

### FR-R567.x — AI Animal Shelter Management
- FR-R567.1 수용 (수용 한계 + 검증)
- FR-R567.2 상태 전환
- FR-R567.3 입양자 프로필 매칭 (건강/기질/경험/거주/자녀)
- FR-R567.4 입양 확정
- FR-R567.5 상태 필터 조회
- FR-R567.6 감사 로그

### FR-R568.x — Government Staff Wellness AI
- FR-R568.1 익명 스냅샷 기록
- FR-R568.2 종합 건강 점수 + 4단계 상태 + 개입
- FR-R568.3 상태별 집계
- FR-R568.4 위험군 조회
- FR-R568.5 참조 목록
- FR-R568.6 감사 로그

### FR-R569.x — AI Mental Health Triage
- FR-R569.1 제출 + 검증
- FR-R569.2 종합 점수 (자살관념 ×15, 지지체계 감점)
- FR-R569.3 긴급도 분류 (routine/priority/urgent/emergency)
- FR-R569.4 의뢰 수준 (self-help/counseling/psychiatric/hospitalization)
- FR-R569.5 긴급도별 조회
- FR-R569.6 감사 로그

### FR-R570.x — Public Food Safety Inspector AI
- FR-R570.1 점검 보고서 제출
- FR-R570.2 가중 차감 계산 (냉장/교차오염 ×5)
- FR-R570.3 5등급 판정 + 3건 이상 중대 위반 폐쇄
- FR-R570.4 필수 개선 조치
- FR-R570.5 결과/실패 조회
- FR-R570.6 감사 로그

## 추적성 매트릭스

| FR | 구현 파일 | 테스트 파일 | CSAP/N2SF |
|----|-----------|------------|-----------|
| FR-R561.x | ai-border-control-risk-analyzer.ts | ai-border-control-risk-analyzer.test.ts | D-06 / N-05 |
| FR-R562.x | public-daycare-quality-ai.ts | public-daycare-quality-ai.test.ts | D-06 / N-05 |
| FR-R563.x | ai-firefighter-dispatch-optimizer.ts | ai-firefighter-dispatch-optimizer.test.ts | D-06 / N-05 |
| FR-R564.x | smart-parking-revenue-ai.ts | smart-parking-revenue-ai.test.ts | D-06 / N-05 |
| FR-R565.x | ai-coastal-erosion-monitor.ts | ai-coastal-erosion-monitor.test.ts | D-06 / N-05 |
| FR-R566.x | public-beach-safety-ai.ts | public-beach-safety-ai.test.ts | D-06 / N-05 |
| FR-R567.x | ai-animal-shelter-management.ts | ai-animal-shelter-management.test.ts | D-06 / N-05 |
| FR-R568.x | government-staff-wellness-ai.ts | government-staff-wellness-ai.test.ts | D-06 / N-05 |
| FR-R569.x | ai-mental-health-triage.ts | ai-mental-health-triage.test.ts | D-06 / N-05 |
| FR-R570.x | public-food-safety-inspector-ai.ts | public-food-safety-inspector-ai.test.ts | D-06 / N-05 |

## 변경 이력
- 2026-04-13 v1.0 초안 및 구현 완료 (10/10 모듈, 60/60 테스트)
