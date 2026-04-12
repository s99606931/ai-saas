# SVC-AI-ADV-R94 — 적응형 레이트 리미터 (Adaptive Rate Limiter)

> 작성일: 2026-04-12 | 작성자: PM Lead | 버전: 1.0.0

## Executive Summary

| 관점 | 내용 |
|------|------|
| 기능 | 트래픽 패턴 학습 기반 동적 임계값 조정 (EWMA + 적응형) |
| 품질 | 피크타임 자동 확장, 평시 자동 축소 |
| 보안 | 테넌트별 격리, DDoS 차단 |
| 비용 | 추가 비용 없음 (기존 rate-limiter 위 래퍼) |

## Context Anchor

- **WHY**: 고정 임계값은 공공기관 특성(월말/분기말 폭증) 대응 불가
- **WHO**: API Gateway, 각 서비스, 운영팀
- **RISK**: 폭증 시 정상 요청 차단 → EWMA 기반 점진 조정
- **SUCCESS**: 테넌트별 동적 한도 + 초과 시 우선순위 기반 제어
- **SCOPE**: 어댑티브 로직 단일 모듈 (기존 ai-rate-limiter와 독립)

## 요구사항

- **FR-R94.1**: EWMA(지수가중이동평균)로 기준 트래픽 학습
- **FR-R94.2**: 현재 트래픽 / 기준 비율로 임계값 동적 조정
- **FR-R94.3**: 테넌트별 격리 버킷
- **FR-R94.4**: decide(request) → ALLOW/THROTTLE/DENY
- **FR-R94.5**: 감사 로그 + 메트릭 방출
- **NFR-R94.1**: decide 호출 1ms 이내
- **NFR-R94.2**: 테스트 5개+
