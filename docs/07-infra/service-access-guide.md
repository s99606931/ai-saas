# 서비스 접속 가이드 — WSL2 k3s 개발 환경

> **작성일**: 2026-04-09 | **환경**: WSL2 + k3s
> **노드 IP**: `172.18.120.97`
> **주의**: 이 문서의 패스워드는 개발 환경 전용입니다. 운영 배포 시 반드시 교체하십시오.

---

## 빠른 참조 (Quick Reference)

| 서비스 | URL | ID | 비밀번호 |
|--------|-----|----|---------|
| **Grafana** (모니터링 대시보드) | http://172.18.120.97:30302 | `admin` | `admin` |
| **Prometheus** (메트릭 쿼리) | http://172.18.120.97:30090 | — | — (인증 없음) |
| **Gitea** (Git 저장소) | http://172.18.120.97:30300 | `saas-admin` | `admin_cd79bcf83ee6da10` |
| **Harbor** (컨테이너 레지스트리) | http://172.18.120.97:30080 | `admin` | `Harbor_8000458f5f68425c` |
| **MinIO** (오브젝트 스토리지) | http://172.18.120.97:30901 | `minio_admin` | `minio_dev_2026` |
| **SaaS Portal** (서비스 포털) | http://172.18.120.97:30400 | — | — |
| **API Gateway** | http://172.18.120.97:32276 | — | JWT 토큰 |
| **PostgreSQL** (DB 직접 접속) | `172.18.120.97:30432` | `saas` | `saas_dev_2026` |
| **Redis** (캐시 직접 접속) | `172.18.120.97:30379` | — | `redis_dev_2026` |

---

## 1. 관측가능성 플랫폼 (Observability)

### 1-1. Grafana — 통합 모니터링 대시보드

```
URL    : http://172.18.120.97:30302
ID     : admin
PW     : admin
```

**초기 접속 후 권장 작업:**
1. 좌측 메뉴 → **Dashboards** → 기본 대시보드 확인
2. 사전 설치된 대시보드:
   - `SQL Monitoring Dashboard` — PostgreSQL 슬로우쿼리 TOP 20, 인덱스 사용률
   - `Service Traffic Dashboard` — 마이크로서비스 트래픽, R.E.D. 메트릭
   - `Log Explorer Dashboard` — 로그 조회 + Tempo 트레이스 연동
3. 비밀번호 변경: 우측 상단 프로필 → **Change password**

**로그 조회 (Explore → Loki):**
```logql
# saas-platform 전체 로그
{namespace="saas-platform"}

# 특정 서비스 에러 로그
{namespace="saas-platform", app="auth-service"} |= "error"

# 최근 1시간 경고 이상 로그
{namespace=~"saas-platform|cicd"} | json | level >= "warn"
```

**트레이스 조회 (Explore → Tempo):**
```
서비스 그래프: Tempo 데이터소스 → Service Graph
트레이스 ID 직접: Search → Trace ID 입력
```

---

### 1-2. Prometheus — 메트릭 쿼리 엔진

```
URL    : http://172.18.120.97:30090
인증   : 없음 (클러스터 내부 접근 권장)
```

**주요 PromQL 예시:**

```promql
# 네임스페이스별 CPU 사용량
sum(rate(container_cpu_usage_seconds_total[5m])) by (namespace)

# PostgreSQL 슬로우쿼리 (5초 초과)
pg_slow_queries_mean_exec_time_seconds > 5

# 서비스 에러율
sum(rate(traces_service_graph_request_failed_total[5m])) by (client)
  / sum(rate(traces_service_graph_request_total[5m])) by (client)

# 현재 활성 알림 확인
ALERTS{alertstate="firing"}
```

**알림 규칙 확인:**
```
http://172.18.120.97:30090/alerts
```

---

### 1-3. AlertManager — 알림 관리

```
접근방법 : port-forward (NodePort 미노출)
명령어   : kubectl port-forward -n monitoring svc/kube-prometheus-stack-alertmanager 9093:9093
URL      : http://localhost:9093
인증     : 없음
```

**port-forward 없이 확인:**
```bash
# 현재 firing 중인 알림 목록
curl -s http://172.18.120.97:30090/api/v1/alerts | python3 -c \
  "import sys,json; d=json.load(sys.stdin); [print(a['labels']['alertname'], a['state']) for a in d['data']['alerts']]"
```

---

### 1-4. Loki — 로그 집계

```
접근방법 : Grafana Explore 메뉴 또는 port-forward
직접접속 : kubectl port-forward -n monitoring svc/loki-gateway 3100:80
LogQL API: http://localhost:3100/loki/api/v1/query_range
헤더     : X-Scope-OrgID: fake
```

**CLI 로그 조회 예시:**
```bash
# port-forward 먼저 실행
kubectl port-forward -n monitoring svc/loki-gateway 3100:80

# 최근 5분 saas-platform 로그
curl -s "http://localhost:3100/loki/api/v1/query_range" \
  -H "X-Scope-OrgID: fake" \
  --data-urlencode 'query={namespace="saas-platform"}' \
  --data-urlencode "start=$(date -d '5 minutes ago' +%s)000000000" \
  --data-urlencode "end=$(date +%s)000000000" \
  --data-urlencode "limit=50" | python3 -m json.tool
```

---

### 1-5. Tempo — 분산 트레이스

```
접근방법 : Grafana Explore → Tempo 데이터소스
직접접속 : kubectl port-forward -n monitoring svc/tempo 3200:3200
OTLP gRPC: tempo.monitoring.svc.cluster.local:4317 (클러스터 내부)
OTLP HTTP: tempo.monitoring.svc.cluster.local:4318 (클러스터 내부)
```

**트레이스 직접 조회:**
```bash
kubectl port-forward -n monitoring svc/tempo 3200:3200
curl http://localhost:3200/api/search?limit=5
```

---

## 2. CI/CD 플랫폼

### 2-1. Gitea — Git 저장소

```
URL    : http://172.18.120.97:30300
ID     : saas-admin
PW     : admin_cd79bcf83ee6da10
SSH    : ssh://git@172.18.120.97:30222
```

**초기 접속 후 권장 작업:**
1. 브라우저에서 위 URL 접속 → 로그인
2. 우측 상단 `+` → **New Repository**
3. CI 파이프라인 확인: 좌측 메뉴 → **Act Runners** (등록된 러너 확인)

**Git 원격 저장소 설정:**
```bash
git remote add gitea http://172.18.120.97:30300/saas-admin/<repo-name>.git
git push gitea main
```

---

### 2-2. Harbor — 컨테이너 레지스트리

```
URL    : http://172.18.120.97:30080
ID     : admin
PW     : Harbor_8000458f5f68425c
```

**Docker 로그인:**
```bash
docker login 172.18.120.97:30080 -u admin -p Harbor_8000458f5f68425c
```

**이미지 푸시:**
```bash
docker tag myimage:latest 172.18.120.97:30080/library/myimage:latest
docker push 172.18.120.97:30080/library/myimage:latest
```

**k3s에서 Harbor 레지스트리 사용:**
```bash
# /etc/rancher/k3s/registries.yaml 에 추가
sudo tee /etc/rancher/k3s/registries.yaml << 'EOF'
mirrors:
  "172.18.120.97:30080":
    endpoint:
      - "http://172.18.120.97:30080"
EOF
sudo systemctl restart k3s
```

---

## 3. SaaS 플랫폼 서비스

### 3-1. SaaS Portal — 서비스 포털

```
URL    : http://172.18.120.97:30400
인증   : 회원가입 후 이용 (초기 계정 없음)
```

---

### 3-2. API Gateway

```
URL    : http://172.18.120.97:32276
인증   : JWT Bearer 토큰
```

**JWT 토큰 발급 (auth-service):**
```bash
curl -X POST http://172.18.120.97:32276/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"your-password"}'
```

---

### 3-3. MinIO — 오브젝트 스토리지 콘솔

```
API URL  : http://172.18.120.97:30900
콘솔 URL : http://172.18.120.97:30901
ID       : minio_admin
PW       : minio_dev_2026
```

**mc CLI 설정:**
```bash
mc alias set local http://172.18.120.97:30900 minio_admin minio_dev_2026
mc ls local
```

---

### 3-4. PostgreSQL — 데이터베이스 직접 접속

```
호스트 : 172.18.120.97
포트   : 30432
DB     : saas_platform
ID     : saas
PW     : saas_dev_2026
```

**psql 접속:**
```bash
psql -h 172.18.120.97 -p 30432 -U saas -d saas_platform
# 비밀번호: saas_dev_2026

# pg_stat_statements 활성화 (슬로우쿼리 모니터링)
psql -h 172.18.120.97 -p 30432 -U saas -d saas_platform \
  -c "CREATE EXTENSION IF NOT EXISTS pg_stat_statements;"
```

---

### 3-5. Redis — 캐시 직접 접속

```
호스트 : 172.18.120.97
포트   : 30379
PW     : redis_dev_2026
```

**redis-cli 접속:**
```bash
redis-cli -h 172.18.120.97 -p 30379 -a redis_dev_2026
```

---

## 4. 전체 서비스 상태 확인

```bash
# 모든 파드 상태 (네임스페이스별)
kubectl get pods -A --no-headers | awk '{print $1, $2, $4}' | sort | column -t

# 관측가능성 스택만
kubectl get pods -n monitoring

# SaaS 플랫폼만
kubectl get pods -n saas-platform

# CI/CD만
kubectl get pods -n cicd
```

---

## 5. port-forward 원라인 모음

```bash
# Grafana (이미 NodePort로 접근 가능)
kubectl port-forward -n monitoring svc/kube-prometheus-stack-grafana 3000:80

# AlertManager
kubectl port-forward -n monitoring svc/kube-prometheus-stack-alertmanager 9093:9093

# Loki (LogQL 직접 쿼리)
kubectl port-forward -n monitoring svc/loki-gateway 3100:80

# Tempo (트레이스 조회)
kubectl port-forward -n monitoring svc/tempo 3200:3200

# Promtail 메트릭 (디버깅)
kubectl port-forward -n monitoring daemonset/promtail 3101:3101
```

---

## 6. 관측가능성 스택 설치 / 재설치

```bash
cd /data/ai-saas

# 전체 설치
./scripts/setup-observability.sh install

# 상태 확인
./scripts/setup-observability.sh verify

# 개별 컴포넌트 업그레이드
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
helm upgrade grafana grafana/grafana -n monitoring -f infra/monitoring/grafana/values.yaml
helm upgrade loki grafana/loki -n monitoring -f infra/monitoring/loki/values.yaml
helm upgrade promtail grafana/promtail -n monitoring -f infra/monitoring/promtail/values.yaml
helm upgrade tempo grafana/tempo -n monitoring -f infra/monitoring/tempo/values.yaml
```

---

## 7. 트러블슈팅

### Promtail이 로그를 보내지 않을 때

```bash
# 활성 파일 수 확인 (0이면 문제)
kubectl port-forward -n monitoring daemonset/promtail 3101:3101 &
curl -s http://localhost:3101/metrics | grep promtail_files_active_total

# Promtail 로그 확인
kubectl logs -n monitoring -l app.kubernetes.io/name=promtail --tail=20

# 재시작
kubectl rollout restart daemonset/promtail -n monitoring
```

### Loki 쿼리 결과가 없을 때

```bash
# Loki 상태 확인
kubectl port-forward -n monitoring svc/loki-gateway 3100:80 &
curl -s http://localhost:3100/ready

# 수집 중인 네임스페이스 확인
curl -s "http://localhost:3100/loki/api/v1/label/namespace/values" \
  -H "X-Scope-OrgID: fake" | python3 -m json.tool
```

### Grafana 데이터소스 연결 오류

```bash
# 데이터소스 ConfigMap 확인
kubectl get configmap -n monitoring -l grafana_datasource=1

# Grafana 재시작
kubectl rollout restart deployment/kube-prometheus-stack-grafana -n monitoring
```

### WSL2 재시작 후 IP 변경 시

```bash
# 새 노드 IP 확인
kubectl get nodes -o jsonpath='{.items[0].status.addresses[?(@.type=="InternalIP")].address}'
# 또는
hostname -I | awk '{print $1}'
```

> **참고**: WSL2는 재시작 시 IP가 변경될 수 있습니다. 변경된 IP로 위 URL을 수정하여 접속하십시오.

---

*이 문서는 `/data/ai-saas/docs/07-infra/service-access-guide.md` 에 저장되어 있습니다.*
