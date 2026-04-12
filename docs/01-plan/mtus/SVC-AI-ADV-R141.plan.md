# MTU Plan — SVC-AI-ADV-R141 Citizen Journey Orchestrator

> **원 요청 번호**: R141
> **모듈**: `platform/services/ai-service/src/lib/citizen-journey-orchestrator.ts`

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 민원인 여정(접수→심사→처리→통보) 전 과정 자동 오케스트레이션 |
| 기술 | 단계 상태 관리 + SLA 타이머 + 이상 상태 탐지 + 다음 단계 라우팅 |
| 보안 | 민원인 식별자 해시. O등급 상태 메트릭만 AI 노출 |
| 규제 | 민원사무처리에 관한 법률, 행안부 민원처리기준 |

## Context Anchor

- WHY: 기존 민원 관련 모듈(`complaint-priority-engine` 등) 은 단일 단계. 여정 전체 관리 공백
- WHO: 민원 담당 공무원, 콜센터
- RISK: SLA 초과 시 행정 처분 대상
- SUCCESS: 단계 지연 자동 감지율 95%+
- SCOPE: 단계 정의→실행→지연 감지→알림 트리거

## FR

| ID | 설명 |
|----|------|
| FR-R141.1 | 여정 단계 정의 등록 |
| FR-R141.2 | 민원인 여정 인스턴스 생성/진행 |
| FR-R141.3 | SLA 타이머 체크 및 지연 단계 식별 |
| FR-R141.4 | 다음 단계 전이 (조건부 라우팅) |
| FR-R141.5 | 감사 로그 `getAuditLog()` |
| FR-R141.6 | C/S등급 차단 |
