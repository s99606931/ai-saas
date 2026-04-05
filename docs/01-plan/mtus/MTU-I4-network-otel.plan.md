# MTU-I4: 네트워크 보안 정책 + OpenTelemetry 관측 가능성

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-I4 |
| Phase | Phase 3 Infrastructure |
| 상태 | Draft |
| 작성일 | 2026-04-05 |
| FR 매핑 | FR-5.4, NFR-4 |
| 의존 MTU | MTU-I1 (k3s+WSL2), MTU-I3 (Flux+Harbor) |
| 예상 세션 | 1 세션 |
| 중요도 | P1 |

---

## 목적

k3s 클러스터에 NetworkPolicy를 적용하여 N2SF 데이터 등급(C/S/O)별 네트워크 흐름을 통제하고, OpenTelemetry Collector를 통해 메트릭·로그·트레이스를 통합 수집합니다. CSAP-D06 침해사고 탐지 요건과 N2SF N03 격리 영역 요건을 인프라 레벨에서 구현합니다.

**시장조사 반영**:
- k3s 기본 CNI(Flannel)는 NetworkPolicy 미지원 → Flannel + kube-router 조합 또는 Calico 교체 필요
- OpenTelemetry Collector v0.96+: k3s DaemonSet + Sidecar 혼합 배포 패턴 권장
- Prometheus 스크레이프 + OTel 게이트웨이 구조: 기존 Prometheus 에코시스템 유지하면서 OTel 표준 준수
- N2SF N03 격리 요건: 국정원 클라우드 보안 가이드라인 2024 기준 네임스페이스 격리 필수

---

## 산출물 파일 (3개)

| 파일 | 문서 유형 | 핵심 내용 |
|------|---------|---------|
| `05-infra/network-policy-guide.md` | 구현가이드형 | k3s NetworkPolicy + CNI 보안 설정 절차 |
| `05-infra/opentelemetry-guide.md` | 아키텍처레퍼런스형 | OTel Collector 구성 + 침해사고 탐지 연동 |
| `05-infra/network-policies/` | 구성 템플릿 | 데이터 등급별 NetworkPolicy YAML 모음 |

---

## 아키텍처 개요

### 네트워크 보안 구조 (N2SF 데이터 등급별 격리)

```
┌─────────────────────────────────────────────────────┐
│                 k3s 클러스터                         │
│                                                     │
│  ┌──────────────────┐   NetworkPolicy               │
│  │ ns: grade-c      │   (C등급 격리 — 에어갭 근사)   │
│  │ (기밀 데이터)     │◀──────────────────────        │
│  │ - LM Studio      │   외부 인터넷 차단             │
│  │ - 온프레미스 DB  │   타 네임스페이스 접근 차단     │
│  └──────────────────┘                               │
│                                                     │
│  ┌──────────────────┐   NetworkPolicy               │
│  │ ns: grade-s      │   (S등급 — 제한적 내부 통신)   │
│  │ (민감 데이터)     │◀──────────────────────        │
│  │ - 내부 API 서버  │   승인된 내부 서비스만 허용     │
│  └──────────────────┘                               │
│                                                     │
│  ┌──────────────────┐   NetworkPolicy               │
│  │ ns: grade-o      │   (O등급 — 마스킹 후 외부 허용)│
│  │ (공개 데이터)     │◀──────────────────────        │
│  │ - Claude API GW  │   AI API 게이트웨이 경유만     │
│  └──────────────────┘                               │
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │ OpenTelemetry Collector (DaemonSet)          │   │
│  │  메트릭 ─┐                                   │   │
│  │  로그   ─┼─▶ [OTel Gateway] ─▶ Prometheus   │   │
│  │  트레이스─┘                 └─▶ Loki         │   │
│  │                             └─▶ Jaeger       │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

---

## 핵심 설계 내용

### 1. CNI 보안 설정 (Flannel + kube-router)

```bash
# k3s 설치 시 kube-router 활성화 (NetworkPolicy 지원)
curl -sfL https://get.k3s.io | sh -s - \
  --flannel-backend=none \
  --disable-network-policy=false \
  --cluster-cidr=10.42.0.0/16
```

### 2. N2SF 데이터 등급별 NetworkPolicy

#### C등급 (기밀) 네임스페이스 격리

```yaml
# network-policies/grade-c-isolation.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: grade-c-full-isolation
  namespace: grade-c
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress
  ingress:
    # 동일 네임스페이스 내부 통신만 허용
    - from:
        - namespaceSelector:
            matchLabels:
              n2sf.grade: "C"
  egress:
    # C등급: 외부 인터넷 전면 차단 (N2SF N03)
    # 클러스터 내부 DNS만 허용
    - to:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: kube-system
      ports:
        - protocol: UDP
          port: 53
```

#### S등급 (민감) 제한적 통신

```yaml
# network-policies/grade-s-restricted.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: grade-s-restricted
  namespace: grade-s
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              n2sf.grade: "S"
        - namespaceSelector:
            matchLabels:
              n2sf.grade: "O"  # O등급 → S등급 API 호출 허용 (승인된 경로)
  egress:
    - to:
        - namespaceSelector:
            matchLabels:
              n2sf.grade: "S"
    - to:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: kube-system
      ports:
        - protocol: UDP
          port: 53
```

#### O등급 (공개) AI API 게이트웨이 경유

```yaml
# network-policies/grade-o-ai-gateway.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: grade-o-ai-gateway-only
  namespace: grade-o
spec:
  podSelector:
    matchLabels:
      app: ai-gateway
  policyTypes:
    - Egress
  egress:
    # AI API 화이트리스트 — O등급 + PII 마스킹 후 승인된 엔드포인트만 (N2SF N05)
    # Claude API
    - to:
        - ipBlock:
            cidr: 0.0.0.0/0
            except:
              - 10.0.0.0/8       # 내부망 직접 접근 차단
              - 172.16.0.0/12    # Docker 내부망 차단
              - 192.168.0.0/16   # 사설망 차단
      ports:
        - protocol: TCP
          port: 443    # HTTPS only (api.anthropic.com, api.openai.com)
    # 클러스터 내부 DNS
    - to:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: kube-system
      ports:
        - protocol: UDP
          port: 53
```

> **보안 주의**: `to: []` (모든 목적지 허용)은 N2SF N05 위반. 반드시 `ipBlock.except`로 내부망 차단 + AI API 포트(443) 제한 적용.
> 실제 배포 시 `api.anthropic.com` 등 외부 IP 범위는 DNS 기반 정책(CoreDNS + Kyverno)으로 보완 권장.

### 3. OpenTelemetry Collector 구성

```yaml
# otel-collector-config.yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318
  prometheus:
    config:
      scrape_configs:
        - job_name: k3s-nodes
          kubernetes_sd_configs:
            - role: node
  k8sobjects:             # k3s 이벤트 수집 (보안 이벤트 포함)
    objects:
      - name: events
        mode: watch
        namespaces: [grade-c, grade-s, grade-o]

processors:
  batch:
    timeout: 5s
  filter/security:        # C/S등급 데이터 로그에서 PII 필터링
    logs:
      exclude:
        match_type: regexp
        bodies:
          - '.*\b\d{6}-\d{7}\b.*'  # 주민등록번호 패턴
          - '.*\b\d{4}-\d{4}-\d{4}-\d{4}\b.*'  # 카드번호 패턴
  resourcedetection:
    detectors: [k8snode, k8sresourceattributes]

exporters:
  prometheus:
    endpoint: 0.0.0.0:8889
  loki:
    endpoint: http://loki.monitoring.svc.cluster.local:3100/loki/api/v1/push
  jaeger:
    endpoint: jaeger.monitoring.svc.cluster.local:14250
  # CSAP-D06: 보안 이벤트 audit.jsonl 기록
  file/audit:
    path: /var/log/audit/audit.jsonl
    rotation:
      max_megabytes: 100
      max_days: 365           # CSAP-D06 최소 1년 보존

service:
  pipelines:
    metrics:
      receivers: [otlp, prometheus]
      processors: [batch, resourcedetection]
      exporters: [prometheus]
    logs:
      receivers: [otlp, k8sobjects]
      processors: [batch, filter/security]
      exporters: [loki, file/audit]
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [jaeger]
```

### 4. CSAP-D06 침해사고 탐지 연동

| 탐지 규칙 | 트리거 조건 | 대응 액션 |
|---------|---------|---------|
| D06-01 비인가 접근 | grade-c 네임스페이스 외부 접속 시도 | NetworkPolicy 차단 + audit.jsonl 기록 + 알림 |
| D06-02 이상 트래픽 | grade-s/c → 외부 IP 연결 시도 | 즉시 차단 + 보안 담당자 알림 |
| D06-03 권한 상승 | Pod 내 `sudo`, `su` 실행 | OTel 이벤트 수집 + 즉시 알림 |
| D06-04 무결성 위반 | 서명되지 않은 이미지 실행 시도 | Harbor 정책 차단 (MTU-I3 연동) |

### 5. N2SF N03 격리 영역 구현 매핑

| N2SF 요건 | k3s 구현 | 검증 방법 |
|---------|---------|---------|
| N03-01 C등급 격리 | `grade-c` 네임스페이스 + NetworkPolicy | `kubectl exec` 외부 연결 실패 확인 |
| N03-02 S등급 접근 통제 | `grade-s` NetworkPolicy + RBAC | 미승인 서비스 접근 거부 로그 확인 |
| N03-03 등급 간 데이터 흐름 | Ingress/Egress 정책 명시적 허용 목록 | NetworkPolicy 다이어그램 감리 |
| N03-04 감사 추적 | OTel → audit.jsonl | audit.jsonl 무결성 해시 확인 |

---

## 기능 요구사항

| ID | 요구사항 | 수용 기준 |
|----|---------|---------|
| FR-5.4 | 네트워크 보안 정책 적용 | C/S/O 등급별 NetworkPolicy 전 항목 적용 확인 |
| NFR-4 | 통합 모니터링 구성 | OTel 메트릭 Prometheus 수집 + 대시보드 표시 |

---

## 합격 기준

1. NetworkPolicy로 C/S등급 데이터 외부 유출 차단 확인 (grade-c 네임스페이스 Pod에서 외부 IP 연결 실패 재현)
2. OpenTelemetry 메트릭 수집 동작 (`curl http://otel-collector:8889/metrics` 응답 확인)
3. 침해사고 탐지 알림 연동 (CSAP-D06 D06-01 규칙 트리거 시 audit.jsonl 기록 및 알림 발송 확인)
4. N2SF N03 격리 요건 충족 확인 (N03-01~N03-04 체크리스트 전 항목 통과)

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 0.1.0 | 2026-04-05 | 최초 작성 | Claude Code |
| 0.2.0 | 2026-04-05 | P1: O등급 Egress 정책 강화 — `to: []` (전체 허용) → ipBlock.except로 내부망 차단 + 포트 443 제한, 보안 주의 주석 추가 | Claude Code |
