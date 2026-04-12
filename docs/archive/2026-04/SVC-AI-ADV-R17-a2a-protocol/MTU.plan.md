# SVC-AI-ADV-R17: A2A Protocol (Agent-to-Agent 상호운용 프로토콜)

> 버전: 1.0.0 | 작성일: 2026-04-11 | 작성자: PM Lead

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 이기종 AI 에이전트 간 표준 통신 프로토콜 구현. Google A2A 프로토콜 기반 에이전트 협업 |
| 기술 | A2A JSON-RPC 2.0 + Agent Card Discovery + Task Lifecycle + SSE 스트리밍 |
| 보안 | CSAP D-08 에이전트 인증/인가, D-12 입력 검증, N2SF 등급별 에이전트 격리 |

---

## 기능 요구사항

| FR ID | 요구사항 | 우선순위 |
|-------|---------|---------|
| FR-ADV17.1 | Agent Card — /.well-known/agent.json 에이전트 능력 명세 공개 | P0 |
| FR-ADV17.2 | Task Lifecycle — 생성/실행/취소/완료 상태 관리 (JSON-RPC) | P0 |
| FR-ADV17.3 | SSE 스트리밍 — 장시간 태스크 진행 상황 실시간 전달 | P0 |
| FR-ADV17.4 | Artifact 교환 — 에이전트 간 결과물 (텍스트, 파일, 구조화 데이터) 전달 | P1 |
| FR-ADV17.5 | Push Notification — 태스크 완료/실패 비동기 알림 | P1 |
| FR-ADV17.6 | 에이전트 레지스트리 — 사용 가능 에이전트 목록 조회/검색 | P2 |

---

## 산출물

| 산출물 | 경로 |
|--------|------|
| a2a-protocol.ts | platform/services/ai-service/src/lib/a2a-protocol.ts |
