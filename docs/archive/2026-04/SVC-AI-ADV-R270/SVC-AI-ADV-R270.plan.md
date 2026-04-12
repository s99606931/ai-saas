# SVC-AI-ADV-R270 — 보안 이벤트 상관분석 v2

> 작성일: 2026-04-13 | 버전: 1.0.0

## Executive Summary

| 관점 | 내용 |
|------|------|
| 기능 | 이벤트 스트림 시간·출처 기반 상관관계 분석 v2 |
| 품질 | 시간 윈도우 그룹화, 소스 IP 연계, 위협 패턴 매칭 |
| 보안 | C/S 차단, 감사 로그, CSAP D-06 |
| 비용 | 인메모리 상관분석 |

## Context Anchor

- **WHY**: 개별 알림은 약신호지만 연계 시 공격 패턴
- **WHO**: SOC, 보안 모니터링
- **RISK**: 오탐 증가 → 임계값 검증
- **SUCCESS**: 이벤트 수집 → 윈도우 그룹 → 패턴 매칭 → 경보
- **SCOPE**: In — 분석·등급. Out — 자동 차단.

## 요구사항

- **FR-R270.1**: 보안 이벤트 수집 (타임스탬프, 소스IP, 타입)
- **FR-R270.2**: 시간 윈도우 기반 그룹화
- **FR-R270.3**: 위협 패턴 매칭 (brute force, scanning, privilege escalation)
- **FR-R270.4**: 위협 등급 산출 (LOW/MED/HIGH/CRITICAL)
- **FR-R270.5**: N2SF guard, IP 마스킹, 감사 로그
- **NFR-R270.1**: TS strict, 테스트 10개+
