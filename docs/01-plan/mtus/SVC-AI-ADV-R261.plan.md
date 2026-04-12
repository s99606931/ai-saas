# SVC-AI-ADV-R261 — 공급망 위험 점수 엔진

> 작성일: 2026-04-13 | 버전: 1.0.0 | 작성자: PM Lead (자율 생성)

## Executive Summary

| 관점 | 내용 |
|------|------|
| 기능 | 공급업체 등록 + 가중치 기반 위험 점수 + 리스크 레벨 판정 + 대체 공급업체 추천 |
| 품질 | 결정론적 점수 산출, 테스트 11개+ |
| 보안 | C/S 차단, vendorId 마스킹, CSAP D-06 감사 로그 |
| 비용 | 로컬 규칙 엔진 |

## Context Anchor

- **WHY**: 공공 조달 공급망 공격 증가 → 사전 위험 가시화 필요
- **WHO**: 조달청, 정보보호팀, 계약 담당자
- **RISK**: 잘못된 점수 → 고위험 업체 계약 체결
- **SUCCESS**: 업체 등록 → 점수 산출 → 레벨 판정 → 대체 추천
- **SCOPE**: In — 점수 엔진. Out — 실시간 외부 CVE 피드

## 요구사항

- **FR-R261.1**: 공급업체 등록 (vendorId·name·country·certifications·cveCount·incidentCount·financialStability)
- **FR-R261.2**: 위험 점수 산출 (0~100, 높을수록 위험)
  - CVE 개수 ×3 (최대 30)
  - 사고 이력 ×5 (최대 25)
  - 재정 불안정 (스코어 <50) → +20
  - 고위험 국가 리스트 → +15
  - 인증서 부재 (ISO27001/SOC2) → +10
- **FR-R261.3**: 레벨 판정 (LOW<25, MEDIUM<50, HIGH<75, CRITICAL≥75)
- **FR-R261.4**: 고위험 국가 목록 관리 (addHighRiskCountry·removeHighRiskCountry)
- **FR-R261.5**: 대체 공급업체 추천 (동일 카테고리·더 낮은 risk score 업체 최대 3개)
- **FR-R261.6**: 전체 위험 요약 (총 업체 수, 레벨별 분포)
- **FR-R261.7**: C/S 차단, vendorId 마스킹, CSAP D-06 감사 로그, getAuditLog()
- **NFR-R261.1**: TypeScript strict, 테스트 11개+

## 추적성 매트릭스

| FR ID | 구현 | 테스트 | CSAP |
|-------|------|--------|------|
| FR-R261.1~7 | supply-chain-risk-scorer.ts | .test.ts | D-06, D-12 |
