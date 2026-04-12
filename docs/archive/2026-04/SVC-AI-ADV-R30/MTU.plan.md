# SVC-AI-ADV-R30: AI 이상 탐지 (Anomaly Detection)

> 버전: 1.0.0 | 작성일: 2026-04-12 | 작성자: PM Lead (Opus)

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 시스템 로그/메트릭에서 보안 이상을 AI가 자동 감지하여 사고 대응 시간 단축 |
| 기술 | LLM 기반 로그 분석 + 통계적 이상치 탐지 (Z-Score, IQR, 이동평균) |
| 보안 | CSAP D-06 침해사고 자동 감지, D-12 보안 이벤트 실시간 모니터링 |
| 운영 | 실시간 스트리밍 분석 + 배치 분석 이중 모드 |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 수작업 로그 분석은 대량 이벤트에서 이상 패턴 식별 불가. AI 자동 감지 필수 |
| WHO | 보안 관제 담당자, SRE 운영팀 |
| RISK | 오탐 과다 시 알림 피로, 미탐 시 보안 사고 미감지 |
| SUCCESS | 이상 탐지 정확도 90%+, 오탐률 5% 이하, 감지 지연 < 30초 |
| SCOPE | 로그 분석기, 통계적 이상치 탐지, LLM 이상 분류, 실시간 알림 |

---

## 기능 요구사항

| FR ID | 요구사항 | 우선순위 |
|-------|---------|---------|
| FR-ADV30.1 | 통계적 이상치 탐지 — Z-Score, IQR, 이동평균 편차 | P0 |
| FR-ADV30.2 | LLM 로그 분석 — 구조화되지 않은 로그에서 이상 패턴 추출 | P0 |
| FR-ADV30.3 | 실시간 스트리밍 — 이벤트 스트림 윈도우 기반 분석 | P1 |
| FR-ADV30.4 | 이상 분류 — 심각도 자동 분류 (critical/high/medium/low) | P0 |
| FR-ADV30.5 | 자동 알림 — 임계값 초과 시 알림 채널 전송 | P1 |
| FR-ADV30.6 | 학습 기준선 — 정상 패턴 자동 학습 + 기준선 갱신 | P1 |
| FR-ADV30.7 | 감사 로그 — 탐지 이벤트 전수 기록 (CSAP D-06) | P0 |

---

## 산출물

| 산출물 | 경로 |
|--------|------|
| anomaly-detector.ts | platform/services/ai-service/src/lib/anomaly-detector.ts |
| log-analyzer.ts | platform/services/ai-service/src/lib/log-analyzer.ts |
