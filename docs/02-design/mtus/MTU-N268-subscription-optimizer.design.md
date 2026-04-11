# MTU-N268: SaaS 구독 AI 최적화 — Design

> **버전**: 1.0 | **작성일**: 2026-04-12 | **작성자**: PM Lead

## Design Anchor

| 항목 | 내용 |
|------|------|
| Plan 참조 | `docs/01-plan/mtus/MTU-N268-subscription-optimizer.plan.md` |
| 아키텍처 | Pragmatic Balance — 사용량 분석 + 패턴 탐지 + 최적화 추천 |
| 구현 파일 | `platform/services/ai-service/src/lib/subscription-optimizer.ts` |

## §1 사용량 시계열 분석 (FR-N268.1)
- 일/주/월 사용량 수집
- 이동 평균, 계절성 분해

## §2 패턴 분류 (FR-N268.2)
- 성장형, 안정형, 감소형, 버스트형 자동 분류
- 통계 지표 기반 (추세 기울기, 분산)

## §3 플랜 추천 (FR-N268.3)
- 사용량 예측 기반 최적 플랜 매칭
- 비용 절감 금액 계산

## §4 이상 과금 감지 (FR-N268.4)
- Z-score 기반 이상치 탐지
- 즉시 알림 트리거

## §5 비용 시뮬레이션 (FR-N268.5)
- what-if 분석 (플랜 변경 시 예상 비용)

## §6 감사 로그 (FR-N268.6)
- 모든 최적화 활동 기록

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-12 | 초기 Design | PM Lead |
