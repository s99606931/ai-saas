# SVC-AI-ADV-R89 — 온콜 에스컬레이션 라우터

> v1.0.0 | 2026-04-12 | PM Lead (5차 세션)

## Executive Summary
| 관점 | 목표 | 지표 |
|---|---|---|
| 비즈니스 | 장애 대응 MTTA 단축 | MTTA ≤ 5분 |
| 기술 | 심각도/도메인/피로도 기반 담당자 선택 | p95 < 3ms |
| 보안 | 알림 감사 | CSAP D-06 |
| 품질 | 응답 없음 시 에스컬레이션 체인 | 결정적 |

## Context Anchor
- **WHY**: 기존 `oncall-fatigue.ts`는 피로도 모니터링만. 실제 장애 발생 시 심각도·도메인·담당자 상태를 종합해 **우선 호출자 + 에스컬레이션 체인**을 결정해야 한다.
- **WHO**: SRE, 장애 대응팀
- **RISK**: 동일 담당자 반복 호출, 피로도 폭증, 우선순위 오류
- **SUCCESS**: MTTA 5분↓, 피로도 반영 정확도 90%↑
- **SCOPE**: IN — 담당자 등록/심각도 매핑/라우팅/응답없음 재시도 / OUT — 실제 알림 전송

## FR
| FR | 제목 | 산출물 |
|---|---|---|
| FR-R89.1 | 담당자 등록 (id/도메인/level/피로도) | oncall-escalation-router.ts |
| FR-R89.2 | 인시던트 라우팅 (도메인·레벨 매칭) | 동일 |
| FR-R89.3 | 응답없음 시 에스컬레이션 체인 (next level) | 동일 |
| FR-R89.4 | 피로도 감점 + 고피로 제외 | 동일 |
| FR-R89.5 | getAuditLog + ROUTE/ESCALATE/SKIPPED_FATIGUE | 동일 |

## 추적성
| FR | 산출물 | 테스트 | CSAP |
|---|---|---|---|
| R89.1~4 | oncall-escalation-router.ts | oncall-escalation-router.test.ts | - |
| R89.5 | 동일 | 동일 | D-06 |
