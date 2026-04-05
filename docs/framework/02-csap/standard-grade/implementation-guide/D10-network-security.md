# D10 네트워크 보안 구현 가이드

| 항목 | 내용 |
|------|------|
| 문서 ID | CSAP-IMPL-D10 |
| 버전 | 1.0.0 |
| 최종 수정일 | 2026-04-05 |
| CSAP 분야 | D10 네트워크 보안 |
| 항목 수 | 8개 (CSAP-D10-01 ~ D10-08) |
| 통제 유형 | 기술적 통제 |
| 심사 방법 | 설정 확인 + 네트워크 구성 검증 |
| 마스터 체크리스트 | [checklist-master.md#csap-d10-01](../checklist-master.md#csap-d10-01) |
| FR 매핑 | FR-2.3-D10 |

<!-- Design Ref: MTU-C3 Plan -- D10 네트워크 보안 -->
<!-- Plan SC: 방화벽/분리/침입탐지/mTLS 패턴 포함 -->

---

## 분야 개요

네트워크 보안은 시스템 간 통신을 보호하고 **비인가 접근을 차단**하는 기술 통제입니다. k3s 환경에서는 NetworkPolicy, kube-router, Traefik 등의 도구로 네트워크 레벨 보안을 구현합니다.

**핵심 키워드**: 방화벽, 세그멘테이션, IDS/IPS, 포트 차단, DNS 보안, mTLS

**연계 MTU**:
- MTU-I1 k3s 클러스터: kube-router + deny-all NetworkPolicy 기본 적용
- MTU-I4 네트워크/OpenTelemetry: 네트워크 모니터링 인프라

---

## CSAP-D10-01: 방화벽 운영

> **중요도**: 상 | **구분**: 필수

### 구현 목표

네트워크 방화벽을 설치/운영하고 기본 차단(deny all) 정책을 적용한다.

### 구현 방법

**k3s NetworkPolicy 기본 차단**

```yaml
# deny-all 기본 정책 (MTU-I1 container-security-baseline.md)
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: production
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress
```

**방화벽 규칙 검토 주기**: 분기 1회 (불필요 규칙 제거, 신규 요건 반영)

**호스트 레벨 방화벽 (UFW/iptables)**

```bash
# WSL2 호스트 방화벽 기본 설정
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 6443/tcp  # k3s API 서버
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

### 필요 증거 자료

| 증거 | 형태 | 보관 위치 |
|------|------|---------|
| 방화벽 설정 (NetworkPolicy YAML) | YAML | Git 저장소 |
| 방화벽 규칙 목록 | 표 | 문서관리시스템 |
| 분기별 규칙 검토 이력 | 보고서 | 문서관리시스템 |

---

## CSAP-D10-02: 네트워크 세그멘테이션

> **중요도**: 상 | **구분**: 필수

### 구현 목표

서비스/관리/DMZ 영역을 논리적으로 분리한다.

### 구현 방법

**k3s 네임스페이스 기반 세그멘테이션**

| 네임스페이스 | 영역 | 용도 | 접근 허용 |
|------------|------|------|---------|
| `production` | 서비스 | 운영 서비스 Pod | Ingress(443) -> web -> api -> db |
| `kube-system` | 관리 | k3s 시스템 컴포넌트 | 관리자 VPN에서만 접근 |
| `monitoring` | 모니터링 | Prometheus, Grafana | 관리자 VPN에서만 접근 |
| `staging` | 스테이징 | 배포 전 검증 | 개발팀 VPN에서만 접근 |

```yaml
# 네임스페이스 간 격리 정책
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-cross-namespace
  namespace: production
spec:
  podSelector: {}
  ingress:
    - from:
        - podSelector: {}  # 같은 네임스페이스 내부만 허용
  policyTypes:
    - Ingress
```

### 필요 증거 자료

| 증거 | 형태 | 보관 위치 |
|------|------|---------|
| 네트워크 구성도 | 다이어그램 | 문서관리시스템 |
| VLAN/네임스페이스 설정 | YAML/설정 | Git 저장소 |
| 세그먼트 목록 | 표 | 문서관리시스템 |

---

## CSAP-D10-03: 침입 탐지/방지 (IDS/IPS)

> **중요도**: 상 | **구분**: 필수

### 구현 목표

IDS/IPS를 설치/운영하고 탐지 규칙을 정기 업데이트한다.

### 구현 방법

| 도구 | 역할 | 배포 방법 |
|------|------|---------|
| Falco | 런타임 위협 탐지 (컨테이너) | k3s DaemonSet |
| kube-router | 네트워크 정책 적용 | k3s 기본 CNI |
| ModSecurity (Nginx) | WAF (웹 공격 차단) | Nginx 모듈 |

```yaml
# Falco: 컨테이너 런타임 이상 탐지
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: falco
  namespace: kube-system
spec:
  selector:
    matchLabels:
      app: falco
  template:
    metadata:
      labels:
        app: falco
    spec:
      containers:
        - name: falco
          image: falcosecurity/falco:latest
          securityContext:
            privileged: true
          volumeMounts:
            - name: proc
              mountPath: /host/proc
              readOnly: true
      volumes:
        - name: proc
          hostPath:
            path: /proc
```

### 필요 증거 자료

| 증거 | 형태 | 보관 위치 |
|------|------|---------|
| IDS/IPS 설정 | 설정 파일/YAML | Git 저장소 |
| 탐지 규칙 목록 | 설정 | 보안 관리 |
| 알림 이력 | 로그 | 모니터링 시스템 |

---

## CSAP-D10-04: 네트워크 모니터링

> **중요도**: 중 | **구분**: 필수

### 구현 목표

네트워크 트래픽을 모니터링하고 이상 트래픽을 탐지한다.

### 구현 방법

| 모니터링 항목 | 도구 | 임계값 |
|------------|------|-------|
| 트래픽 사용량 | Prometheus + node-exporter | 대역폭 80% 초과 경고 |
| 비정상 트래픽 | Falco + kube-router | 비허가 포트 접근 |
| DDoS 탐지 | Rate limiting + 트래픽 분석 | 분당 요청 10,000회 초과 |
| 연결 상태 | Prometheus | 비정상 TCP 연결 수 |

### 필요 증거 자료

| 증거 | 형태 | 보관 위치 |
|------|------|---------|
| 모니터링 대시보드 | 스크린샷 | 문서관리시스템 |
| 이상 탐지 규칙 | 설정 | 모니터링 시스템 |
| DDoS 대응 설정 | 설정 | 네트워크 관리 |

---

## CSAP-D10-05: 불필요 포트/서비스 차단

> **중요도**: 상 | **구분**: 필수

### 구현 목표

불필요 포트를 폐쇄하고 최소한의 서비스만 노출한다.

### 구현 방법

**허용 포트 목록 (화이트리스트)**

| 포트 | 서비스 | 접근 대상 |
|------|-------|---------|
| 443/tcp | HTTPS (서비스) | 인터넷 (이용자) |
| 6443/tcp | k3s API 서버 | VPN 관리자만 |
| 22/tcp | SSH (비상) | VPN 관리자만 |

**나머지 모든 포트 기본 차단.**

```bash
# 정기 포트 스캔 (분기 1회)
nmap -sT -p- localhost | grep open
# 허용 목록 외 오픈 포트 발견 시 즉시 차단
```

### 필요 증거 자료

| 증거 | 형태 | 보관 위치 |
|------|------|---------|
| 포트 스캔 결과 | 보고서 | 문서관리시스템 |
| 허용 포트 목록 | 표 | 방화벽 규칙 |
| 서비스 목록 | 표 | 인프라 관리 |

---

## CSAP-D10-06: DNS 보안

> **중요도**: 중 | **구분**: 필수

### 구현 목표

DNS 보안 설정(DNSSEC)을 적용하고 DNS 로그를 기록한다.

### 구현 방법

| 항목 | 설정 |
|------|------|
| DNSSEC | DNS 영역 서명 활성화 |
| DNS over HTTPS | 내부 DNS 쿼리 암호화 |
| DNS 로그 | 모든 DNS 쿼리/응답 기록 |
| 캐시 포이즈닝 방지 | 소스 포트 랜덤화, 응답 검증 |

```yaml
# CoreDNS (k3s 기본) 로깅 설정
apiVersion: v1
kind: ConfigMap
metadata:
  name: coredns
  namespace: kube-system
data:
  Corefile: |
    .:53 {
        errors
        log  # DNS 쿼리 로깅 활성화
        health
        ready
        kubernetes cluster.local in-addr.arpa ip6.arpa {
          pods insecure
          fallthrough in-addr.arpa ip6.arpa
        }
        forward . /etc/resolv.conf
        cache 30
        loop
        reload
        loadbalance
    }
```

### 필요 증거 자료

| 증거 | 형태 | 보관 위치 |
|------|------|---------|
| DNS 설정 | 설정 파일 | Git 저장소 |
| DNSSEC 설정 | 설정/증빙 | DNS 관리 |
| DNS 로그 | 로그 파일 | 로그 저장소 |

---

## CSAP-D10-07: 무선 네트워크 보안

> **중요도**: 중 | **구분**: 권고

### 구현 목표

무선 AP 보안(WPA3/WPA2)을 설정하고 비인가 AP를 탐지한다.

### 구현 방법

| 항목 | 설정 |
|------|------|
| 인증 | WPA3-Enterprise (또는 최소 WPA2-Enterprise) |
| 게스트 분리 | 게스트 네트워크 별도 VLAN |
| 비인가 AP | 정기 스캔 (월 1회) |
| MAC 필터 | 허가 단말만 접속 |

> 참고: WSL2 기반 개발 환경에서는 무선 네트워크가 직접 적용되지 않습니다. 이 항목은 운영 데이터센터 환경에 적용합니다.

### 필요 증거 자료

| 증거 | 형태 | 보관 위치 |
|------|------|---------|
| 무선 보안 설정 | 설정 화면 | 네트워크 관리 |
| AP 목록 | 표 | 네트워크 관리 |
| 게스트 네트워크 설정 | 설정 | 네트워크 관리 |

---

## CSAP-D10-08: 외부 연결 통제

> **중요도**: 상 | **구분**: 필수

### 구현 목표

외부 네트워크 연결을 점검하고 비인가 외부 접속을 차단한다.

### 구현 방법

| 원칙 | 구현 |
|------|------|
| 외부 연결 최소화 | 허가된 외부 연결만 허용 (화이트리스트) |
| VPN 필수 | 외부에서 내부 접근 시 VPN 경유 |
| 접속 이력 | 외부 연결 이력 전수 기록 |
| 정기 점검 | 분기 1회 외부 연결 목록 검토 |

```yaml
# k3s Egress 정책: 허가된 외부 연결만 허용
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: restrict-egress
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: api-server
  egress:
    - to:
        - podSelector: {}  # 내부 통신 허용
    - to:
        - ipBlock:
            cidr: 0.0.0.0/0  # 외부 통신
      ports:
        - port: 443          # HTTPS만 허용
          protocol: TCP
  policyTypes:
    - Egress
```

### 필요 증거 자료

| 증거 | 형태 | 보관 위치 |
|------|------|---------|
| 외부 연결 목록 | 표 | 네트워크 관리 |
| VPN 설정 | 설정 파일 | 인프라 관리 |
| 외부 접속 이력 | 로그 | audit.jsonl |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 최초 작성 -- CSAP-D10 8항목 전수 구현 가이드. k3s NetworkPolicy + Falco + CoreDNS 패턴 | Claude Code |
