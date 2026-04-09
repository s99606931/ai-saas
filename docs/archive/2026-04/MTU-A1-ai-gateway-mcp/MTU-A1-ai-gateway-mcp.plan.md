# MTU-A1: AI 보안 게이트웨이 + MCP 통합 [신규]

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-A1 |
| Phase | Phase 4 Advanced |
| 상태 | Draft |
| 작성일 | 2026-04-05 |
| FR 매핑 | FR-6.1, FR-6.2, FR-6.3, AI-REQ-2 |
| 의존 MTU | MTU-C4 (N2SF 매핑), MTU-C5 (N2SF 영역), MTU-I1 (k3s 클러스터 구성) |
| 예상 세션 | 2 세션 |
| 중요도 | P0 |

---

## 목적

N2SF 데이터 등급 분류 기반으로 AI API 접근을 자동 제어하고,
MCP 프로토콜을 통한 표준화된 AI 도구 통합 패턴을 제공합니다.

**시장조사 반영**:
- MCP: Linux Foundation 표준, 2026년 월간 SDK 다운로드 9,700만
- 하이브리드 모델 전략: C/S등급 → **LM Studio** (온프레미스), O등급 → Claude API
- LM Studio: Windows 호스트 실행, OpenAI 호환 API (`host.docker.internal:1234`), GGUF 모델 지원
- N2SF MLS 2026년 도입 → 공개망에서도 LLM 활용 가능한 아키텍처 설계 필요

---

## 산출물 파일 (4개)

| 파일 | 문서 유형 | 핵심 내용 |
|------|---------|---------|
| `09-ai-integration/security-gateway-pattern.md` | 아키텍처 레퍼런스형 | N2SF 등급 → AI API 허용/차단 결정 트리 |
| `09-ai-integration/data-classification-masking.md` | 구현 가이드형 | C/S등급 차단, O등급 PII 마스킹 |
| `09-ai-integration/mcp-integration-guide.md` | 구현 가이드형 | MCP 서버 구성 + 공공시스템 연동 |

> **참고**: LM Studio 연동 가이드는 **MTU-A2** (`lmstudio-guide.md`, `lmstudio-client-examples.md`)에서 전담 관리합니다.

---

## AI 보안 게이트웨이 결정 트리

```
요청 수신
  → [N2SF 등급 분류]
  ├── C등급 (기밀): 외부 AI API 전송 금지 → LM Studio (온프레미스) 라우팅
  ├── S등급 (민감): 외부 AI API 전송 금지 → LM Studio (온프레미스) 라우팅
  └── O등급 (공개): PII 마스킹 → Claude API / GPT-4 API
```

---

## MCP 통합 패턴

```
공공시스템 DB → MCP Server (감사로그 포함)
                  → Claude API (O등급만)
                  → LM Studio (C/S등급)
```

MCP 서버 구성:
- 공공 데이터 조회 Tool
- 감사 로그 자동 기록
- N2SF 등급 자동 분류 훅
- 응답 PII 필터링

---

## 기능 요구사항

| ID | 요구사항 | 수용 기준 |
|----|---------|---------|
| FR-6.1 | AI API 보안 게이트웨이 | C/S등급 100% 차단 확인 |
| FR-6.2 | N2SF 기반 데이터 마스킹 | O등급 PII 마스킹 후 전송 |
| AI-REQ-2 | MCP 통합 패턴 | MCP 서버 구성 예시 코드 동작 |
| FR-6.3-new | LM Studio 연동 가이드 | LM Studio 설정 + WSL2 API 연동 예시 |

---

## 합격 기준

1. N2SF C/S등급 데이터 AI API 전송 시 100% 차단 (시뮬레이션 확인)
2. MCP 서버 구성 예시 코드 Python/TypeScript 중 1개 이상 완비
3. LM Studio API 연동 예시 — `host.docker.internal:1234` OpenAI 호환 엔드포인트 동작 확인
4. 모든 AI API 호출 audit.jsonl 자동 기록
5. N2SF-N05 (데이터 영역) 통제 100% 충족

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 0.1.0 | 2026-04-05 | 최초 작성 — MCP + 온프레미스 LLM 추가 | Claude Code |
| 0.2.0 | 2026-04-05 | LM Studio 적용 — Llama 직접 배포 → LM Studio Windows 호스트 방식으로 변경 | Claude Code |
| 0.3.0 | 2026-04-05 | P1: lmstudio-guide.md → MTU-A2 전담 분리 (산출물 테이블에서 제거 + 참조 주석 추가), MTU-I1 의존성 추가 | Claude Code |
