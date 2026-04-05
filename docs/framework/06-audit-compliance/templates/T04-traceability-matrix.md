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

---

## 1. 순방향 추적 (FR → 산출물 → 테스트 → CSAP)

### FR-1.x 기반 문서

| FR ID | 요구사항명 | 구현 산출물 | 테스트 케이스 | 관련 CSAP | 상태 | MTU |
|-------|---------|---------|------------|---------|------|-----|
| FR-1.1 | Getting Started | `00-getting-started/` 3개 파일 | TC-F1-001~003 | — | 완료 | F1 |
| FR-1.2 | 개발 표준 가이드 | `01-dev-standards/` 4개 파일 | TC-F3-001~004 | CSAP-D12 | 완료 | F3 |
| FR-1.3 | 참조 기반 레이어 | `99-references/` 2개 파일 | TC-F2-001~002 | — | 완료 | F2 |
| FR-1.4 | CC 하네스 검증 | `09-cc-harness/` 1개 파일 | TC-F6-001~003 | — | 완료 | F6 |

### FR-2.x CSAP 준수

| FR ID | 요구사항명 | 구현 산출물 | 테스트 케이스 | 관련 CSAP | 상태 | MTU |
|-------|---------|---------|------------|---------|------|-----|
| FR-2.1 | CSAP 마스터 체크리스트 | `02-csap/standard-grade/checklist-master.md` | TC-C1-001~005 | CSAP 전체(79) | 완료 | C1 |
| FR-2.2 | CSAP D01~D07 | `02-csap/.../D01~D07.md` (7파일) | TC-C2-001~010 | D01~D07(28항목) | 완료 | C2a,C2b |
| FR-2.3 | CSAP D08~D13 | `02-csap/.../D08~D13.md` (6파일) | TC-C3-001~008 | D08~D13(51항목) | 완료 | C3 |
| FR-2.4 | ISMS-P 관리 분야 | `04-isms-p/management-controls/` (4파일) | TC-C6a-001~002 | D01,D02,D03 중첩 | 완료 | C6a |
| FR-2.5 | CSAP 간편등급 | `02-csap/simple-grade/` (2파일) | TC-F4-001~003 | CSAP 일반 | 완료 | F4 |

### FR-3.x N2SF

| FR ID | 요구사항명 | 구현 산출물 | 테스트 케이스 | 관련 CSAP | 상태 | MTU |
|-------|---------|---------|------------|---------|------|-----|
| FR-3.1 | N2SF x CSAP 매핑 | `03-n2sf/csap-n2sf-mapping.md` | TC-C4-001~002 | CSAP 전체 x N2SF | 완료 | C4 |
| FR-3.2 | N2SF 6개 영역 통제 | `03-n2sf/domains/` (6파일) | TC-C5-001~004 | — | 완료 | C5 |
| FR-3.3 | 데이터 등급 분류 | `03-n2sf/data-grade-classification.md` | TC-C4-003 | N2SF-N05 | 완료 | C4 |
| FR-3.6 | N2SF 아키텍처 | `03-n2sf/n2sf-infrastructure-architecture.md` | TC-I5-001~004 | — | 완료 | I5 |

### FR-4.x 감리 산출물

| FR ID | 요구사항명 | 구현 산출물 | 테스트 케이스 | 관련 CSAP | 상태 | MTU |
|-------|---------|---------|------------|---------|------|-----|
| FR-4.1 | T01 사업계획서 | `06-audit-compliance/templates/T01-business-plan.md` | TC-A3a-001 | CSAP-D12 | 완료 | A3a |
| FR-4.2 | T02 요구사항정의서 | `06-audit-compliance/templates/T02-requirements.md` | TC-A3a-002 | CSAP-D12 | 완료 | A3a |
| FR-4.3 | T03+T04 설계+추적 | `06-audit-compliance/templates/T03, T04` | TC-A3a-003~004 | CSAP-D12 | 완료 | A3a |

### FR-5.x 인프라

| FR ID | 요구사항명 | 구현 산출물 | 테스트 케이스 | 관련 CSAP | 상태 | MTU |
|-------|---------|---------|------------|---------|------|-----|
| FR-5.1 | k3s 클러스터 | `07-infra/k3s-wsl2/` (3파일) | TC-I1-001~005 | CSAP-D11 | 완료 | I1 |
| FR-5.2 | Gitea CI/CD | `07-infra/gitea-cicd-guide.md` | TC-I2-001~004 | CSAP-D12 | 완료 | I2 |
| FR-5.3 | GitOps 자동 배포 | `07-infra/flux-gitops-guide.md`, `harbor-registry-guide.md` | TC-I3-001~004 | CSAP-D05 | 완료 | I3 |
| FR-5.4 | 네트워크+모니터링 | `07-infra/network-policy-guide.md`, `opentelemetry-guide.md` | TC-I4-001~004 | CSAP-D10,D06 | 완료 | I4 |

### FR-10.x 공급망 보안

| FR ID | 요구사항명 | 구현 산출물 | 테스트 케이스 | 관련 CSAP | 상태 | MTU |
|-------|---------|---------|------------|---------|------|-----|
| FR-10.1 | SBOM 자동 생성 | `07-infra/supply-chain/sbom-guide.md` | TC-C8-001~003 | CSAP-D05-02 | 완료 | C8 |
| FR-10.2 | 이미지 서명 검증 | `07-infra/supply-chain/sigstore-signing.md` | TC-C8-004~007 | CSAP-D05-03 | 완료 | C8 |

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

---

## 5. 추적성 통계

| 추적 방향 | 전체 항목 | 매핑 완료 | 미매핑 | 커버리지 |
|---------|---------|---------|--------|---------|
| FR → 산출물 | 20 | 20 | 0 | 100% |
| FR → 테스트 | 20 | 20 | 0 | 100% |
| FR → CSAP | 20 | 15 | 5 (CSAP 미해당) | 100% |
| CSAP → FR | 79 | 79 | 0 | 100% |
| N2SF → FR | 6 영역 | 6 | 0 | 100% |

> **결론**: 모든 FR이 산출물·테스트·CSAP와 4방향으로 추적 가능합니다. 감리관이 임의의 FR ID를 선택하면 해당 산출물, 테스트 케이스, CSAP 통제 항목을 즉시 확인할 수 있습니다.

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 최초 작성 — FR↔산출물↔테스트↔CSAP 4방향 매트릭스 | Claude Code |
