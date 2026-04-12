# SVC-AI-ADV-R19: AI Feedback Loop (AI 피드백 루프)

> 버전: 1.0.0 | 작성일: 2026-04-11 | 작성자: PM Lead

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 사용자 피드백을 체계적으로 수집하여 AI 품질 지속 개선. RLHF/DPO 학습 데이터 축적 |
| 기술 | 피드백 수집 (thumbs up/down, 비교, 자유 기술) + 선호도 데이터셋 생성 + 품질 추이 분석 |
| 보안 | CSAP D-09 피드백 데이터 암호화, N2SF PII 마스킹 후 저장 |

---

## 기능 요구사항

| FR ID | 요구사항 | 우선순위 |
|-------|---------|---------|
| FR-ADV19.1 | 피드백 수집기 — 좋아요/싫어요 + 별점 + 자유 기술 | P0 |
| FR-ADV19.2 | 비교 피드백 — 2개 응답 선호도 비교 (DPO 학습 데이터) | P0 |
| FR-ADV19.3 | 피드백 집계 — 프롬프트/모델별 만족도 통계 | P0 |
| FR-ADV19.4 | 선호도 데이터셋 — RLHF/DPO 학습용 포맷 내보내기 | P1 |
| FR-ADV19.5 | 품질 추이 분석 — 시간대별 만족도 변화 감지 | P1 |
| FR-ADV19.6 | 자동 알림 — 만족도 급감 시 담당자 알림 | P2 |

---

## 산출물

| 산출물 | 경로 |
|--------|------|
| ai-feedback-loop.ts | platform/services/ai-service/src/lib/ai-feedback-loop.ts |
