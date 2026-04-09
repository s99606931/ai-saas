# N2SF 레퍼런스 인프라 아키텍처

| 항목 | 내용 |
|------|------|
| 문서 ID | N2SF-ARCH-001 |
| 버전 | 1.0.0 |
| 최종 수정일 | 2026-04-05 |
| 대상 독자 | 아키텍트, 보안 담당자, CSAP/N2SF 심사 대응 팀, 감리관 |
| FR 매핑 | FR-3.6 (N2SF 아키텍처 문서화) |
| MTU 매핑 | MTU-I5 |
| 참조 문서 | [CSAP x N2SF 매핑](csap-n2sf-mapping.md), [데이터 등급 분류](data-grade-classification.md), [N2SF 6개 영역 통제](domains/) |

<!-- Design Ref: MTU-I5 Plan -- N2SF 레퍼런스 아키텍처 -->
<!-- Plan SC: 6개 영역 x k3s 매핑, AI 라우팅 결정 트리, CSAP 3단계 매핑 -->

---

## 1. 개요

본 문서는 N2SF(국가정보보안기본방침) 6개 보안 영역을 k3s 클러스터 인프라에 구현하는 레퍼런스 아키텍처입니다. 공공 SaaS 프레임워크의 보안 아키텍처 전체상을 제공하며, 데이터 등급(C/S/O)별 네트워크 영역 분리, AI 라우팅 결정 트리, CSAP 통제 항목과 k3s 리소스의 3단계 매핑을 포함합니다.

### 참조 체계

```
[MTU-C4] CSAP x N2SF 전수 매핑     → 규제 요건 기준선
    │
    ▼
[MTU-C5] N2SF 6개 영역 통제 가이드  → 영역별 통제 상세
    │
    ▼
[본 문서] N2SF 인프라 아키텍처       → k3s 구현 전체 설계
    │
    ├── [MTU-I1] k3s 클러스터 설치   → 물리 인프라
    ├── [MTU-I2] Gitea CI/CD        → 서비스 영역 (빌드/배포)
    ├── [MTU-I3] Flux + Harbor      → 저장/데이터 영역 (이미지)
    └── [MTU-I4] NetworkPolicy+OTel → 격리/운영 영역 (네트워크/감사)
```

---

## 2. C/S/O 데이터 등급별 네트워크 영역 분리

### 2.1 전체 아키텍처 다이어그램

```
                            외부 인터넷
                                │
                                │ (TLS 1.3+ 필수, N2SF N02)
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Ingress Layer (Traefik / NGINX Ingress Controller)                  │
│  - grade-o 서비스만 외부 노출                                          │
│  - TLS 1.3+ 종단 (CSAP-D09-02)                                      │
│  - WAF 규칙 적용 (OWASP Top 10, CSAP-D12)                            │
└───────────────────────────────┬──────────────────────────────────────┘
                                │
          ┌─────────────────────┼─────────────────────┐
          │                     │                     │
          ▼                     ▼                     ▼
┌──────────────────┐  ┌──────────────────┐  ┌────────────────────────┐
│ ns: grade-o      │  │ ns: grade-s      │  │ ns: grade-c            │
│ (O등급: 공개)     │  │ (S등급: 민감)     │  │ (C등급: 기밀)          │
│                  │  │                  │  │                        │
│ - 공개 웹 UI     │  │ - 내부 API 서버  │  │ - LM Studio (로컬 AI)  │
│ - 공개 API       │  │ - 인증/인가 서비스│  │ - 온프레미스 DB        │
│ - AI API Gateway │  │ - 민감 데이터 DB │  │ - 암호화 저장소        │
│   (Claude API)   │  │ - 세션 관리      │  │ - 키 관리 서비스       │
│                  │  │                  │  │                        │
│ [NetworkPolicy]  │  │ [NetworkPolicy]  │  │ [NetworkPolicy]        │
│ AI GW만 443 외부 │  │ 내부 제한적 허용 │  │ 완전 격리 (에어갭)     │
│ PII 마스킹 후만  │  │ O→S 443만 허용   │  │ 외부/타NS 완전 차단    │
└────────┬─────────┘  └────────┬─────────┘  └────────────────────────┘
         │                     │
         │  승인된 내부 통신    │
         └──────────┬──────────┘
                    │
          ┌─────────▼──────────────────────────────────────────┐
          │  공유 인프라 (ns: monitoring, flux-system, harbor)  │
          │                                                    │
          │  - OpenTelemetry Collector (DaemonSet)              │
          │  - Prometheus + Loki + Jaeger                       │
          │  - Harbor 레지스트리                                  │
          │  - Flux GitOps 컨트롤러                              │
          │  - audit.jsonl (CSAP-D06)                           │
          └────────────────────────────────────────────────────┘
```

### 2.2 데이터 흐름 매트릭스

| 소스 \ 대상 | grade-c | grade-s | grade-o | monitoring | 외부 인터넷 |
|-----------|---------|---------|---------|-----------|----------|
| **grade-c** | 허용 (내부) | 차단 | 차단 | OTel 4317 | **차단** |
| **grade-s** | 차단 | 허용 (내부) | 차단 | OTel 4317 | **차단** |
| **grade-o** | 차단 | 443 (API) | 허용 (내부) | OTel 4317 | AI GW 443만 |
| **monitoring** | 수집 (Pull) | 수집 (Pull) | 수집 (Pull) | 허용 | 차단 |
| **외부 인터넷** | 차단 | 차단 | Ingress만 | 차단 | — |

---

## 3. N2SF 6개 보안 영역 x k3s 구현 매핑

### N01 관리 영역 (관리적 보안)

| 통제 항목 | k3s 구현 | 구현 파일 | CSAP 매핑 |
|---------|---------|---------|---------|
| 사용자 식별·인증 | Kubernetes ServiceAccount + RBAC | MTU-C3 D08 | CSAP-D08-01 |
| 접근 권한 최소화 | ClusterRole 최소 권한 원칙 | MTU-C3 D08 | CSAP-D08-02 |
| 관리자 접근 통제 | kubeconfig 분리 + 감사 로그 | MTU-I1 | CSAP-D08-03 |
| 서비스 계정 관리 | ServiceAccount 자동 마운트 비활성화 | MTU-I1 | CSAP-D08-04 |

```yaml
# N01 구현 예시: 최소 권한 ServiceAccount
apiVersion: v1
kind: ServiceAccount
metadata:
  name: app-service-account
  namespace: grade-s
  annotations:
    n2sf.area: "N01"
    csap.control: "D08-01, D08-02"
automountServiceAccountToken: false        # 자동 마운트 비활성화
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: app-minimal-role
  namespace: grade-s
rules:
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["get", "list"]                 # 최소 권한만 부여
```

### N02 인증 영역 (서비스 통신 보안)

| 통제 항목 | k3s 구현 | 구현 파일 | CSAP 매핑 |
|---------|---------|---------|---------|
| TLS 1.3+ 전송 암호화 | Traefik Ingress TLS termination | MTU-I1 | CSAP-D09-02 |
| mTLS 서비스 간 인증 | Linkerd 또는 Istio (선택) | 본 문서 | CSAP-D09-02 |
| API 인증·인가 | JWT + RBAC 미들웨어 | MTU-C3 D08 | CSAP-D08-01 |

```yaml
# N02 구현 예시: mTLS (Linkerd 사용 시)
apiVersion: linkerd.io/v1alpha2
kind: ServerAuthorization
metadata:
  name: grade-s-mtls-only
  namespace: grade-s
  annotations:
    n2sf.area: "N02"
spec:
  server:
    selector:
      matchLabels:
        app: internal-api
  client:
    meshTLS:
      serviceAccounts:
        - name: authorized-client
          namespace: grade-o
```

> **mTLS 선택 가이드**: 소규모 배포는 Linkerd(경량), 대규모는 Istio(기능 풍부). k3s 환경에서는 Linkerd 권장.

### N03 격리 영역 (네트워크 분리)

| 통제 항목 | k3s 구현 | 구현 파일 | CSAP 매핑 |
|---------|---------|---------|---------|
| C등급 완전 격리 | NetworkPolicy + 네임스페이스 분리 | [network-policy-guide.md](../08-infra/network-policy-guide.md) | CSAP-D10-01 |
| S등급 접근 통제 | NetworkPolicy Ingress/Egress 제한 | [grade-s-restricted.yaml](../08-infra/network-policies/grade-s-restricted.yaml) | CSAP-D10-02 |
| 등급 간 통신 통제 | 명시적 허용 목록 (화이트리스트) | [network-policy-guide.md](../08-infra/network-policy-guide.md) | CSAP-D10-03 |
| 네트워크 감사 | OTel k8sobjects + audit.jsonl | [opentelemetry-guide.md](../08-infra/opentelemetry-guide.md) | CSAP-D06-01 |

### N04 암호화 영역 (데이터 저장 보안)

| 통제 항목 | k3s 구현 | 구현 파일 | CSAP 매핑 |
|---------|---------|---------|---------|
| 저장 데이터 암호화 | PV 암호화 (LUKS) | MTU-C3 D09 | CSAP-D09-01 |
| 시크릿 관리 | Sealed Secrets (암호화 Git 저장) | 본 문서 | CSAP-D09-01 |
| 키 수명 주기 | Cosign 키 연간 교체 | [sigstore-signing.md](../08-infra/supply-chain/sigstore-signing.md) | CSAP-D09-03 |
| 이미지 무결성 | Cosign 서명 + Harbor 정책 | [harbor-registry-guide.md](../08-infra/harbor-registry-guide.md) | CSAP-D12-02 |

```yaml
# N04 구현 예시: Sealed Secrets (Git에 안전하게 저장)
apiVersion: bitnami.com/v1alpha1
kind: SealedSecret
metadata:
  name: db-credentials
  namespace: grade-c
  annotations:
    n2sf.area: "N04"
    csap.control: "D09-01"
spec:
  encryptedData:
    password: AgBy3...                     # kubeseal로 암호화된 값
    # 평문 Secret을 Git에 커밋하면 CSAP-D09 위반
```

### N05 데이터 영역 (AI 라우팅 게이트웨이)

| 통제 항목 | k3s 구현 | 구현 파일 | CSAP 매핑 |
|---------|---------|---------|---------|
| 데이터 등급 분류 | DataGrade enum + classifyData 함수 | [data-grade-classification.md](data-grade-classification.md) | N2SF-N05 |
| AI 라우팅 결정 | routeToAI 게이트웨이 | 본 문서 (아래) | AI-REQ-1 |
| PII 마스킹 | maskPII 함수 | [data-grade-classification.md](data-grade-classification.md) | N2SF-N05 |
| C/S 등급 AI 전송 차단 | NetworkPolicy + 코드 검증 | [network-policy-guide.md](../08-infra/network-policy-guide.md) | N2SF-N05 |

---

## 4. N2SF N05 데이터 영역: AI 라우팅 결정 트리

### 4.1 라우팅 결정 흐름도

```
사용자 요청 (AI 기능 호출)
          │
          ▼
┌─────────────────────────┐
│ 1. 데이터 등급 분류      │  ◀── MTU-C4 classifyData()
│    (C / S / O ?)        │
└──────────┬──────────────┘
           │
     ┌─────┴──────────────────┐
     │                        │
     ▼                        ▼
  C 또는 S 등급             O 등급
     │                        │
     ▼                        ▼
┌────────────────────┐  ┌────────────────────────────┐
│ 2. 온프레미스 라우팅│  │ 3. PII 마스킹 수행          │
│                    │  │    maskPII(data)            │
│ LM Studio          │  │    - 주민등록번호 → [MASKED]│
│ (WSL2 로컬)        │  │    - 이름 → [NAME]          │
│                    │  │    - 전화번호 → [PHONE]     │
│ - Llama 3.1 8B     │  └──────────┬─────────────────┘
│ - 외부 전송 없음   │             │
│ - N2SF N03 격리    │             ▼
│                    │  ┌────────────────────────────┐
│ grade-c 네임스페이스│  │ 4. 마스킹 검증              │
│ NetworkPolicy 보호 │  │    validateMasking(masked)  │
└────────────────────┘  │    - PII 잔존 검사          │
                        │    - 통과 시 → 외부 전송    │
                        │    - 실패 시 → 차단 + 로그  │
                        └──────────┬─────────────────┘
                                   │
                                   ▼
                        ┌────────────────────────────┐
                        │ 5. Claude API 호출          │
                        │    (api.anthropic.com)      │
                        │                            │
                        │ grade-o 네임스페이스         │
                        │ ai-gateway Pod 경유         │
                        │ NetworkPolicy: 443만 허용   │
                        └────────────────────────────┘
```

### 4.2 라우팅 결정 코드 패턴

```typescript
// AI 라우팅 게이트웨이 핵심 로직 (Phase 4 MTU-A1 구현 예정)
import { classifyData, DataGrade } from '@/lib/data-classification'
import { maskPII, validateMasking } from '@/lib/pii-masking'
import { auditLog } from '@/lib/audit'

async function routeToAI(
  prompt: string,
  context: RequestContext
): Promise<AIResponse> {
  // 1. 데이터 등급 자동 분류
  const grade = await classifyData(prompt)

  // 2. C/S 등급: 온프레미스 LM Studio 라우팅
  if (grade === DataGrade.C || grade === DataGrade.S) {
    await auditLog({
      action: 'AI_ROUTE',
      destination: 'LM_STUDIO',
      grade,
      actor: context.userId,
    })
    return lmStudioClient.complete({
      prompt,
      model: 'llama-3.1-8b',
    })
  }

  // 3. O 등급: PII 마스킹 후 Claude API 라우팅
  if (grade === DataGrade.O) {
    const maskedPrompt = await maskPII(prompt)

    // 4. 마스킹 검증
    const isClean = await validateMasking(maskedPrompt)
    if (!isClean) {
      await auditLog({
        action: 'AI_ROUTE_BLOCKED',
        reason: 'PII_RESIDUAL',
        grade,
      })
      throw new Error('PII 마스킹 검증 실패 — AI 전송 차단 (N2SF N05)')
    }

    await auditLog({
      action: 'AI_ROUTE',
      destination: 'CLAUDE_API',
      grade,
      actor: context.userId,
    })
    return claudeApiClient.complete({
      prompt: maskedPrompt,
    })
  }

  // 미분류 데이터: 차단
  throw new Error('데이터 등급 미분류 — AI 라우팅 차단 (N2SF N05)')
}
```

### 4.3 LM Studio 배포 (grade-c 네임스페이스)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: lm-studio
  namespace: grade-c
  labels:
    app: lm-studio
    n2sf.area: "N05"
spec:
  replicas: 1
  selector:
    matchLabels:
      app: lm-studio
  template:
    metadata:
      labels:
        app: lm-studio
    spec:
      serviceAccountName: lm-studio-sa
      containers:
        - name: lm-studio
          image: harbor.internal/infra/lm-studio:latest
          ports:
            - containerPort: 1234          # LM Studio API 포트
          resources:
            limits:
              memory: "8Gi"                # Llama 3.1 8B 최소 메모리
              cpu: "4"
          env:
            - name: LMS_MODEL
              value: "meta-llama/Llama-3.1-8B"
            - name: LMS_PORT
              value: "1234"
```

---

## 5. CSAP 통제 → N2SF 영역 → k3s 리소스 3단계 매핑

| CSAP 통제 ID | CSAP 항목명 | N2SF 영역 | k3s 리소스 | 구현 MTU |
|------------|---------|---------|---------|---------|
| D01-01~04 | 정보보호 정책 | N01 관리 | RBAC 정책 문서 | MTU-C2a |
| D02-01~03 | 보안 조직 | N01 관리 | ServiceAccount 체계 | MTU-C2a |
| D03-01~04 | 인적 보안 | N01 관리 | (비기술적 통제) | MTU-C2a |
| D04-01~05 | 자산 관리 | N01 관리 | ConfigMap/Secret 관리 | MTU-C2a |
| D05-01~04 | 공급망 보안 | N05 데이터 | SBOM + Cosign | MTU-C8 |
| D06-01~05 | 침해사고 관리 | N06 운영 | OTel + audit.jsonl | MTU-I4 |
| D07-01~03 | 재해복구 | N06 운영 | etcd 백업 + Flux GitOps | MTU-I3 |
| D08-01~12 | 접근 통제 | N01+N02 | RBAC + JWT + MFA | MTU-C3 |
| D09-01~04 | 암호화 | N04 암호화 | AES-256 + TLS 1.3 + Sealed Secrets | MTU-C3 |
| D10-01~08 | 네트워크 보안 | N03 격리 | NetworkPolicy + kube-router | MTU-I4 |
| D11-01~07 | 가상화 보안 | N02+N03 | PSS restricted + Trivy + Falco | MTU-I1 |
| D12-01~10 | 개발 보안 | N05 데이터 | Zod 검증 + OWASP + Kyverno | MTU-C3 |
| D13-01~10 | 공공기관 추가 | N01+N06 | 감사 추적 + 데이터 주권 | MTU-C3 |

---

## 6. N06 운영 영역 (WSL2 호스트 보안)

| 보안 항목 | 구현 방법 | 검증 방법 | CSAP 매핑 |
|---------|---------|---------|---------|
| 호스트 OS 접근 통제 | WSL2 사용자 계정 분리 + sudo 감사 | `/var/log/auth.log` 확인 | D08-01 |
| 디스크 암호화 | BitLocker (Windows) + eCryptfs (WSL2) | 암호화 상태 확인 | D09-01 |
| 물리적 접근 통제 | 공공기관 전산실 보안 정책 (비IT 범위) | 출입 기록 확인 | D13 |
| 노드 취약점 관리 | k3s 정기 업데이트 + CVE 모니터링 | `k3s --version` | D11-01 |
| 로그 수집 | OTel filelog receiver → Loki | Loki 로그 조회 | D06-02 |

---

## 7. 아키텍처 의사결정 기록 (ADR)

### ADR-001: CNI 선택 — kube-router

- **결정**: Flannel 대신 kube-router 사용
- **근거**: NetworkPolicy 지원 필수 (N2SF N03), Flannel 미지원
- **대안**: Calico (더 많은 기능, 더 무거움)
- **영향**: MTU-I1에서 `--flannel-backend=none` 설치

### ADR-002: AI 라우팅 — 이중 경로

- **결정**: C/S → LM Studio, O → Claude API 이중 경로
- **근거**: N2SF N05 데이터 영역 요건 (C/S등급 외부 전송 금지)
- **대안**: 모든 데이터 온프레미스 처리 (성능 제한)
- **영향**: MTU-A1에서 AI 게이트웨이 구현 필요

### ADR-003: 서비스 메시 — Linkerd (선택적)

- **결정**: mTLS 필요 시 Linkerd 사용 (초기에는 선택적)
- **근거**: k3s 경량 환경에 적합, Istio 대비 리소스 50% 절감
- **대안**: Istio (기능 풍부, 리소스 과다)
- **영향**: N02 영역 완전 구현은 Linkerd 배포 후

### ADR-004: 시크릿 관리 — Sealed Secrets

- **결정**: 평문 Secret 대신 Sealed Secrets 사용
- **근거**: GitOps(Flux)에서 Secret을 Git에 안전하게 저장, CSAP-D09 준수
- **대안**: Vault (더 강력, 운영 복잡)
- **영향**: kubeseal 도구 사전 설치 필요

---

## 8. 참조 링크

### MTU-C4 역참조

- [CSAP x N2SF 전수 매핑 테이블](csap-n2sf-mapping.md) — 79항목 x 6영역 전수 매핑
- [데이터 등급 분류 체계](data-grade-classification.md) — C/S/O 3등급 분류 기준

### MTU-C5 역참조

- [N01 관리적 보안](domains/N01-management-security.md)
- [N02 인증](domains/N02-authentication.md)
- [N03 격리](domains/N03-isolation.md)
- [N04 암호화](domains/N04-encryption.md)
- [N05 데이터](domains/N05-data.md)
- [N06 운영](domains/N06-operations.md)

### 인프라 구현

- [k3s 클러스터 설치 레시피](../08-infra/k3s-wsl2/) — MTU-I1
- [Gitea CI/CD 파이프라인](../08-infra/gitea-cicd-guide.md) — MTU-I2
- [Flux GitOps 가이드](../08-infra/flux-gitops-guide.md) — MTU-I3
- [Harbor 레지스트리](../08-infra/harbor-registry-guide.md) — MTU-I3
- [NetworkPolicy 가이드](../08-infra/network-policy-guide.md) — MTU-I4
- [OpenTelemetry 가이드](../08-infra/opentelemetry-guide.md) — MTU-I4

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 최초 작성 — N2SF 6영역 x k3s 매핑 + AI 라우팅 + 3단계 매핑 | Claude Code |
