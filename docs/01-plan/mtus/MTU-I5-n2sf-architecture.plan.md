# MTU-I5: N2SF 레퍼런스 아키텍처

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-I5 |
| Phase | Phase 3 Infrastructure |
| 상태 | Draft |
| 작성일 | 2026-04-05 |
| FR 매핑 | FR-3.6 |
| 의존 MTU | MTU-C4 (N2SF 등급 분류), MTU-C5 (N2SF 6개 영역 통제), MTU-I4 (네트워크+OTel) |
| 예상 세션 | 1 세션 |
| 중요도 | P1 |

---

## 목적

N2SF(국가정보보안기본방침) 6개 보안 영역을 인프라 레벨에서 구현하는 레퍼런스 아키텍처 설계서를 작성합니다. 데이터 등급(C/S/O)별 네트워크 영역 분리, LM Studio(온프레미스)와 Claude API(외부) 간 AI 라우팅 결정 트리, CSAP 통제 항목과 k3s 리소스의 3단계 매핑을 포함합니다.

**참조 문서**:
- MTU-C4: `03-n2sf/csap-to-n2sf-mapping.md` — CSAP↔N2SF 전수 매핑 (역참조)
- MTU-C5: `03-n2sf/n2sf-control-guides/` — N2SF 6개 영역 통제 가이드 (역참조)
- MTU-I4: `05-infra/network-policy-guide.md` — NetworkPolicy 구현 (역참조)

**시장조사 반영**:
- 국정원 「AI 시스템 보안 가이드라인」 2025 개정: C/S등급 데이터의 외부 AI API 전송 명시적 금지
- LM Studio v0.3+: WSL2 환경에서 GPU 없이도 Llama 3.1 8B 구동 가능 (공공기관 온프레미스 적합)
- N2SF 2024 개정: N05 데이터 영역에 AI/LLM 사용 시 데이터 분류 의무 명시

---

## 산출물 파일 (1개)

| 파일 | 문서 유형 | 핵심 내용 |
|------|---------|---------|
| `03-n2sf/n2sf-infrastructure-architecture.md` | 아키텍처레퍼런스형 | N2SF 6개 영역 × k3s 구현 전체 설계서 |

---

## N2SF 6개 보안 영역 × k3s 구현 매핑

| N2SF 영역 | 영역명 | k3s 구현 요소 | MTU 연동 |
|---------|------|------------|---------|
| N01 | 관리 영역 | Kubernetes RBAC, ServiceAccount 정책 | MTU-C3 (D08) |
| N02 | 서비스 영역 | Ingress TLS 1.3+, mTLS (Istio 또는 Linkerd 선택) | MTU-I1 |
| N03 | 격리 영역 | NetworkPolicy C/S등급 에어갭 근사 격리 | MTU-I4 |
| N04 | 저장 영역 | PersistentVolume 암호화 (LUKS), Sealed Secrets | MTU-C3 (D09) |
| N05 | 데이터 영역 | AI 라우팅 게이트웨이 (LM Studio ↔ Claude API) | MTU-A1 |
| N06 | 물리 영역 | WSL2 호스트 보안, 노드 접근 통제 | MTU-I1 |

---

## 핵심 설계 내용

### 1. C/S/O 데이터 등급별 네트워크 영역 분리 다이어그램

```
외부 인터넷
     │
     │  (TLS 1.3+만 허용, N2SF N02)
     ▼
┌─────────────────────────────────────────────────────────────────┐
│  Ingress Layer (grade-o 전용 외부 노출)                         │
│  [Traefik / NGINX Ingress]                                      │
└───────────────────────────┬─────────────────────────────────────┘
                            │
          ┌─────────────────┼─────────────────┐
          │                 │                 │
          ▼                 ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐
│ ns: grade-o  │  │ ns: grade-s  │  │ ns: grade-c          │
│ (O등급: 공개)│  │ (S등급: 민감)│  │ (C등급: 기밀)        │
│              │  │              │  │                      │
│ - 공개 API   │  │ - 내부 API   │  │ - LM Studio          │
│ - 웹 UI      │  │ - 민감 DB    │  │ - 온프레미스 DB      │
│ - Claude API │  │ - 인증 서비스│  │ - 암호화 저장소      │
│   게이트웨이  │  │              │  │ (외부 차단: N03)     │
│              │  │              │  │                      │
│ [NetworkPolicy│  │[NetworkPolicy│  │[NetworkPolicy         │
│ 외부 허용 -  │  │ 내부 제한]   │  │ 완전 격리]           │
│ 마스킹 후만] │  │              │  │                      │
└──────┬───────┘  └──────┬───────┘  └──────────────────────┘
       │                 │
       │    허용된 내부 통신만 (Egress 정책)
       └─────────────────┘
                │
      ┌─────────▼──────────┐
      │  공유 인프라        │
      │  - OTel Collector  │
      │  - Harbor 레지스트리│
      │  - Flux GitOps     │
      │  - audit.jsonl     │
      └────────────────────┘
```

### 2. N2SF N05 데이터 영역: AI 라우팅 결정 트리

```
사용자 요청 (AI 기능 호출)
          │
          ▼
┌─────────────────────┐
│ 데이터 등급 분류     │  ◀── MTU-C4 분류 기준
│ (C / S / O ?)       │
└──────────┬──────────┘
           │
     ┌─────┴──────┐
     │            │
     ▼            ▼
  C 또는 S      O등급
   등급?          │
     │            ▼
     │    ┌──────────────────────┐
     │    │ PII 마스킹 수행       │
     │    │ (개인정보 토큰화)     │
     │    └──────────┬───────────┘
     │               │
     │               ▼
     │    ┌──────────────────────┐
     │    │ Claude API 호출       │
     │    │ (Anthropic 외부 API)  │
     │    │ N2SF N05 허용 경로    │
     │    └──────────────────────┘
     │
     ▼
┌─────────────────────┐
│ 온프레미스 LM Studio│
│ (WSL2 내부)         │
│ - Llama 3.1 8B     │
│ - 외부 전송 없음    │
│ N2SF N03 격리 적용  │
└─────────────────────┘
```

**라우팅 결정 코드 패턴**:

```typescript
// AI 라우팅 게이트웨이 핵심 로직 (MTU-A1 구현 예시)
enum DataGrade { C = 'C', S = 'S', O = 'O' }

async function routeToAI(
  prompt: string,
  dataGrade: DataGrade,
  context: RequestContext
): Promise<AIResponse> {
  // C/S 등급: 온프레미스 LM Studio 라우팅
  if (dataGrade === DataGrade.C || dataGrade === DataGrade.S) {
    await auditLog({ action: 'AI_ROUTE', destination: 'LM_STUDIO', grade: dataGrade })
    return lmStudioClient.complete({ prompt, model: 'llama-3.1-8b' })
  }

  // O 등급: PII 마스킹 후 Claude API 라우팅
  if (dataGrade === DataGrade.O) {
    const maskedPrompt = await maskPII(prompt)   // PII 필터링 필수
    await auditLog({ action: 'AI_ROUTE', destination: 'CLAUDE_API', grade: dataGrade })
    return claudeApiClient.complete({ prompt: maskedPrompt })
  }

  throw new Error('데이터 등급 미분류 — AI 라우팅 차단 (N2SF N05)')
}
```

### 3. CSAP 통제 → N2SF 영역 → k3s 리소스 3단계 매핑

| CSAP 통제 ID | CSAP 항목명 | N2SF 영역 | k3s 리소스 | 구현 파일 |
|------------|---------|---------|---------|---------|
| D08-01 | 사용자 식별·인증 | N01 관리 영역 | ServiceAccount + RBAC | MTU-C3 |
| D08-02 | 접근 권한 최소화 | N01 관리 영역 | ClusterRole (최소 권한) | MTU-C3 |
| D09-01 | 저장 데이터 암호화 | N04 저장 영역 | PV 암호화 + Sealed Secrets | MTU-C3 |
| D09-02 | 전송 데이터 암호화 | N02 서비스 영역 | Ingress TLS 1.3+ | MTU-I1 |
| D06-01 | 침해사고 탐지 | N03 격리 영역 | OTel + NetworkPolicy 이벤트 | MTU-I4 |
| D06-02 | 감사 로그 보존 | N05 데이터 영역 | audit.jsonl (OTel 수집) | MTU-I4 |
| D11-01 | 컨테이너 보안 | N02 서비스 영역 | PodSecurityAdmission (restricted) | MTU-I1 |
| D12-01 | 배포 취약점 스캔 | N04 저장 영역 | Harbor Trivy 정책 | MTU-I3 |
| D12-02 | 이미지 무결성 | N04 저장 영역 | Cosign 서명 검증 정책 | MTU-I3, MTU-C8 |
| D05-01 | 공급망 보안 | N05 데이터 영역 | SBOM (Syft) + Sigstore | MTU-C8 |

### 4. N2SF 6개 영역별 k3s 구현 상세

#### N01 관리 영역 (관리자 접근 통제)

```yaml
# 최소 권한 ServiceAccount 예시
apiVersion: v1
kind: ServiceAccount
metadata:
  name: app-service-account
  namespace: grade-s
  annotations:
    n2sf.area: "N01"
    csap.control: "D08-01, D08-02"
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: app-minimal-role
  namespace: grade-s
rules:
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["get", "list"]     # 최소 권한만 부여
```

#### N02 서비스 영역 (서비스 통신 보안)

```yaml
# mTLS 적용 (Linkerd 사용 시)
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

#### N03 격리 영역 (MTU-I4 상세 구현 참조)

- 구현 위치: `05-infra/network-policy-guide.md` (MTU-I4 역참조)
- 핵심 정책: `grade-c-full-isolation.yaml`, `grade-s-restricted.yaml`

#### N04 저장 영역 (데이터 저장 암호화)

```yaml
# Sealed Secrets (암호화된 Secret 관리)
# 평문 Secret을 Git에 커밋 금지 — SealedSecret 사용 필수
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
    password: AgBy...  # kubeseal 도구로 암호화된 값
```

#### N05 데이터 영역 (AI 라우팅 게이트웨이)

- 구현 위치: MTU-A1 (AI 보안 게이트웨이) — Phase 4
- 사전 설계: 위 라우팅 결정 트리 참조

#### N06 물리 영역 (WSL2 호스트 보안)

| 보안 항목 | 구현 방법 | 검증 |
|---------|---------|------|
| 호스트 OS 접근 통제 | WSL2 사용자 계정 분리 + sudo 감사 | `/var/log/auth.log` 확인 |
| 디스크 암호화 | BitLocker (Windows) + eCryptfs (WSL2) | 디스크 암호화 상태 확인 |
| 물리적 접근 통제 | 공공기관 전산실 물리 보안 정책 (비IT 범위) | 관리 규정 문서 확인 |

---

## 기능 요구사항

| ID | 요구사항 | 수용 기준 |
|----|---------|---------|
| FR-3.6 | N2SF 아키텍처 문서화 | N2SF 6개 영역 × k3s 구현 전체 매핑 완비 |

---

## 합격 기준

1. C/S/O 등급별 네트워크 영역 분리 다이어그램 포함 (`n2sf-infrastructure-architecture.md` 내 ASCII 또는 Mermaid 다이어그램)
2. N2SF 6개 영역 k3s 구현 매핑 완비 (N01~N06 전 항목, CSAP 통제 ID 연결)
3. LM Studio ↔ Claude API 라우팅 결정 트리 포함 (데이터 등급 기반 분기 로직 명시)
4. MTU-C4, MTU-C5 역참조 링크 완비 (`n2sf-infrastructure-architecture.md` 내 참조 섹션 포함)

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 0.1.0 | 2026-04-05 | 최초 작성 | Claude Code |
