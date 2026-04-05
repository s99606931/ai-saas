# MTU-C7: Policy as Code [신규]

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-C7 |
| Phase | Phase 2 Core Security / Phase 3 Infrastructure |
| 상태 | Draft |
| 작성일 | 2026-04-05 |
| FR 매핑 | FR-9.1 (신규), FR-9.2, FR-9.3 |
| 의존 MTU | MTU-I1 (k3s 구성 완료 후) |
| 예상 세션 | 2 세션 |
| 중요도 | P0 |

---

## 목적

k3s 클러스터에서 CSAP 보안 정책을 코드로 자동 적용합니다.
수동 보안 설정이 아닌, 정책 파일 배포만으로 클러스터 전체에 CSAP 통제가 적용됩니다.

**시장조사 근거**:
- Kyverno: CNCF Incubating 2026년 상승, Kubernetes 네이티브 (새 언어 불필요)
- OPA/Gatekeeper: 복잡한 컴플라이언스 로직, 외부 데이터 통합 (Rego DSL)
- 2026 권장: 하이브리드 접근 (단순 정책 → Kyverno, 복잡 정책 → OPA)
- EU Cyber Resilience Act(CRA) 대비 Policy as Code 필수화 추세

---

## 산출물 파일 (3개)

| 파일 | 문서 유형 | 핵심 내용 |
|------|---------|---------|
| `05-infra/policy-as-code/kyverno-policies.md` | 구현 가이드형 | CSAP D08/D11/D12 기반 Kyverno 정책 |
| `05-infra/policy-as-code/opa-gatekeeper.md` | 구현 가이드형 | 복잡한 컴플라이언스 정책 (Rego) |
| `05-infra/policy-as-code/README.md` | 아키텍처 레퍼런스형 | 하이브리드 정책 전략 + CSAP 매핑 |

---

## Kyverno 정책 매핑 (CSAP 기반)

| CSAP 항목 | 정책 내용 | 도구 |
|---------|---------|------|
| CSAP-D08-01 (계정 권한 분리) | ServiceAccount 제한, non-root 강제 | Kyverno |
| CSAP-D08-05 (특권 모드 제한) | privileged container 금지 | Kyverno |
| CSAP-D09-01 (암호화 정책) | Secret 암호화 강제 (etcd-at-rest), TLS 미적용 Service 금지 | Kyverno |
| CSAP-D09-02 (암호 강도) | 취약 알고리즘(MD5, SHA-1) 포함 이미지 배포 차단 | Kyverno + Cosign |
| CSAP-D11-03 (컨테이너 불변성) | readOnlyRootFilesystem 강제 | Kyverno |
| CSAP-D12-08 (취약점 스캔 통과) | 서명된 이미지만 배포 허용 | Kyverno + Cosign |
| CSAP-D10-04 (네트워크 분리) | NetworkPolicy 기본 차단 정책 (기본 Deny-all) | Kyverno |
| CSAP-D06-01 (감사 로그 강제) | audit.jsonl 미생성 Pod 배포 차단 (annotation 검사) | Kyverno |
| CSAP-D06-02 (로그 보존 정책) | 로그 보존 설정 없는 PVC 생성 차단 (1년 이상 보존 강제) | OPA/Gatekeeper |
| N2SF-N03 (분리 격리) | Namespace 간 통신 제한 | OPA/Gatekeeper |
| N2SF-N05 (데이터 등급 분리) | 등급별 Namespace 레이블 강제 | OPA/Gatekeeper |

---

## 기능 요구사항

| ID | 요구사항 | 수용 기준 |
|----|---------|---------|
| FR-9.1 | Kyverno 정책 8개 이상 | CSAP D08/D09/D10/D11/D12/D06 매핑 정책 (D-09 암호화 + D-06 감사로그 포함) |
| FR-9.2 | OPA Rego 정책 2개 이상 | N2SF N03/N05 매핑 정책 |
| FR-9.3 | k3s 적용 확인 방법 | `kubectl apply` + `kubectl get` 검증 명령 |

---

## 합격 기준

1. k3s 클러스터에 `kubectl apply -f kyverno-policies.yaml` 명령으로 정책 적용 성공
2. 비규정 준수 Pod 생성 시 자동 거부 (reject) 확인
3. CSAP-D08/D11/D12 매핑 정책 최소 5개 포함
4. 각 정책에 CSAP ID 주석 포함 (`# CSAP-D08-01: 계정 권한 분리`)
5. Auditor 에이전트 검증 통과

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 0.1.0 | 2026-04-05 | 최초 작성 — 시장조사 반영 신규 MTU | Claude Code |
| 0.2.0 | 2026-04-05 | P1: D-09 암호화 정책(Secret 암호화, TLS 강제) + D-06 감사로그 정책(audit.jsonl 강제, 로그 보존) Kyverno/OPA 매핑 추가, FR-9.1 정책 수 8개 이상으로 상향 | Claude Code |
