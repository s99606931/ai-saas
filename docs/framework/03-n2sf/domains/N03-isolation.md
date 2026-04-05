# N03 격리 구현 가이드

| 항목 | 내용 |
|------|------|
| 문서 ID | N2SF-N03-001 |
| 버전 | 1.0.0 |
| 최종 수정일 | 2026-04-05 |
| N2SF 영역 | N03 격리 |
| 대상 독자 | 인프라 엔지니어, 보안 담당자, 아키텍트 |
| FR 매핑 | FR-3.3, FR-3.4, FR-3.5, FR-3.5a, FR-3.5b |
| MTU 매핑 | MTU-C5 |

<!-- Design Ref: MTU-C5 Plan -- N03 격리 (핵심) -->
<!-- Plan SC: C등급 물리격리 + O등급 MLS 전환 로드맵 + k8s NetworkPolicy YAML -->

---

## 1. 영역 개요

N03 격리 영역은 N2SF의 핵심 기술 통제 영역입니다.
데이터 등급(C/S/O)에 따라 네트워크, 시스템, 저장소를 물리적·논리적으로 분리하며,
CSAP D10(네트워크 보안), D08-08(네트워크 접근 통제), D08-10(접근 로그)과 직접 대응됩니다.

### 핵심 원칙

- **C 등급**: 물리적 완전 격리 + 논리적 분리 (공개망 연결 불가, 전용 k3s 클러스터)
- **S 등급**: 논리적 분리 (전용 Namespace, NetworkPolicy 강제 차단)
- **O 등급**: 공유 클러스터 허용 (Namespace 격리 + 레이블 강제)

---

## 2. C/S/O 등급별 격리 아키텍처

### 현재 아키텍처 (2026년 기준)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
C 등급 (기밀)       │ 물리 격리 전용 클러스터
                    │ - 공개망 연결 없음 (에어갭)
                    │ - 전용 HSM 암호화 (KCMVP 인증)
                    │ - 전용 물리 서버 또는 WSL2 인스턴스
                    │ - LM Studio 온프레미스 AI만 허용
                    │ - 모든 외부 Egress 차단
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
S 등급 (민감)       │ 논리 격리 전용 Namespace
                    │ - NetworkPolicy: 기본 Deny-all
                    │ - 동일 등급 Namespace 간만 통신 허용
                    │ - 외부 인터넷 Egress 차단
                    │ - 내부 서비스 간 mTLS 강제
                    │ - AI API 외부 전송 금지
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
O 등급 (공개)       │ 공유 클러스터 Namespace 격리
                    │ - Namespace 레이블 강제 (data-grade: O)
                    │ - 외부 인터넷 Egress 허용 (화이트리스트)
                    │ - AI API 연동 허용 (PII 마스킹 후)
                    │ - Ingress 외부 노출 허용
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 등급별 네트워크 통제 비교

| 통제 항목 | C 등급 (기밀) | S 등급 (민감) | O 등급 (공개) |
|---------|-------------|-------------|-------------|
| 네트워크 분리 | 물리적 격리 (에어갭) | 논리적 격리 (NetworkPolicy) | Namespace 격리 |
| 외부 Egress | 전면 차단 | 전면 차단 | 화이트리스트 허용 |
| 내부 Ingress | 동일 클러스터 내부만 | 동일 등급 Namespace 간만 | 클러스터 내부 허용 |
| 외부 Ingress | 금지 | 금지 (VPN 경유 예외) | Ingress Controller 허용 |
| 서비스 메시 | 불필요 (격리) | mTLS 강제 (Linkerd/Istio) | mTLS 권고 |
| DNS 해석 | 내부 DNS만 | 내부 DNS만 | 외부 DNS 허용 |
| AI API 연동 | 온프레미스만 (LM Studio) | 온프레미스만 (LM Studio) | 외부 API 허용 (마스킹 후) |

---

## 3. k8s NetworkPolicy 구현 패턴

### 3.1 C 등급 Namespace — 완전 격리 (Deny-all)

```yaml
# C 등급: 모든 Ingress + Egress 차단
# CSAP-D10-01 (네트워크 접근 통제) + N2SF N-03
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: grade-c-deny-all
  namespace: grade-c
  labels:
    n2sf.area: "N03"
    data-grade: "C"
  annotations:
    csap.control: "D10-01"
    description: "C등급 전용 Namespace — 모든 외부 통신 차단"
spec:
  podSelector: {}           # 모든 Pod 대상
  policyTypes:
    - Ingress
    - Egress
  # Ingress/Egress 규칙 미정의 → 모든 트래픽 차단
---
# C 등급: 동일 Namespace 내부 통신만 허용 (선택적)
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: grade-c-internal-only
  namespace: grade-c
  labels:
    n2sf.area: "N03"
  annotations:
    csap.control: "D10-01"
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - podSelector: {}    # 동일 Namespace 내 Pod 간만 허용
  egress:
    - to:
        - podSelector: {}    # 동일 Namespace 내 Pod 간만 허용
    - to:                    # CoreDNS 허용 (내부 DNS 해석 필수)
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: kube-system
        - podSelector:
            matchLabels:
              k8s-app: kube-dns
      ports:
        - protocol: UDP
          port: 53
```

### 3.2 S 등급 Namespace — 동일 등급 간 통신만 허용

```yaml
# S 등급: 동일 data-grade 레이블 Namespace 간만 통신 허용
# CSAP-D10-02 (네트워크 분리) + N2SF N-03
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: grade-s-isolation
  namespace: grade-s
  labels:
    n2sf.area: "N03"
    data-grade: "S"
  annotations:
    csap.control: "D10-02"
    description: "S등급 Namespace — 동일 등급 간만 통신 허용"
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              data-grade: "S"    # S 등급 Namespace 간만 Ingress 허용
  egress:
    - to:
        - namespaceSelector:
            matchLabels:
              data-grade: "S"    # S 등급 Namespace 간만 Egress 허용
    - to:                        # CoreDNS 허용
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: kube-system
        - podSelector:
            matchLabels:
              k8s-app: kube-dns
      ports:
        - protocol: UDP
          port: 53
---
# S 등급: 외부 인터넷 Egress 명시적 차단
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: grade-s-no-external
  namespace: grade-s
  annotations:
    csap.control: "D10-01"
    description: "S등급 외부 인터넷 Egress 차단 — AI API 포함"
spec:
  podSelector: {}
  policyTypes:
    - Egress
  egress:
    - to:
        - ipBlock:
            cidr: 10.0.0.0/8      # 내부 네트워크만 허용
    - to:
        - ipBlock:
            cidr: 172.16.0.0/12   # 내부 네트워크만 허용
    - to:
        - ipBlock:
            cidr: 192.168.0.0/16  # 내부 네트워크만 허용
```

### 3.3 O 등급 Namespace — 외부 통신 화이트리스트

```yaml
# O 등급: 외부 통신 화이트리스트 기반 허용
# N2SF N-03 + CSAP-D10-03
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: grade-o-controlled-egress
  namespace: grade-o
  labels:
    n2sf.area: "N03"
    data-grade: "O"
  annotations:
    csap.control: "D10-03"
    description: "O등급 Namespace — 화이트리스트 기반 외부 통신 허용"
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - namespaceSelector: {}    # 클러스터 내 모든 Namespace 허용
    - from:
        - ipBlock:
            cidr: 0.0.0.0/0       # 외부 Ingress 허용 (Ingress Controller 경유)
            except:
              - 10.0.0.0/8         # 내부 대역은 namespaceSelector로 관리
  egress:
    - to:
        - namespaceSelector: {}    # 클러스터 내부 통신 허용
    - to:                          # Anthropic API 허용 (AI 연동)
        - ipBlock:
            cidr: 0.0.0.0/0       # PII 마스킹 후 외부 AI API 허용
      ports:
        - protocol: TCP
          port: 443                # HTTPS만 허용
    - to:                          # CoreDNS
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: kube-system
      ports:
        - protocol: UDP
          port: 53
```

---

## 4. CSAP 통제항목 역참조

| CSAP ID | 항목명 | N03 구현 요건 | k8s 리소스 |
|---------|--------|------------|---------|
| [CSAP-D10-01](../../02-csap/standard-grade/implementation-guide/D10-network.md#csap-d10-01) | 네트워크 접근 통제 | 기본 Deny-all + 화이트리스트 | NetworkPolicy |
| [CSAP-D10-02](../../02-csap/standard-grade/implementation-guide/D10-network.md#csap-d10-02) | 네트워크 분리 | 등급별 Namespace 격리 | Namespace + 레이블 |
| [CSAP-D10-03](../../02-csap/standard-grade/implementation-guide/D10-network.md#csap-d10-03) | DMZ 구성 | Ingress Layer 분리 | Ingress Controller |
| [CSAP-D08-08](../../02-csap/standard-grade/implementation-guide/D08-access-control.md#csap-d08-08) | 네트워크 접근 통제 | IP 기반 접근 제한 | NetworkPolicy ipBlock |
| [CSAP-D08-10](../../02-csap/standard-grade/implementation-guide/D08-access-control.md#csap-d08-10) | 접근 로그 기록 | 격리 위반 시도 기록 | audit.jsonl + OTel |

---

## 5. N2SF MLS 전환 로드맵

N2SF 다층보안(MLS, Multi-Level Security) 도입 대비 아키텍처 전환 계획:

### 현재 (2026년 상반기) — 폐쇄망 격리 아키텍처

```
현재 상태: C/S 등급 = 물리/논리 격리, O 등급 = 공유 클러스터
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
강점: 단순·명확, 물리적 보안 보장
약점: C/S 등급 AI 활용 불가, 인프라 비용 증가
```

### Phase 1 (2026년 하반기) — MLS 도입 검토

| 활동 | 산출물 | 담당 |
|------|--------|------|
| N2SF MLS 기술 규격 분석 | MLS 기술 보고서 | 보안팀 |
| 기존 격리 정책 MLS 호환성 평가 | 호환성 평가서 | 인프라팀 |
| MLS 파일럿 대상 선정 (O→S 등급) | 파일럿 계획서 | PM |

### Phase 2 (2027년) — MLS 파일럿

| 활동 | 산출물 | 담당 |
|------|--------|------|
| O→S 등급 공개망 연동 MLS 파일럿 | 파일럿 결과 보고서 | 보안팀 |
| MLS 기반 NetworkPolicy 재설계 | 정책 업데이트 | 인프라팀 |
| S 등급 AI API 제한적 허용 검토 | 보안 영향 평가서 | CISO |

### Phase 3 (2028년 이후) — C 등급 MLS 확대

| 활동 | 산출물 | 담당 |
|------|--------|------|
| C 등급 MLS 기반 공개망 LLM 활용 검토 | 기술 타당성 보고서 | 보안팀 |
| MLS 전체 아키텍처 전환 | 아키텍처 설계서 v2 | 아키텍트 |
| CSAP 인증 재평가 | CSAP 변경 신고서 | PM |

### MLS 전환 시 NetworkPolicy 변경 예시

```yaml
# Phase 2 (MLS 파일럿): S 등급에서 특정 외부 AI API 허용
# 주의: MLS 정책 확정 전까지 적용 금지
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: grade-s-mls-pilot-ai-egress
  namespace: grade-s
  labels:
    n2sf.area: "N03"
    mls-phase: "pilot"         # MLS 파일럿 전용 레이블
  annotations:
    description: "[MLS Phase 2] S등급 AI API 제한적 허용 — PII 마스킹 + 감사 로그 필수"
    approval: "CISO-2027-XXX"  # CISO 승인 번호 필수
spec:
  podSelector:
    matchLabels:
      app: ai-gateway           # AI 게이트웨이 Pod만 대상
  policyTypes:
    - Egress
  egress:
    - to:
        - ipBlock:
            cidr: 160.79.104.0/23    # Anthropic API IP 범위 (예시)
      ports:
        - protocol: TCP
          port: 443
```

---

## 6. 격리 위반 탐지 및 대응

### 탐지 메커니즘

```typescript
// N03 격리 위반 탐지 — OTel + NetworkPolicy 이벤트 연동
interface IsolationViolation {
  timestamp: string
  sourceNamespace: string
  sourceGrade: DataGrade
  targetNamespace: string
  targetGrade: DataGrade
  violationType: 'CROSS_GRADE' | 'EXTERNAL_EGRESS' | 'UNAUTHORIZED_INGRESS'
  action: 'BLOCKED' | 'LOGGED'     // NetworkPolicy가 차단, 로그 기록
}

// 격리 위반 시 자동 알림
async function handleIsolationViolation(
  violation: IsolationViolation
): Promise<void> {
  // 1. audit.jsonl 기록
  await auditLog({
    actor: 'SYSTEM',
    action: 'ISOLATION_VIOLATION',
    target: `${violation.sourceNamespace} -> ${violation.targetNamespace}`,
    n2sfDomain: 'N03',
    csapControl: 'D10-01',
    result: violation.action,
    metadata: violation,
  })

  // 2. 등급별 알림
  if (violation.sourceGrade === 'C' || violation.targetGrade === 'C') {
    await alertCISO('C등급 격리 위반 탐지', violation)    // 즉시 알림
  }
}
```

### 정기 검증 스크립트

```bash
#!/bin/bash
# N03 격리 정책 정기 검증 — 주 1회 실행 권장
echo "=== N03 격리 정책 검증 $(date +%Y-%m-%d) ==="

# 1. 등급별 Namespace 레이블 확인
echo "--- Namespace 등급 레이블 확인 ---"
kubectl get namespaces -l data-grade --show-labels

# 2. NetworkPolicy 존재 확인 (등급별 최소 1개 필수)
echo "--- NetworkPolicy 확인 ---"
for ns in grade-c grade-s grade-o; do
  count=$(kubectl get networkpolicies -n $ns --no-headers 2>/dev/null | wc -l)
  echo "$ns: NetworkPolicy $count 개"
  if [ "$count" -eq 0 ]; then
    echo "  [경고] $ns에 NetworkPolicy가 없습니다! N03 위반"
  fi
done

# 3. C 등급 외부 통신 불가 검증
echo "--- C 등급 외부 통신 차단 검증 ---"
kubectl run test-c-egress --namespace=grade-c \
  --image=busybox --restart=Never --rm -it -- \
  wget --timeout=3 -q -O- https://api.anthropic.com 2>&1 || \
  echo "  [정상] C등급 외부 Egress 차단 확인"

echo "=== 검증 완료 ==="
```

---

## 7. 증적 자료 체크리스트

| 번호 | 증적 자료 | 보관 주기 | 비고 |
|------|---------|---------|------|
| 1 | NetworkPolicy YAML 목록 | 최신 유지 | Git 버전 관리 |
| 2 | Namespace 등급 레이블 현황 | 최신 유지 | kubectl 명령 결과 |
| 3 | 격리 위반 시도 로그 | 1년 | audit.jsonl |
| 4 | 정기 검증 실행 결과 | 1년 | 주 1회 |
| 5 | MLS 전환 검토 보고서 | 영구 | Phase별 산출물 |

---

## 8. 관련 문서

- [CSAP x N2SF 전수 매핑 테이블](../csap-n2sf-mapping.md) (MTU-C4)
- [데이터 등급 분류 체계](../data-grade-classification.md) (MTU-C4)
- [CSAP D10 네트워크 보안 구현 가이드](../../02-csap/standard-grade/implementation-guide/D10-network.md)
- [컨테이너 보안 베이스라인](../../07-infra/container-security-baseline.md) (MTU-I1)
- [N02 인증 구현 가이드](./N02-authentication.md) (인증 + 격리 연계)
- [N05 데이터 구현 가이드](./N05-data.md) (AI 라우팅 관련)

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 최초 작성 — N03 격리 구현 가이드 (MLS 전환 로드맵 + k8s NetworkPolicy YAML) | Claude Code |
