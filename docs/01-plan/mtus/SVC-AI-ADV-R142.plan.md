# MTU Plan — SVC-AI-ADV-R142 AI Model Health Monitor

> **원 요청 번호**: R142
> **모듈**: `platform/services/ai-service/src/lib/ai-model-health-monitor.ts`

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 배포된 AI 모델 드리프트/정확도 실시간 모니터링으로 품질 저하 선제 대응 |
| 기술 | 롤링 윈도우 정확도·레이턴시·드리프트 지표 계산, 임계값 기반 경고 |
| 보안 | 모델 메타데이터 + 집계 메트릭만. 입출력 원문 미전송 |
| 규제 | 행안부 AI 시스템 감리 가이드, CSAP 변경관리 |

## Context Anchor

- WHY: 기존 `embedding-drift-monitor`, `rca-engine-v2` 와 구분되는 배포 후 모델 단위 헬스 집계
- WHO: MLOps, 운영 SRE
- RISK: 드리프트 방치 시 오판 결과 확산
- SUCCESS: 드리프트 탐지 지연 < 10분
- SCOPE: 메트릭 수집→롤링 집계→상태 판정→경고 목록

## FR

| ID | 설명 |
|----|------|
| FR-R142.1 | 모델 추론 메트릭 기록(latency, correct, confidence) |
| FR-R142.2 | 롤링 윈도우 정확도 계산 |
| FR-R142.3 | 드리프트 스코어 계산 (baseline 대비 편차) |
| FR-R142.4 | 상태 판정 (HEALTHY/DEGRADED/CRITICAL) |
| FR-R142.5 | 감사 로그 |
| FR-R142.6 | C/S등급 차단 |
