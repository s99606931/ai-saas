# SVC-AI-ADV-R17: A2A Protocol DESIGN

> 버전: 1.0.0 | 작성일: 2026-04-11 | 작성자: PM Lead (Opus)

## 아키텍처 선택: Option B — Pragmatic Balance

Google A2A 프로토콜 사양 기반 + MCP 보완 + 공공기관 보안 적용

---

## Design Anchor

- **WHY**: 이기종 AI 에이전트 간 표준 통신으로 멀티에이전트 생태계 구축
- **HOW**: JSON-RPC 2.0 + Agent Card 검색 + Task 생명주기 관리
- **CONSTRAINT**: CSAP D-08 에이전트 인증, N2SF 등급별 격리

---

## §1 Agent Card (FR-ADV17.1)

`/.well-known/agent.json` 엔드포인트:
- name, description, version
- capabilities: 지원하는 입/출력 형식 (text, file, structured)
- skills: 수행 가능한 작업 목록
- authentication: 필요한 인증 방식
- endpoint: A2A JSON-RPC 엔드포인트 URL

## §2 Task Lifecycle (FR-ADV17.2)

상태 머신: submitted -> working -> input-required -> completed | failed | canceled
JSON-RPC 메서드:
- tasks/send: 태스크 제출 (동기)
- tasks/sendSubscribe: 태스크 제출 + SSE 구독 (비동기)
- tasks/get: 태스크 상태 조회
- tasks/cancel: 태스크 취소

## §3 SSE 스트리밍 (FR-ADV17.3)

이벤트 타입: TaskStatusUpdateEvent, TaskArtifactUpdateEvent
Content-Type: text/event-stream

## §4 Artifact 교환 (FR-ADV17.4)

Artifact 구조: name, type (text/file/data), mimeType, content
Part 분할: 대용량 결과물 청크 단위 전송

## §5 Push Notification (FR-ADV17.5)

웹훅 기반 비동기 알림. 태스크 등록 시 callbackUrl 지정.

## §6 에이전트 레지스트리 (FR-ADV17.6)

로컬 레지스트리: 등록된 에이전트 목록 관리 + 스킬 기반 검색
