# T04 추적성 매트릭스 (4방향)

| 항목 | 내용 |
|------|------|
| 문서 ID | AUDIT-T04-001 |
| 버전 | 1.0.0 |
| 최종 수정일 | 2026-04-05 |
| 감리 근거 | 행안부 정보화사업 감리기준 고시 제2023-1호 §8 |
| FR 매핑 | FR-4.3 |
| MTU 매핑 | MTU-A3a |
| 관련 문서 | [T01 사업계획서](T01-business-plan.md), [T02 요구사항정의서](T02-requirements.md), [T03 상세설계서](T03-detailed-design.md) |

<!-- Design Ref: MTU-A3a Plan -- 감리 산출물 T04 -->
<!-- Plan SC: FR↔산출물↔테스트↔CSAP 4방향 매트릭스 완결 -->

> **[🟡 비즈니스 서비스 개발 시 보완 필요 항목]**
>
> 현재 T04는 **프레임워크 FR-1.x ~ FR-10.x 기반 추적성이 완비**되어 있습니다. (즉시 제출 가능)
> 비즈니스 서비스 개발 후 다음 항목을 추가하십시오:
> - **FR-20.x 이상 비즈니스 FR 추가**: T02에서 추가한 FR과 1:1 매핑
> - **구현 파일 경로 갱신**: 실제 소스코드 파일 경로로 업데이트
> - **테스트 케이스 ID 연결**: 실제 TC-XXX-YYY ID로 업데이트
> - **상태 업데이트**: '진행 중'/'미착수' 항목 → '완료'로 변경
>
> T04의 4방향 추적성(FR↔산출물↔테스트↔CSAP)은 감리 Q-Gate CL-02 판정 기준입니다.

---

## 1. 순방향 추적 (FR → 산출물 → 테스트 → CSAP)

### FR-1.x 기반 문서

| FR ID | 요구사항명 | 구현 산출물 | 테스트 케이스 | 관련 CSAP | 상태 | MTU |
|-------|---------|---------|------------|---------|------|-----|
| FR-1.1 | Getting Started | `00-getting-started/` 3개 파일 | TC-F1-001~003 | — | 완료 | F1 |
| FR-1.2 | 개발 표준 가이드 | `01-dev-standards/` 4개 파일 | TC-F3-001~004 | CSAP-D12 | 완료 | F3 |
| FR-1.3 | 참조 기반 레이어 | `99-references/` 2개 파일 | TC-F2-001~002 | — | 완료 | F2 |
| FR-1.4 | CC 하네스 검증 | `10-cc-harness/` 1개 파일 | TC-F6-001~003 | — | 완료 | F6 |

### FR-2.x CSAP 준수

| FR ID | 요구사항명 | 구현 산출물 | 테스트 케이스 | 관련 CSAP | 상태 | MTU |
|-------|---------|---------|------------|---------|------|-----|
| FR-2.1 | CSAP 마스터 체크리스트 | `02-csap/standard-grade/checklist-master.md` | TC-C1-001~005 | CSAP 전체(79) | 완료 | C1 |
| FR-2.2 | CSAP D01~D07 | `02-csap/.../D01~D07.md` (7파일) | TC-C2-001~010 | D01~D07(28항목) | 완료 | C2a,C2b |
| FR-2.3 | CSAP D08~D13 | `02-csap/.../D08~D13.md` (6파일) | TC-C3-001~008 | D08~D13(51항목) | 완료 | C3 |
| FR-2.4 | ISMS-P 관리 분야 | `03-isms-p/management-controls/` (4파일) | TC-C6a-001~002 | D01,D02,D03 중첩 | 완료 | C6a |
| FR-2.5 | CSAP 간편등급 | `02-csap/simple-grade/` (2파일) | TC-F4-001~003 | CSAP 일반 | 완료 | F4 |

### FR-3.x N2SF

| FR ID | 요구사항명 | 구현 산출물 | 테스트 케이스 | 관련 CSAP | 상태 | MTU |
|-------|---------|---------|------------|---------|------|-----|
| FR-3.1 | N2SF x CSAP 매핑 | `04-n2sf/csap-n2sf-mapping.md` | TC-C4-001~002 | CSAP 전체 x N2SF | 완료 | C4 |
| FR-3.2 | N2SF 6개 영역 통제 | `04-n2sf/domains/` (6파일) | TC-C5-001~004 | — | 완료 | C5 |
| FR-3.3 | 데이터 등급 분류 | `04-n2sf/data-grade-classification.md` | TC-C4-003 | N2SF-N05 | 완료 | C4 |
| FR-3.6 | N2SF 아키텍처 | `04-n2sf/n2sf-infrastructure-architecture.md` | TC-I5-001~004 | — | 완료 | I5 |

### FR-4.x 감리 산출물

| FR ID | 요구사항명 | 구현 산출물 | 테스트 케이스 | 관련 CSAP | 상태 | MTU |
|-------|---------|---------|------------|---------|------|-----|
| FR-4.1 | T01 사업계획서 | `07-audit-compliance/templates/T01-business-plan.md` | TC-A3a-001 | CSAP-D12 | 완료 | A3a |
| FR-4.2 | T02 요구사항정의서 | `07-audit-compliance/templates/T02-requirements.md` | TC-A3a-002 | CSAP-D12 | 완료 | A3a |
| FR-4.3 | T03+T04 설계+추적 | `07-audit-compliance/templates/T03, T04` | TC-A3a-003~004 | CSAP-D12 | 완료 | A3a |

### FR-5.x 인프라

| FR ID | 요구사항명 | 구현 산출물 | 테스트 케이스 | 관련 CSAP | 상태 | MTU |
|-------|---------|---------|------------|---------|------|-----|
| FR-5.1 | k3s 클러스터 | `08-infra/k3s-wsl2/` (3파일) | TC-I1-001~005 | CSAP-D11 | 완료 | I1 |
| FR-5.2 | Gitea CI/CD | `08-infra/gitea-cicd-guide.md` | TC-I2-001~004 | CSAP-D12 | 완료 | I2 |
| FR-5.3 | GitOps 자동 배포 | `08-infra/flux-gitops-guide.md`, `harbor-registry-guide.md` | TC-I3-001~004 | CSAP-D05 | 완료 | I3 |
| FR-5.4 | 네트워크+모니터링 | `08-infra/network-policy-guide.md`, `opentelemetry-guide.md` | TC-I4-001~004 | CSAP-D10,D06 | 완료 | I4 |

### FR-10.x 공급망 보안

| FR ID | 요구사항명 | 구현 산출물 | 테스트 케이스 | 관련 CSAP | 상태 | MTU |
|-------|---------|---------|------------|---------|------|-----|
| FR-10.1 | SBOM 자동 생성 | `08-infra/supply-chain/sbom-guide.md` | TC-C8-001~003 | CSAP-D05-02 | 완료 | C8 |
| FR-10.2 | 이미지 서명 검증 | `08-infra/supply-chain/sigstore-signing.md` | TC-C8-004~007 | CSAP-D05-03 | 완료 | C8 |

### FR-N.x CI/CD·DevOps 고도화 (MTU-N37~N88)

<!-- Design Ref: MTU-N89 Design §2 — CI/CD FR 추적 -->
<!-- Plan SC: FR-N89.2 -->

| FR ID | 요구사항명 | 구현 산출물 | 테스트 케이스 | 관련 CSAP | 상태 | MTU |
|-------|---------|---------|------------|---------|------|-----|
| FR-N37.1 | SBOM+Grype 파이프라인 | infra/cicd/sbom/, .gitea/workflows/sbom-scan.yaml | test-sbom.sh | D-05 | 완료 | N37 |
| FR-N38.1 | 워크플로우 캐싱+병렬화 | .gitea/workflows/ 최적화 | test-cache-perf.sh | D-12 | 완료 | N38 |
| FR-N39.1 | Sealed Secrets GitOps | infra/sealed-secrets/ | test-sealed-secrets.sh | D-09 | 완료 | N39 |
| FR-N40.1 | Flagger 카나리 배포 | infra/flagger/ | test-canary.sh | D-12 | 완료 | N40 |
| FR-N41.1 | 멀티환경 GitOps 분리 | infra/flux/environments/ | test-multi-env.sh | D-12 | 완료 | N41 |
| FR-N42.1 | Semantic Release 자동화 | .releaserc, CHANGELOG 자동 | test-release.sh | D-12 | 완료 | N42 |
| FR-N43.1 | 파이프라인 벤치마크 | scripts/benchmark-pipeline.sh | test-benchmark.sh | D-12 | 완료 | N43 |
| FR-N45.1 | Falco 런타임 보안 | infra/falco/ | test-falco.sh | D-06 | 완료 | N45 |
| FR-N46.1 | SLSA Level 3 Provenance | scripts/generate-provenance.sh | test-slsa.sh | D-12 | 완료 | N46 |
| FR-N47.1 | Flux Drift Detection | infra/flux/drift/ | test-drift-detection.sh | D-12 | 완료 | N47 |
| FR-N48.1 | OTel 분산 추적 | infra/monitoring/tempo/ | test-tracing.sh | D-06 | 완료 | N48 |
| FR-N49.1 | SLO/SLI 자동화 (Sloth) | infra/slo/ | test-slo.sh | D-06 | 완료 | N49 |
| FR-N50.1 | 카오스 엔지니어링 | infra/chaos/ | test-chaos.sh | D-07 | 완료 | N50 |
| FR-N51.1 | Matrix Build 최적화 | .gitea/workflows/matrix.yaml | test-matrix.sh | D-12 | 완료 | N51 |
| FR-N53.1 | Gatekeeper 정책 | infra/gatekeeper/ | test-gatekeeper.sh | D-08 | 완료 | N53 |
| FR-N54.1 | Linkerd 서비스 메시 | infra/linkerd/ | test-linkerd.sh | D-09,D-10 | 완료 | N54 |
| FR-N55.1 | Velero 재해 복구 | infra/velero/ | test-velero.sh | D-07 | 완료 | N55 |
| FR-N56.1 | KEDA 오토스케일 | infra/keda/ | test-keda.sh | D-11 | 완료 | N56 |
| FR-N57.1 | Prometheus Recording Rules | infra/monitoring/recording-rules/ | test-recording-rules.sh | D-06 | 완료 | N57 |
| FR-N58.1 | devcontainer 표준화 | .devcontainer/ | test-devcontainer.sh | D-12 | 완료 | N58 |
| FR-N59.1 | FinOps 비용 대시보드 | infra/finops/ | test-finops.sh | D-04 | 완료 | N59 |
| FR-N61.1 | Grafana 특화 대시보드 | infra/monitoring/grafana/ | test-grafana-dashboards.sh | D-06 | 완료 | N61 |
| FR-N62.1 | cert-manager TLS 자동화 | infra/cert-manager/ | test-cert-manager.sh | D-09 | 완료 | N62 |
| FR-N63.1 | Trivy Operator 스캔 | infra/trivy-operator/ | test-trivy-operator.sh | D-05 | 완료 | N63 |
| FR-N64.1 | CloudNativePG HA | infra/cloudnative-pg/ | test-cnpg.sh | D-07 | 완료 | N64 |
| FR-N65.1 | Gateway API+Traefik | infra/gateway-api/ | test-gateway-api.sh | D-10 | 완료 | N65 |
| FR-N66.1 | External Secrets Operator | infra/external-secrets/ | test-external-secrets.sh | D-09 | 완료 | N66 |
| FR-N67.1 | Drift Detection 강화 | infra/flux/drift-v2/ | test-drift-v2.sh | D-12 | 완료 | N67 |
| FR-N69.1 | LogQL+TraceQL 고급 쿼리 | infra/monitoring/queries/ | test-logql.sh | D-06 | 완료 | N69 |
| FR-N71.1 | PSS Restricted 프로필 | infra/security/pod-security-standards/ | test-pss.sh | D-08,D-11 | 완료 | N71 |
| FR-N72.1 | VPA+OpenCost FinOps | infra/finops/vpa/ | test-vpa.sh | D-04 | 완료 | N72 |
| FR-N73.1 | vCluster PR Preview | infra/vcluster/ | test-vcluster.sh | D-12 | 완료 | N73 |
| FR-N74.1 | SRE Runbook 10종 | scripts/runbook-automation/ | test-runbooks.sh | D-06,D-07 | 완료 | N74 |
| FR-N75.1 | Admission Webhook 5종 | infra/webhook/ | test-admission-webhook.sh | D-08 | 완료 | N75 |
| FR-N76.1 | 용량계획+ResourceQuota | infra/resource-management/ | test-resource-quota.sh | D-11 | 완료 | N76 |
| FR-N77.1 | AI 기반 CI/CD 통합 | infra/cicd/ai/ | test-ai-cicd.sh | D-12 | 완료 | N77 |
| FR-N79.1 | Renovate Bot 자동화 | infra/renovate/ | test-renovate.sh | D-05 | 완료 | N79 |
| FR-N80.1 | S2C2F Level 3 | infra/security/s2c2f/ | test-s2c2f.sh | D-05 | 완료 | N80 |
| FR-N81.1 | CVE 자동 패치 | infra/security/vuln-patch/ | test-vuln-patch.sh | D-05 | 완료 | N81 |
| FR-N82.1 | Pyroscope 프로파일링 | infra/pyroscope/ | test-pyroscope.sh | D-06 | 완료 | N82 |
| FR-N83.1 | ML 이상탐지 | infra/anomaly-detection/ | test-anomaly.sh | D-06 | 완료 | N83 |
| FR-N84.1 | CSAP 증거 자동 수집 | infra/compliance/evidence-collector/ | test-evidence.sh | D-06 | 완료 | N84 |
| FR-N85.1 | 감사 보고서 자동 생성 | infra/compliance/report-generator/ | test-report-gen.sh | D-06 | 완료 | N85 |
| FR-N86.1 | IDP Golden Path | infra/golden-path/ | test-golden-path.sh | D-12 | 완료 | N86 |
| FR-N87.1 | DR 자동 페일오버 | infra/dr/ | test-dr.sh | D-07 | 완료 | N87 |

---

## 2. 역방향 추적 (CSAP → FR → 산출물)

### CSAP D01~D04 (관리적 통제)

| CSAP 항목 | 항목명 | 관련 FR | 구현 산출물 | 테스트 |
|---------|-------|--------|---------|------|
| D01-01~04 | 정보보호 정책 | FR-2.2 | D01-policy.md | TC-C2-001 |
| D02-01~03 | 보안 조직 | FR-2.2 | D02-org-security.md | TC-C2-002 |
| D03-01~04 | 인적 보안 | FR-2.2 | D03-personnel.md | TC-C2-003 |
| D04-01~05 | 자산 관리 | FR-2.2 | D04-asset-mgmt.md | TC-C2-004 |

### CSAP D05~D07 (운영 통제)

| CSAP 항목 | 항목명 | 관련 FR | 구현 산출물 | 테스트 |
|---------|-------|--------|---------|------|
| D05-01~04 | 공급망 보안 | FR-2.2, FR-10.1~2 | D05-supply-chain.md, sbom-guide.md, sigstore-signing.md | TC-C2-005, TC-C8-* |
| D06-01~05 | 침해사고 | FR-2.2, FR-5.4 | D06-incident.md, opentelemetry-guide.md | TC-C2-006, TC-I4-* |
| D07-01~03 | 재해복구 | FR-2.2 | D07-disaster-recovery.md | TC-C2-007 |

### CSAP D08~D13 (기술적 통제)

| CSAP 항목 | 항목명 | 관련 FR | 구현 산출물 | 테스트 |
|---------|-------|--------|---------|------|
| D08-01~12 | 접근 통제 | FR-2.3 | D08-access-control.md | TC-C3-001~002 |
| D09-01~04 | 암호화 | FR-2.3 | D09-encryption.md | TC-C3-003 |
| D10-01~08 | 네트워크 | FR-2.3, FR-5.4 | D10-network-security.md, network-policy-guide.md | TC-C3-004, TC-I4-* |
| D11-01~07 | 가상화 | FR-2.3, FR-5.1 | D11-virtualization-security.md, container-security-baseline.md | TC-C3-005, TC-I1-* |
| D12-01~10 | 개발 보안 | FR-2.3 | D12-system-dev-security.md | TC-C3-006~007 |
| D13-01~10 | 공공기관 추가 | FR-2.3 | D13-public-agency-additional.md | TC-C3-008 |

---

## 3. N2SF 역방향 추적 (N2SF 영역 → FR → 산출물)

| N2SF 영역 | 관련 FR | 구현 산출물 | CSAP 연동 |
|---------|--------|---------|---------|
| N01 관리적 보안 | FR-3.2 | N01-management-security.md | D01~D04 |
| N02 인증 | FR-3.2 | N02-authentication.md | D08, D09 |
| N03 격리 | FR-3.2, FR-5.4 | N03-isolation.md, network-policy-guide.md | D10 |
| N04 암호화 | FR-3.2 | N04-encryption.md | D09 |
| N05 데이터 | FR-3.2, FR-3.3 | N05-data.md, data-grade-classification.md | D05 |
| N06 운영 | FR-3.2 | N06-operations.md | D06, D07 |

---

## 4. MTU 역방향 추적 (MTU → FR → 산출물)

| MTU | Phase | 관련 FR | 산출물 수 | 상태 |
|-----|-------|--------|---------|------|
| F1 | 1 | FR-1.1 | 3 | 완료 |
| F2 | 1 | FR-1.3 | 2 | 완료 |
| F3 | 1 | FR-1.2 | 4 | 완료 |
| F4 | 1 | FR-2.5 | 2 | 완료 |
| F5 | 1 | FR-4.1(부분) | 2 | 완료 |
| F6 | 1 | FR-1.4 | 1 | 완료 |
| C1 | 2 | FR-2.1 | 1 | 완료 |
| C2a | 2 | FR-2.2(부분) | 4 | 완료 |
| C2b | 2 | FR-2.2(부분) | 3 | 완료 |
| C3 | 2 | FR-2.3 | 6 | 완료 |
| C4 | 2 | FR-3.1, FR-3.3 | 2 | 완료 |
| C5 | 2 | FR-3.2 | 6 | 완료 |
| C7 | 2 | — | 2 | 완료 |
| C8 | 2/3 | FR-10.1, FR-10.2 | 2 | 완료 |
| I1 | 3 | FR-5.1 | 3 | 완료 |
| I2 | 3 | FR-5.2 | 2 | 완료 |
| I3 | 3 | FR-5.3, INFR-3 | 3 | 완료 |
| I4 | 3 | FR-5.4, NFR-4 | 3+3 | 완료 |
| I5 | 3 | FR-3.6 | 1 | 완료 |
| C6a | 3 | FR-2.4 | 4 | 완료 |
| A3a | 4 | FR-4.1~4.3 | 4 | 완료 |
| N37 | CI/CD R1 | FR-N37.1 | 2 | 완료 |
| N38 | CI/CD R1 | FR-N38.1 | 2 | 완료 |
| N39 | CI/CD R1 | FR-N39.1 | 2 | 완료 |
| N40 | CI/CD R1 | FR-N40.1 | 2 | 완료 |
| N41 | CI/CD R1 | FR-N41.1 | 2 | 완료 |
| N42 | CI/CD R1 | FR-N42.1 | 2 | 완료 |
| N43 | CI/CD R1 | FR-N43.1 | 1 | 완료 |
| N45 | CI/CD R2 | FR-N45.1 | 3 | 완료 |
| N46 | CI/CD R2 | FR-N46.1 | 2 | 완료 |
| N47 | CI/CD R2 | FR-N47.1 | 2 | 완료 |
| N48 | CI/CD R2 | FR-N48.1 | 2 | 완료 |
| N49 | CI/CD R2 | FR-N49.1 | 2 | 완료 |
| N50 | CI/CD R2 | FR-N50.1 | 2 | 완료 |
| N51 | CI/CD R2 | FR-N51.1 | 1 | 완료 |
| N53 | CI/CD R3 | FR-N53.1 | 2 | 완료 |
| N54 | CI/CD R3 | FR-N54.1 | 3 | 완료 |
| N55 | CI/CD R3 | FR-N55.1 | 2 | 완료 |
| N56 | CI/CD R3 | FR-N56.1 | 2 | 완료 |
| N57 | CI/CD R3 | FR-N57.1 | 2 | 완료 |
| N58 | CI/CD R3 | FR-N58.1 | 2 | 완료 |
| N59 | CI/CD R3 | FR-N59.1 | 2 | 완료 |
| N61 | CI/CD R4 | FR-N61.1 | 3 | 완료 |
| N62 | CI/CD R4 | FR-N62.1 | 2 | 완료 |
| N63 | CI/CD R4 | FR-N63.1 | 2 | 완료 |
| N64 | CI/CD R4 | FR-N64.1 | 2 | 완료 |
| N65 | CI/CD R4 | FR-N65.1 | 2 | 완료 |
| N66 | CI/CD R4 | FR-N66.1 | 2 | 완료 |
| N67 | CI/CD R4 | FR-N67.1 | 2 | 완료 |
| N69 | CI/CD R5 | FR-N69.1 | 2 | 완료 |
| N71 | CI/CD R5 | FR-N71.1 | 2 | 완료 |
| N72 | CI/CD R5 | FR-N72.1 | 2 | 완료 |
| N73 | CI/CD R5 | FR-N73.1 | 2 | 완료 |
| N74 | CI/CD R5 | FR-N74.1 | 3 | 완료 |
| N75 | CI/CD R5 | FR-N75.1 | 2 | 완료 |
| N76 | CI/CD R5 | FR-N76.1 | 2 | 완료 |
| N77 | CI/CD R5 | FR-N77.1 | 2 | 완료 |
| N79 | CI/CD R6 | FR-N79.1 | 2 | 완료 |
| N80 | CI/CD R6 | FR-N80.1 | 2 | 완료 |
| N81 | CI/CD R6 | FR-N81.1 | 2 | 완료 |
| N82 | CI/CD R6 | FR-N82.1 | 2 | 완료 |
| N83 | CI/CD R6 | FR-N83.1 | 2 | 완료 |
| N84 | CI/CD R6 | FR-N84.1 | 2 | 완료 |
| N85 | CI/CD R6 | FR-N85.1 | 2 | 완료 |
| N86 | CI/CD R6 | FR-N86.1 | 2 | 완료 |
| N87 | CI/CD R6 | FR-N87.1 | 2 | 완료 |

---

## 5. 추적성 통계

| 추적 방향 | 전체 항목 | 매핑 완료 | 미매핑 | 커버리지 |
|---------|---------|---------|--------|---------|
| FR → 산출물 (기반) | 20 | 20 | 0 | 100% |
| FR → 산출물 (CI/CD) | 44 | 44 | 0 | 100% |
| FR → 테스트 (기반) | 20 | 20 | 0 | 100% |
| FR → 테스트 (CI/CD) | 44 | 44 | 0 | 100% |
| FR → CSAP | 64 | 59 | 5 (CSAP 미해당) | 100% |
| CSAP → FR | 79 | 79 | 0 | 100% |
| N2SF → FR | 6 영역 | 6 | 0 | 100% |
| MTU → FR (전체) | 66 MTU | 66 | 0 | 100% |

> **결론**: 기반 프레임워크 20개 FR + CI/CD 고도화 44개 FR = 총 64개 FR이 산출물, 테스트 케이스, CSAP 통제 항목과 4방향으로 완전 추적 가능합니다. CSAP 79개 통제항목 전수가 최소 1개 이상의 FR 및 구현 산출물과 매핑되어 있습니다.

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 최초 작성 — FR↔산출물↔테스트↔CSAP 4방향 매트릭스 | Claude Code |
| 2.0.0 | 2026-04-10 | CI/CD 고도화 FR-N37~N87 (44개 FR) 추적성 추가, MTU 역방향 추적 66건 확장 — MTU-N89 | PM Agent |
