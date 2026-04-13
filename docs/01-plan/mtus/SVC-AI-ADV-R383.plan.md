# SVC-AI-ADV-R383 Plan: AI기반 클라우드 네이티브 마이그레이션 어드바이저

## Context Anchor
- **WHY**: 레거시 시스템의 클라우드 네이티브 전환 경로 자동 제안
- **WHO**: 아키텍처팀, 인프라팀
- **RISK**: 잘못된 마이그레이션 전략으로 서비스 중단 가능
- **SUCCESS**: SC-R383-1 마이그레이션 복잡도 점수, SC-R383-2 전략 추천
- **SCOPE**: 애플리케이션 등록, 의존성 분석, 마이그레이션 전략 추천

## 요구사항
- FR-R383.1: 애플리케이션 등록 (id, name, techStack, dependencyCount)
- FR-R383.2: 마이그레이션 복잡도 점수 계산
- FR-R383.3: 마이그레이션 전략 추천 (lift-and-shift/replatform/refactor)
- FR-R383.4: 복잡도 상위 애플리케이션 목록 반환
- NFR-R383.1: C/S 등급 데이터 전송 금지 (N2SF N-05)
- NFR-R383.2: 모든 작업 감사 로그 기록
