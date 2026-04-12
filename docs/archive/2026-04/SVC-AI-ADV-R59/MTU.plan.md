# SVC-AI-ADV-R59 — Semantic Firewall (의미 기반 프롬프트 인젝션 방어)

## Executive Summary (4-Perspective)

| 관점 | 내용 |
|------|------|
| **기술** | 임베딩·패턴·휴리스틱 3단 탐지기로 프롬프트 인젝션/탈옥/금칙 콘텐츠를 차단 |
| **보안** | CSAP D-12 입력 검증 + OWASP LLM01(Prompt Injection) 완화 |
| **규제** | N2SF AI-REQ-5 (Guardrails), 민감 데이터 누수 방지 |
| **운영** | 결정·차단·통과 전수 감사(`audit.jsonl`), 정책 핫리로드 |

## Context Anchor

- **WHY**: 외부 LLM 연동 시 공격자가 시스템 프롬프트를 우회·유출하는 시도를 런타임에 차단해야 한다.
- **WHO**: `ai-service` 모든 경로(RAG, Agent, Function Call)에서 사용자 입력 전처리에 삽입.
- **RISK**: 오탐(false-positive) 발생 시 정상 요청 차단 → 정책 허용 리스트와 신뢰 점수 병행.
- **SUCCESS**: OWASP LLM Top10 샘플 인젝션 70종 중 95% 차단 + 정상 프롬프트 오탐 < 2%.
- **SCOPE**: `platform/services/ai-service/src/lib/semantic-firewall.ts` 단일 모듈 + 테스트.

## 기능 요구사항

| ID | 요구사항 | 검증 |
|----|---------|------|
| FR-R59.1 | 프롬프트 인젝션 패턴 탐지 (룰 + 임베딩 유사도) | 테스트 케이스 15종 |
| FR-R59.2 | 민감 지시어/탈옥 프롬프트 차단 | "ignore previous", "system prompt" 등 |
| FR-R59.3 | 콘텐츠 분류(Toxic/PII/Secret) | 3-클래스 점수 반환 |
| FR-R59.4 | 정책 핫리로드(`reloadPolicy`) | 런타임 정책 교체 테스트 |
| FR-R59.5 | 결정 감사로그 `getAuditLog()` | CSAP D-06 |
| FR-R59.6 | N2SF C/S 등급 차단 | `BLOCKED` 예외 |

## 추적성 매트릭스

| FR | 모듈 함수 | 테스트 | CSAP |
|----|---------|--------|------|
| FR-R59.1 | `inspect()` | `injection-detect` | D-12 |
| FR-R59.2 | `detectJailbreak()` | `jailbreak-block` | D-12 |
| FR-R59.3 | `classifyContent()` | `content-classify` | D-06 |
| FR-R59.4 | `reloadPolicy()` | `policy-hotreload` | D-01 |
| FR-R59.5 | `getAuditLog()` | `audit-trail` | D-06 |
| FR-R59.6 | `enforceDataGrade()` | `n2sf-block` | N2SF N-05 |
