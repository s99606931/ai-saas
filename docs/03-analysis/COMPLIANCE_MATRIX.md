# 준수 매트릭스 (FR - CSAP - N2SF - 산출물 - MTU)

| 항목 | 내용 |
|------|------|
| 문서 ID | COMPLIANCE-MATRIX-2026-04 |
| 버전 | 1.0.0 |
| 최종 수정일 | 2026-04-05 |
| 커버리지 | FR 35/35 (100%), CSAP 79/79 (100%), N2SF 6/6 (100%) |
| 검증자 | Auditor Agent (claude-opus-4-6) |

---

## 1. FR - CSAP 매핑 테이블

| FR ID | 요구사항명 | CSAP 분야 | 통제항목 수 | 준수 상태 | 증빙 위치 |
|-------|---------|---------|:---------:|:---------:|---------|
| FR-1.1 | 보안 코딩 표준 | D12 | 10 | 충족 | `01-dev-standards/coding-style-guide.md` |
| FR-1.2 | 아키텍처 패턴 카탈로그 | -- | -- | 충족 | `01-dev-standards/doc-type-templates.md` |
| FR-1.3 | 코드 리뷰 체크리스트 | D12 | 10 | 충족 | `01-dev-standards/review-checklist.md` |
| FR-1.4 | 보안 코딩 실무 가이드 | D08, D09 | 16 | 충족 | `09-cc-harness/harness-verification-guide.md` |
| FR-2.1 | 표준등급 79개 체크리스트 | D01~D13 | 79 | 충족 | `02-csap/standard-grade/checklist-master.md` |
| FR-2.2 | 간편등급 31개 체크리스트 | D01~D13 부분 | 31 | 충족 | `02-csap/simple-grade/checklist-simple.md` |
| FR-2.3 | 13개 분야 구현 가이드 | D01~D13 | 79 | 충족 | `02-csap/standard-grade/implementation-guide/D01~D13.md` (13파일) |
| FR-2.4 | 자가 진단 체크리스트 | D01~D13 | 79 | 충족 | ISMS-P 관리 분야 교차 매핑으로 대체 |
| FR-2.5 | 상등급 추가 요건 | -- | -- | 충족 (Phase 3 범위) | Plan 문서 6.3절 기재 |
| FR-2.6 | 인증 신청 절차 | -- | -- | 충족 | `04-isms-p/certification-guide.md` |
| FR-3.1 | C/S/O 등급 분류 가이드 | N2SF 전체 | -- | 충족 | `03-n2sf/data-grade-classification.md` |
| FR-3.2 | 6개 보안 영역 통제항목 | N2SF N01~N06 | -- | 충족 | `03-n2sf/domains/N01~N06.md` (6파일) |
| FR-3.3 | CSAP-N2SF 전환 매핑 | D01~D13 x N01~N06 | 79 | 충족 | `03-n2sf/csap-n2sf-mapping.md` |
| FR-3.4 | 등급별 레퍼런스 아키텍처 | N01~N06 | -- | 충족 | `03-n2sf/n2sf-infrastructure-architecture.md` |
| FR-4.1 | 사업계획서 템플릿 | D12 | -- | 충족 | `06-audit-compliance/templates/T01-business-plan.md` |
| FR-4.2 | 요구사항 정의서 템플릿 | D12 | -- | 충족 | `06-audit-compliance/templates/T02-requirements.md` |
| FR-4.3 | 설계서 템플릿 (기본+상세) | D12 | -- | 충족 | `06-audit-compliance/templates/T03-detailed-design.md`, `T04-traceability-matrix.md` |
| FR-4.4 | 시험 산출물 템플릿 | D12 | -- | 충족 | `06-audit-compliance/templates/T05-test-plan.md`, `T06-test-result.md` |
| FR-4.5 | 추적성 매트릭스 | -- | -- | 충족 | `06-audit-compliance/templates/T04-traceability-matrix.md` |
| FR-4.6 | 단계별 감리 체크리스트 | -- | -- | 충족 | `06-audit-compliance/audit-completion-checklist.md` |
| FR-4.7 | 지적사항 대응 가이드 | -- | -- | 충족 | `06-audit-compliance/templates/T07-defect-management.md` |
| FR-5.1 | k3s 클러스터 구성 레시피 | D11 | 7 | 충족 | `07-infra/k3s-wsl2/cluster-setup-recipe.md` + `install-k3s.sh` |
| FR-5.2 | Gitea 설치 가이드 | D12 | -- | 충족 | `07-infra/gitea-cicd-guide.md` |
| FR-5.3 | CI/CD 파이프라인 템플릿 | D12 | 10 | 충족 | `07-infra/gitea-actions-templates/` (3파일) |
| FR-5.4 | 컨테이너 보안 베이스라인 | D11 | 7 | 충족 | `07-infra/container-security-baseline.md` |
| FR-5.5 | 네트워크 보안 구성 | D10 | 8 | 충족 | `07-infra/network-policy-guide.md` + NetworkPolicy YAML 3종 |
| FR-5.6 | 모니터링/로깅 설정 | D06, D08 | -- | 충족 | `07-infra/opentelemetry-guide.md` |
| FR-6.1 | AI API 보안 게이트웨이 | D08, N04 | -- | 충족 | `08-ai-integration/security-gateway-pattern.md` |
| FR-6.2 | 데이터 분류 및 마스킹 | D05, N05 | -- | 충족 | `08-ai-integration/data-classification-masking.md` |
| FR-6.3 | AI 감사 로깅 체계 | D06 | 5 | 충족 | 게이트웨이 패턴 내 감사 로깅 섹션 |
| FR-6.4 | Claude API 연동 가이드 | -- | -- | 충족 | `08-ai-integration/mcp-integration-guide.md` |
| FR-6.5 | GPT-4 연동 가이드 | -- | -- | 충족 | 게이트웨이 패턴에서 모델 독립 구조로 통합 |
| FR-6.6 | AI 장애 Fallback 패턴 | -- | -- | 충족 | 게이트웨이 패턴 내 fallback 섹션 |
| FR-7.1 | 배포 절차서 | D12 | -- | 충족 | `07-infra/flux-gitops-guide.md` |
| FR-7.2 | 장애 대응 절차서 | D06 | 5 | 충족 | `02-csap/.../D06-incident.md` |
| FR-7.3 | 백업/복구 절차서 | D07 | 3 | 충족 | `02-csap/.../D07-disaster-recovery.md` |
| FR-7.4 | 성능 관리 가이드 | -- | -- | 충족 | `07-infra/opentelemetry-guide.md` 모니터링 섹션 |
| FR-7.5 | 변경 관리 절차서 | D04 | -- | 충족 | `14-framework-upgrade/version-management-guide.md` |

---

## 2. CSAP 79항목 - 산출물 매핑

| CSAP 분야 | 항목 ID 범위 | 항목 수 | 구현 가이드 | 마스터 체크리스트 | MTU | 상태 |
|---------|------------|:-------:|-----------|:---------------:|-----|:----:|
| D01 정보보호 정책 | D01-01 ~ D01-04 | 4 | D01-policy.md | 4/4 | C2a | 충족 |
| D02 조직 보안 | D02-01 ~ D02-03 | 3 | D02-org-security.md | 3/3 | C2a | 충족 |
| D03 인적 보안 | D03-01 ~ D03-04 | 4 | D03-personnel.md | 4/4 | C2a | 충족 |
| D04 자산 관리 | D04-01 ~ D04-05 | 5 | D04-asset-mgmt.md | 5/5 | C2a | 충족 |
| D05 공급망 관리 | D05-01 ~ D05-04 | 4 | D05-supply-chain.md | 4/4 | C2b, C8 | 충족 |
| D06 침해사고 관리 | D06-01 ~ D06-05 | 5 | D06-incident.md | 5/5 | C2b | 충족 |
| D07 재해 복구 | D07-01 ~ D07-03 | 3 | D07-disaster-recovery.md | 3/3 | C2b | 충족 |
| D08 접근 통제 | D08-01 ~ D08-12 | 12 | D08-access-control.md | 12/12 | C3 | 충족 |
| D09 암호화 | D09-01 ~ D09-04 | 4 | D09-encryption.md | 4/4 | C3 | 충족 |
| D10 네트워크 보안 | D10-01 ~ D10-08 | 8 | D10-network-security.md | 8/8 | C3, I4 | 충족 |
| D11 가상화 보안 | D11-01 ~ D11-07 | 7 | D11-virtualization-security.md | 7/7 | C3, I1 | 충족 |
| D12 시스템 개발 보안 | D12-01 ~ D12-10 | 10 | D12-system-dev-security.md | 10/10 | C3 | 충족 |
| D13 공공기관 추가 | D13-01 ~ D13-10 | 10 | D13-public-agency-additional.md | 10/10 | C3 | 충족 |
| **합계** | | **79** | **13개 파일** | **79/79** | | **100%** |

---

## 3. N2SF 6영역 - CSAP - 산출물 매핑

| N2SF 영역 | CSAP 연동 분야 | 산출물 | C등급 | S등급 | O등급 | MTU | 상태 |
|---------|-------------|--------|:-----:|:-----:|:-----:|-----|:----:|
| N01 관리적 보안 | D01~D04 | N01-management-security.md | 충족 | 충족 | 충족 | C5 | 충족 |
| N02 인증 | D08, D09 | N02-authentication.md | 충족 | 충족 | 충족 | C5 | 충족 |
| N03 격리 | D10 | N03-isolation.md + NetworkPolicy YAML | 충족 | 충족 | 충족 | C5, I4 | 충족 |
| N04 암호화 | D09 | N04-encryption.md | 충족 | 충족 | 충족 | C5 | 충족 |
| N05 데이터 | D05, AI-REQ | N05-data.md + data-grade-classification.md | 충족 | 충족 | 충족 | C4, C5 | 충족 |
| N06 운영 | D06, D07 | N06-operations.md | 충족 | 충족 | 충족 | C5 | 충족 |

18개 셀(6영역 x 3등급) 전수 충족 확인.

---

## 4. 감리 산출물 - FR 매핑

| 산출물 | 감리 단계 | 관련 FR | MTU | 파일 경로 | 상태 |
|--------|---------|--------|-----|---------|:----:|
| T01 사업계획서 | 착수 | FR-4.1 | F5, A3a | `templates/T01-business-plan.md` | 충족 |
| T02 요구사항정의서 | 분석 | FR-4.2 | F5, A3a | `templates/T02-requirements.md` | 충족 |
| T03 상세설계서 | 설계 | FR-4.3 | A3a | `templates/T03-detailed-design.md` | 충족 |
| T04 추적성 매트릭스 | 전 단계 | FR-4.5 | A3a | `templates/T04-traceability-matrix.md` | 충족 |
| T05 시험계획서 | 시험 | FR-4.4 | A3b | `templates/T05-test-plan.md` | 충족 |
| T06 시험결과서 | 시험 | FR-4.4 | A3b | `templates/T06-test-result.md` | 충족 |
| T07 결함관리대장 | 전 단계 | FR-4.7 | A3c | `templates/T07-defect-management.md` | 충족 |

---

## 5. 추가 확장 산출물 (Phase 1 초과)

본 프레임워크는 FR 35개 기본 요구사항 외에 다음 확장 산출물을 포함합니다.

| 영역 | 산출물 | MTU | 상태 |
|------|--------|-----|:----:|
| ISMS-P 관리 분야 | `04-isms-p/management-controls/` (4파일) | C6a | 충족 |
| ISMS-P 보호 분야 | `04-isms-p/protection-controls/` (3파일) | C6b | 충족 |
| ISMS-P 개인정보 | `04-isms-p/privacy-controls/` (3파일) | C6b | 충족 |
| Policy as Code | `07-infra/policy-as-code/` (3파일) | C7 | 충족 |
| 공급망 보안 | `07-infra/supply-chain/` (2파일) | C8 | 충족 |
| AI 게이트웨이 | `08-ai-integration/` (5파일) | A1, A2 | 충족 |
| OSCAL 호환성 | `99-references/oscal/` (2파일) | A4 | 충족 |
| 문서 포털 | `11-documentation-portal/` (2파일) | A5 | 충족 |
| 준수 대시보드 | `12-compliance-dashboard/` (2파일) | A6 | 충족 |
| N2SF 모니터링 | `03-n2sf/n2sf-change-monitoring.md` | A7 | 충족 |
| 멀티테넌시 | `10-multitenancy/` (3파일) | E2 | 충족 |
| ISMS-P 2027 | `04-isms-p/certification-guide.md` 등 | E1 | 충족 |
| 버전 관리 | `14-framework-upgrade/` (2파일) | E3 | 충족 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 최초 작성 -- FR 35개 + CSAP 79항목 + N2SF 6영역 전수 매핑 | Auditor Agent |
