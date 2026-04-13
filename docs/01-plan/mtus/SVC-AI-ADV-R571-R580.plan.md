# SVC-AI-ADV-R571~R580 — Plan

> 작성일: 2026-04-13
> 범위: 공공기관 AI 서비스 10종 신규 모듈 (R571~R580)
> 상위 MTU: SVC-AI-ADV 무한 고도화 루프

## Executive Summary (4관점)

| 관점 | 목표 | 산출물 | 검증 |
|------|------|--------|------|
| 감리 | CSAP D-06 감사 로그 + N2SF N-05 데이터 차단 | 10 × `getAuditLog()` + `blockClassifiedData` | 10 × C/S등급 차단 테스트 |
| 기능 | 10개 공공 AI 도메인 순수 로직 | `platform/services/ai-service/src/lib/*.ts` | 60 vitest (각 6) |
| 품질 | TypeScript strict + noUncheckedIndexedAccess | `tsc --noEmit` | 0 errors |
| 운영 | 외부 API 의존 없음, 결정적 실행 | 순수 함수 + 내부 상태 | 단위 테스트 결정성 |

## Context Anchor

- **WHY**: 공공기관 행정 자동화 수요 확대 — 교통/재난/농지/주거/교육문화/청소년/복지/노인/보훈/체육 10개 도메인의 의사결정 보조 AI가 필요.
- **WHO**: 도로교통공단, 행정안전부 재난관리본부, 농림축산식품부, LH/SH, 문화체육관광부 도서관정보정책기획단, 여성가족부 청소년정책관, 보건복지부, 지자체 노인복지과, 국가보훈부, 체육진흥공단.
- **RISK**: 민감 개인정보 오용 위험 → 익명 참조(`counseleeCode`/`seniorCode`/`athleteCode`) 강제 + C/S 등급 차단 가드. 청소년 자살 관념 등 위기 사안 오분류 위험 → 결정론적 임계값 + 감사 로그 전수 기록.
- **SUCCESS**: 60/60 vitest 통과, tsc 0 errors, C/S등급 차단 10건 100% 검증.
- **SCOPE**: 로직 전용 — HTTP 라우트·DB 영속화·외부 API 호출 미포함 (후속 라운드에서 서비스 통합).

## 요구사항 (FR)

### FR-R571.x — Traffic Accident Analysis AI
- FR-R571.1 사고 기록 (위치/도로유형/기상/차량/부상/사망/야간)
- FR-R571.2 위험 평가 (심각도 minor/moderate/severe/fatal + 스코어)
- FR-R571.3 위치 통계 집계
- FR-R571.4 위험 집중 지점 식별 (임계값 필터)
- FR-R571.5 기록 조회
- FR-R571.6 감사 로그

### FR-R572.x — AI Flood Evacuation Planner
- FR-R572.1 구역 등록 (인구/고도/최근접 대피소)
- FR-R572.2 대피소 등록 (수용량/가용)
- FR-R572.3 수위 업데이트 (강수량/강수량)
- FR-R572.4 홍수 수준 분류 (normal/watch/warning/emergency)
- FR-R572.5 대피 계획 수립 (우선 대피소 + 대피 인구 + 예상 소요)
- FR-R572.6 감사 로그

### FR-R573.x — Agricultural Land Registry AI
- FR-R573.1 필지 등록 (지목/면적/보호구역)
- FR-R573.2 사용 상태 업데이트
- FR-R573.3 검증 (보호구역 전환 에러 / 유휴 경고 / 최소 면적)
- FR-R573.4 소유자별 필지 조회
- FR-R573.5 지목별 총 면적 집계
- FR-R573.6 감사 로그

### FR-R574.x — Public Rental Housing AI
- FR-R574.1 신청자 등록 (가구유형/가구원/소득/자산/장애)
- FR-R574.2 유닛 등록
- FR-R574.3 자격 평가 (소득/자산/기존주택 + 우선순위 점수)
- FR-R574.4 유닛 배정 (가구유형 매칭 + 최저 임대료)
- FR-R574.5 가용 유닛 목록
- FR-R574.6 감사 로그

### FR-R575.x — AI Library Recommendation Engine
- FR-R575.1 도서 추가
- FR-R575.2 이용자 등록 (선호 분야/읽은 도서/평점)
- FR-R575.3 추천 (선호 분야 + 인기도 + 선호 저자 가점)
- FR-R575.4 평점 기록
- FR-R575.5 인기 도서 상위 목록
- FR-R575.6 감사 로그

### FR-R576.x — Youth Counseling AI Advisor
- FR-R576.1 세션 생성 (익명 코드 강제 / 실명 거부)
- FR-R576.2 트리아지 (자살사고/자해/학폭/지지망 가중치)
- FR-R576.3 위기 세션 목록
- FR-R576.4 주제별 세션 조회
- FR-R576.5 세션 수 집계
- FR-R576.6 감사 로그

### FR-R577.x — Welfare Benefit Matching AI
- FR-R577.1 가구 등록 (소득/자산/구성원 특성)
- FR-R577.2 급여 프로그램 등록 (요건 + 금액)
- FR-R577.3 급여 매칭 (소득/자산/구성원 요건 검증)
- FR-R577.4 총 잠재 수급액 계산
- FR-R577.5 프로그램 목록
- FR-R577.6 감사 로그

### FR-R578.x — Senior Mobility Support AI
- FR-R578.1 이동 요청 (출발/목적지/이동수준/보호자 필요)
- FR-R578.2 차량 등록 (휠체어/보호자 탑승)
- FR-R578.3 차량 배정 (요건 매칭 + 최근접 + 의료 우선)
- FR-R578.4 대기 요청 목록
- FR-R578.5 배정 이력
- FR-R578.6 감사 로그

### FR-R579.x — Veteran Service Priority AI
- FR-R579.1 보훈대상자 등록 (카테고리/장애율/연령/소득)
- FR-R579.2 서비스 요청 등록
- FR-R579.3 우선순위 스코어 (카테고리+장애+연령+소득+서비스유형)
- FR-R579.4 우선순위 큐 (서비스 유형 필터)
- FR-R579.5 카테고리별 인원 집계
- FR-R579.6 감사 로그

### FR-R580.x — Sports Talent Discovery AI
- FR-R580.1 신체 프로필 등록 (6~25세)
- FR-R580.2 종목 적합도 분석 (6종목 축구/농구/수영/육상/체조/태권도)
- FR-R580.3 최상위 종목 추천
- FR-R580.4 종목별 인재풀 조회
- FR-R580.5 프로필 수 집계
- FR-R580.6 감사 로그

## 비기능 요구사항

- **NFR-SEC-1**: N2SF N-05 — C/S 등급 데이터 차단 (모든 입력 메서드)
- **NFR-SEC-2**: CSAP D-06 — 모든 상태 변경 `auditLog` 기록 + `getAuditLog()` 깊은 복사 반환
- **NFR-QLT-1**: TypeScript strict 모드 (noUnusedLocals, noUncheckedIndexedAccess)
- **NFR-QLT-2**: 모든 배열 첨자 접근은 `arr[i]!` 또는 `arr[i] ?? default`
- **NFR-OPS-1**: 외부 네트워크 호출 없음, 순수 인메모리 상태

## 추적성 매트릭스 (요약)

| FR | 구현 | 테스트 | CSAP |
|----|------|--------|------|
| FR-R571.x | traffic-accident-analysis-ai.ts | traffic-accident-analysis-ai.test.ts | D-06 |
| FR-R572.x | ai-flood-evacuation-planner.ts | ai-flood-evacuation-planner.test.ts | D-06 |
| FR-R573.x | agricultural-land-registry-ai.ts | agricultural-land-registry-ai.test.ts | D-06 |
| FR-R574.x | public-rental-housing-ai.ts | public-rental-housing-ai.test.ts | D-06 |
| FR-R575.x | ai-library-recommendation-engine.ts | ai-library-recommendation-engine.test.ts | D-06 |
| FR-R576.x | youth-counseling-ai-advisor.ts | youth-counseling-ai-advisor.test.ts | D-06, D-08 |
| FR-R577.x | welfare-benefit-matching-ai.ts | welfare-benefit-matching-ai.test.ts | D-06 |
| FR-R578.x | senior-mobility-support-ai.ts | senior-mobility-support-ai.test.ts | D-06 |
| FR-R579.x | veteran-service-priority-ai.ts | veteran-service-priority-ai.test.ts | D-06 |
| FR-R580.x | sports-talent-discovery-ai.ts | sports-talent-discovery-ai.test.ts | D-06 |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-13 | 최초 작성 (R571~R580 10개 모듈) | PM Lead |
