# MTU Plan — SVC-AI-ADV-R138 AI-Powered SLA Negotiator

> **원 요청 번호**: R138
> **모듈**: `platform/services/ai-service/src/lib/sla-negotiator-ai.ts`
> **작성일**: 2026-04-12
> **작성자**: PM Lead

## Executive Summary (4-Perspective)

| 관점 | 내용 |
|------|------|
| 비즈니스 | 공공기관 SaaS 조달 계약 시 SLA 조항 자동 협상·최적화로 계약 기간 단축 및 리스크 감소 |
| 기술 | 제안 SLA vs 운영 가능 범위를 비교하고 위반 위험도·보상 비용을 계산해 대안 조항을 생성 |
| 보안 | O등급 메타데이터(가용성, RTO, RPO)만 사용. C/S등급 계약 본문 전송 금지 |
| 규제 | 행안부 정보화사업 감리기준 §4.2(계약조건), CSAP D-06 감사로그, N2SF N-05 AI 데이터 등급 |

## Context Anchor

- **WHY**: 기존 `sla-contract-management.ts`는 계약 상태 조회만 담당. 신규 협상 제안·반론 자동화 공백
- **WHO**: 법무·구매 담당자, 공공기관 SaaS 운영팀
- **RISK**: 비현실적 SLA 수용 시 운영 리스크 급증, 위약금 폭증
- **SUCCESS**: 협상 1회차에 수용 가능한 합의안 80% 이상 도출
- **SCOPE**: 제안 분석, 대안 생성, 리스크 점수화, 감사 로그

## 기능 요구사항 (FR)

| FR ID | 설명 | 검증 방법 |
|-------|------|----------|
| FR-R138.1 | 제안 SLA 파싱 (가용성, RTO, RPO, 응답시간) | 유닛 테스트 |
| FR-R138.2 | 운영 이력 기반 달성 가능성 점수(0~1) 계산 | 유닛 테스트 |
| FR-R138.3 | 위반 시 예상 위약금 계산 (월 매출 × 위약률 × 위반확률) | 유닛 테스트 |
| FR-R138.4 | 협상 대안 조항 생성 (3개: 보수/균형/공격) | 유닛 테스트 |
| FR-R138.5 | 협상 세션 감사 로그 (`getAuditLog()`) | 유닛 테스트 |
| FR-R138.6 | C/S등급 입력 차단 guard | 유닛 테스트 |

## 비기능 요구사항

- **성능**: 단일 제안 분석 < 50ms
- **커버리지**: 80%+
- **TypeScript strict**: 0 에러

## 추적성 매트릭스

| FR | 구현 | 테스트 | CSAP |
|----|------|--------|------|
| FR-R138.1~4 | `SlaNegotiatorAI.analyze()` | `sla-negotiator-ai.test.ts` | D-06 |
| FR-R138.5 | `getAuditLog()` | test it[5] | D-06 |
| FR-R138.6 | `assertDataGrade()` | test it[6] | N2SF N-05 |
