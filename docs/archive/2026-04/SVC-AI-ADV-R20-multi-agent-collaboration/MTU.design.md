# SVC-AI-ADV-R20: Multi-Agent Collaboration DESIGN

> 버전: 1.0.0 | 작성일: 2026-04-11 | 작성자: PM Lead (Opus)

## 아키텍처 선택: Option B — Pragmatic Balance

Supervisor-Worker 패턴 + DAG 기반 실행 + 공유 메모리 블랙보드

---

## Design Anchor

- **WHY**: 복잡한 공공 업무를 전문 에이전트 분업으로 고품질 처리
- **HOW**: Supervisor가 작업 분해 → Worker 할당 → 결과 통합 → 합의
- **CONSTRAINT**: CSAP D-08 에이전트별 권한 분리, N2SF 등급별 격리

---

## §1 Supervisor 에이전트 (FR-ADV20.1)

역할: 사용자 요청 → 하위 작업 분해 → Worker 선택 → 결과 병합
작업 분해: LLM 기반 계획 수립 (agent-planner.ts 연동)
결과 병합: 순차/병렬 결과를 최종 응답으로 합성

## §2 Worker 에이전트 풀 (FR-ADV20.2)

AgentProfile: id, name, skills[], model, maxConcurrency, priority
풀 관리: 등록/해제, 사용량 추적, 부하 분산

## §3 공유 메모리 (Blackboard) (FR-ADV20.3)

SharedMemory: key-value 스토어 (에이전트 ID별 접근 제어)
엔트리: key, value, owner, readers[], createdAt, expiresAt
동시성: 낙관적 잠금 (version 필드)

## §4 에이전트 그래프 (FR-ADV20.4)

DAG 노드: agentId, inputs[], outputs[], condition?
실행 엔진: 의존성 해결 → 병렬 실행 가능 노드 동시 실행
조건부 분기: 이전 노드 결과에 따른 동적 라우팅

## §5 합의 프로토콜 (FR-ADV20.5)

- 다수결: 동일 질문에 N개 에이전트 응답 → 가장 많은 동의
- 가중 투표: 전문 영역 에이전트에 높은 가중치
- 토론: 에이전트 간 반론 → 수정 → 재투표 (최대 3라운드)
