# MTU Plan — SVC-AI-ADV-R144 Tenant Billing Reporter

> **원 요청 번호**: R144
> **모듈**: `platform/services/ai-service/src/lib/tenant-billing-reporter.ts`

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 테넌트별 AI 사용량을 기간 단위 과금 리포트로 산출 |
| 기술 | 토큰·모델별 단가 매핑, 기간 집계, 할인/등급 적용 |
| 보안 | 테넌트 ID 해시 저장, 원문 프롬프트 미저장 |
| 규제 | 공공 회계법 청구서 증빙, CSAP 요금 투명성 |

## Context Anchor

- WHY: 기존 `cost-attribution`(실시간 귀속)과 달리 월간 청구서 생성 전용
- WHO: 재무, 테넌트 운영자
- RISK: 청구서 계산 오류 → 감사 지적
- SUCCESS: 청구서 재현 가능, 계산 오차 0원
- SCOPE: 사용량 기록→기간 필터→단가 계산→라인별 리포트

## FR

| ID | 설명 |
|----|------|
| FR-R144.1 | 사용량 기록: tenantId, modelId, inputTokens, outputTokens, at |
| FR-R144.2 | 모델별 단가(per 1K token) 등록 |
| FR-R144.3 | 기간 리포트 생성 (시작·끝 timestamp) |
| FR-R144.4 | 테넌트별 할인율 적용 |
| FR-R144.5 | 감사 로그 + `getAuditLog()` |
| FR-R144.6 | C/S등급 데이터 차단 |

## 테스트 시나리오

- 3개 사용 → 기간 리포트 합산
- 할인율 10% 적용 확인
- 단가 미등록 모델 사용 → 오류
- C등급 차단
