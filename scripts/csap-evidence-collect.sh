#!/usr/bin/env bash
# Design Ref: MTU-N84 §아키텍처
# Plan SC: FR-N84.1, FR-N84.3, FR-N84.4
# CSAP 증거 자동 수집 스크립트 (온디맨드 실행용)
set -euo pipefail

DATE=${1:-$(date +%Y-%m-%d)}
BASE_DIR="/data/ai-saas/evidence/${DATE}"

echo "============================================"
echo " CSAP 증거 자동 수집"
echo " 날짜: ${DATE}"
echo " 저장 경로: ${BASE_DIR}"
echo "============================================"
echo ""

mkdir -p "${BASE_DIR}"

collect_evidence() {
  local control="$1"
  local description="$2"
  local dir="${BASE_DIR}/${control}"
  mkdir -p "${dir}"
  echo "[${control}] ${description}..."
}

# D-08: 접근 통제
collect_evidence "D-08" "접근 통제 증거 수집"
# RBAC 설정
kubectl get clusterrolebindings -o yaml > "${BASE_DIR}/D-08/cluster-role-bindings.yaml" 2>/dev/null || echo "# kubectl not available - 시뮬레이션 모드" > "${BASE_DIR}/D-08/cluster-role-bindings.yaml"
kubectl get rolebindings -A -o yaml > "${BASE_DIR}/D-08/role-bindings.yaml" 2>/dev/null || echo "# kubectl not available" > "${BASE_DIR}/D-08/role-bindings.yaml"
kubectl get networkpolicies -A -o yaml > "${BASE_DIR}/D-08/network-policies.yaml" 2>/dev/null || echo "# kubectl not available" > "${BASE_DIR}/D-08/network-policies.yaml"

# D-09: 암호화
collect_evidence "D-09" "암호화 증거 수집"
kubectl get certificates -A -o yaml > "${BASE_DIR}/D-09/tls-certificates.yaml" 2>/dev/null || echo "# kubectl not available" > "${BASE_DIR}/D-09/tls-certificates.yaml"

# D-06: 감사 로그
collect_evidence "D-06" "감사 로그 증거 수집"
cp /data/ai-saas/.claude/audit.jsonl "${BASE_DIR}/D-06/audit-log.jsonl" 2>/dev/null || echo "[]" > "${BASE_DIR}/D-06/audit-log.jsonl"

# D-12: 개발 보안
collect_evidence "D-12" "개발 보안 증거 수집"
kubectl get clusterpolicies -o yaml > "${BASE_DIR}/D-12/kyverno-policies.yaml" 2>/dev/null || echo "# kubectl not available" > "${BASE_DIR}/D-12/kyverno-policies.yaml"

# D-10: 운영 보안
collect_evidence "D-10" "운영 보안 증거 수집"
kubectl get prometheusrules -A -o yaml > "${BASE_DIR}/D-10/alerting-rules.yaml" 2>/dev/null || echo "# kubectl not available" > "${BASE_DIR}/D-10/alerting-rules.yaml"

# D-13: 재해 복구
collect_evidence "D-13" "재해 복구 증거 수집"
kubectl get schedules -A -o yaml > "${BASE_DIR}/D-13/backup-schedules.yaml" 2>/dev/null || echo "# kubectl not available" > "${BASE_DIR}/D-13/backup-schedules.yaml"

# 무결성 해시 생성 (FR-N84.3)
echo ""
echo "무결성 해시 생성 (SHA-256)..."
find "${BASE_DIR}" -type f \( -name "*.yaml" -o -name "*.jsonl" -o -name "*.txt" \) | sort | while read f; do
  sha256sum "$f" >> "${BASE_DIR}/integrity.sha256"
done

# 매니페스트 생성
CONTROLS=$(ls -d ${BASE_DIR}/D-* 2>/dev/null | sed 's/.*\///' | tr '\n' ',' | sed 's/,$//')
echo "{\"date\":\"${DATE}\",\"collected_at\":\"$(date -Iseconds)\",\"controls\":[\"${CONTROLS}\"],\"file_count\":$(find ${BASE_DIR} -type f | wc -l),\"status\":\"complete\"}" > "${BASE_DIR}/manifest.json"

echo ""
echo "============================================"
echo " CSAP 증거 수집 완료"
echo " 파일 수: $(find ${BASE_DIR} -type f | wc -l)"
echo " 해시 파일: ${BASE_DIR}/integrity.sha256"
echo "============================================"
