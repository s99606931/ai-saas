# MTU-A1: AI 보안 게이트웨이 + MCP 통합 — 설계 문서

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-A1 |
| Phase | Phase 4 Advanced |
| 문서 유형 | Design |
| 버전 | 1.0.0 |
| 작성일 | 2026-04-05 |
| Plan 참조 | `docs/01-plan/mtus/MTU-A1-ai-gateway-mcp.plan.md` |
| FR 매핑 | FR-6.1, FR-6.2, AI-REQ-2 |

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| WHY | 공공기관 AI 활용 시 C/S등급 데이터 유출 방지 필수 — N2SF N-05 위반 시 CSAP 인증 취소 |
| WHO | 개발자 (게이트웨이 구현), 보안 아키텍트 (정책 설계), AI 팀 (MCP 통합) |
| RISK | C/S등급 데이터 외부 AI API 전송 → 법적 제재 + CSAP 인증 취소 |
| SUCCESS | C/S등급 100% 차단 + MCP 표준 통합 + audit.jsonl 전수 기록 |

---

## 1. 아키텍처 옵션 평가

### Option A: 클라이언트 측 필터링
- 장점: 구현 단순
- 단점: 우회 가능, 중앙 통제 불가

### Option B: 서버 측 게이트웨이 (선택)
- 장점: 중앙 통제, 감사 로그 일원화, N2SF 등급 분류 자동화
- 단점: 단일 장애점 위험 (HA 구성 필요)
- **선택 근거**: CSAP D-08 접근 통제 + N2SF N-05 데이터 관리 동시 충족

### Option C: 프록시 체인
- 장점: 기존 인프라 활용
- 단점: MCP 통합 어려움

**최종 선택: Option B (서버 측 게이트웨이)**

---

## 2. 보안 게이트웨이 결정 트리

```
요청 수신 (사용자 또는 시스템)
  |
  v
[1단계] 데이터 등급 분류 (classifyData)
  |
  +-- C등급 (기밀) --> 차단: 외부 AI API 전송 금지
  |                     --> 라우팅: LM Studio (host.docker.internal:1234)
  |
  +-- S등급 (민감) --> 차단: 외부 AI API 전송 금지
  |                     --> 라우팅: LM Studio (host.docker.internal:1234)
  |
  +-- O등급 (공개) --> [2단계] PII 마스킹 (maskPII)
                        |
                        v
                   [3단계] Claude API 전송
                        |
                        v
                   [4단계] 응답 수신 → audit.jsonl 기록
```

---

## 3. 산출물 구조

| 파일 | 문서 유형 | 핵심 내용 |
|------|---------|---------|
| `06-ai-integration/security-gateway-pattern.md` | 아키텍처 레퍼런스 | 결정 트리 + 라우팅 로직 + TypeScript 패턴 |
| `06-ai-integration/data-classification-masking.md` | 구현 가이드 | classifyData + maskPII 함수 + 정규식 |
| `06-ai-integration/mcp-integration-guide.md` | 구현 가이드 | MCP 서버 구성 + 공공시스템 Tool 정의 |

---

## 4. MCP 통합 아키텍처

```
공공시스템 DB ──────────────────────────────────┐
                                                │
MCP Server (공공 SaaS 프레임워크)                  │
  ├── Tool: query_public_data (O등급 조회)        │
  ├── Tool: audit_log_search (감사 로그 검색)      │
  ├── Resource: csap_checklist (79항목 현황)       │
  └── Middleware: N2SF Grade Filter               │
       ├── C/S등급 → LM Studio 라우팅             │
       └── O등급 → Claude API (PII 마스킹 후)      │
```

---

## 5. Design Anchor

- Plan SC: FR-6.1 (AI 보안 게이트웨이)
- Plan SC: FR-6.2 (N2SF 데이터 마스킹)
- Plan SC: AI-REQ-2 (MCP 통합)
- Design Ref: CLAUDE.md 절대 제약 5번 (C/S등급 AI API 전송 금지)

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 최초 작성 — Option B 서버 측 게이트웨이 선택 | Claude Code |
