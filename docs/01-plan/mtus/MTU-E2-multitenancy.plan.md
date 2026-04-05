# MTU-E2: 공공기관 멀티테넌시 SaaS 아키텍처 설계 가이드

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-E2 |
| Phase | Phase 5 Ecosystem |
| 상태 | Draft |
| 작성일 | 2026-04-05 |
| FR 매핑 | FR-8.5 (멀티테넌시) |
| 의존 MTU | MTU-C3 (CSAP D08~D13), MTU-I1 (k3s WSL2), MTU-I3 (Flux GitOps + Harbor) |
| 예상 세션 | 2 세션 |

---

## 목적

공공기관 대상 SaaS 서비스에서 N2SF 데이터 등급별 테넌트 격리 수준을 정의하고,
CSAP D-08 접근 통제 준수·Kyverno 정책 기반 리소스 강제·자동화된 온보딩 절차를 제공합니다.
단일 k3s 클러스터에서 복수 공공기관이 안전하게 서비스를 공유할 수 있는 아키텍처 레퍼런스를 제시합니다.

---

## 시장조사 반영 / 선택 근거

| 근거 | 내용 |
|------|------|
| 공공 SaaS 확산 | 행정·공공기관 SaaS 전환율 2026년 40% → 단일 서비스로 다수 기관 동시 서비스 필요 |
| N2SF 격리 요건 | C등급(기밀) 데이터 처리 기관은 논리적 격리가 아닌 물리적 격리 요건 충족 필요 |
| Kyverno 표준화 | MTU-C7 Policy as Code에서 채택한 Kyverno를 테넌트 리소스 한도 강제에 재활용 |
| 온보딩 자동화 | 공공기관 조달 절차 특성상 계약 후 빠른 서비스 개통 요구 → 1일 이내 자동 온보딩 |

---

## 산출물 파일 (3개)

| 파일 | 문서 유형 | 핵심 내용 |
|------|---------|---------|
| `10-multitenancy/architecture-guide.md` | 아키텍처 레퍼런스형 | N2SF 등급별 격리 전략 + 전체 구성도 |
| `10-multitenancy/tenant-isolation-policy.md` | 구현 가이드형 | Kyverno 정책 예시 + C등급 에어갭 구성 |
| `10-multitenancy/onboarding-procedure.md` | 절차서형 | 테넌트 온보딩 자동화 절차 (1일 이내) |

---

## 핵심 설계 내용

### 1. N2SF 등급별 테넌트 격리 수준

| N2SF 등급 | 격리 수준 | k3s 구성 | CSAP 요건 |
|-----------|---------|---------|---------|
| C (기밀) | 클러스터 격리 (에어갭) | 전용 k3s 클러스터 + 물리 네트워크 분리 | D-08, D-09, D-12 전면 적용 |
| S (민감) | 네임스페이스 격리 | 전용 네임스페이스 + NetworkPolicy 완전 차단 | D-08, D-09 적용 |
| O (공개) | 논리 격리 (공유) | 공유 네임스페이스 + RBAC 분리 | D-08 적용 |

```
[C등급 테넌트] — 에어갭 클러스터
  ┌─────────────────────────────────────┐
  │  k3s Cluster (전용, 물리 분리)       │
  │  ├── namespace: tenant-c-ministryA  │
  │  └── namespace: tenant-c-ministryB  │
  │  네트워크: 외부 인터넷 완전 차단      │
  └─────────────────────────────────────┘

[S등급 테넌트] — 네임스페이스 격리
  ┌─────────────────────────────────────┐
  │  k3s Cluster (공유)                  │
  │  ├── namespace: tenant-s-agencyA    │
  │  │   NetworkPolicy: ingress/egress   │
  │  │   모두 동일 네임스페이스만 허용    │
  │  └── namespace: tenant-s-agencyB    │
  └─────────────────────────────────────┘

[O등급 테넌트] — 논리 격리 (공유)
  ┌─────────────────────────────────────┐
  │  k3s Cluster (공유)                  │
  │  └── namespace: tenant-o-shared     │
  │      RBAC으로 테넌트별 리소스 분리   │
  └─────────────────────────────────────┘
```

### 2. Kyverno 정책 — 테넌트 리소스 한도 강제

```yaml
# Kyverno ClusterPolicy: 테넌트 리소스 한도 필수화
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: require-tenant-resource-limits
spec:
  validationFailureAction: Enforce
  rules:
    - name: check-resource-limits
      match:
        any:
          - resources:
              kinds: [Pod]
              namespaceSelector:
                matchLabels:
                  tenant-type: public-saas
      validate:
        message: "테넌트 Pod에 CPU/메모리 한도 설정 필수 (CSAP D-08)"
        pattern:
          spec:
            containers:
              - resources:
                  limits:
                    cpu: "?*"
                    memory: "?*"
```

```yaml
# Kyverno Policy: C등급 테넌트 외부 네트워크 차단
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: block-external-network-grade-c
spec:
  validationFailureAction: Enforce
  rules:
    - name: deny-external-egress
      match:
        any:
          - resources:
              kinds: [NetworkPolicy]
              namespaceSelector:
                matchLabels:
                  n2sf-grade: "C"
      validate:
        message: "C등급 테넌트 네임스페이스는 외부 이그레스 허용 불가 (N2SF N-03)"
        deny:
          conditions:
            any:
              - key: "{{ request.object.spec.egress[].to[].ipBlock }}"
                operator: NotEquals
                value: ""
```

### 3. C등급 에어갭 격리 구성

```bash
# C등급 전용 k3s 클러스터 초기화 (에어갭 환경)
# 1. 외부 저장소 없이 Harbor 프라이빗 레지스트리만 사용
k3s server \
  --disable traefik \
  --private-registry /etc/rancher/k3s/registries.yaml \
  --cluster-cidr 10.42.0.0/16 \
  --service-cidr 10.43.0.0/16

# 2. 에어갭용 이미지 사전 로드
k3s ctr images import grade-c-images.tar

# 3. NetworkPolicy: 외부 통신 전면 차단
kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-all-external
  namespace: tenant-c-ministryA
spec:
  podSelector: {}
  policyTypes: [Ingress, Egress]
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              name: tenant-c-ministryA
  egress:
    - to:
        - namespaceSelector:
            matchLabels:
              name: tenant-c-ministryA
EOF
```

### 4. 테넌트 온보딩 자동화 절차 (1일 이내)

```
[T+0h] 온보딩 요청 접수
    입력: 기관명, N2SF 등급, 담당자 이메일, 서비스 용량 요구
         ↓
[T+1h] 자동화 스크립트 실행 (Gitea Actions)
    - 네임스페이스 생성: tenant-{grade}-{기관코드}
    - RBAC 역할·바인딩 생성 (CSAP D-08)
    - Kyverno 정책 적용 (리소스 한도, 네트워크 격리)
    - Harbor 프로젝트 생성 (이미지 격리)
         ↓
[T+4h] 초기 설정 검증 (자동)
    - 네임스페이스 격리 테스트 (타 테넌트 접근 불가 확인)
    - 리소스 한도 적용 확인
    - N2SF 등급별 AI 게이트웨이 라우팅 확인
         ↓
[T+8h] 관리자 계정 발급 + 접근 안내 발송
    - 담당자 이메일로 초기 자격증명 전달 (암호화)
    - 온보딩 체크리스트 PDF 첨부
         ↓
[T+24h] 온보딩 완료 확인
    - 서비스 정상 접근 확인 (헬스체크)
    - audit.jsonl에 온보딩 완료 기록
```

---

## 합격 기준

1. N2SF 등급별 테넌트 격리 수준 명시 (C→클러스터 격리, S→네임스페이스 격리, O→공유 논리 격리 3가지 명확 정의)
2. Kyverno 정책으로 테넌트 리소스 한도 강제 예시 포함 (YAML 예시 코드 동작 가능 수준)
3. C등급 테넌트 에어갭 격리 구성 포함 (외부 통신 전면 차단 NetworkPolicy + 에어갭 이미지 로드 절차)
4. 테넌트 온보딩 자동화 절차 완비 (최대 1일 이내 완료 타임라인 명시)

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 0.1.0 | 2026-04-05 | 신규 — Phase 5 Ecosystem MTU-E2 최초 작성 | Claude Code |
| 0.2.0 | 2026-04-05 | P0-01: FR-8.2 → FR-8.5 재부번 (MTU-C6 중복 해소) | CTO 팀 검토 |
