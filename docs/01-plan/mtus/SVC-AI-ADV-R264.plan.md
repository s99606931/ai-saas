# SVC-AI-ADV-R264 — 시민 민원 품질 점수 엔진

> 작성일: 2026-04-13 | 버전: 1.0.0 | 작성자: PM Lead (자율 생성)

## Executive Summary

| 관점 | 내용 |
|------|------|
| 기능 | 민원 처리 기록 수집 + 4지표 품질 점수 + 부서 랭킹 + 개선 권고 |
| 품질 | 결정론적 가중 평균, 테스트 12개+ |
| 보안 | C/S 차단, citizenId 마스킹, CSAP D-06 감사 로그 |
| 비용 | 로컬 계산 |

## Context Anchor

- **WHY**: 공공 민원 품질 정량화 필요 → AI 자동 평가 + 부서 개선 유도
- **WHO**: 시민, 행정감사팀, 민원 담당 부서장
- **RISK**: 불공정 점수 → 부서 항의 → 임의 조작
- **SUCCESS**: 처리 이력 등록 → 4지표 점수 → 부서 랭킹 + 권고
- **SCOPE**: In — 점수 집계. Out — LLM 기반 정성 평가

## 4 지표 (가중치)

1. **응답 속도** (30%): 24시간 이내 → 100, 48시간 → 80, 7일 → 50, 이후 0
2. **해결률** (30%): resolved / total
3. **재문의율** (20% 역): 재문의 없음 100 → 재문의 많을수록 감점
4. **만족도** (20%): 시민 평가 1~5 → (score-1)/4*100

## 요구사항

- **FR-R264.1**: 민원 기록 등록 (requestId·departmentId·citizenId·submittedAt·respondedAt·resolvedAt·reinquiryCount·satisfaction)
- **FR-R264.2**: 부서별 품질 점수 계산 (4지표 가중 평균, 0~100)
- **FR-R264.3**: 부서 랭킹 조회 (점수 desc 정렬)
- **FR-R264.4**: 개선 권고 생성 (지표별 60점 미만 → 구체 권고)
- **FR-R264.5**: 민원 상세 분석 (개별 requestId 점수 반환)
- **FR-R264.6**: 등급 판정 (EXCELLENT≥90, GOOD≥75, FAIR≥60, POOR<60)
- **FR-R264.7**: C/S 차단, citizenId 마스킹, CSAP D-06 감사 로그, getAuditLog()
- **NFR-R264.1**: TypeScript strict, 테스트 12개+

## 추적성 매트릭스

| FR ID | 구현 | 테스트 | CSAP |
|-------|------|--------|------|
| FR-R264.1~7 | civic-service-quality-engine.ts | .test.ts | D-06, D-12 |
