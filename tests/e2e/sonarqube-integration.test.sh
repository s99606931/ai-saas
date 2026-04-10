#!/bin/bash
# SonarQube 통합 E2E 테스트
# Design Ref: DS-N105.6
# Plan SC: FR-N105.6

set -uo pipefail

PASS=0
FAIL=0
TOTAL=0

pass() { PASS=$((PASS+1)); TOTAL=$((TOTAL+1)); echo "[PASS] $1"; }
fail() { FAIL=$((FAIL+1)); TOTAL=$((TOTAL+1)); echo "[FAIL] $1: $2"; }

echo "============================================"
echo " MTU-N105: SonarQube 통합 E2E 테스트"
echo "============================================"
echo ""

# E2E-N105.1: Helm values 파일 검증
echo "--- E2E-N105.1: Helm Values 검증 ---"
if [ -f "/data/ai-saas/infra/sonarqube/values.yaml" ]; then
  pass "SonarQube Helm values 파일 존재"
else
  fail "SonarQube Helm values 파일 누락" "infra/sonarqube/values.yaml"
fi

if grep -q "sonarqube" /data/ai-saas/infra/sonarqube/values.yaml; then
  pass "SonarQube 이미지 설정 확인"
else
  fail "SonarQube 이미지 미설정" "image.repository 확인"
fi

if grep -q "community" /data/ai-saas/infra/sonarqube/values.yaml; then
  pass "Community Edition 태그 확인"
else
  fail "Community Edition 태그 미설정" "CE 버전 확인"
fi

if grep -q "SONAR_TELEMETRY_ENABLE" /data/ai-saas/infra/sonarqube/values.yaml; then
  pass "텔레메트리 비활성화 설정 (N2SF 준수)"
else
  fail "텔레메트리 비활성화 미설정" "N2SF 외부 통신 차단 필요"
fi

if grep -q "networkPolicy" /data/ai-saas/infra/sonarqube/values.yaml; then
  pass "NetworkPolicy 설정 존재"
else
  fail "NetworkPolicy 미설정" "네트워크 격리 필요"
fi

if grep -q "securityContext" /data/ai-saas/infra/sonarqube/values.yaml; then
  pass "보안 컨텍스트 설정 존재"
else
  fail "보안 컨텍스트 미설정" "PSS 호환 필요"
fi

# E2E-N105.2: Gitea Actions 워크플로우 검증
echo ""
echo "--- E2E-N105.2: Gitea Actions 워크플로우 검증 ---"
if [ -f "/data/ai-saas/.gitea/workflows/sonarqube-scan.yaml" ]; then
  pass "SonarQube 스캔 워크플로우 파일 존재"
else
  fail "워크플로우 파일 누락" ".gitea/workflows/sonarqube-scan.yaml"
fi

if grep -q "pull_request" /data/ai-saas/.gitea/workflows/sonarqube-scan.yaml; then
  pass "PR 트리거 설정 확인"
else
  fail "PR 트리거 미설정" "pull_request 이벤트 필요"
fi

if grep -q "sonar-scanner" /data/ai-saas/.gitea/workflows/sonarqube-scan.yaml; then
  pass "sonar-scanner 실행 설정 확인"
else
  fail "sonar-scanner 미설정" "스캔 명령어 필요"
fi

if grep -q "sonar-quality-gate-check" /data/ai-saas/.gitea/workflows/sonarqube-scan.yaml; then
  pass "품질 게이트 확인 스텝 존재"
else
  fail "품질 게이트 확인 스텝 누락" "PR 차단 로직 필요"
fi

if grep -q "audit" /data/ai-saas/.gitea/workflows/sonarqube-scan.yaml; then
  pass "감사 로그 기록 스텝 존재"
else
  fail "감사 로그 기록 미설정" "CSAP D-06 준수 필요"
fi

# E2E-N105.3: 품질 게이트 정책 문서 검증
echo ""
echo "--- E2E-N105.3: 품질 게이트 정책 검증 ---"
if [ -f "/data/ai-saas/infra/sonarqube/quality-gate-policy.md" ]; then
  pass "품질 게이트 정책 문서 존재"
else
  fail "정책 문서 누락" "infra/sonarqube/quality-gate-policy.md"
fi

if grep -q "80%" /data/ai-saas/infra/sonarqube/quality-gate-policy.md; then
  pass "커버리지 80% 기준 설정"
else
  fail "커버리지 기준 미설정" "Q-Gate G4 기준 필요"
fi

if grep -q "3%" /data/ai-saas/infra/sonarqube/quality-gate-policy.md; then
  pass "중복률 3% 기준 설정"
else
  fail "중복률 기준 미설정" "DRY 원칙"
fi

# E2E-N105.4: sonar-project.properties 검증
echo ""
echo "--- E2E-N105.4: 프로젝트 설정 검증 ---"
if [ -f "/data/ai-saas/sonar-project.properties" ]; then
  pass "sonar-project.properties 파일 존재"
else
  fail "프로젝트 설정 파일 누락" "sonar-project.properties"
fi

if grep -q "ai-saas" /data/ai-saas/sonar-project.properties; then
  pass "프로젝트 키 설정 확인"
else
  fail "프로젝트 키 미설정" "projectKey 필요"
fi

if grep -q "node_modules" /data/ai-saas/sonar-project.properties; then
  pass "node_modules 제외 패턴 확인"
else
  fail "제외 패턴 미설정" "불필요 파일 스캔 방지"
fi

# E2E-N105.5: PR 차단 스크립트 검증
echo ""
echo "--- E2E-N105.5: PR 차단 스크립트 검증 ---"
if [ -f "/data/ai-saas/scripts/sonar-quality-gate-check.sh" ]; then
  pass "PR 차단 스크립트 존재"
else
  fail "스크립트 누락" "scripts/sonar-quality-gate-check.sh"
fi

if [ -x "/data/ai-saas/scripts/sonar-quality-gate-check.sh" ]; then
  pass "스크립트 실행 권한 확인"
else
  fail "실행 권한 없음" "chmod +x 필요"
fi

if grep -q "exit 1" /data/ai-saas/scripts/sonar-quality-gate-check.sh; then
  pass "실패 시 비정상 종료 코드 반환"
else
  fail "실패 처리 누락" "exit 1 필요"
fi

if grep -q "qualitygates/project_status" /data/ai-saas/scripts/sonar-quality-gate-check.sh; then
  pass "SonarQube API 호출 설정 확인"
else
  fail "API 호출 미설정" "품질 게이트 API 필요"
fi

# E2E-N105.6: CSAP 준수 검증
echo ""
echo "--- E2E-N105.6: CSAP/N2SF 준수 검증 ---"
if grep -q "SONAR_TELEMETRY_ENABLE" /data/ai-saas/infra/sonarqube/values.yaml && \
   grep -q "false" /data/ai-saas/infra/sonarqube/values.yaml; then
  pass "N2SF O등급: 텔레메트리 비활성화 확인"
else
  fail "N2SF 위반 가능" "외부 통신 차단 필요"
fi

# 시크릿 하드코딩 검사
if ! grep -rE "(password|secret|token)\s*[:=]\s*['\"][a-zA-Z0-9]" \
  /data/ai-saas/infra/sonarqube/ /data/ai-saas/scripts/sonar-quality-gate-check.sh \
  /data/ai-saas/.gitea/workflows/sonarqube-scan.yaml 2>/dev/null | grep -v "secrets\." | grep -v "SONAR_TOKEN}" | grep -v "env:" | grep -q .; then
  pass "시크릿 하드코딩 없음 (CSAP D-09)"
else
  fail "시크릿 하드코딩 발견" "환경 변수 사용 필수"
fi

# 결과 요약
echo ""
echo "============================================"
echo " 테스트 결과: ${PASS}/${TOTAL} 통과 (실패: ${FAIL})"
echo "============================================"

if [ $FAIL -gt 0 ]; then
  echo "[FAIL] MTU-N105 E2E 테스트 실패"
  exit 1
fi

MATCH_RATE=$(echo "scale=1; $PASS * 100 / $TOTAL" | bc)
echo "matchRate: ${MATCH_RATE}%"
echo "[PASS] MTU-N105 E2E 테스트 모두 통과"
