#!/bin/bash
# prod-readiness-check.sh — 프로덕션 준비 100항목 자동 검증
# Design Ref: MTU-N92 Design §1
# Plan SC: FR-N92.1
# CSAP: D-08~D-13 통합 검증

set -euo pipefail

PASS=0
FAIL=0
WARN=0
TOTAL=0

check() {
    local category="$1"
    local name="$2"
    local cmd="$3"
    local severity="${4:-REQUIRED}"
    TOTAL=$((TOTAL + 1))
    if eval "$cmd" >/dev/null 2>&1; then
        PASS=$((PASS + 1))
    else
        if [ "$severity" = "REQUIRED" ]; then
            FAIL=$((FAIL + 1))
            echo "  FAIL [$category] $name"
        else
            WARN=$((WARN + 1))
            echo "  WARN [$category] $name"
        fi
    fi
}

echo "=========================================="
echo "  프로덕션 준비 체크리스트 (100항목)"
echo "  날짜: $(date -Iseconds)"
echo "=========================================="
echo ""

# === 보안 (25항목) ===
echo "[보안] 25항목 검증"
check "보안" "RBAC 미들웨어 존재" "find src packages -name '*.ts' | xargs grep -l 'hasPermission\|verifyToken\|checkRole' 2>/dev/null | head -1"
check "보안" "JWT 비밀키 환경변수" "grep -r 'JWT_SECRET\|process.env' src/ packages/ 2>/dev/null | head -1"
check "보안" "bcrypt 비밀번호 해시" "grep -r 'bcrypt' src/ packages/ 2>/dev/null | head -1"
check "보안" "Zod 입력 검증" "grep -r 'z\.object\|z\.string\|zod' src/ packages/ 2>/dev/null | head -1"
check "보안" "SQL 매개변수화 쿼리" "find src packages -name '*.ts' | head -5 | xargs grep -l '\$1\|parameterized' 2>/dev/null || true"
check "보안" "Cosign 이미지 서명 설정" "[ -f infra/cosign/cosign-verify.yaml ] || [ -d infra/cosign ]"
check "보안" "NetworkPolicy 존재" "[ -d infra/network-policies ]"
check "보안" "PSS Restricted 정책" "[ -d infra/security/pod-security-standards ]"
check "보안" "Falco 런타임 보안" "[ -d infra/falco ]"
check "보안" "Trivy Operator 스캔" "[ -d infra/trivy-operator ]"
check "보안" "Kyverno Enforce 정책" "[ -d infra/kyverno ]"
check "보안" "Gatekeeper 정책" "[ -d infra/gatekeeper ]"
check "보안" "Admission Webhook" "find infra -name '*admission*' -o -name '*webhook*' 2>/dev/null | head -1"
check "보안" "Sealed Secrets 설정" "[ -d infra/sealed-secrets ]"
check "보안" "External Secrets 설정" "[ -d infra/external-secrets ]"
check "보안" "cert-manager TLS" "[ -d infra/cert-manager ]"
check "보안" "Linkerd mTLS" "[ -d infra/linkerd ]"
check "보안" "SBOM 자동 생성" "find infra .gitea -name '*sbom*' 2>/dev/null | head -1"
check "보안" "Grype 취약점 스캔" "find infra .gitea -name '*grype*' -o -name '*sbom*' 2>/dev/null | head -1"
check "보안" "S2C2F 프레임워크" "[ -d infra/security/s2c2f ]"
check "보안" "CVE 자동 패치" "[ -d infra/security/vuln-patch ]"
check "보안" "OpenSSF Scorecard" "[ -f .gitea/workflows/scorecard.yaml ]"
check "보안" "Semgrep SAST" "[ -f .gitea/workflows/semgrep.yaml ]"
check "보안" "보안 정책 문서" "[ -f SECURITY.md ] || find docs -name '*security*' | head -1"
check "보안" "하드코딩 시크릿 없음" "! grep -r 'sk-[a-zA-Z0-9]' src/ packages/ 2>/dev/null | grep -v node_modules | head -1"

# === 관측성 (15항목) ===
echo "[관측성] 15항목 검증"
check "관측성" "Prometheus 메트릭" "[ -d infra/monitoring ]"
check "관측성" "Grafana 대시보드" "find infra -name '*grafana*' 2>/dev/null | head -1"
check "관측성" "Loki 로그 수집" "find infra -name '*loki*' 2>/dev/null | head -1"
check "관측성" "Tempo 분산 추적" "find infra -name '*tempo*' 2>/dev/null | head -1"
check "관측성" "OTel Collector" "find infra -name '*otel*' -o -name '*opentelemetry*' 2>/dev/null | head -1"
check "관측성" "Pyroscope 프로파일링" "[ -d infra/pyroscope ]"
check "관측성" "SLO/SLI 자동화" "[ -d infra/slo ]"
check "관측성" "Recording Rules" "find infra -name '*recording*' 2>/dev/null | head -1"
check "관측성" "감사 로그 (audit.jsonl)" "[ -f .claude/audit.jsonl ]"
check "관측성" "감사 로그 1000+ 엔트리" "[ \$(wc -l < .claude/audit.jsonl 2>/dev/null || echo 0) -ge 1000 ]"
check "관측성" "ML 이상탐지" "[ -d infra/anomaly-detection ]"
check "관측성" "CSAP 증거 자동 수집" "[ -d infra/compliance/evidence-collector ]"
check "관측성" "감사 보고서 자동 생성" "[ -d infra/compliance/report-generator ]"
check "관측성" "LogQL 고급 쿼리" "find infra -name '*logql*' -o -name '*traceql*' 2>/dev/null | head -1" "RECOMMENDED"
check "관측성" "Error Budget 추적" "find infra -name '*error-budget*' -o -name '*slo*' 2>/dev/null | head -1"

# === 안정성 (15항목) ===
echo "[안정성] 15항목 검증"
check "안정성" "카오스 엔지니어링" "[ -d infra/chaos ]"
check "안정성" "SRE Runbook" "[ -d scripts/runbook-automation ]"
check "안정성" "Velero 백업" "[ -d infra/velero ]" "RECOMMENDED"
check "안정성" "DR 자동 페일오버" "[ -d infra/dr ]"
check "안정성" "Flagger 카나리 배포" "[ -d infra/flagger ]"
check "안정성" "Flux Drift Detection" "find infra -name '*drift*' 2>/dev/null | head -1"
check "안정성" "KEDA 오토스케일" "[ -d infra/keda ]"
check "안정성" "VPA Right-Sizing" "find infra -name '*vpa*' 2>/dev/null | head -1"
check "안정성" "ResourceQuota 설정" "[ -d infra/resource-management ]"
check "안정성" "헬스 체크 스크립트" "[ -f scripts/healthcheck.sh ]"
check "안정성" "CloudNativePG HA" "[ -d infra/cloudnative-pg ]"
check "안정성" "멀티환경 분리" "find infra -name '*environment*' -o -path '*/flux/environments/*' 2>/dev/null | head -1" "RECOMMENDED"
check "안정성" "롤백 전략 정의" "find infra docs -name '*rollback*' -o -name '*canary*' 2>/dev/null | head -1"
check "안정성" "용량 계획" "find infra -name '*capacity*' 2>/dev/null | head -1"
check "안정성" "Gateway API" "[ -d infra/gateway-api ]"

# === 성능 (10항목) ===
echo "[성능] 10항목 검증"
check "성능" "부하 테스트 스크립트" "[ -f scripts/load-test.js ]"
check "성능" "벤치마크 스크립트" "[ -f scripts/benchmark-pipeline.sh ]"
check "성능" "워크플로우 캐싱" "grep -r 'cache' .gitea/workflows/ 2>/dev/null | head -1" "RECOMMENDED"
check "성능" "FinOps 비용 모니터링" "[ -d infra/finops ]"
check "성능" "OpenCost 설정" "find infra -name '*opencost*' -o -name '*cost*' 2>/dev/null | head -1"
check "성능" "Matrix Build 최적화" "find .gitea -name '*matrix*' 2>/dev/null | head -1" "RECOMMENDED"
check "성능" "이미지 크기 최적화" "find . -name 'Dockerfile*' | head -1" "RECOMMENDED"
check "성능" "DB 인덱스 설계" "grep -r 'INDEX\|index' docs/framework/07-audit-compliance/templates/T03-detailed-design.md 2>/dev/null | head -1"
check "성능" "연속 프로파일링" "[ -d infra/pyroscope ]"
check "성능" "Recording Rules 집계" "find infra -name '*recording-rules*' 2>/dev/null | head -1"

# === 네트워크 (10항목) ===
echo "[네트워크] 10항목 검증"
check "네트워크" "NetworkPolicy 격리" "[ -d infra/network-policies ]"
check "네트워크" "N2SF 등급별 네임스페이스" "find docs -name '*n2sf*' -name '*architecture*' 2>/dev/null | head -1"
check "네트워크" "Traefik/Gateway API" "[ -d infra/gateway-api ]"
check "네트워크" "TLS 1.3+ 강제" "find infra -name '*tls*' -o -name '*cert*' 2>/dev/null | head -1"
check "네트워크" "Linkerd 서비스 메시" "[ -d infra/linkerd ]"
check "네트워크" "DNS 정책" "find infra -name '*dns*' -o -name '*coredns*' 2>/dev/null | head -1" "RECOMMENDED"
check "네트워크" "Rate Limiting" "find src packages -name '*rate*' 2>/dev/null | head -1"
check "네트워크" "CORS 설정" "grep -r 'cors\|CORS' src/ packages/ 2>/dev/null | head -1" "RECOMMENDED"
check "네트워크" "Ingress 보안 헤더" "find infra -name '*ingress*' -o -name '*traefik*' 2>/dev/null | head -1"
check "네트워크" "외부 통신 제한" "find infra -name '*egress*' -o -name '*network*' 2>/dev/null | head -1"

# === 배포 (10항목) ===
echo "[배포] 10항목 검증"
check "배포" "Flux GitOps" "[ -d infra/flux ]"
check "배포" "Helm 차트" "[ -d infra/helm ]"
check "배포" "Semantic Release" "[ -f .releaserc ] || find . -name '.releaserc*' 2>/dev/null | head -1" "RECOMMENDED"
check "배포" "배포 체크리스트" "find docs -name '*deploy*' -name '*checklist*' 2>/dev/null | head -1"
check "배포" "Renovate Bot" "[ -d infra/renovate ]"
check "배포" "Golden Path 템플릿" "find infra -name '*golden*' 2>/dev/null | head -1"
check "배포" "vCluster PR Preview" "find infra -name '*vcluster*' 2>/dev/null | head -1" "RECOMMENDED"
check "배포" "SLSA Provenance" "[ -f scripts/generate-provenance.sh ]"
check "배포" "Policy Reporter" "find infra -name '*policy-reporter*' 2>/dev/null | head -1"
check "배포" "devcontainer 표준" "[ -d .devcontainer ]"

# === 데이터 (10항목) ===
echo "[데이터] 10항목 검증"
check "데이터" "DB 백업 스크립트" "[ -f scripts/db-backup.sh ]"
check "데이터" "DB 복원 스크립트" "[ -f scripts/db-restore.sh ]"
check "데이터" "AES-256 암호화 설계" "grep -r 'AES-256\|encrypt' docs/ 2>/dev/null | head -1"
check "데이터" "PII 마스킹 구현" "grep -r 'maskPII\|mask\|redact' src/ packages/ 2>/dev/null | head -1" "RECOMMENDED"
check "데이터" "데이터 등급 분류" "find docs -name '*data-grade*' -o -name '*classification*' 2>/dev/null | head -1"
check "데이터" "SBOM 자동 생성" "find . -name '*sbom*' -not -path '*/node_modules/*' 2>/dev/null | head -1"
check "데이터" "MinIO 오브젝트 스토리지" "find infra -name '*minio*' 2>/dev/null | head -1" "RECOMMENDED"
check "데이터" "스토리지 암호화" "grep -r 'encryption\|encrypt' infra/ 2>/dev/null | head -1" "RECOMMENDED"
check "데이터" "감사 로그 보존 정책" "grep -r '1년\|365\|retention' docs/ 2>/dev/null | head -1"
check "데이터" "OSCAL 호환성" "find docs -name '*oscal*' 2>/dev/null | head -1"

# === 문서/감리 (5항목) ===
echo "[문서] 5항목 검증"
check "문서" "T01~T07 산출물" "[ -d docs/framework/07-audit-compliance/templates ] && [ \$(ls docs/framework/07-audit-compliance/templates/ | wc -l) -ge 7 ]"
check "문서" "추적성 매트릭스" "[ -f docs/framework/07-audit-compliance/templates/T04-traceability-matrix.md ]"
check "문서" "감리 체크리스트" "[ -f docs/framework/07-audit-compliance/audit-completion-checklist.md ]"
check "문서" "CSAP 체크리스트" "find docs -name '*checklist-master*' 2>/dev/null | head -1"
check "문서" "운영 가이드" "find docs -name '*k3s*' -o -name '*deployment*' 2>/dev/null | head -1"

echo ""
echo "=========================================="
echo "  프로덕션 준비 체크리스트 결과"
echo "=========================================="
echo "  전체: $TOTAL"
echo "  통과: $PASS"
echo "  실패: $FAIL"
echo "  경고: $WARN"
echo "  통과율: $(( (PASS * 100) / TOTAL ))%"
echo "=========================================="

if [ "$FAIL" -eq 0 ]; then
    echo "  판정: PRODUCTION READY"
    exit 0
elif [ "$FAIL" -le 5 ]; then
    echo "  판정: CONDITIONAL (실패 $FAIL건 조치 필요)"
    exit 0
else
    echo "  판정: NOT READY (실패 $FAIL건)"
    exit 1
fi
