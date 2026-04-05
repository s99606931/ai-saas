# AI 모듈 PRD — MTU-A1 AI 보안 게이트웨이 + MTU-A2 LM Studio 연동

> **Phase**: Phase 4 Advanced (AI 모듈 선행 분석)
> **작성일**: 2026-04-05
> **상태**: Draft
> **작성자**: PM Lead Agent
> **대상 MTU**: MTU-A1 (AI 보안 게이트웨이 + MCP), MTU-A2 (LM Studio 연동 가이드)

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| **문제** | 공공기관이 생성형 AI를 업무에 활용하려면 N2SF 데이터 등급별 접근 통제가 필수이나, C/S등급 데이터의 외부 AI API 전송을 자동으로 차단하는 표준 패턴이 부재 |
| **솔루션** | N2SF 등급 기반 AI 라우팅 게이트웨이 (C/S→LM Studio 온프레미스, O→Claude API) + MCP 표준 통합 패턴 제공 |
| **기능/UX 효과** | 데이터 등급 자동 분류 → AI 라우팅 자동 결정 → PII 자동 마스킹 → 감사 로그 자동 기록 |
| **핵심 가치** | 공공기관 AI 활용의 보안 민주화 — N2SF 준수하면서 AI 생산성 확보 |

---

## 1. Context Anchor

### WHY (왜 지금 해야 하는가)

1. **공공부문 AI 도입 가속화**: 디지털플랫폼정부위원회 "공공부문 초거대 AI 도입/활용 가이드라인 2.0" (2025년 4월 배포)
   - N2SF 데이터 보안등급 분류 및 보안 통제 항목 추가 반영
   - 범정부 공통기반 활용 권장
2. **국정원 AI 보안 가이드라인** (2025년 12월 발표):
   - 공공기관 생성형 AI 활용 보안 원칙 공식화
   - "무엇을 입력하지 말고, 어떤 설정을 확인하며, 어떤 통제로 감싸야 하는가"
   - C/S등급 데이터의 외부 AI API 전송 명시적 금지
3. **N2SF 실증 사업**: 공공기관 업무PC에서 ChatGPT 등 AI 서비스 사용 가능하도록 N2SF 기반 실증 공모 착수 (2026년 3월)
4. **MCP 표준화**: Linux Foundation 표준, 2026년 월간 SDK 다운로드 9,700만 — AI 도구 연동 사실상 표준

### WHO (이해관계자)

| 역할 | 관심사 | 영향도 |
|------|--------|--------|
| 공공기관 AI 담당자 | N2SF 준수하면서 AI 활용 | 매우 높음 |
| 보안 담당자 | C/S등급 데이터 외부 전송 차단 | 매우 높음 |
| 개발자 | AI API 연동 코드 패턴, MCP 통합 | 높음 |
| 감리관 | AI 관련 보안 증적, 감사 로그 | 높음 |
| 국정원 감독관 | N2SF N05 데이터 영역 준수 여부 | 매우 높음 |

### RISK (위험 요소)

| ID | 위험 | 영향도 | 대응 방안 |
|----|------|--------|----------|
| R-AI-01 | LM Studio 모델 품질이 Claude/GPT-4 대비 낮음 | 중간 | C/S등급은 정확도보다 보안 우선, 모델 선택 가이드 제공 |
| R-AI-02 | host.docker.internal 네트워크 제한 (WSL2 환경) | 중간 | 사전 네트워크 테스트 절차, 대체 IP 설정 가이드 |
| R-AI-03 | PII 마스킹 불완전 (새로운 PII 패턴 미탐지) | 높음 | 정규식 + NER 하이브리드 마스킹, 주기적 패턴 업데이트 |
| R-AI-04 | MCP 프로토콜 공공기관 적용 전례 부족 | 중간 | MCP 서버 최소 구현 예시 + 보안 감사 후 점진적 확대 |
| R-AI-05 | N2SF 데이터 등급 자동 분류 오류 | 높음 | 분류 결과 human-in-the-loop 확인 단계, 감사 로그 전수 기록 |

### SUCCESS (성공 기준)

| ID | 기준 | 측정 방법 |
|----|------|----------|
| SC-AI-01 | C/S등급 데이터 외부 AI API 전송 100% 차단 | 시뮬레이션 테스트 (C등급 프롬프트 → Claude API 전송 시도 → 차단 확인) |
| SC-AI-02 | O등급 PII 마스킹 후 전송 | 마스킹 전/후 비교, PII 패턴 0건 확인 |
| SC-AI-03 | LM Studio WSL2 연동 동작 | host.docker.internal:1234 응답 확인 |
| SC-AI-04 | MCP 서버 예시 동작 | Python/TypeScript MCP 서버 실행 + 도구 호출 성공 |
| SC-AI-05 | 감사 로그 전수 기록 | 모든 AI API 호출 audit.jsonl에 기록 확인 |

### SCOPE (범위)

| 구분 | 포함 | 미포함 |
|------|------|--------|
| In Scope | AI 보안 게이트웨이 설계, N2SF 등급 라우팅, PII 마스킹, MCP 통합 패턴, LM Studio 설치/설정/연동 가이드 | AI 모델 파인튜닝, RAG 구현, 프롬프트 엔지니어링 가이드, 모델 학습 |

---

## 2. MTU별 상세 분석

### MTU-A1: AI 보안 게이트웨이 + MCP 통합

| 항목 | 내용 |
|------|------|
| 의존 | MTU-C4 (완료), MTU-C5 (미완료), MTU-I1 (완료) |
| 복잡도 | HIGH (AI 보안 + MCP 프로토콜 + N2SF 연동) |
| 산출물 | security-gateway-pattern.md, data-classification-masking.md, mcp-integration-guide.md |
| 예상 세션 | 2 세션 |
| 차단 대상 | MTU-A2 (LM Studio 연동) |

**핵심 아키텍처 — N2SF 등급 기반 AI 라우팅**:

```
사용자 AI 요청
    |
    v
[N2SF 데이터 등급 분류기] --- MTU-C4 classifyData()
    |
    +--- C/S 등급 ---> [LM Studio (온프레미스)]
    |                    host.docker.internal:1234
    |                    OpenAI 호환 API
    |                    데이터 외부 전송 없음
    |
    +--- O 등급 -----> [PII 마스킹] ---> [Claude API]
    |                    maskPII()        api.anthropic.com
    |                    주민번호, 카드번호,
    |                    이름, 연락처 마스킹
    |
    +--- 미분류 -----> [차단] + 관리자 알림
    |
    v
[감사 로그] --- audit.jsonl (모든 AI 호출 전수 기록)
```

**국정원 AI 보안 가이드라인 준수 매핑**:

| 가이드라인 항목 | 구현 방법 | MTU |
|--------------|---------|-----|
| 입력 데이터 통제 | N2SF 등급 분류 → C/S 차단 | A1 |
| 설정 확인 | LM Studio 서버 설정 검증 스크립트 | A2 |
| 보안 통제 | AI 게이트웨이 + NetworkPolicy | A1, I4 |
| 감사 추적 | audit.jsonl 전수 기록 | A1 |

**MCP 통합 패턴**:

| MCP 구성 요소 | 역할 | 보안 통제 |
|-------------|------|---------|
| MCP Server | 공공 데이터 조회 Tool 제공 | N2SF 등급 자동 분류 훅 |
| MCP Client | AI 모델 → Tool 호출 | 감사 로그 자동 기록 |
| Transport | stdio/SSE | 내부 네트워크만 허용 |
| Tool 정의 | 공공 DB 조회, 문서 검색 | 응답 PII 필터링 |

---

### MTU-A2: LM Studio 연동 가이드

| 항목 | 내용 |
|------|------|
| 의존 | MTU-A1 (미완료) |
| 복잡도 | MED (설치/설정 가이드 + 클라이언트 코드 예시) |
| 산출물 | lmstudio-guide.md, lmstudio-client-examples.md |
| 예상 세션 | 1 세션 |

**LM Studio 선택 근거** (온프레미스 LLM):

| 비교 항목 | LM Studio | vLLM/Ollama | 판정 |
|---------|----------|------------|------|
| 설치 용이성 | Windows GUI 설치 | 커맨드라인 설치 | LM Studio 우위 |
| GPU 필요 여부 | CPU 전용 가능 (느리지만 동작) | GPU 권장 | LM Studio 유연 |
| API 호환성 | OpenAI SDK 100% 호환 | OpenAI 호환 (부분) | LM Studio 우위 |
| 모델 관리 | GUI에서 GGUF 모델 검색/다운로드/관리 | CLI 관리 | LM Studio 편의성 |
| WSL2 연동 | host.docker.internal:1234 | 동일 | 동등 |
| 공공기관 적합성 | 폐쇄망 오프라인 모델 로드 가능 | 동일 | 동등 |

**지원 모델 및 공공기관 추천**:

| 우선순위 | 모델 | 파라미터 | 용도 | 최소 VRAM | 한국어 |
|---------|------|---------|------|---------|-------|
| 1 | Llama 3.1 8B Instruct | 8B | 범용 질의응답 | 8GB | 보통 |
| 2 | Gemma 2 9B | 9B | 한국어 지원 개선 | 10GB | 양호 |
| 3 | Phi-3 Mini 3.8B | 3.8B | 경량 추론 (저사양 PC) | 4GB | 제한적 |
| 4 | DeepSeek Coder 6.7B | 6.7B | 코드 생성 | 8GB | 제한적 |

---

## 3. 우선순위 매트릭스

| MTU | 영향도 (1~5) | 긴급도 (1~5) | 난이도 (1~5) | 총점 | 착수 가능 | 선행 조건 |
|-----|-------------|-------------|-------------|------|----------|----------|
| **MTU-A1** | 5 (AI 보안 핵심) | 4 (A2 차단) | 5 (복합 보안) | **14** | C5 완료 후 | C4(완료), C5(미완료), I1(완료) |
| **MTU-A2** | 4 (온프레미스 LLM) | 3 (A1 의존) | 3 (설치 가이드) | **10** | A1 후 | A1(미완료) |

---

## 4. 착수 일정 (Phase 4 내 AI 모듈 위치)

```
Phase 2 잔여: MTU-C5 ─────────┐
                               │
Phase 3:      MTU-I2, I4 ─────┤
                               │
Phase 4 착수: ─────────────────┘
  MTU-A1 (AI 게이트웨이) ──── MTU-A2 (LM Studio)
```

**착수 전제 조건**:
1. MTU-C4 N2SF 매핑 완료 (완료)
2. MTU-C5 N2SF 6영역 통제 완료 (미완료 — Phase 2 잔여)
3. MTU-I1 k3s 클러스터 구성 완료 (완료)

**예상 착수 시점**: Phase 2 잔여(C5) + Phase 3 초기(I2, I4) 완료 후

---

## 5. 규제 준수 매트릭스

| 규제 | 항목 | MTU | 구현 방법 |
|------|------|-----|---------|
| N2SF | N05 데이터 영역 | A1 | 등급 분류 → AI 라우팅 자동 결정 |
| N2SF | N03 격리 영역 | A1, I4 | C/S등급 네임스페이스 외부 차단 |
| CSAP | D08 접근 통제 | A1 | AI API 인증 + RBAC |
| CSAP | D09 암호화 | A1 | TLS 1.3+ AI API 통신 |
| CSAP | D06 감사 로그 | A1 | 모든 AI 호출 audit.jsonl 기록 |
| 국정원 | AI 보안 가이드라인 | A1, A2 | 입력 통제, 설정 확인, 보안 통제 3원칙 |
| 디지털플랫폼정부 | AI 도입 가이드라인 2.0 | A1, A2 | N2SF 등급 분류, 범정부 공통기반 활용 |

---

## 6. 추적성 매트릭스

| FR ID | MTU | CSAP | N2SF | 국정원 AI | 산출물 |
|-------|-----|------|------|---------|--------|
| FR-6.1 | A1 | D08, D09 | N05 | 입력 통제 | security-gateway-pattern.md |
| FR-6.2 | A1 | D06 | N05 | 보안 통제 | data-classification-masking.md |
| AI-REQ-2 | A1 | - | - | - | mcp-integration-guide.md |
| FR-6.3-new | A2 | - | N03 | 설정 확인 | lmstudio-guide.md |
| AI-REQ-3 | A2 | - | N05 | - | lmstudio-client-examples.md |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 최초 작성 — AI 모듈 MTU-A1, A2 PRD | PM Lead Agent |
