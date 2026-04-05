# OPA/Gatekeeper 정책 — N2SF + CSAP 복합 컴플라이언스

| 항목 | 내용 |
|------|------|
| 문서 ID | PAC-OPA-001 |
| 버전 | 1.0.0 |
| 최종 수정일 | 2026-04-05 |
| 정책 엔진 | OPA/Gatekeeper |
| 정책 수 | 3개 (N2SF N03/N05 + CSAP D06-02) |
| FR 매핑 | FR-9.2 |
| MTU 매핑 | MTU-C7 |

<!-- Design Ref: MTU-C7 Plan -- OPA Rego 정책 -->
<!-- Plan SC: N2SF N03/N05 매핑 정책 2개 이상 -->

---

## OPA/Gatekeeper 선택 근거

Kyverno로 표현하기 어려운 복잡한 컴플라이언스 로직에 OPA/Gatekeeper를 사용합니다:

| 정책 | 복잡도 이유 | Kyverno 한계 |
|------|---------|-----------|
| 로그 보존 강제 | PVC 용량 계산 + 보존 기간 교차 검증 | 수치 연산 한계 |
| Namespace 간 통신 제한 | 등급 간 계층적 규칙 (C>S>O 단방향만 허용) | 복합 조건 표현 한계 |
| 데이터 등급 레이블 강제 | 외부 데이터 참조 (등급 정의 ConfigMap) | 외부 데이터 통합 미지원 |

---

## 1. 로그 보존 정책 강제 (CSAP-D06-02)

PVC 생성 시 로그 보존 설정이 1년 이상인지 검증합니다.

### ConstraintTemplate

```yaml
# CSAP-D06-02: 로그 보존 정책 — PVC에 보존 기간 annotation 강제
apiVersion: templates.gatekeeper.sh/v1
kind: ConstraintTemplate
metadata:
  name: k8slogretention
  annotations:
    csap.control: "D06-02"
    description: "로그 보존 설정 없는 PVC 생성 차단 (1년 이상 보존 강제)"
spec:
  crd:
    spec:
      names:
        kind: K8sLogRetention
      validation:
        openAPIV3Schema:
          type: object
          properties:
            minRetentionDays:
              type: integer
              description: "최소 보존 기간 (일)"
            targetNamespaces:
              type: array
              items:
                type: string
              description: "적용 대상 Namespace 목록"
  targets:
    - target: admission.k8s.gatekeeper.sh
      rego: |
        package k8slogretention

        # CSAP-D06-02: 로그 보존 정책 Rego 규칙
        violation[{"msg": msg}] {
          input.review.kind.kind == "PersistentVolumeClaim"

          # 대상 Namespace 확인
          ns := input.review.object.metadata.namespace
          ns == input.parameters.targetNamespaces[_]

          # 보존 기간 annotation 확인
          annotations := input.review.object.metadata.annotations
          not annotations["log.retention/days"]

          msg := sprintf(
            "[CSAP-D06-02] PVC '%s/%s'에 log.retention/days annotation이 없습니다. "
            + "최소 %d일 이상 보존 기간을 설정해야 합니다.",
            [ns, input.review.object.metadata.name, input.parameters.minRetentionDays]
          )
        }

        violation[{"msg": msg}] {
          input.review.kind.kind == "PersistentVolumeClaim"

          ns := input.review.object.metadata.namespace
          ns == input.parameters.targetNamespaces[_]

          annotations := input.review.object.metadata.annotations
          retention := to_number(annotations["log.retention/days"])
          retention < input.parameters.minRetentionDays

          msg := sprintf(
            "[CSAP-D06-02] PVC '%s/%s'의 보존 기간이 %d일로 "
            + "최소 요건 %d일에 미달합니다.",
            [ns, input.review.object.metadata.name, retention,
             input.parameters.minRetentionDays]
          )
        }
```

### Constraint

```yaml
apiVersion: constraints.gatekeeper.sh/v1beta1
kind: K8sLogRetention
metadata:
  name: require-log-retention-1year
  annotations:
    csap.control: "D06-02"
spec:
  enforcementAction: deny
  match:
    kinds:
      - apiGroups: [""]
        kinds: ["PersistentVolumeClaim"]
    namespaces:
      - grade-c
      - grade-s
      - grade-o
  parameters:
    minRetentionDays: 365
    targetNamespaces:
      - grade-c
      - grade-s
      - grade-o
```

**검증 명령**:

```bash
# Template + Constraint 적용
kubectl apply -f k8s-log-retention-template.yaml
kubectl apply -f require-log-retention-1year.yaml

# 보존 기간 미설정 PVC → 거부
kubectl apply -f - <<EOF
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: test-no-retention
  namespace: grade-s
spec:
  accessModes: ["ReadWriteOnce"]
  resources:
    requests:
      storage: 10Gi
EOF
# Expected: denied — [CSAP-D06-02] log.retention/days annotation 없음

# 보존 기간 365일 설정 PVC → 허용
kubectl apply -f - <<EOF
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: test-with-retention
  namespace: grade-s
  annotations:
    log.retention/days: "365"
spec:
  accessModes: ["ReadWriteOnce"]
  resources:
    requests:
      storage: 10Gi
EOF
# Expected: created
```

---

## 2. Namespace 간 통신 제한 (N2SF-N03)

데이터 등급 간 비인가 통신을 차단합니다. 상위 등급에서 하위 등급으로의 단방향 통신만 허용합니다.

### ConstraintTemplate

```yaml
# N2SF-N03: 분리 격리 — 등급 간 Namespace 통신 제한
apiVersion: templates.gatekeeper.sh/v1
kind: ConstraintTemplate
metadata:
  name: k8snamespaceisolation
  annotations:
    n2sf.area: "N03"
    description: "N2SF 등급 기반 Namespace 간 통신 제한"
spec:
  crd:
    spec:
      names:
        kind: K8sNamespaceIsolation
      validation:
        openAPIV3Schema:
          type: object
          properties:
            gradeHierarchy:
              type: array
              items:
                type: string
              description: "등급 계층 (높은 순서): [C, S, O]"
  targets:
    - target: admission.k8s.gatekeeper.sh
      rego: |
        package k8snamespaceisolation

        # N2SF N-03: Namespace 격리 Rego 규칙
        # NetworkPolicy가 다른 등급 Namespace로의 통신을 허용하는지 검사

        violation[{"msg": msg}] {
          input.review.kind.kind == "NetworkPolicy"

          # 현재 Namespace의 데이터 등급
          ns := input.review.object.metadata.namespace
          source_grade := data.inventory.namespace[ns].metadata.labels["data-grade"]

          # Egress 규칙에서 대상 Namespace 등급 확인
          egress := input.review.object.spec.egress[_]
          to := egress.to[_]
          target_grade := to.namespaceSelector.matchLabels["data-grade"]

          # 등급 계층 위반 확인 (하위→상위 통신 금지)
          grade_index(source_grade) > grade_index(target_grade)

          msg := sprintf(
            "[N2SF-N03] '%s' Namespace(%s등급)에서 %s등급 Namespace로의 "
            + "Egress가 감지되었습니다. 하위→상위 등급 통신은 금지됩니다.",
            [ns, source_grade, target_grade]
          )
        }

        # 등급 인덱스 (C=0, S=1, O=2 — 숫자가 낮을수록 높은 등급)
        grade_index(grade) = idx {
          hierarchy := input.parameters.gradeHierarchy
          hierarchy[idx] == grade
        }
```

### Constraint

```yaml
apiVersion: constraints.gatekeeper.sh/v1beta1
kind: K8sNamespaceIsolation
metadata:
  name: enforce-grade-isolation
  annotations:
    n2sf.area: "N03"
spec:
  enforcementAction: deny
  match:
    kinds:
      - apiGroups: ["networking.k8s.io"]
        kinds: ["NetworkPolicy"]
  parameters:
    gradeHierarchy:
      - "C"     # 최고 등급 (index 0)
      - "S"     # 중간 등급 (index 1)
      - "O"     # 최하 등급 (index 2)
```

---

## 3. 데이터 등급 Namespace 레이블 강제 (N2SF-N05)

모든 워크로드 Namespace에 `data-grade` 레이블을 필수로 부여합니다.

### ConstraintTemplate

```yaml
# N2SF-N05: 데이터 등급 분리 — Namespace 레이블 강제
apiVersion: templates.gatekeeper.sh/v1
kind: ConstraintTemplate
metadata:
  name: k8srequiredatagrade
  annotations:
    n2sf.area: "N05"
    description: "모든 워크로드 Namespace에 data-grade 레이블 필수"
spec:
  crd:
    spec:
      names:
        kind: K8sRequireDataGrade
      validation:
        openAPIV3Schema:
          type: object
          properties:
            allowedGrades:
              type: array
              items:
                type: string
              description: "허용되는 등급 값 목록"
            exemptNamespaces:
              type: array
              items:
                type: string
              description: "면제 Namespace 목록 (시스템 NS)"
  targets:
    - target: admission.k8s.gatekeeper.sh
      rego: |
        package k8srequiredatagrade

        # N2SF N-05: 데이터 등급 Namespace 레이블 강제

        violation[{"msg": msg}] {
          input.review.kind.kind == "Namespace"

          # 면제 Namespace 제외
          ns_name := input.review.object.metadata.name
          not ns_name == input.parameters.exemptNamespaces[_]

          # data-grade 레이블 존재 확인
          labels := input.review.object.metadata.labels
          not labels["data-grade"]

          msg := sprintf(
            "[N2SF-N05] Namespace '%s'에 data-grade 레이블이 없습니다. "
            + "허용 값: %v. 모든 워크로드 Namespace는 데이터 등급 분류가 필수입니다.",
            [ns_name, input.parameters.allowedGrades]
          )
        }

        violation[{"msg": msg}] {
          input.review.kind.kind == "Namespace"

          ns_name := input.review.object.metadata.name
          not ns_name == input.parameters.exemptNamespaces[_]

          labels := input.review.object.metadata.labels
          grade := labels["data-grade"]

          # 허용된 등급 값인지 확인
          not grade == input.parameters.allowedGrades[_]

          msg := sprintf(
            "[N2SF-N05] Namespace '%s'의 data-grade 값 '%s'은 "
            + "허용되지 않습니다. 허용 값: %v",
            [ns_name, grade, input.parameters.allowedGrades]
          )
        }
```

### Constraint

```yaml
apiVersion: constraints.gatekeeper.sh/v1beta1
kind: K8sRequireDataGrade
metadata:
  name: require-data-grade-label
  annotations:
    n2sf.area: "N05"
spec:
  enforcementAction: deny
  match:
    kinds:
      - apiGroups: [""]
        kinds: ["Namespace"]
  parameters:
    allowedGrades:
      - "C"
      - "S"
      - "O"
    exemptNamespaces:
      - kube-system
      - kube-public
      - kube-node-lease
      - kyverno
      - gatekeeper-system
      - default
```

**검증 명령**:

```bash
# Template + Constraint 적용
kubectl apply -f k8s-require-data-grade-template.yaml
kubectl apply -f require-data-grade-label.yaml

# 등급 레이블 없는 Namespace → 거부
kubectl create namespace test-no-grade
# Expected: denied — [N2SF-N05] data-grade 레이블 없음

# 등급 레이블 있는 Namespace → 허용
kubectl create namespace test-with-grade --dry-run=client -o yaml | \
  kubectl label --local -f - data-grade=O --dry-run=client -o yaml | \
  kubectl apply -f -
# Expected: created
```

---

## 일괄 적용 명령

```bash
# 1. ConstraintTemplate 적용 (먼저)
kubectl apply -f k8s-log-retention-template.yaml
kubectl apply -f k8s-namespace-isolation-template.yaml
kubectl apply -f k8s-require-data-grade-template.yaml

# 2. Template 준비 대기
kubectl wait --for=condition=established \
  constrainttemplate/k8slogretention \
  constrainttemplate/k8snamespaceisolation \
  constrainttemplate/k8srequiredatagrade \
  --timeout=60s

# 3. Constraint 적용
kubectl apply -f require-log-retention-1year.yaml
kubectl apply -f enforce-grade-isolation.yaml
kubectl apply -f require-data-grade-label.yaml

# 4. 적용 확인
kubectl get constrainttemplates
kubectl get constraints -o wide
```

---

## 관련 문서

- [Policy as Code README](./README.md) — 하이브리드 정책 전략 개요
- [Kyverno 정책](./kyverno-policies.md) — CSAP 매핑 정책 8개
- [N03 격리 구현 가이드](../../03-n2sf/domains/N03-isolation.md) (MTU-C5)
- [N05 데이터 구현 가이드](../../03-n2sf/domains/N05-data.md) (MTU-C5)
- [CSAP D06 침해사고 관리](../../02-csap/standard-grade/implementation-guide/D06-incident.md)

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 최초 작성 — OPA/Gatekeeper 정책 3개 (N03/N05/D06-02) | Claude Code |
