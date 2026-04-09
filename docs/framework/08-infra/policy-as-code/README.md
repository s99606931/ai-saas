# Policy as Code — 하이브리드 정책 전략

| 항목 | 내용 |
|------|------|
| 문서 ID | PAC-001 |
| 버전 | 1.0.0 |
| 최종 수정일 | 2026-04-05 |
| 대상 독자 | 인프라 엔지니어, 보안 담당자, DevSecOps 팀 |
| FR 매핑 | FR-9.1, FR-9.2, FR-9.3 |
| MTU 매핑 | MTU-C7 |

<!-- Design Ref: MTU-C7 Plan -- Policy as Code -->
<!-- Plan SC: Kyverno 8+ 정책, OPA 2+ 정책, kubectl 검증 -->

---

## 1. 개요

Policy as Code는 CSAP 보안 정책을 수동 설정이 아닌 코드로 정의하여 k3s 클러스터에 자동 적용하는 접근 방식입니다. 정책 파일 배포만으로 클러스터 전체에 CSAP 통제가 일괄 적용됩니다.

### 하이브리드 전략 근거

| 도구 | 용도 | 장점 | 단점 |
|------|------|------|------|
| **Kyverno** | 단순~중간 복잡도 정책 | Kubernetes 네이티브 YAML, 학습 곡선 낮음, CNCF Incubating | 복잡한 로직 한계 |
| **OPA/Gatekeeper** | 복잡한 컴플라이언스 정책 | Rego DSL로 복잡 로직 표현, 외부 데이터 통합 | 학습 곡선 높음 |

**권장 조합**: 단순 정책(8개+) Kyverno, 복잡 정책(2개+) OPA/Gatekeeper

---

## 2. CSAP 통제항목 x 정책 도구 매핑

| CSAP 항목 | 통제 내용 | 도구 | 정책 파일 |
|---------|---------|------|---------|
| CSAP-D08-01 | 계정 권한 분리 — ServiceAccount 제한, non-root 강제 | Kyverno | `kyverno-policies.md` §1 |
| CSAP-D08-05 | 특권 모드 제한 — privileged container 금지 | Kyverno | `kyverno-policies.md` §2 |
| CSAP-D09-01 | 암호화 정책 — Secret 암호화, TLS 미적용 차단 | Kyverno | `kyverno-policies.md` §3 |
| CSAP-D09-02 | 암호 강도 — 취약 알고리즘 이미지 차단 | Kyverno + Cosign | `kyverno-policies.md` §4 |
| CSAP-D10-04 | 네트워크 분리 — NetworkPolicy 기본 Deny-all | Kyverno | `kyverno-policies.md` §5 |
| CSAP-D11-03 | 컨테이너 불변성 — readOnlyRootFilesystem 강제 | Kyverno | `kyverno-policies.md` §6 |
| CSAP-D12-08 | 취약점 스캔 통과 — 서명된 이미지만 배포 | Kyverno + Cosign | `kyverno-policies.md` §7 |
| CSAP-D06-01 | 감사 로그 강제 — audit annotation 필수 | Kyverno | `kyverno-policies.md` §8 |
| CSAP-D06-02 | 로그 보존 정책 — PVC 보존 강제 | OPA/Gatekeeper | `opa-gatekeeper.md` §1 |
| N2SF-N03 | 분리 격리 — Namespace 간 통신 제한 | OPA/Gatekeeper | `opa-gatekeeper.md` §2 |
| N2SF-N05 | 데이터 등급 분리 — Namespace 레이블 강제 | OPA/Gatekeeper | `opa-gatekeeper.md` §3 |

---

## 3. 아키텍처

```
개발자 → git push → Gitea (MTU-I2)
                          │
                  ┌───────▼────────┐
                  │ Gitea Actions  │
                  │ (CI/CD)        │
                  └───────┬────────┘
                          │
                          ▼
              ┌──────────────────────┐
              │  k3s 클러스터         │
              │                      │
              │  ┌────────────────┐  │
              │  │ Kyverno        │  │  ← 8+ 정책 (Admission Webhook)
              │  │ (ValidatingWH) │  │
              │  └────────────────┘  │
              │                      │
              │  ┌────────────────┐  │
              │  │ OPA/Gatekeeper │  │  ← 3+ 정책 (Constraint Templates)
              │  │ (ValidatingWH) │  │
              │  └────────────────┘  │
              │                      │
              │  Pod 생성 요청 ──────┤
              │       │              │
              │  Kyverno 검사 ───────┤  비규정 준수 → REJECT
              │       │              │
              │  Gatekeeper 검사 ────┤  비규정 준수 → REJECT
              │       │              │
              │  Pod 생성 허용 ───────┤  통과 시 → ALLOW
              └──────────────────────┘
```

---

## 4. 설치 및 적용

### 4.1 Kyverno 설치 (Helm)

```bash
# Kyverno 설치 (k3s 클러스터)
helm repo add kyverno https://kyverno.github.io/kyverno/
helm repo update

helm install kyverno kyverno/kyverno \
  --namespace kyverno --create-namespace \
  --set replicaCount=1 \
  --set resources.requests.memory=256Mi \
  --set resources.limits.memory=512Mi

# 설치 확인
kubectl get pods -n kyverno
kubectl get clusterpolicies
```

### 4.2 OPA/Gatekeeper 설치 (Helm)

```bash
# Gatekeeper 설치
helm repo add gatekeeper https://open-policy-agent.github.io/gatekeeper/charts
helm repo update

helm install gatekeeper gatekeeper/gatekeeper \
  --namespace gatekeeper-system --create-namespace \
  --set replicas=1 \
  --set audit.replicas=1

# 설치 확인
kubectl get pods -n gatekeeper-system
kubectl get constrainttemplates
```

### 4.3 정책 일괄 적용

```bash
# Kyverno 정책 적용 (kyverno-policies.md 내 YAML 추출 후)
kubectl apply -f kyverno-policies/

# OPA Constraint Template + Constraint 적용
kubectl apply -f opa-constraints/

# 적용 확인
kubectl get clusterpolicies -o wide
kubectl get constraints -o wide

# 정책 위반 테스트 (비규정 준수 Pod 생성 시도)
kubectl run test-violation --image=nginx --privileged=true 2>&1
# Expected: Error from server: admission webhook denied the request
```

---

## 5. 모니터링 및 감사

### 정책 위반 모니터링

```bash
# Kyverno 정책 위반 이벤트 조회
kubectl get events --field-selector reason=PolicyViolation -A

# Kyverno 보고서 조회 (AdmissionReport)
kubectl get admissionreports -A

# OPA/Gatekeeper 위반 조회
kubectl get constraints -o json | jq '.items[].status.violations'
```

### 감사 로그 연동

```typescript
// Policy as Code 위반 시 audit.jsonl 기록
interface PolicyViolation {
  timestamp: string
  policyName: string
  policyEngine: 'kyverno' | 'gatekeeper'
  resource: string        // 위반 리소스 (Pod/Deployment 등)
  namespace: string
  csapControl: string     // 관련 CSAP 통제 ID
  action: 'BLOCKED'       // 항상 차단
  message: string
}
```

---

## 6. 관련 문서

- [Kyverno 정책 상세](./kyverno-policies.md) — CSAP D08/D09/D10/D11/D12/D06 매핑 정책 8개+
- [OPA/Gatekeeper 정책 상세](./opa-gatekeeper.md) — N2SF N03/N05 + CSAP D06-02 매핑 정책 3개
- [CSAP D08 접근 통제 구현 가이드](../../02-csap/standard-grade/implementation-guide/D08-access-control.md)
- [CSAP D11 가상화 보안 구현 가이드](../../02-csap/standard-grade/implementation-guide/D11-virtualization.md)
- [N03 격리 구현 가이드](../../04-n2sf/domains/N03-isolation.md) (MTU-C5)
- [컨테이너 보안 베이스라인](../container-security-baseline.md) (MTU-I1)

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 최초 작성 — 하이브리드 정책 전략 (Kyverno + OPA) | Claude Code |
