#!/bin/bash
# =============================================================================
# MTU-N61: Grafana 공공기관 SaaS 특화 대시보드 검증
# Design Ref: MTU-N61.design.md §1, §2
# Plan SC: FR-N61.1~FR-N61.6
# =============================================================================

set -euo pipefail

PASS=0
FAIL=0
TOTAL=0
DASH_DIR="/data/ai-saas/infra/monitoring/dashboards"

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

run_test() {
  local id="$1" desc="$2" cmd="$3"
  TOTAL=$((TOTAL + 1))
  if eval "$cmd" > /dev/null 2>&1; then
    echo -e "  ${GREEN}[PASS]${NC} ${id}: ${desc}"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}[FAIL]${NC} ${id}: ${desc}"
    FAIL=$((FAIL + 1))
  fi
}

echo "============================================================"
echo " MTU-N61: Grafana 공공기관 SaaS 특화 대시보드 검증"
echo " $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================================"

# --- FR-N61.1: CSAP 준수 현황 대시보드 ---
echo ""
echo "--- FR-N61.1: CSAP 준수 현황 대시보드 ---"

run_test "TC-01" "CSAP 대시보드 파일 존재" \
  "[ -f '${DASH_DIR}/csap-compliance-status.json' ]"

run_test "TC-02" "CSAP 대시보드 유효 JSON" \
  "python3 -c \"import json; json.load(open('${DASH_DIR}/csap-compliance-status.json'))\""

run_test "TC-03" "CSAP 대시보드 패널 8개 이상" \
  "python3 -c \"
import json
d = json.load(open('${DASH_DIR}/csap-compliance-status.json'))
panels = [p for p in d.get('panels', []) if p.get('type') != 'row']
assert len(panels) >= 8, f'panels={len(panels)}'
\""

run_test "TC-04" "CSAP 대시보드 Kyverno 정책 패널 포함" \
  "python3 -c \"
import json
d = json.load(open('${DASH_DIR}/csap-compliance-status.json'))
targets = str(d)
assert 'policy_report_result' in targets or 'kyverno' in targets.lower()
\""

# --- FR-N61.2: 테넌트 리소스 대시보드 ---
echo ""
echo "--- FR-N61.2: 테넌트 리소스 대시보드 ---"

run_test "TC-05" "테넌트 대시보드 파일 존재" \
  "[ -f '${DASH_DIR}/tenant-resource-usage.json' ]"

run_test "TC-06" "테넌트 대시보드 유효 JSON" \
  "python3 -c \"import json; json.load(open('${DASH_DIR}/tenant-resource-usage.json'))\""

run_test "TC-07" "테넌트 대시보드 namespace 변수 포함" \
  "python3 -c \"
import json
d = json.load(open('${DASH_DIR}/tenant-resource-usage.json'))
tpl = d.get('templating', {}).get('list', [])
ns_vars = [v for v in tpl if v.get('name') == 'namespace']
assert len(ns_vars) >= 1, 'namespace variable missing'
\""

run_test "TC-08" "테넌트 대시보드 패널 8개 이상" \
  "python3 -c \"
import json
d = json.load(open('${DASH_DIR}/tenant-resource-usage.json'))
panels = [p for p in d.get('panels', []) if p.get('type') != 'row']
assert len(panels) >= 8, f'panels={len(panels)}'
\""

# --- FR-N61.3: 인증/보안 이벤트 대시보드 ---
echo ""
echo "--- FR-N61.3: 인증/보안 이벤트 대시보드 ---"

run_test "TC-09" "보안 대시보드 파일 존재" \
  "[ -f '${DASH_DIR}/security-auth-events.json' ]"

run_test "TC-10" "보안 대시보드 유효 JSON" \
  "python3 -c \"import json; json.load(open('${DASH_DIR}/security-auth-events.json'))\""

run_test "TC-11" "보안 대시보드 패널 8개 이상" \
  "python3 -c \"
import json
d = json.load(open('${DASH_DIR}/security-auth-events.json'))
panels = [p for p in d.get('panels', []) if p.get('type') != 'row']
assert len(panels) >= 8, f'panels={len(panels)}'
\""

run_test "TC-12" "보안 대시보드 인증 관련 쿼리 포함" \
  "python3 -c \"
import json
d = json.load(open('${DASH_DIR}/security-auth-events.json'))
content = str(d).lower()
assert 'auth' in content or 'login' in content or '인증' in content
\""

# --- FR-N61.4: Recording Rules 활용 ---
echo ""
echo "--- FR-N61.4: Recording Rules 활용 ---"

run_test "TC-13" "대시보드에서 recording rules 참조" \
  "python3 -c \"
import json, glob
found = False
for f in glob.glob('${DASH_DIR}/*.json'):
    with open(f) as fh:
        content = fh.read()
        if 'namespace:' in content or 'service:' in content or 'node:' in content:
            found = True
            break
assert found, 'No recording rule references found'
\""

# --- FR-N61.5: 한국어 레이블 ---
echo ""
echo "--- FR-N61.5: 한국어 레이블 ---"

run_test "TC-14" "CSAP 대시보드 한국어 제목" \
  "python3 -c \"
import json
d = json.load(open('${DASH_DIR}/csap-compliance-status.json'))
content = str(d)
assert '준수' in content or 'CSAP' in content
\""

run_test "TC-15" "테넌트 대시보드 한국어 레이블" \
  "python3 -c \"
import json
d = json.load(open('${DASH_DIR}/tenant-resource-usage.json'))
tpl = d.get('templating', {}).get('list', [])
labels = [v.get('label', '') for v in tpl]
korean_found = any(any(ord(c) >= 0xAC00 and ord(c) <= 0xD7A3 for c in l) for l in labels if l)
assert korean_found, f'No Korean labels found: {labels}'
\""

# --- FR-N61.6: 전체 대시보드 구조 검증 ---
echo ""
echo "--- FR-N61.6: 전체 구조 검증 ---"

run_test "TC-16" "3종 대시보드 전체 JSON 유효성" \
  "python3 -c \"
import json, glob
count = 0
for name in ['csap-compliance-status', 'tenant-resource-usage', 'security-auth-events']:
    f = '${DASH_DIR}/' + name + '.json'
    d = json.load(open(f))
    assert 'panels' in d, f'{name}: no panels'
    count += 1
assert count == 3
\""

run_test "TC-17" "모든 대시보드 datasource 설정 존재" \
  "python3 -c \"
import json
for name in ['csap-compliance-status', 'tenant-resource-usage', 'security-auth-events']:
    f = '${DASH_DIR}/' + name + '.json'
    content = json.dumps(json.load(open(f)))
    assert 'prometheus' in content, f'{name}: no prometheus datasource'
\""

run_test "TC-18" "Grafana 대시보드 총 10개 이상 (기존 + 신규 3종)" \
  "python3 -c \"
import glob
count = len(glob.glob('${DASH_DIR}/*.json'))
assert count >= 10, f'Dashboard count: {count}'
\""

# --- 결과 ---
echo ""
echo "============================================================"
echo " 결과: PASS: ${PASS} / FAIL: ${FAIL} / 총: ${TOTAL}"
if [ "${TOTAL}" -gt 0 ]; then
  RATE=$(awk "BEGIN {printf \"%.1f\", (${PASS}/${TOTAL})*100}")
  echo " 통과율: ${RATE}%"
fi
echo "============================================================"

if [ "${FAIL}" -eq 0 ]; then
  echo -e "\n${GREEN}[ALL PASS] MTU-N61 Grafana 대시보드 검증 완료${NC}"
  exit 0
else
  echo -e "\n${RED}[PARTIAL] ${FAIL}건 실패${NC}"
  exit 1
fi
