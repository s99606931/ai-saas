# 공공기관 SaaS 프레임워크 — 마스터 로드맵

> **기준**: 2026-04-05 시장조사 결과 반영
> **방법론**: 최소 테스트 단위(MTU) 분해 + PDCA 사이클 적용
> **참조**: `docs/00-pm/market-research-2026-04.md`

---

## Executive Summary

| 항목 | 내용 |
|------|------|
| 총 MTU 수 | 35개 (Phase 1~5) |
| 총 산출물 파일 | 73개 (기존 54개 + 신규 19개) |
| 구현 기간 | 12개월 (4 Phase, Phase 5는 별도) |
| 신규 추가 모듈 | 7개 (ISMS-P, Policy as Code, SBOM, OSCAL, 멀티테넌시, 프레임워크 업그레이드, ISMS-P 2027) |
| MTU 평균 파일 수 | 2~5개 |
| MTU 평균 완료 기간 | 1~2 세션 |

---

## MTU 정의 원칙

**최소 테스트 단위(MTU)**란 다음 조건을 충족하는 최소 작업 단위입니다:

1. **독립 구현**: 의존 MTU 완료 시 단독으로 구현 가능
2. **즉시 검증**: 명확한 합격/불합격 기준 (수치 또는 실행 결과)
3. **1~2 세션**: 한 번의 Claude Code 세션(~4시간)으로 완료 가능
4. **단일 책임**: 하나의 관심사(CSAP 분야, 문서 유형 등) 집중
5. **감리 연결**: 최소 1개 FR/CSAP 항목에 직접 매핑

---

## 전체 MTU 목록

### Phase 1: Foundation (M1~M2) — 6 MTUs

| ID | MTU명 | 파일 수 | 의존 MTU | 검증 기준 |
|----|-------|---------|---------|---------|
| **MTU-F1** | Getting Started 레이어 | 3 | 없음 | 신규 사용자 15분 내 방향 파악 |
| **MTU-F2** | 참조 기반 레이어 | 2 | 없음 | CSAP/N2SF 법령 인덱스 완비 |
| **MTU-F3** | 개발 표준 가이드 | 4 | MTU-F2 | PR 체크리스트로 코드리뷰 1회 수행 가능 |
| **MTU-F4** | CSAP 간편등급 | 2 | MTU-F2 | PM이 31개 항목 자가진단 3일 이내 |
| **MTU-F5** | 감리 산출물 T01~T02 | 2 | MTU-F2 | T01로 3시간 이내 20p 사업계획서 초안 |
| **MTU-F6** | CC 하네스 완성도 검증 | 기존 | 없음 | Q-Gate G1~G3 통과 |

**Phase 1 완료 게이트**: MTU-F1~F6 전체 완료 + Auditor 검증 통과

---

### Phase 2: Core Security (M3~M6) — 7 MTUs ✏️

> **v1.1.0 변경**: MTU-C2 → C2a+C2b 분할 / MTU-C6 Phase 3 이동 (CTO 검토 R-01, R-03)

| ID | MTU명 | 파일 수 | 의존 MTU | 검증 기준 |
|----|-------|---------|---------|---------|
| **MTU-C1** | CSAP 표준등급 마스터 체크리스트 | 1 | MTU-F4 | 79항목 CSAP-DXX-YY 형식 100% |
| **MTU-C2a** | CSAP D01~D04 구현 가이드 | 4 | MTU-C1 | 정책·조직·인적·자산 4분야 구현 예시 |
| **MTU-C2b** | CSAP D05~D07 구현 가이드 | 3 | MTU-C1 | 공급망·침해사고·재해복구 3분야 구현 예시 |
| **MTU-C3** | CSAP D08~D13 구현 가이드 | 6 | MTU-C1 | D08 RBAC, D09 AES-256 예시 코드 완비 |
| **MTU-C4** | N2SF 등급 분류 + 매핑 | 3 | MTU-C1 | 79항목 CSAP↔N2SF 전수 매핑 |
| **MTU-C5** | N2SF 6개 영역 통제 | 6 | MTU-C4 | N2SF-NXX 형식 + 영역별 구현 가이드 |
| **MTU-C7** | Policy as Code [신규] | 3 | MTU-I1 | k3s에 Kyverno/OPA 정책 적용 확인 |
| **MTU-C8** | Supply Chain Security [신규] | 2 | MTU-I2 | SBOM 생성 + Cosign 이미지 서명 확인 |

**Phase 2 완료 게이트**: CSAP 79항목 100% 커버 + N2SF 전수 매핑 (ISMS-P는 Phase 3으로 이동)

---

### Phase 3: Infrastructure (M5~M8) — 8 MTUs ✏️

> **v1.1.0 변경**: MTU-C6 (ISMS-P) Phase 2 → Phase 3 이동. MTU-A3 → A3a+A3b+A3c 분할 (CTO 검토 R-01, R-03)

| ID | MTU명 | 파일 수 | 의존 MTU | 검증 기준 |
|----|-------|---------|---------|---------|
| **MTU-I1** | k3s WSL2 클러스터 + 보안 | 3 | MTU-F2 | WSL2에서 10분 이내 k3s 설치 재현 |
| **MTU-I2** | Gitea CI/CD 파이프라인 | 4 | MTU-I1 | 빌드/테스트/배포 3종 파이프라인 실행 |
| **MTU-I3** | Flux GitOps + Harbor [신규] | 3 | MTU-I2 | GitOps 자동 배포 + Harbor 스캔 정책 |
| **MTU-I4** | 네트워크 보안 + OpenTelemetry [신규] | 3 | MTU-I1 | OTel 메트릭 Prometheus 수집 확인 |
| **MTU-I5** | N2SF 레퍼런스 아키텍처 | 3 | MTU-C4 | C/S/O 3등급 k3s 배포 구성도 완비 |
| **MTU-C6a** | ISMS-P 체크리스트 + CSAP 매핑 [신규] | 1 | MTU-C1 | 101항목 전수, CSAP 교차 참조 완비 |
| **MTU-C6b** | ISMS-P 증적 자동화 + 자가진단 [신규] | 2 | MTU-C6a | Gitea Actions → audit.jsonl 자동 기록 |
| **MTU-A3a** | 감리 산출물 T03~T04 (설계서) | 2 | MTU-F5 | T03/T04 감리관 확인란 + CSAP 반영 |

**Phase 3 완료 게이트**: k3s 10분 구성 + Gitea CI/CD 3종 동작 + ISMS-P 101항목 + T03~T04

---

### Phase 4: Advanced (M8~M11) — 8 MTUs ✏️

> **v1.1.0 변경**: MTU-A3 → A3b+A3c 분할 (MTU-A3a는 Phase 3으로 이동) (CTO 검토 R-03)

| ID | MTU명 | 파일 수 | 의존 MTU | 검증 기준 |
|----|-------|---------|---------|---------|
| **MTU-A1** | AI 보안 게이트웨이 + MCP [신규] | 4 | MTU-C4, MTU-C5 | C/S등급 100% 차단 + LM Studio (host.docker.internal:1234) + MCP 통합 예시 |
| **MTU-A2** | LM Studio 연동 가이드 [신규] | 2 | MTU-A1 | LM Studio (Windows 호스트, host.docker.internal:1234) + WSL2/k3s 연동 예시 |
| **MTU-A3b** | 감리 산출물 T05~T06 (시험서) | 2 | MTU-A3a | T05 CSAP 항목별 시험 방법 매핑 |
| **MTU-A3c** | 감리 5단계 체크리스트 + 결함 대응 | 6 | MTU-A3b | 감리관 체크리스트 5종 + 결함 대응 가이드 |
| **MTU-A4** | OSCAL 호환성 레이어 [신규] | 2 | MTU-C1, MTU-C4 | CSAP+N2SF 통제항목 기계가독형 매핑 + oscal-cli 검증 통과 |
| **MTU-A5** | Docusaurus 문서 포털 [신규] | 2 | MTU-F1~F6 (전체) | 역할별 사이드바 5개 + CSAP 체크리스트 MDX 인터랙티브 뷰어 동작 |
| **MTU-A6** | 준수 현황 대시보드 [신규] | 2 | MTU-C1, MTU-A4, MTU-I4 | CSAP+N2SF+ISMS-P 실시간 Grafana 대시보드 + 감리 준비도 점수 자동 계산 |
| **MTU-A7** | N2SF 모니터링 프로세스 [신규] | 1 | MTU-C4 | 국정원 가이드라인 변경 → 30일 내 업데이트 절차 |

**Phase 4 완료 게이트**: AI C/S차단 확인 + 추적성 매트릭스 완결 + OSCAL 검증

---

### Phase 5: Ecosystem (M10~M12) — 3 MTUs ✏️

> **v1.2.0 변경**: MTU-E1~E3 재정의 — ISMS-P 의무화·멀티테넌시·프레임워크 업그레이드 중심으로 재편

| ID | MTU명 | 파일 수 | 의존 MTU | 검증 기준 |
|----|-------|---------|---------|---------|
| **MTU-E1** | ISMS-P 2027 의무화 대응 완성 가이드 [신규] | 2 | MTU-C6a, MTU-C6b | ISMS-P 심사 단계별 체크리스트 + CSAP 중복 30개 매핑 + 2027-07 타임라인 |
| **MTU-E2** | 공공기관 멀티테넌시 SaaS 아키텍처 [신규] | 3 | MTU-C3, MTU-I1, MTU-I3 | N2SF 등급별 격리 전략 + Kyverno 정책 + 1일 온보딩 자동화 |
| **MTU-E3** | 프레임워크 버전 관리·업그레이드 절차 [신규] | 2 | MTU-A7, 전체 MTU | 시맨틱 버저닝 + 30일 SLA 업데이트 파이프라인 + 롤백 절차 |

**Phase 5 완료 게이트**: 전체 73개 파일 완성 + Q-Gate G1~G7 전체 통과

---

## MTU 의존성 그래프

```
MTU-F2 (참조 기반) ─────────────────────────────────────┐
    │                                                    │
    ├── MTU-F1 (Getting Started)                         │
    ├── MTU-F3 (개발 표준) ─────────────────────────────┤
    ├── MTU-F4 (CSAP 간편) ── MTU-C1 (마스터 체크리스트) │
    └── MTU-F5 (감리 T01~T02) ── MTU-A3 (감리 T03~T06) ─┤
                                                         │
MTU-F2 ── MTU-I1 (k3s) ── MTU-I2 (Gitea) ── MTU-I3 (Flux+Harbor)
              │                │
              │                └── MTU-C8 (SBOM+Sigstore)
              │
              └── MTU-I4 (네트워크+OTel)

MTU-C1 ──┬── MTU-C2 (D01~D07)
          ├── MTU-C3 (D08~D13)
          ├── MTU-C4 (N2SF 매핑) ─┬── MTU-C5 (N2SF 영역)
          │                       ├── MTU-I5 (N2SF 아키텍처)
          │                       └── MTU-A1 (AI 게이트웨이)
          ├── MTU-C6 (ISMS-P) [신규]
          └── MTU-A4 (OSCAL 호환성) [신규] ── MTU-A6 (준수 현황 대시보드) [신규]

MTU-F1~F6 ── MTU-A5 (Docusaurus 문서 포털) [신규]

MTU-I1 ── MTU-C7 (Policy as Code) [신규]

MTU-A1 ── MTU-A2 (LM Studio 연동)

MTU-C6a+b ── MTU-E1 (ISMS-P 2027 의무화)
MTU-C3 + MTU-I1 + MTU-I3 ── MTU-E2 (멀티테넌시)
MTU-A7 + 모든 MTU 완료 ── MTU-E3 (프레임워크 업그레이드)
```

---

## 산출물 목록 (73개)

### 기존 54개 (Plan 기준)
`docs/01-plan/features/public-saas-framework.plan.md` 참조

### 신규 추가 19개 (시장조사 + v1.2.0 반영)

| 번호 | 파일 경로 | MTU | 근거 |
|------|---------|-----|------|
| 55 | `03-n2sf/mls-implementation-guide.md` | MTU-C5 | N2SF MLS 다층보안 2026 |
| 56 | `05-infra/flux-gitops/` | MTU-I3 | 폐쇄망 GitOps 표준 |
| 57 | `05-infra/harbor-registry.md` | MTU-I3 | 이미지 보안 강화 |
| 58 | `05-infra/opentelemetry-config.md` | MTU-I4 | 관찰성 표준화 |
| 59 | `05-infra/policy-as-code/kyverno-policies.md` | MTU-C7 | K8s 정책 자동화 |
| 60 | `05-infra/policy-as-code/opa-gatekeeper.md` | MTU-C7 | 복잡한 컴플라이언스 정책 |
| 61 | `05-infra/supply-chain/sbom-guide.md` | MTU-C8 | 공급망 보안 |
| 62 | `05-infra/supply-chain/sigstore-signing.md` | MTU-C8 | 이미지 서명 검증 |
| 63 | `06-ai-integration/mcp-integration-guide.md` | MTU-A1 | MCP 표준 AI 연동 |
| 64 | `06-ai-integration/lmstudio-guide.md` | MTU-A2 | LM Studio (Windows 호스트, host.docker.internal:1234) 연동 |
| 65 | `07-isms-p/checklist-101.md` | MTU-C6a | ISMS-P 101항목 (신규 모듈) |
| 66 | `07-isms-p/evidence-automation-guide.md` | MTU-C6b | 2027 의무화 자동 증적 |
| 67 | `07-isms-p/self-diagnosis.md` | MTU-C6b | ISMS-P 자가진단 |
| 68 | `08-oscal/csap-oscal-mapping.md` | MTU-A6 | NIST OSCAL 호환성 |
| 69 | `05-isms-p/certification-guide.md` | MTU-E1 | ISMS-P 심사 절차 + 2027 타임라인 |
| 70 | `05-isms-p/auto-evidence-collection.md` | MTU-E1 | 자동 증적 수집 → ISMS-P 보고서 생성 |
| 71 | `10-multitenancy/architecture-guide.md` | MTU-E2 | N2SF 등급별 테넌트 격리 아키텍처 |
| 72 | `10-multitenancy/tenant-isolation-policy.md` | MTU-E2 | Kyverno 테넌트 격리 정책 |
| 73 | `10-multitenancy/onboarding-procedure.md` | MTU-E2 | 테넌트 온보딩 자동화 (1일 이내) |

---

## Phase별 기간 계획 (업데이트)

| Phase | 기간 | MTU 수 | 주요 완료 기준 |
|-------|------|--------|-------------|
| Phase 1 Foundation | M1~M2 | 6 MTUs | 기반 문서 + CC 하네스 |
| Phase 2 Core Security | M3~M6 | 8 MTUs | CSAP 79항목 + ISMS-P 101항목 |
| Phase 3 Infrastructure | M5~M7 | 5 MTUs | k3s + Gitea + Policy as Code |
| Phase 4 Advanced | M7~M10 | 6 MTUs | AI 게이트웨이 + 감리 + OSCAL |
| Phase 5 Ecosystem | M10~M12 | 3 MTUs | ISMS-P 의무화 + 멀티테넌시 + 프레임워크 업그레이드 |

---

## 성공 기준 (업데이트)

| KPI | 목표 | 측정 방법 |
|-----|------|---------|
| K-01 | CSAP 79항목 100% 커버 | checklist-master.md 항목 수 |
| K-02 | ISMS-P 101항목 100% 커버 | checklist-101.md 항목 수 [신규] |
| K-03 | N2SF 전수 매핑 (79×6) | csap-to-n2sf-mapping.md 완결 |
| K-04 | k3s 구성 10분 이내 | 설치 스크립트 실행 시간 |
| K-05 | 감리 1차 통과율 90%+ | 실제 감리 결과 |
| K-06 | OSCAL 호환성 | OSCAL validator 검증 [신규] |
| K-07 | 공급망 보안 SBOM 생성 | Syft/Trivy 자동 생성 확인 [신규] |
| K-08 | 문서 포털 가동 | Docusaurus 빌드 성공 [신규] |

---

## MTU 수 요약 (v1.2.0)

| Phase | v1.0.0 | v1.1.0 | v1.2.0 | 변경 내용 |
|-------|--------|--------|--------|---------|
| Phase 1 Foundation | 6 | 6 | 6 | 변경 없음 |
| Phase 2 Core Security | 8 | 7 | 7 | 변경 없음 |
| Phase 3 Infrastructure | 5 | 8 | 8 | 변경 없음 |
| Phase 4 Advanced | 6 | 8 | 11 | MTU-A4(OSCAL 호환성), MTU-A5(Docusaurus 문서 포털), MTU-A6(준수 현황 대시보드) 정합 완료 |
| Phase 5 Ecosystem | 3 | 3 | 3 | MTU-E1~E3 내용 재정의 (ISMS-P/멀티테넌시/업그레이드) |
| **합계** | **28** | **32** | **35** | Phase 4 MTU 명확화 +3 = **+3** |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 최초 작성 — 시장조사 기반 28 MTU 정의 | Claude Code |
| 1.1.0 | 2026-04-05 | CTO 검토 반영 — P0 수정 3건 적용 | Claude Code |
| — | — | R-01: MTU-C6 Phase 3 이동 (Phase 2 과부하 해소) | — |
| — | — | R-02: Plan 2.2 온프레미스 LLM In Scope 변경 | — |
| — | — | R-03: MTU-C2/C6/A3 분할 → 총 32 MTU | — |
| — | — | R-06: MTU-A7 N2SF 모니터링 프로세스 신규 추가 | — |
| 1.2.0 | 2026-04-05 | LM Studio 적용 (온프레미스 LLM), 잔여 MTU Plan 전수 생성 완료 | Claude Code |
| — | — | MTU-A1 검증 기준: LM Studio (host.docker.internal:1234) 명시 | — |
| — | — | MTU-A2: Claude/GPT-4 API + 온프레미스 LLM → LM Studio 연동 가이드로 명확화 | — |
| — | — | Phase 5 MTU-E1~E3 재정의: ISMS-P 의무화·멀티테넌시·프레임워크 업그레이드 | — |
| — | — | 총 MTU 35개, 산출물 73개로 업데이트 | — |
| v1.3.0 | 2026-04-05 | P0-03: MTU-A4/A5/A6 ID/목적 로드맵-Plan 정합 수정 | CTO 팀 검토 |
| — | — | MTU-A4: 추적성 매트릭스 T07 → OSCAL 호환성 레이어 (실제 Plan 파일 기준 정합) | — |
| — | — | MTU-A5: CSAP 상등급+인증 절차 → Docusaurus 문서 포털 (실제 Plan 파일 기준 정합) | — |
| — | — | MTU-A6: OSCAL 호환성 레이어 → 준수 현황 대시보드 (실제 Plan 파일 기준 정합) | — |
