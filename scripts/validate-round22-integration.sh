#!/bin/bash
# Round 22 통합 검증 스크립트
# Design Ref: MTU-N218 S2.4
# Plan SC: FR-N218.4
# CSAP: D-06 감사 모니터링 검증

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
MONITORING_DIR="${PROJECT_ROOT}/infra/monitoring"
DASHBOARD_DIR="${MONITORING_DIR}/dashboards"

PASS=0
FAIL=0
WARN=0

log_pass() { echo "[PASS] $1"; PASS=$((PASS+1)); }
log_fail() { echo "[FAIL] $1"; FAIL=$((FAIL+1)); }
log_warn() { echo "[WARN] $1"; WARN=$((WARN+1)); }
log_info() { echo "[INFO] $1"; }

echo "=============================================="
echo "  Round 22 통합 검증 (MTU-N218)"
echo "  실행 시각: $(date '+%Y-%m-%d %H:%M:%S')"
echo "=============================================="
echo ""

# 1. YAML 문법 검증
log_info "=== 1. YAML 문법 검증 ==="

YAML_FILES=(
  "${MONITORING_DIR}/round22-cross-reference-rules.yaml"
  "${MONITORING_DIR}/round22-alert-routing.yaml"
)

for f in "${YAML_FILES[@]}"; do
  if [ ! -f "$f" ]; then
    log_fail "파일 미존재: $f"
    continue
  fi
  if python3 -c "import yaml; yaml.safe_load(open('$f'))" 2>/dev/null; then
    log_pass "YAML 문법 정상: $(basename "$f")"
  else
    log_fail "YAML 문법 오류: $(basename "$f")"
  fi
done

# 2. 대시보드 JSON 검증
log_info ""
log_info "=== 2. 대시보드 JSON 검증 ==="

INTEGRATION_DASHBOARD="${DASHBOARD_DIR}/round22-integration-dashboard.json"

if [ ! -f "$INTEGRATION_DASHBOARD" ]; then
  log_fail "통합 대시보드 미존재: round22-integration-dashboard.json"
else
  if python3 -c "import json; json.load(open('$INTEGRATION_DASHBOARD'))" 2>/dev/null; then
    log_pass "JSON 문법 정상: round22-integration-dashboard.json"
  else
    log_fail "JSON 문법 오류: round22-integration-dashboard.json"
  fi

  # 패널 ID 중복 검사
  DUPLICATE_IDS=$(python3 -c "
import json
d = json.load(open('$INTEGRATION_DASHBOARD'))
ids = [p['id'] for p in d.get('panels', []) if 'id' in p]
seen = set()
dupes = set()
for i in ids:
    if i in seen:
        dupes.add(i)
    seen.add(i)
print(','.join(map(str, dupes)) if dupes else '')
" 2>/dev/null || echo "ERROR")

  if [ "$DUPLICATE_IDS" = "" ]; then
    log_pass "패널 ID 중복 없음"
  elif [ "$DUPLICATE_IDS" = "ERROR" ]; then
    log_fail "패널 ID 중복 검사 실패"
  else
    log_fail "패널 ID 중복 발견: $DUPLICATE_IDS"
  fi

  # UID 확인
  DASHBOARD_UID=$(python3 -c "import json; print(json.load(open('$INTEGRATION_DASHBOARD')).get('uid',''))" 2>/dev/null)
  if [ -n "$DASHBOARD_UID" ]; then
    log_pass "대시보드 UID 설정됨: $DASHBOARD_UID"
  else
    log_fail "대시보드 UID 미설정"
  fi
fi

# 3. 드릴다운 링크 대상 대시보드 존재 확인
log_info ""
log_info "=== 3. 드릴다운 링크 검증 ==="

EXPECTED_DASHBOARDS=(
  "apiserver-lat-n200:apiserver-latency-dashboard.json"
  "etcd-perf-n201:etcd-performance-dashboard.json"
  "coredns-perf-n202:coredns-performance-dashboard.json"
  "kubelet-performance-n203:kubelet-performance-dashboard.json"
  "scheduler-performance-n204:scheduler-performance-dashboard.json"
  "controller-manager-perf-n205:controller-manager-performance-dashboard.json"
  "resource-optimization-n206:resource-optimization-dashboard.json"
  "gc-monitoring-n207:gc-monitoring-dashboard.json"
  "disk-io-saturation-n208:disk-io-saturation-dashboard.json"
  "network-bandwidth-n209:network-bandwidth-dashboard.json"
  "oom-kill-tracking-n210:oom-kill-tracking-dashboard.json"
  "init-container-perf-n211:init-container-perf-dashboard.json"
  "image-pull-n212:image-pull-latency-dashboard.json"
  "sa-token-n213:sa-token-expiry-dashboard.json"
  "adm-webhook-n214:admission-webhook-latency-dashboard.json"
  "crd-ctrl-n215:crd-controller-status-dashboard.json"
  "sched-wait-n216:scheduling-wait-dashboard.json"
  "ns-trend-n217:namespace-resource-trend-dashboard.json"
)

for entry in "${EXPECTED_DASHBOARDS[@]}"; do
  uid="${entry%%:*}"
  file="${entry##*:}"
  if [ -f "${DASHBOARD_DIR}/${file}" ]; then
    actual_uid=$(python3 -c "import json; print(json.load(open('${DASHBOARD_DIR}/${file}')).get('uid',''))" 2>/dev/null)
    if [ "$actual_uid" = "$uid" ]; then
      log_pass "대시보드 존재 + UID 일치: ${uid}"
    else
      log_warn "대시보드 존재하지만 UID 불일치: 기대=${uid}, 실제=${actual_uid}"
    fi
  else
    log_fail "대시보드 파일 미존재: ${file}"
  fi
done

# 4. Recording Rule 참조 무결성
log_info ""
log_info "=== 4. Recording Rules 참조 무결성 ==="

RULES_FILE="${MONITORING_DIR}/round22-cross-reference-rules.yaml"
if [ -f "$RULES_FILE" ]; then
  RULE_COUNT=$(python3 -c "
import yaml
d = yaml.safe_load(open('$RULES_FILE'))
count = 0
for g in d.get('groups', []):
    count += len(g.get('rules', []))
print(count)
" 2>/dev/null || echo "0")

  if [ "$RULE_COUNT" -ge 5 ]; then
    log_pass "Recording Rules 정의 수: ${RULE_COUNT}개 (최소 5개 충족)"
  else
    log_fail "Recording Rules 부족: ${RULE_COUNT}개 (최소 5개 필요)"
  fi

  # 통합 대시보드에서 참조하는 메트릭 확인
  REFERENCED_METRICS=$(python3 -c "
import json
d = json.load(open('$INTEGRATION_DASHBOARD'))
metrics = set()
for p in d.get('panels', []):
    for t in p.get('targets', []):
        expr = t.get('expr', '')
        if expr.startswith('round22:'):
            metrics.add(expr.strip())
for m in sorted(metrics):
    print(m)
" 2>/dev/null)

  DEFINED_METRICS=$(python3 -c "
import yaml
d = yaml.safe_load(open('$RULES_FILE'))
for g in d.get('groups', []):
    for r in g.get('rules', []):
        print(r.get('record', ''))
" 2>/dev/null)

  while IFS= read -r metric; do
    if echo "$DEFINED_METRICS" | grep -q "^${metric}$"; then
      log_pass "메트릭 정의 확인: ${metric}"
    else
      log_fail "메트릭 미정의: ${metric} (대시보드에서 참조하나 Rules에 없음)"
    fi
  done <<< "$REFERENCED_METRICS"
else
  log_fail "Recording Rules 파일 미존재"
fi

# 5. 알림 라우팅 검증
log_info ""
log_info "=== 5. 알림 라우팅 검증 ==="

ROUTING_FILE="${MONITORING_DIR}/round22-alert-routing.yaml"
if [ -f "$ROUTING_FILE" ]; then
  ROUTE_COUNT=$(python3 -c "
import yaml
d = yaml.safe_load(open('$ROUTING_FILE'))
routes = d.get('route', {}).get('routes', [])
print(len(routes))
" 2>/dev/null || echo "0")

  if [ "$ROUTE_COUNT" -ge 5 ]; then
    log_pass "알림 라우팅 경로 수: ${ROUTE_COUNT}개 (5개 카테고리 충족)"
  else
    log_fail "알림 라우팅 부족: ${ROUTE_COUNT}개"
  fi

  RECEIVER_COUNT=$(python3 -c "
import yaml
d = yaml.safe_load(open('$ROUTING_FILE'))
receivers = d.get('receivers', [])
print(len(receivers))
" 2>/dev/null || echo "0")

  if [ "$RECEIVER_COUNT" -ge 4 ]; then
    log_pass "수신자 정의 수: ${RECEIVER_COUNT}개"
  else
    log_fail "수신자 부족: ${RECEIVER_COUNT}개"
  fi
else
  log_fail "알림 라우팅 파일 미존재"
fi

# 결과 요약
echo ""
echo "=============================================="
echo "  검증 결과 요약"
echo "=============================================="
echo "  통과: ${PASS}"
echo "  실패: ${FAIL}"
echo "  경고: ${WARN}"
echo "  총계: $((PASS + FAIL + WARN))"
echo "=============================================="

if [ "$FAIL" -gt 0 ]; then
  echo "  상태: 실패 (${FAIL}건 수정 필요)"
  exit 1
else
  echo "  상태: 통과"
  exit 0
fi
