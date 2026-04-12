# MTU Plan — SVC-AI-ADV-R161 Prompt Version Registry

> **원 요청 번호**: R161
> **모듈**: `platform/services/ai-service/src/lib/prompt-version-registry.ts`

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 프롬프트 배포/롤백 중앙 관리로 A/B 테스트 + 회귀 대응 |
| 기술 | 프롬프트 이름별 버전 레지스트리, active 포인터, 롤백 |
| 보안 | 변경 이력 전수 감사, C/S 차단 |
| 규제 | CSAP D-06 감사, 행안부 AI 거버넌스 |

## Context Anchor

- WHY: 프롬프트 변경 시 응답 품질 급변 → 롤백 가능한 거버넌스 필요
- WHO: AI 운영팀, 변경관리 위원회
- RISK: 기록 없는 프롬프트 변경 → 감리 지적
- SUCCESS: 등록/활성화/롤백/조회 API, 전 변경 감사 기록
- SCOPE: register / activate / rollback / getActive

## FR

| ID | 설명 |
|----|------|
| FR-R161.1 | register(name, version, template, author): 새 버전 등록 |
| FR-R161.2 | 중복 버전 등록 → duplicate_version |
| FR-R161.3 | activate(name, version): active 포인터 이동 |
| FR-R161.4 | 존재하지 않는 버전 활성화 → version_not_found |
| FR-R161.5 | rollback(name): 직전 active 버전으로 복귀 |
| FR-R161.6 | getActive(name): 현재 활성 프롬프트 반환 |
| FR-R161.7 | listVersions(name): 모든 버전 목록 |
| FR-R161.8 | C/S 차단, getAuditLog() |

## 테스트 케이스

- register 후 listVersions 반영
- 중복 등록 차단
- activate 후 getActive 반환값 확인
- 존재하지 않는 버전 활성화 차단
- rollback: 이전 active 로 복귀
- rollback 이력 없음 → no_previous_active
- C/S 차단
- 감사 로그 전 변경 기록
