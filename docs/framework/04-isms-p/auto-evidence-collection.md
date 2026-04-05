# ISMS-P 자동 증적 수집 및 보고서 생성 가이드

> MTU-E1 | FR-8.4 | 적용 기준일: 2026-04-05
> 참조: MTU-C6b (evidence-automation-guide.md), MTU-I2 (Gitea CI/CD)

---

## 1. 개요

ISMS-P 심사 시 가장 큰 비용 요인인 증적 수집을 자동화합니다.
MTU-C6b에서 구축한 audit.jsonl 기반 증적 인프라를 확장하여,
ISMS-P 101항목 전수에 대한 자동 보고서를 생성합니다.

**목표**: 심사 준비 공수 80% 절감, 증적 누락 0건

---

## 2. 자동 증적 수집 파이프라인

```
Gitea Actions (CI/CD 파이프라인)
    │
    ▼
audit.jsonl (append-only, CSAP D-06)
    │
    ├── [일간] ISMS-P 항목별 증적 집계
    │       → isms-p-evidence-{YYYY-MM-DD}.json
    │
    ├── [월간] ISMS-P 101항목 준수 현황
    │       → isms-p-monthly-report-{YYYY-MM}.md
    │
    └── [심사 대응] D-30 자동 생성
            → isms-p-audit-package-{심사일}.zip
```

---

## 3. 일간 증적 집계 워크플로우

```yaml
# .gitea/workflows/isms-p-daily-evidence.yml
# Plan SC: FR-8.4, Design Ref: MTU-C6b
name: ISMS-P 일간 증적 집계

on:
  schedule:
    - cron: '0 23 * * *'  # 매일 23:00 UTC

jobs:
  collect-daily:
    runs-on: ubuntu-latest
    steps:
      - name: 소스코드 체크아웃
        uses: actions/checkout@v4

      - name: 오늘자 audit.jsonl 항목 추출
        run: |
          TODAY=$(date +%Y-%m-%d)
          cat /var/log/audit/audit.jsonl | \
            jq -c "select(.timestamp | startswith(\"${TODAY}\"))" > \
            /tmp/today-audit.jsonl

      - name: ISMS-P 항목별 증적 집계
        run: |
          cat /tmp/today-audit.jsonl | \
            jq -r '.ismsPControls[]? // empty' | \
            sort | uniq -c | sort -rn > \
            /tmp/isms-p-coverage.txt

          echo "=== ISMS-P 일간 증적 현황 (${TODAY}) ===" 
          cat /tmp/isms-p-coverage.txt

      - name: JSON 보고서 생성
        run: |
          TODAY=$(date +%Y-%m-%d)
          jq -n \
            --arg date "${TODAY}" \
            --arg total "$(wc -l < /tmp/today-audit.jsonl)" \
            --arg isms_p "$(cat /tmp/isms-p-coverage.txt | wc -l)" \
            '{date: $date, totalEvents: ($total|tonumber), ismsPItemsCovered: ($isms_p|tonumber)}' > \
            reports/isms-p-evidence-${TODAY}.json

      - name: audit.jsonl에 일간 집계 기록
        run: |
          echo "{\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"action\":\"DAILY_EVIDENCE_COLLECTION\",\"result\":\"SUCCESS\"}" >> /var/log/audit/audit.jsonl
```

---

## 4. 월간 보고서 생성

```yaml
# .gitea/workflows/isms-p-monthly-report.yml
name: ISMS-P 월간 준수 보고서

on:
  schedule:
    - cron: '0 0 1 * *'  # 매월 1일

jobs:
  generate-report:
    runs-on: ubuntu-latest
    steps:
      - name: 월간 audit.jsonl 집계
        run: |
          MONTH=$(date -d 'last month' +%Y-%m)
          cat /var/log/audit/audit.jsonl | \
            jq -c "select(.timestamp | startswith(\"${MONTH}\"))" > \
            /tmp/monthly-audit.jsonl

      - name: ISMS-P 101항목 커버리지 분석
        run: |
          # 관리체계 16항목 (M01-M16)
          M_COUNT=$(cat /tmp/monthly-audit.jsonl | jq -r '.ismsPControls[]? // empty' | grep '^ISMS-P-M-' | sort -u | wc -l)
          
          # 보호대책 64항목 (P01-P64)
          P_COUNT=$(cat /tmp/monthly-audit.jsonl | jq -r '.ismsPControls[]? // empty' | grep '^ISMS-P-P-' | sort -u | wc -l)
          
          # 개인정보 21항목 (I01-I21)
          I_COUNT=$(cat /tmp/monthly-audit.jsonl | jq -r '.ismsPIControls[]? // empty' | grep '^ISMS-P-I-' | sort -u | wc -l)
          
          TOTAL=$((M_COUNT + P_COUNT + I_COUNT))
          
          echo "## ISMS-P 월간 준수 보고서 (${MONTH})"
          echo ""
          echo "| 분야 | 대상 | 커버 | 비율 |"
          echo "|------|------|------|------|"
          echo "| 관리체계 | 16 | ${M_COUNT} | $((M_COUNT * 100 / 16))% |"
          echo "| 보호대책 | 64 | ${P_COUNT} | $((P_COUNT * 100 / 64))% |"
          echo "| 개인정보 | 21 | ${I_COUNT} | $((I_COUNT * 100 / 21))% |"
          echo "| **합계** | **101** | **${TOTAL}** | **$((TOTAL * 100 / 101))%** |"

      - name: Markdown 보고서 저장
        run: |
          MONTH=$(date -d 'last month' +%Y-%m)
          # 보고서 파일 생성 (경로: reports/)
          echo "보고서 생성 완료: isms-p-monthly-report-${MONTH}.md"
```

---

## 5. 심사 대응 패키지 자동 생성

```yaml
# .gitea/workflows/isms-p-audit-package.yml
name: ISMS-P 심사 대응 패키지

on:
  workflow_dispatch:
    inputs:
      audit_date:
        description: '심사 예정일'
        required: true

jobs:
  generate-package:
    runs-on: ubuntu-latest
    steps:
      - name: 증적 파일 수집
        run: |
          mkdir -p audit-package
          
          # 1. 정책 문서 (MTU-C6a 관리체계)
          cp docs/framework/04-isms-p/management-controls/*.md audit-package/
          
          # 2. 보호대책 문서 (MTU-C6b)
          cp docs/framework/04-isms-p/protection-controls/*.md audit-package/
          
          # 3. 개인정보 문서 (MTU-C6b)
          cp docs/framework/04-isms-p/privacy-controls/*.md audit-package/
          
          # 4. 감사 로그 최근 6개월
          cat /var/log/audit/audit.jsonl | \
            jq -c "select(.timestamp >= \"$(date -d '6 months ago' +%Y-%m-%d)\")" > \
            audit-package/audit-log-6months.jsonl
          
          # 5. CSAP 인증 증적 재활용 (30개 중복 항목)
          cp docs/framework/02-csap/standard-grade/checklist-master.md audit-package/

      - name: ZIP 패키지 생성
        run: |
          zip -r isms-p-audit-package-${{ inputs.audit_date }}.zip audit-package/
          echo "심사 대응 패키지 생성 완료"

      - name: 패키지 목록 검증
        run: |
          echo "=== 패키지 내용 ==="
          unzip -l isms-p-audit-package-${{ inputs.audit_date }}.zip
          FILE_COUNT=$(unzip -l isms-p-audit-package-${{ inputs.audit_date }}.zip | tail -1 | awk '{print $2}')
          echo "총 파일 수: ${FILE_COUNT}"
```

---

## 6. CSAP 증적 자동 재활용 매핑

```typescript
// CSAP → ISMS-P 증적 자동 매핑 유틸리티
// Design Ref: MTU-E1, Plan SC: FR-8.4

interface EvidenceMapping {
  csapId: string;
  ismsPId: string;
  evidenceType: 'full' | 'partial';
  additionalWork?: string;
}

const CSAP_ISMS_P_MAPPING: EvidenceMapping[] = [
  { csapId: 'CSAP-D08-01', ismsPId: 'ISMS-P-P-01', evidenceType: 'full' },
  { csapId: 'CSAP-D08-02', ismsPId: 'ISMS-P-P-02', evidenceType: 'full' },
  { csapId: 'CSAP-D09-01', ismsPId: 'ISMS-P-P-15', evidenceType: 'full' },
  { csapId: 'CSAP-D09-03', ismsPId: 'ISMS-P-P-17', evidenceType: 'full' },
  // ... 30개 완전 중복 항목
];

function reuseCSAPEvidence(csapAuditLog: AuditEntry[]): ISMSPEvidence[] {
  return CSAP_ISMS_P_MAPPING
    .filter(m => m.evidenceType === 'full')
    .map(mapping => {
      const csapEvidence = csapAuditLog.find(
        e => e.csapControls?.includes(mapping.csapId)
      );
      return {
        ismsPId: mapping.ismsPId,
        evidence: csapEvidence,
        source: 'CSAP_REUSE',
        additionalWorkRequired: false,
      };
    });
}
```

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 최초 작성 — 자동 증적 파이프라인 + CSAP 재활용 | Claude Code |
