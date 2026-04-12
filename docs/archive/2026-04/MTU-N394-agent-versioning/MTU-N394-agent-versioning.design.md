# MTU-N394-agent-versioning — Design

## Executive Summary

| 관점 | 결정 | 근거 |
|------|------|------|
| 아키텍처 | Single lib module + service class | 테스트 용이, tenantId 기반 격리 |
| 보안 | CSAP D-12 준수 | 감사 로그 append-only |
| 운영 | In-memory + 감사 로그 영속화 | 최소 의존성 |
| 추적성 | FR-N394.1~5 ↔ 테스트 ↔ CSAP 매핑 | Q-Gate G1~G7 통과 |

## Context Anchor
- **WHY**: 에이전트 버저닝/롤백 기능 확보 (공공 SaaS 프레임워크 필수)
- **WHO**: 테넌트 관리자, 운영자, 감사관
- **RISK**: 다중 테넌트 격리 실패, 감사 로그 누락
- **SUCCESS**: 전 테스트 PASS + matchRate 100%
- **SCOPE**: lib/agent-versioning.ts + vitest 테스트 (4~8건)

## 아키텍처 옵션 (Pragmatic Balance 선택)
1. 순수 in-memory (선택): 단순/고성능/테스트 가능
2. Redis 기반: 분산 필요 시 Phase 2에서 전환
3. DB 영속화: 장기 감사 추적 시 Phase 3

## 데이터 모델
`src/lib/agent-versioning.ts` 참조 — FR-N394.1~5 대응 interface 정의

## 보안 / 규제
- CSAP: D-12
- N2SF: O등급 데이터만 AI API 전송, C/S 등급 마스킹 필수
- 감사 로그: 모든 상태 변화 append-only 기록

## 변경 이력
| 버전 | 일자 | 내용 |
|------|------|------|
| 1.0 | 2026-04-11 | 최초 작성 (PM 자율 모드) |
