# Phase 3 PRD — Infrastructure 인프라 자동화

> **Phase**: Phase 3 Infrastructure (MTU-I2, I3, I4, I5 + C6a, C6b, A3a)
> **작성일**: 2026-04-05
> **상태**: Draft
> **작성자**: PM Lead Agent
> **주요 MTU**: MTU-I2, MTU-I3, MTU-I4, MTU-I5, MTU-C6a, MTU-C6b, MTU-A3a

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| **문제** | k3s 클러스터(I1) 구축은 완료되었으나 CI/CD 파이프라인, GitOps 배포, 관측 가능성, ISMS-P 체크리스트 등 운영 인프라가 부재하여 실제 공공 SaaS 운영 불가 |
| **솔루션** | Gitea CI/CD, Flux GitOps + Harbor, OpenTelemetry 관측, N2SF 레퍼런스 아키텍처, ISMS-P 101항목 체크리스트를 순차/병렬 구축 |
| **기능/UX 효과** | 코드 push → 빌드/테스트/스캔/서명/배포 자동화 + 실시간 모니터링 + ISMS-P 2027 의무화 사전 대비 |
| **핵심 가치** | 폐쇄망 환경에서 완전 자립형 DevSecOps 파이프라인 + 이중 규제(CSAP+ISMS-P) 동시 대응 |

---

## 1. Context Anchor

### WHY (왜 지금 해야 하는가)

1. **ISMS-P 2027년 7월 의무화 확정**: 공공기관 57곳 + 민간 50곳 = 107곳 대상, 미인증 시 최대 3천만 원 과태료
2. **N2SF 실증 사업 진행 중**: 국정원이 2024년 로드맵 발표 후 2025~2026년 실증 사업 확대 — 인프라 레벨 구현 증거 필수
3. **Phase 4 의존성**: MTU-A1(AI 게이트웨이)은 C5+I1 의존, MTU-C8은 I2 의존 — 인프라 미구축 시 Phase 4 전체 차단
4. **Gitea Actions GA 안정화**: Gitea v1.21+ Actions 기능 GA 진입, GitHub Actions 99% 호환

### WHO (이해관계자)

| 역할 | 관심사 | 영향도 |
|------|--------|--------|
| DevOps 엔지니어 | CI/CD 자동화, GitOps 배포, 모니터링 | 매우 높음 |
| 보안 담당자 | 공급망 보안, 네트워크 격리, 감사 로그 | 매우 높음 |
| ISMS-P 심사관 | 101항목 증적, 자동 증적 수집 | 높음 |
| 감리관 | T03~T04 산출물, 인프라 구성 증적 | 높음 |

### RISK (위험 요소)

| ID | 위험 | 영향도 | 대응 방안 |
|----|------|--------|----------|
| R-P3-01 | Gitea Actions 폐쇄망 러너 구성 복잡도 | 높음 | air-gap 절차 사전 설계, Docker-in-Docker 격리 패턴 |
| R-P3-02 | Harbor + Trivy 오프라인 취약점 DB 갱신 | 중간 | 주간 수동 업데이트 절차 문서화 |
| R-P3-03 | OpenTelemetry + k3s 리소스 오버헤드 | 중간 | DaemonSet 경량 배포, 메트릭 샘플링 주기 조정 |
| R-P3-04 | ISMS-P 개편 일정 유동성 | 낮음 | 현행 101항목 기준 + 개편 시 업데이트 예비 계획 |
| R-P3-05 | I4 의존성 변경 (I1→I1+I3) | 낮음 | I4 Plan 확인 — MTU-I1 의존만으로 착수 가능, I3 연동은 후행 |

### SUCCESS (성공 기준)

| ID | 기준 | 측정 방법 |
|----|------|----------|
| SC-P3-01 | Gitea CI/CD 3종 파이프라인 동작 | 빌드/테스트/배포 워크플로우 실행 성공 |
| SC-P3-02 | GitOps 자동 배포 | Gitea push → k3s 배포 10분 이내 |
| SC-P3-03 | OTel 메트릭 수집 | Prometheus 엔드포인트 응답 확인 |
| SC-P3-04 | N2SF 레퍼런스 아키텍처 | 6영역 x k3s 매핑 완비 |
| SC-P3-05 | ISMS-P 101항목 체크리스트 | CSAP 교차 참조 30개+ |
| SC-P3-06 | 감리 T03~T04 산출물 | 감리관 확인란 포함 |

### SCOPE (범위)

| 구분 | 포함 | 미포함 |
|------|------|--------|
| In Scope | Gitea CI/CD, Flux+Harbor, OTel+NetworkPolicy, N2SF 아키텍처, ISMS-P 체크리스트/자동화, 감리 T03~T04 | AI 게이트웨이(Phase 4), 멀티테넌시(Phase 5), Docusaurus 포털(Phase 4) |

---

## 2. MTU별 상세 분석

### MTU-I2: Gitea CI/CD 파이프라인

| 항목 | 내용 |
|------|------|
| 의존 | MTU-I1 (완료) |
| 복잡도 | HIGH (인프라 구축, 산출물 4개, Actions 러너 구성) |
| 산출물 | gitea-cicd-guide.md, build-test.yml, security-scan.yml, deploy-k3s.yml |
| 예상 세션 | 1 세션 |
| 차단 대상 | MTU-I3 (Flux+Harbor), MTU-C8 (SBOM+Sigstore) |

**시장조사 반영**:
- Gitea Actions: GitHub Actions YAML 99% 호환, 자체 호스팅 러너 지원
- 폐쇄망 러너: 별도 호스트/Docker 격리 구성, 네트워크 아웃바운드 제한 가능
- Docker-in-Docker(DinD) 패턴으로 러너 격리 강화

---

### MTU-I3: Flux GitOps + Harbor 컨테이너 레지스트리

| 항목 | 내용 |
|------|------|
| 의존 | MTU-I2 (미완료) |
| 복잡도 | HIGH (인프라 구축, air-gap 절차 포함) |
| 산출물 | flux-gitops-guide.md, harbor-registry-guide.md, kustomization-templates/ |
| 예상 세션 | 1 세션 |
| 차단 대상 | MTU-E2 (멀티테넌시) |

**시장조사 반영**:
- Flux v2: pull-only 동기화, 네트워크 아웃바운드 불필요 — 폐쇄망 적합
- Harbor v2.9+: Cosign 서명 검증 정책 GA, Trivy 오프라인 스캔 지원
- ArgoCD 대비 Flux 선택: 리소스 효율성 + 폐쇄망 호환성

---

### MTU-I4: 네트워크 보안 + OpenTelemetry

| 항목 | 내용 |
|------|------|
| 의존 | MTU-I1 (완료) |
| 복잡도 | HIGH (인프라 보안 + 관측 가능성 통합) |
| 산출물 | network-policy-guide.md, opentelemetry-guide.md, network-policies/ |
| 예상 세션 | 1 세션 |
| 차단 대상 | MTU-A6 (대시보드) |

**시장조사 반영**:
- k3s 기본 CNI(Flannel) NetworkPolicy 미지원 → kube-router 필수
- OTel Collector v0.96+: DaemonSet + Sidecar 혼합 배포 패턴
- N2SF N03 격리: 네임스페이스 기반 데이터 등급별 네트워크 분리 필수

---

### MTU-I5: N2SF 레퍼런스 아키텍처

| 항목 | 내용 |
|------|------|
| 의존 | MTU-C4 (완료), MTU-C5 (미완료), MTU-I4 (미완료) |
| 복잡도 | MED (아키텍처 문서 1개, 코드 구현 없음) |
| 산출물 | n2sf-infrastructure-architecture.md |
| 예상 세션 | 1 세션 |
| 비고 | C5, I4 완료 후 착수 권장 (역참조 링크 완비를 위해) |

---

### MTU-C6a: ISMS-P 체크리스트 + CSAP 매핑

| 항목 | 내용 |
|------|------|
| 의존 | MTU-C1 (완료) |
| 복잡도 | MED (101항목 전수 체크리스트, CSAP 교차 참조) |
| 산출물 | checklist-101.md |
| 예상 세션 | 1 세션 |
| 차단 대상 | MTU-C6b, MTU-E1 (ISMS-P 2027 의무화) |

**시장조사 반영**:
- ISMS-P 2027년 7월 의무화 확정 — 공공기관 57곳 + 민간 50곳 대상
- 미인증 시 최대 3천만 원 과태료
- 예비심사 신설, 현장실증형 심사 강화 — 단순 서류가 아닌 실증 증거 필요
- CSAP과 ISMS-P 중복 항목 30개+ 존재 — 교차 참조로 이중 인증 효율화

---

### MTU-C6b: ISMS-P 증적 자동화 + 자가진단

| 항목 | 내용 |
|------|------|
| 의존 | MTU-C6a (미완료) |
| 복잡도 | MED (증적 자동화 스크립트 + 자가진단 가이드) |
| 산출물 | evidence-automation-guide.md, self-diagnosis.md |
| 예상 세션 | 1 세션 |
| 차단 대상 | MTU-E1 |

---

### MTU-A3a: 감리 산출물 T03~T04 (설계서)

| 항목 | 내용 |
|------|------|
| 의존 | MTU-F5 (완료) |
| 복잡도 | MED (감리 산출물 2개, 행안부 형식) |
| 산출물 | T03-system-design.md, T04-database-design.md |
| 예상 세션 | 1 세션 |
| 차단 대상 | MTU-A3b (T05~T06) |

---

## 3. 우선순위 매트릭스

| MTU | 영향도 (1~5) | 긴급도 (1~5) | 난이도 (1~5) | 총점 | 착수 가능 | 병렬 가능 |
|-----|-------------|-------------|-------------|------|----------|----------|
| **MTU-I2** | 5 (CI/CD 핵심) | 5 (I3, C8 차단) | 4 (인프라 구축) | **14** | 즉시 | 독립 |
| **MTU-I4** | 4 (모니터링+보안) | 4 (A6 차단) | 4 (인프라 복합) | **12** | 즉시 | I2와 병렬 |
| **MTU-C6a** | 5 (ISMS-P 의무화) | 4 (C6b, E1 차단) | 3 (문서 체크리스트) | **12** | 즉시 | I2, I4와 병렬 |
| **MTU-A3a** | 3 (감리 산출물) | 3 (A3b 차단) | 2 (문서 작성) | **8** | 즉시 | 모두와 병렬 |
| **MTU-I3** | 4 (GitOps 배포) | 3 (I2 의존) | 4 (air-gap 구성) | **11** | I2 후 | I2 직후 |
| **MTU-C6b** | 4 (증적 자동화) | 3 (C6a 의존) | 3 (자동화 스크립트) | **10** | C6a 후 | I3과 병렬 |
| **MTU-I5** | 3 (아키텍처 문서) | 2 (C5, I4 의존) | 2 (문서 1개) | **7** | C5+I4 후 | 마지막 |

---

## 4. 착수 그룹핑

### 그룹 A: 즉시 병렬 착수 (의존 충족)

```
MTU-I2  (Gitea CI/CD)       — 의존: I1 완료
MTU-I4  (NetworkPolicy+OTel) — 의존: I1 완료
MTU-C6a (ISMS-P 체크리스트)  — 의존: C1 완료
MTU-A3a (감리 T03~T04)      — 의존: F5 완료
```

### 그룹 B: 그룹 A 완료 후 착수

```
MTU-I3  (Flux+Harbor)        — 의존: I2 완료
MTU-C6b (ISMS-P 증적 자동화) — 의존: C6a 완료
```

### 그룹 C: 연쇄 의존 (최종)

```
MTU-I5  (N2SF 레퍼런스 아키텍처) — 의존: C5 + I4 완료
```

---

## 5. 의존성 흐름도

```
[Phase 2 잔여]
  MTU-C5 ──────────────────────────────┐
                                        │
[Phase 3 그룹 A — 병렬]                │
  MTU-I2 ─────┬── MTU-I3 ──┐           │
              │              │           │
  MTU-I4 ─────┤              │           │
              │              ▼           ▼
              │          [그룹 C]    MTU-I5
              │
  MTU-C6a ────┬── MTU-C6b
              │
  MTU-A3a ────┘
```

---

## 6. Phase 3 완료 게이트 체크리스트

| 항목 | 기준 | 상태 |
|------|------|------|
| k3s 10분 구성 | MTU-I1 (완료) | 완료 |
| Gitea CI/CD 3종 동작 | MTU-I2 빌드/테스트/배포 | **미완료** |
| GitOps 자동 배포 | MTU-I3 Flux 싱크 | **미완료** |
| 네트워크 격리 + 모니터링 | MTU-I4 NetworkPolicy + OTel | **미완료** |
| N2SF 아키텍처 | MTU-I5 6영역 매핑 | **미완료** |
| ISMS-P 101항목 | MTU-C6a 체크리스트 | **미완료** |
| ISMS-P 증적 자동화 | MTU-C6b 자동 수집 | **미완료** |
| 감리 T03~T04 | MTU-A3a 설계서 | **미완료** |

---

## 7. 추적성 매트릭스

| FR ID | MTU | CSAP 항목 | N2SF 영역 | ISMS-P 항목 | 산출물 |
|-------|-----|---------|---------|-----------|--------|
| FR-5.2 | I2 | D12-01~05 | - | - | gitea-cicd-guide.md |
| FR-5.3 | I3 | D12-02 | - | - | flux-gitops-guide.md |
| FR-5.4 | I4 | D06-01~04, D10 | N03 격리 | - | network-policy-guide.md |
| NFR-4 | I4 | D07 | - | - | opentelemetry-guide.md |
| FR-3.6 | I5 | 전수 | N01~N06 | - | n2sf-infrastructure-architecture.md |
| FR-4.1 | C6a | - | - | 101항목 전수 | checklist-101.md |
| FR-4.2 | C6b | D06 | - | 증적 자동화 | evidence-automation-guide.md |
| FR-4.3 | A3a | - | - | - | T03, T04 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 최초 작성 — Phase 3 Infrastructure 7 MTU PRD | PM Lead Agent |
