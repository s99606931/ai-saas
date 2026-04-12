# MTU-N270: 고객 성공 AI 자동화 — Design

> **버전**: 1.0 | **작성일**: 2026-04-12 | **작성자**: PM Lead

## Design Anchor

| 항목 | 내용 |
|------|------|
| Plan 참조 | `docs/01-plan/mtus/MTU-N270-customer-success.plan.md` |
| 아키텍처 | Pragmatic Balance — 헬스 스코어 + 위험 식별 + 인터벤션 |
| 구현 파일 | `platform/services/ai-service/src/lib/customer-success-ai.ts` |

## §1 헬스 스코어 (FR-N270.1)
- 사용량, 활성도, 기능 채택률, 지원 티켓 수 등 다차원 지표
- 가중 점수 → 0~100 스코어

## §2 이탈 위험 식별 (FR-N270.2)
- 헬스 스코어 하락 추세 + 이탈 예측 모델
- 위험 등급: low, medium, high, critical

## §3 인터벤션 플레이북 (FR-N270.3)
- 위험 등급별 자동 액션 (이메일, 미팅 요청, 교육 제안)
- 플레이북 등록/수정/실행

## §4 고객 여정 단계 (FR-N270.4)
- onboarding → activation → engagement → expansion → renewal
- 자동 단계 분류

## §5 NPS/CSAT 예측 (FR-N270.5)
- 활동 데이터 기반 만족도 예측

## §6 감사 로그 (FR-N270.6)
- 모든 CS 활동 기록

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-12 | 초기 Design | PM Lead |
