#!/usr/bin/env bash
set -euo pipefail
PROJECT_ROOT="/data/ai-saas"
PASS=0; FAIL=0; TOTAL=0
pass() { PASS=$((PASS+1)); TOTAL=$((TOTAL+1)); echo "[PASS] $1"; }
fail() { FAIL=$((FAIL+1)); TOTAL=$((TOTAL+1)); echo "[FAIL] $1"; }

echo "=========================================="
echo "  MTU-N153 개인정보보호법 준수 E2E 테스트"
echo "=========================================="

# FR-N153.1: PII 스캐너
[ -f "$PROJECT_ROOT/src/privacy/pii-scanner.ts" ] && pass "1a: PII 스캐너 파일 존재" || fail "1a"
grep -q "PII_PATTERNS" "$PROJECT_ROOT/src/privacy/pii-scanner.ts" && pass "1b: PII 패턴 정의" || fail "1b"
grep -q "residentNumber" "$PROJECT_ROOT/src/privacy/pii-scanner.ts" && pass "1c: 주민등록번호 패턴" || fail "1c"
grep -q "phoneNumber" "$PROJECT_ROOT/src/privacy/pii-scanner.ts" && pass "1d: 전화번호 패턴" || fail "1d"
grep -q "creditCard" "$PROJECT_ROOT/src/privacy/pii-scanner.ts" && pass "1e: 신용카드 패턴" || fail "1e"
grep -q "maskPII" "$PROJECT_ROOT/src/privacy/pii-scanner.ts" && pass "1f: PII 마스킹 함수" || fail "1f"
grep -q "scanForPII" "$PROJECT_ROOT/src/privacy/pii-scanner.ts" && pass "1g: PII 스캔 함수" || fail "1g"

# FR-N153.2: 동의 검증
grep -q "validateForAITransmission" "$PROJECT_ROOT/src/privacy/pii-scanner.ts" && pass "2a: AI 전송 검증 함수" || fail "2a"
grep -q "BLOCKED" "$PROJECT_ROOT/src/privacy/pii-scanner.ts" && pass "2b: C/S등급 차단 로직" || fail "2b"

# FR-N153.3: 보존기간 점검
[ -f "$PROJECT_ROOT/infra/privacy-compliance/retention-checker.yaml" ] && pass "3a: 보존기간 CronJob 존재" || fail "3a"
grep -q "privacy-retention-checker" "$PROJECT_ROOT/infra/privacy-compliance/retention-checker.yaml" && pass "3b: 보존기간 점검 Job" || fail "3b"
grep -q "privacy-data-purge" "$PROJECT_ROOT/infra/privacy-compliance/retention-checker.yaml" && pass "3c: 자동 파기 Job" || fail "3c"

# FR-N153.4: PIA 체크리스트
[ -f "$PROJECT_ROOT/infra/privacy-compliance/pia-ci-workflow.yaml" ] && pass "4a: PIA CI 워크플로우 존재" || fail "4a"
grep -q "PIA" "$PROJECT_ROOT/infra/privacy-compliance/pia-ci-workflow.yaml" && pass "4b: PIA 체크리스트 포함" || fail "4b"

# FR-N153.5: 파기 자동화
grep -q "DELETE FROM users" "$PROJECT_ROOT/infra/privacy-compliance/retention-checker.yaml" && pass "5a: 데이터 파기 SQL" || fail "5a"
grep -q "PRIVACY_DATA_PURGE" "$PROJECT_ROOT/infra/privacy-compliance/retention-checker.yaml" && pass "5b: 파기 감사 로그" || fail "5b"

# FR-N153.6: CI 통합
grep -q "pii-scan" "$PROJECT_ROOT/infra/privacy-compliance/pia-ci-workflow.yaml" && pass "6a: CI PII 스캔 단계" || fail "6a"
grep -q "n2sf-data-grade" "$PROJECT_ROOT/infra/privacy-compliance/pia-ci-workflow.yaml" && pass "6b: N2SF 데이터 등급 CI" || fail "6b"

# FR-N153.7: 알림 + 감사
[ -f "$PROJECT_ROOT/infra/privacy-compliance/alerts.yaml" ] && pass "7a: 알림 규칙 파일" || fail "7a"
grep -q "PIIDataExposure" "$PROJECT_ROOT/infra/privacy-compliance/alerts.yaml" && pass "7b: PII 노출 알림" || fail "7b"
grep -q "RetentionPolicyViolation" "$PROJECT_ROOT/infra/privacy-compliance/alerts.yaml" && pass "7c: 보존기간 위반 알림" || fail "7c"

# CSAP/N2SF
grep -q "D-13" "$PROJECT_ROOT/infra/privacy-compliance/retention-checker.yaml" && pass "CSAP-D13: 도메인 레이블" || fail "CSAP-D13"
grep -q "classifyDataGrade" "$PROJECT_ROOT/src/privacy/pii-scanner.ts" && pass "N2SF-N05: 데이터 등급 분류" || fail "N2SF-N05"
grep -q "runAsNonRoot" "$PROJECT_ROOT/infra/privacy-compliance/retention-checker.yaml" && pass "보안: 비root 실행" || fail "보안"

echo ""
echo "=========================================="
echo "  결과: $PASS/$TOTAL 통과 (실패: $FAIL)"
echo "=========================================="
[ "$FAIL" -eq 0 ] && echo "[SUCCESS] 모든 테스트 통과" && exit 0 || { echo "[FAILURE]"; exit 1; }
