#!/bin/bash
# audit-readiness-report.sh — 감리 대비 보고서 자동 생성
# Design Ref: MTU-N95 Design
# Plan SC: FR-N95.3

set -euo pipefail

OUTPUT="${1:-docs/release/audit-readiness-$(date +%Y%m%d).md}"

echo "감리 대비 보고서 생성 중..."

mkdir -p "$(dirname "$OUTPUT")"

cat > "$OUTPUT" << 'HEREDOC'
# 감리 대비 보고서

> **프로젝트**: 공공기관 SaaS 프레임워크
> **생성일**: GENERATED_DATE
> **자동 생성**: audit-readiness-report.sh

---

## 1. 감리 준수 현황 총괄

HEREDOC

# 날짜 치환
sed -i "s/GENERATED_DATE/$(date +%Y-%m-%d)/" "$OUTPUT"

# Q-Gate 결과 추가
echo "### Q-Gate G1~G7 통과 현황" >> "$OUTPUT"
echo "" >> "$OUTPUT"
echo '```' >> "$OUTPUT"
bash scripts/qgate-verify.sh 2>&1 >> "$OUTPUT" || true
echo '```' >> "$OUTPUT"
echo "" >> "$OUTPUT"

# CSAP 커버리지 추가
echo "### CSAP 79항목 커버리지" >> "$OUTPUT"
echo "" >> "$OUTPUT"
echo '```' >> "$OUTPUT"
bash scripts/csap-coverage-check.sh 2>&1 >> "$OUTPUT" || true
echo '```' >> "$OUTPUT"
echo "" >> "$OUTPUT"

# 산출물 현황
echo "## 2. 감리 산출물 현황" >> "$OUTPUT"
echo "" >> "$OUTPUT"
echo "| 산출물 | 경로 | 존재 | 갱신일 |" >> "$OUTPUT"
echo "|--------|------|------|--------|" >> "$OUTPUT"

for f in T01-business-plan T02-requirements T03-detailed-design T04-traceability-matrix T05-test-plan T06-test-result T07-defect-management; do
    FILE="docs/framework/07-audit-compliance/templates/${f}.md"
    if [ -f "$FILE" ]; then
        MDATE=$(stat -c %y "$FILE" 2>/dev/null | cut -d' ' -f1 || echo "N/A")
        echo "| $f | $FILE | O | $MDATE |" >> "$OUTPUT"
    else
        echo "| $f | $FILE | X | - |" >> "$OUTPUT"
    fi
done

echo "" >> "$OUTPUT"

# 감사 로그 현황
echo "## 3. 감사 로그 현황" >> "$OUTPUT"
echo "" >> "$OUTPUT"
if [ -f ".claude/audit.jsonl" ]; then
    AUDIT_COUNT=$(wc -l < .claude/audit.jsonl)
    echo "- 총 엔트리: $AUDIT_COUNT" >> "$OUTPUT"
    echo "- 파일: .claude/audit.jsonl" >> "$OUTPUT"
    echo "- 크기: $(stat -c%s .claude/audit.jsonl 2>/dev/null || echo 'N/A') bytes" >> "$OUTPUT"
else
    echo "- **WARNING**: audit.jsonl 파일 없음" >> "$OUTPUT"
fi

echo "" >> "$OUTPUT"

# 인프라 현황
echo "## 4. 인프라 컴포넌트 현황" >> "$OUTPUT"
echo "" >> "$OUTPUT"
INFRA_COUNT=$(ls -d infra/*/ 2>/dev/null | wc -l)
echo "- 인프라 컴포넌트: ${INFRA_COUNT}개 디렉토리" >> "$OUTPUT"
echo "- E2E 테스트: $(ls tests/e2e/test-*.sh 2>/dev/null | wc -l)개" >> "$OUTPUT"
echo "- 워크플로우: $(ls .gitea/workflows/*.yaml 2>/dev/null | wc -l)개" >> "$OUTPUT"

echo "" >> "$OUTPUT"
echo "---" >> "$OUTPUT"
echo "" >> "$OUTPUT"
echo "*이 보고서는 자동 생성되었습니다.*" >> "$OUTPUT"

echo "감리 대비 보고서 생성 완료: $OUTPUT"
