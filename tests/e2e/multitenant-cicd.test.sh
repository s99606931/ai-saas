#!/bin/bash
# 멀티테넌트 CI/CD 격리 E2E 테스트
# Plan SC: FR-N108.6

set -uo pipefail
PASS=0; FAIL=0; TOTAL=0
pass() { PASS=$((PASS+1)); TOTAL=$((TOTAL+1)); echo "[PASS] $1"; }
fail() { FAIL=$((FAIL+1)); TOTAL=$((TOTAL+1)); echo "[FAIL] $1: $2"; }

echo "============================================"
echo " MTU-N108: 멀티테넌트 CI/CD 격리 E2E 테스트"
echo "============================================"
echo ""

BASE="/data/ai-saas/infra/multi-tenant-cicd"

# FR-N108.1: 네임스페이스 템플릿
echo "--- FR-N108.1: 네임스페이스 템플릿 ---"
F="$BASE/tenant-namespace-template.yaml"
[ -f "$F" ] && pass "템플릿 파일 존재" || fail "파일 누락" "$F"
grep -q "Namespace" "$F" && pass "Namespace 리소스 정의" || fail "Namespace 미정의" ""
grep -q "saas.go.kr/tenant-id" "$F" && pass "테넌트 ID 라벨" || fail "라벨 누락" ""
grep -q "ServiceAccount" "$F" && pass "ServiceAccount 포함" || fail "SA 미포함" ""
grep -q "Role" "$F" && pass "Role 정의 포함" || fail "Role 누락" ""
grep -q "RoleBinding" "$F" && pass "RoleBinding 정의 포함" || fail "RoleBinding 누락" ""
grep -q "pod-security.kubernetes.io/enforce: restricted" "$F" && pass "PSS Restricted 적용" || fail "PSS 미적용" ""

# FR-N108.2: Kyverno RBAC 주입
echo ""
echo "--- FR-N108.2: Kyverno RBAC 주입 ---"
F="$BASE/kyverno-tenant-rbac.yaml"
[ -f "$F" ] && pass "Kyverno 정책 파일 존재" || fail "파일 누락" "$F"
grep -q "ClusterPolicy" "$F" && pass "ClusterPolicy 리소스 타입" || fail "타입 오류" ""
grep -q "runAsNonRoot" "$F" && pass "비루트 실행 강제" || fail "보안 컨텍스트 누락" ""
grep -q "allowPrivilegeEscalation: false" "$F" && pass "권한 상승 차단" || fail "권한 상승 미차단" ""
grep -q "harbor.local" "$F" && pass "이미지 레지스트리 제한" || fail "레지스트리 미제한" ""
grep -q "hostPath" "$F" && pass "hostPath 마운트 금지 정책" || fail "hostPath 미차단" ""
grep -q "D-06" "$F" && pass "CSAP D-06 감사 정책 참조" || fail "D-06 미참조" ""

# FR-N108.3: ResourceQuota
echo ""
echo "--- FR-N108.3: ResourceQuota ---"
F="$BASE/tenant-quota-template.yaml"
[ -f "$F" ] && pass "쿼터 템플릿 파일 존재" || fail "파일 누락" "$F"
grep -q "ResourceQuota" "$F" && pass "ResourceQuota 리소스 정의" || fail "쿼터 미정의" ""
grep -q "LimitRange" "$F" && pass "LimitRange 기본값 정의" || fail "LimitRange 누락" ""
grep -q "requests.cpu" "$F" && pass "CPU 쿼터 설정" || fail "CPU 쿼터 누락" ""
grep -q "requests.memory" "$F" && pass "Memory 쿼터 설정" || fail "Memory 쿼터 누락" ""
grep -q "pods:" "$F" && pass "Pod 수 제한 설정" || fail "Pod 제한 누락" ""

# FR-N108.4: NetworkPolicy
echo ""
echo "--- FR-N108.4: NetworkPolicy 격리 ---"
F="$BASE/tenant-network-policy.yaml"
[ -f "$F" ] && pass "NetworkPolicy 파일 존재" || fail "파일 누락" "$F"
grep -q "default-deny" "$F" && pass "default-deny 정책 존재" || fail "기본 거부 미설정" ""
grep -q "allow-same-namespace" "$F" && pass "동일 네임스페이스 허용" || fail "내부 통신 미허용" ""
grep -q "allow-dns" "$F" && pass "DNS 허용 정책" || fail "DNS 미허용" ""
grep -q "allow-harbor" "$F" && pass "Harbor 접근 허용" || fail "Harbor 미허용" ""
grep -q "allow-gitea" "$F" && pass "Gitea 접근 허용" || fail "Gitea 미허용" ""
grep -q "allow-monitoring" "$F" && pass "모니터링 접근 허용" || fail "모니터링 미허용" ""

NP_COUNT=$(grep -c "kind: NetworkPolicy" "$F" || true)
[ "$NP_COUNT" -ge 5 ] && pass "NetworkPolicy 5개 이상 ($NP_COUNT개)" || fail "정책 부족" "$NP_COUNT"

# FR-N108.5: 온보딩 스크립트
echo ""
echo "--- FR-N108.5: 온보딩 스크립트 ---"
F="/data/ai-saas/scripts/tenant-cicd-onboarding.sh"
[ -f "$F" ] && pass "온보딩 스크립트 존재" || fail "스크립트 누락" "$F"
[ -x "$F" ] && pass "실행 권한 확인" || fail "실행 권한 없음" ""
grep -q "tenant-id" "$F" && pass "테넌트 ID 파라미터" || fail "파라미터 미정의" ""
grep -q "tier" "$F" && pass "티어 파라미터" || fail "티어 미정의" ""
grep -q "audit" "$F" && pass "감사 로그 기록 포함" || fail "감사 로그 누락" ""

# CSAP 준수
echo ""
echo "--- CSAP/N2SF 준수 ---"
if ! grep -rE "(password|secret|token)\s*[:=]\s*['\"][a-zA-Z0-9]{8}" $BASE/ /data/ai-saas/scripts/tenant-cicd-onboarding.sh 2>/dev/null | grep -v "secrets\"" | grep -v "kind:" | grep -q .; then
  pass "시크릿 하드코딩 없음"
else
  fail "시크릿 하드코딩 발견" ""
fi

# 결과
echo ""
echo "============================================"
echo " 테스트 결과: ${PASS}/${TOTAL} 통과 (실패: ${FAIL})"
echo "============================================"
[ $FAIL -gt 0 ] && exit 1
MATCH_RATE=$(echo "scale=1; $PASS * 100 / $TOTAL" | bc)
echo "matchRate: ${MATCH_RATE}%"
echo "[PASS] MTU-N108 E2E 테스트 모두 통과"
