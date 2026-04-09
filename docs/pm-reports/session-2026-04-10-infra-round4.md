# PM 세션 보고서 -- 2026-04-10 인프라 4라운드

## 세션 개요

| 항목 | 값 |
|------|-----|
| 날짜 | 2026-04-10 |
| 세션 유형 | 인프라 고도화 4라운드 |
| 착수 MTU | MTU-N61 ~ MTU-N68 (8개) |
| 완료 MTU | 8/8 (100%) |
| 총 테스트 | 124건 ALL PASS + 교차 검증 6건 ALL PASS |
| 모델 | claude-opus-4-6 |

---

## 이번 세션 완료 MTU

| MTU | 제목 | TC 수 | 결과 | matchRate |
|-----|------|-------|------|-----------|
| MTU-N61 | Grafana 공공기관 SaaS 특화 대시보드 | 18 | ALL PASS | 100% |
| MTU-N62 | cert-manager TLS 인증서 자동화 | 20 | ALL PASS | 100% |
| MTU-N63 | Trivy Operator 클러스터 보안 스캔 | 14 | ALL PASS | 100% |
| MTU-N64 | CloudNativePG PostgreSQL Operator | 17 | ALL PASS | 100% |
| MTU-N65 | Gateway API + Traefik 고도화 | 20 | ALL PASS | 100% |
| MTU-N66 | External Secrets Operator | 17 | ALL PASS | 100% |
| MTU-N67 | Flux Drift Detection + 감사 | 12 | ALL PASS | 100% |
| MTU-N68 | 4라운드 통합 검증 (교차 검증 포함) | 124+6 | ALL PASS | 100% |

---

## 주요 산출물

### MTU-N61: Grafana 공공기관 SaaS 대시보드
- CSAP 준수 현황 대시보드 (8패널): Kyverno/Gatekeeper 정책 준수율, 감사 로그 통계
- 테넌트별 리소스 사용량 대시보드 (8패널): CPU/메모리/디스크, 네임스페이스 변수 기반
- 인증/보안 이벤트 대시보드 (8패널): 로그인 실패 Top10, RBAC 거부, 토큰 갱신

### MTU-N62: cert-manager TLS 자동화
- cert-manager v1.17 Helm values (CRD, Prometheus, ServiceMonitor)
- Self-Signed Root CA ClusterIssuer (10년 유효, ECDSA P-256)
- CA ClusterIssuer (Root CA 서명, 서비스 인증서 발급)
- 서비스별 Certificate 6종 (90일 유효, 30일 전 자동 갱신)
- Prometheus 알림 4개 (만료 30일/7일, NotReady, 컨트롤러 다운)

### MTU-N63: Trivy Operator 보안 스캔
- Trivy Operator Helm values (Standalone, CIS Benchmark 6시간 주기)
- VulnerabilityReport + ConfigAuditReport 자동 생성
- Prometheus 알림 3개 (Critical/High 취약점, 설정 감사 실패)
- Grafana 보안 스캔 대시보드 (8패널: 심각도 분포, CIS 준수율, 스캔 이력)

### MTU-N64: CloudNativePG PostgreSQL
- CloudNativePG Operator Helm values (PodMonitor, 보안 컨텍스트)
- HA 클러스터 (PostgreSQL 16, 3인스턴스, Anti-Affinity)
- SSL 필수 + scram-sha-256 인증 (CSAP D-09)
- WAL 아카이빙 MinIO + 스케줄 백업 (daily 03:00 KST)
- cert-manager DB TLS Certificate 자동 발급
- Prometheus 알림 4개 (복제 지연, 연결 수, WAL 실패, 장애 복구)

### MTU-N65: Gateway API + Traefik
- Traefik HelmChartConfig (Gateway API Provider 활성화, 접근 로그)
- GatewayClass + Gateway (HTTP/HTTPS 리스너, TLS 종단)
- HTTPRoute 6종 (auth, api-gw, tenant, audit, ai-gw, catalog)
- Rate Limiting 미들웨어 (100 req/s, AI 전용 10 req/s)
- 보안 헤더 미들웨어 (HSTS, CSP, X-Frame-Options, XSS Filter)
- 참고: ingress-nginx 2026-03 아카이브로 Gateway API 표준 전환

### MTU-N66: External Secrets Operator
- ESO Helm values (ServiceMonitor, 보안 컨텍스트)
- Kubernetes Backend SecretStore + RBAC (최소 권한)
- ExternalSecret 6종 (서비스별, refreshInterval 1h 자동 동기화)
- Sealed Secrets + ESO 역할 분리 문서 (배포 시점 vs 런타임)

### MTU-N67: Flux Drift Detection + 감사
- Flux Kustomization drift detection (interval 5m, prune true)
- HelmRelease driftDetection mode: enabled (replicas 무시 규칙)
- ConfigMap 변경 감사 스크립트 (YAML 유효성, 하드코딩 탐지)
- Secret 관리 감사 스크립트 (평문 시크릿, .env, 하드코딩 패턴)

---

## 전체 진행률

| 라운드 | MTU 범위 | 완료 | 총 테스트 |
|--------|---------|------|----------|
| 기본 35 MTU | F1~E3 | 35/35 | - |
| 확장 P00~P21 | 플랫폼 구현 | 22/22 | - |
| N01~N36 | DevOps 기반 | 36/36 | - |
| 1라운드 | N37~N44 | 8/8 | 39/39 |
| 2라운드 | N45~N52 | 8/8 | 160/160 |
| 3라운드 | N53~N60 | 8/8 | 100/100 |
| **4라운드** | **N61~N68** | **8/8** | **124/124** |
| **총계** | | **125+** | **423+** |

---

## 인프라 스택 현황

```
k3s (v1.30) + WSL2
  +-- Gitea + Actions (CI/CD)
  +-- Harbor (컨테이너 레지스트리)
  +-- Flux (GitOps + Drift Detection) [강화]
  +-- Flagger (카나리 배포)
  +-- Kyverno (이미지 서명 검증)
  +-- OPA Gatekeeper (Rego 정책 엔진)
  +-- Linkerd (서비스 메시 + mTLS)
  +-- Velero + MinIO (DR 자동화)
  +-- KEDA + VPA (오토스케일링)
  +-- Falco (런타임 보안)
  +-- Sealed Secrets (시크릿 암호화)
  +-- External Secrets Operator (런타임 시크릿 동기화) [NEW]
  +-- Litmus (카오스 엔지니어링)
  +-- Prometheus + Grafana + Loki + Tempo (관측성)
  +-- Sloth (SLO 자동화)
  +-- Cosign (이미지 서명)
  +-- cert-manager (TLS 인증서 자동화) [NEW]
  +-- Trivy Operator (취약점/CIS 스캔) [NEW]
  +-- CloudNativePG (PostgreSQL HA) [NEW]
  +-- Gateway API + Traefik (API 라우팅) [NEW]
  +-- DevContainer (개발 환경)
  +-- FinOps 도구 (비용 최적화)
```

---

## 웹검색 시장조사 결과 반영

| 조사 항목 | 결과 | 반영 MTU |
|-----------|------|---------|
| ingress-nginx 아카이브 (2026-03-24) | CVE 9.8, 공식 종료 | N65: Gateway API 전환 |
| cert-manager v1.17 설치 | OCI Helm + CRD 내장 | N62: Helm values |
| Trivy Operator CIS Benchmark | v1.23 벤치마크, 6시간 주기 | N63: 컴플라이언스 |
| CloudNativePG + Flux CD | GitOps 선언적 DB 관리 | N64: Cluster CRD |
| ESO vs Sealed Secrets | ESO 런타임 동기화 장점 | N66: 이중 관리 전략 |
| Flux Drift Detection | ConfigMap/Secret 드리프트 | N67: 감사 강화 |

---

## CSAP 커버리지 업데이트

| CSAP 통제항목 | 4라운드 추가 커버리지 |
|-------------|-------------------|
| D-06 침해사고관리 | cert-manager 만료 알림, Trivy 스캔, CloudNativePG 감사 로깅, Drift Detection |
| D-08 접근통제 | Gateway API Rate Limiting, 보안 헤더, ESO RBAC, CSAP 대시보드 |
| D-09 암호화 | cert-manager TLS 자동화, CloudNativePG SSL+scram-sha-256, ESO 시크릿 회전 |
| D-12 개발보안 | Trivy CIS Benchmark, Gateway API 표준 전환, ConfigMap/Secret 감사 |

---

## 다음 세션 착수 권장

1. **MTU-N69**: Crossplane 인프라 추상화 (DB/Storage를 K8s CRD로 관리)
2. **MTU-N70**: Backstage 개발자 포털 (서비스 카탈로그 + TechDocs)
3. **MTU-N71**: ArgoCD Rollouts 고급 배포 전략 (Blue-Green, Analysis Run)
4. **MTU-N72**: Prometheus Mimir 장기 메트릭 저장소 (Thanos 대안)

---

## 발견된 이슈/블로커

- **ingress-nginx 종료**: 2026-03-24 아카이브 + CVSS 9.8 CVE. Gateway API로 완전 전환 필요. 기존 Ingress 리소스는 Traefik Gateway API로 마이그레이션 권장.
- **ESO 파일 경로**: 초기 생성 시 `external-secret-refs/` 디렉토리에 저장되어 이동 필요. 해결 완료.
- **통합 테스트 파싱**: grep 출력에서 PASS/FAIL 수치 추출 시 정규식 개선 필요 (`\K` 후방 참조 사용). 해결 완료.
