#!/usr/bin/env bash
# Cilium L7 Zero Trust E2E 테스트
set -euo pipefail
PROJECT_ROOT="/data/ai-saas"
ZT_DIR="$PROJECT_ROOT/infra/cilium-zero-trust"
PASS=0; FAIL=0; TOTAL=0
pass() { PASS=$((PASS+1)); TOTAL=$((TOTAL+1)); echo "[PASS] $1"; }
fail() { FAIL=$((FAIL+1)); TOTAL=$((TOTAL+1)); echo "[FAIL] $1"; }

echo "=========================================="
echo "  MTU-N152 Cilium L7 Zero Trust E2E"
echo "=========================================="

# TC-N152.1: Default Deny
echo ""
echo "--- TC-N152.1: L3/L4 기본 거부 정책 ---"
[ -f "$ZT_DIR/default-deny.yaml" ] && pass "1a: default-deny.yaml 존재" || fail "1a"
grep -q "CiliumNetworkPolicy" "$ZT_DIR/default-deny.yaml" && pass "1b: CiliumNetworkPolicy 리소스" || fail "1b"
grep -q "default-deny-ingress" "$ZT_DIR/default-deny.yaml" && pass "1c: 인그레스 기본 거부" || fail "1c"
grep -q "default-deny-egress" "$ZT_DIR/default-deny.yaml" && pass "1d: 이그레스 기본 거부" || fail "1d"
grep -q "tenant-isolation" "$ZT_DIR/default-deny.yaml" && pass "1e: 테넌트 격리 정책" || fail "1e"

# TC-N152.2: L7 HTTP 필터링
echo ""
echo "--- TC-N152.2: L7 HTTP 정책 ---"
[ -f "$ZT_DIR/l7-http-policy.yaml" ] && pass "2a: l7-http-policy.yaml 존재" || fail "2a"
grep -q "method: GET" "$ZT_DIR/l7-http-policy.yaml" && pass "2b: GET 메서드 필터링" || fail "2b"
grep -q "method: POST" "$ZT_DIR/l7-http-policy.yaml" && pass "2c: POST 메서드 필터링" || fail "2c"
grep -q 'path: "/api/v1' "$ZT_DIR/l7-http-policy.yaml" && pass "2d: API 경로 필터링" || fail "2d"
grep -q "api-gateway-l7-http" "$ZT_DIR/l7-http-policy.yaml" && pass "2e: API Gateway L7 정책" || fail "2e"
grep -q "audit-service" "$ZT_DIR/l7-http-policy.yaml" && pass "2f: Audit Service L7 정책" || fail "2f"

# TC-N152.3: L7 gRPC 필터링
echo ""
echo "--- TC-N152.3: L7 gRPC 정책 ---"
[ -f "$ZT_DIR/l7-grpc-policy.yaml" ] && pass "3a: l7-grpc-policy.yaml 존재" || fail "3a"
grep -q "UserService" "$ZT_DIR/l7-grpc-policy.yaml" && pass "3b: gRPC UserService 필터링" || fail "3b"
grep -q "TenantService" "$ZT_DIR/l7-grpc-policy.yaml" && pass "3c: gRPC TenantService 필터링" || fail "3c"

# TC-N152.4: Identity-aware 정책
echo ""
echo "--- TC-N152.4: Identity 기반 접근 ---"
[ -f "$ZT_DIR/identity-aware-policy.yaml" ] && pass "4a: identity 정책 파일 존재" || fail "4a"
grep -q "role: admin" "$ZT_DIR/identity-aware-policy.yaml" && pass "4b: 역할 기반 접근 제어" || fail "4b"
grep -q "ai-service-isolation" "$ZT_DIR/identity-aware-policy.yaml" && pass "4c: AI 서비스 격리 정책" || fail "4c"
grep -q "data-grade-checked" "$ZT_DIR/identity-aware-policy.yaml" && pass "4d: 데이터 등급 확인 레이블" || fail "4d"

# TC-N152.5: Hubble 관측성
echo ""
echo "--- TC-N152.5: Hubble 관측성 ---"
[ -f "$ZT_DIR/hubble-config.yaml" ] && pass "5a: Hubble 설정 파일 존재" || fail "5a"
grep -q "enable-hubble.*true" "$ZT_DIR/hubble-config.yaml" && pass "5b: Hubble 활성화" || fail "5b"
grep -q "hubble-metrics" "$ZT_DIR/hubble-config.yaml" && pass "5c: 메트릭 수집 설정" || fail "5c"
grep -q "ServiceMonitor" "$ZT_DIR/hubble-config.yaml" && pass "5d: Prometheus ServiceMonitor" || fail "5d"

# TC-N152.6: FQDN 이그레스 제어
echo ""
echo "--- TC-N152.6: FQDN 이그레스 ---"
[ -f "$ZT_DIR/fqdn-egress.yaml" ] && pass "6a: FQDN 정책 파일 존재" || fail "6a"
grep -q "toFQDNs" "$ZT_DIR/fqdn-egress.yaml" && pass "6b: FQDN 기반 이그레스" || fail "6b"
grep -q "host.docker.internal" "$ZT_DIR/fqdn-egress.yaml" && pass "6c: LM Studio FQDN 허용" || fail "6c"

# TC-N152.7: 알림 설정
echo ""
echo "--- TC-N152.7: 정책 위반 알림 ---"
[ -f "$ZT_DIR/alerts.yaml" ] && pass "7a: 알림 규칙 파일 존재" || fail "7a"
grep -q "CiliumPolicyDropSpike" "$ZT_DIR/alerts.yaml" && pass "7b: 정책 위반 급증 알림" || fail "7b"
grep -q "CiliumL7AuthFailure" "$ZT_DIR/alerts.yaml" && pass "7c: L7 인증 실패 알림" || fail "7c"
grep -q "CiliumDNSPolicyDrop" "$ZT_DIR/alerts.yaml" && pass "7d: DNS 정책 위반 알림" || fail "7d"
grep -q "UnauthorizedExternalAccess" "$ZT_DIR/alerts.yaml" && pass "7e: 비인가 외부 접근 알림" || fail "7e"

# CSAP/N2SF 보안 검증
echo ""
echo "--- CSAP/N2SF 보안 ---"
grep -q "D-10" "$ZT_DIR/kustomization.yaml" && pass "CSAP-D10: 네트워크 보안 레이블" || fail "CSAP-D10"
grep -q "N-01" "$ZT_DIR/default-deny.yaml" && pass "N2SF-N01: 네트워크 격리 레이블" || fail "N2SF-N01"
grep -q "N-02" "$ZT_DIR/identity-aware-policy.yaml" && pass "N2SF-N02: ID 접근 레이블" || fail "N2SF-N02"
grep -q "N-05" "$ZT_DIR/identity-aware-policy.yaml" && pass "N2SF-N05: 데이터 보호 레이블" || fail "N2SF-N05"
[ -f "$ZT_DIR/kustomization.yaml" ] && pass "Kustomization 존재" || fail "Kustomization 미존재"

echo ""
echo "=========================================="
echo "  결과: $PASS/$TOTAL 통과 (실패: $FAIL)"
echo "=========================================="
[ "$FAIL" -eq 0 ] && echo "[SUCCESS] 모든 테스트 통과" && exit 0 || { echo "[FAILURE] $FAIL 건 실패"; exit 1; }
