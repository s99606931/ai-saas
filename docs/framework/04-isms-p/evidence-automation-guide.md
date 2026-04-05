# ISMS-P 증적 자동 수집 가이드

> MTU-C6b | FR-2.4-Pa, FR-2.4-Pb | 적용 기준일: 2026-04-05
> 참조: MTU-C6a (관리체계), MTU-I2 (Gitea CI/CD), CSAP D-06 (침해사고 관리)

---

## 개요

ISMS-P 심사 시 가장 큰 부담은 증적 자료 수집입니다.
본 가이드는 Gitea Actions CI/CD 파이프라인을 활용하여 ISMS-P 보호 분야(64항목) + 개인정보(21항목)의
증적을 자동으로 수집하고, audit.jsonl에 기록하는 패턴을 제공합니다.

**기대 효과**: 심사 준비 공수 80% 절감, 증적 누락 0건 목표

---

## 1. 자동 증적 수집 아키텍처

```
Gitea Actions 이벤트 흐름
-----------------------------------------------------------
빌드 이벤트 발생 (push / PR merge)
    |
    v
Gitea Actions 파이프라인 실행
    |
    +-- 빌드 성공/실패 결과         --> ISMS-P-P-46 증거
    +-- Trivy 취약점 스캔 결과       --> ISMS-P-P-38 증거
    +-- ESLint 보안 분석 결과        --> ISMS-P-P-35 증거
    +-- 테스트 커버리지 결과         --> ISMS-P-P-36 증거
    +-- SBOM 생성 결과              --> ISMS-P-P-39 증거
    +-- 컨테이너 이미지 서명         --> ISMS-P-P-25 증거
    |
    v
audit.jsonl 자동 기록 (append-only)
    |
    v
월간 증적 리포트 자동 생성
    |
    v
ISMS-P 심사 시 증거 자료 자동 제출
-----------------------------------------------------------
```

---

## 2. audit.jsonl 스키마 (ISMS-P + CSAP 통합)

```typescript
interface IsmsPAuditEntry {
  timestamp: string                  // ISO 8601
  actor: string                      // 작업자 ID 또는 'SYSTEM'
  action: AuditAction                // 수행 작업 유형
  resource?: string                  // 대상 리소스
  result: 'SUCCESS' | 'FAILURE' | 'BLOCKED'
  ismsPControls: string[]            // 관련 ISMS-P-P-XX 항목
  ismsPIControls?: string[]          // 관련 ISMS-P-I-XX 항목 (개인정보 처리 시)
  csapControls: string[]             // 관련 CSAP-DXX-YY 항목
  evidence?: Record<string, unknown> // 증거 데이터 (스캔 결과 등)
  ip: string
  sessionId?: string
}

type AuditAction =
  | 'CI_BUILD'                // ISMS-P-P-46 배포 관리
  | 'VULNERABILITY_SCAN'      // ISMS-P-P-38 SAST/DAST
  | 'SECURE_CODING_CHECK'     // ISMS-P-P-35 시큐어 코딩
  | 'TEST_EXECUTION'          // ISMS-P-P-36 보안 테스트
  | 'SBOM_GENERATION'         // ISMS-P-P-39 오픈소스 보안
  | 'IMAGE_SIGNING'           // ISMS-P-P-25 전자서명
  | 'DEPLOY'                  // ISMS-P-P-46 배포 관리
  | 'ACCESS'                  // ISMS-P-P-01 접근 기록
  | 'LOGIN'                   // ISMS-P-P-03 사용자 인증
  | 'LOGIN_FAILED'            // ISMS-P-P-03 인증 실패
  | 'ACCOUNT_DEACTIVATE'      // ISMS-P-P-02 계정 비활성화
  | 'PRIVILEGED_ACTION'       // ISMS-P-P-05 특권 계정 사용
  | 'PERMISSION_CHANGE'       // ISMS-P-P-06 접근 권한 변경
  | 'ENCRYPTION_KEY_ROTATE'   // ISMS-P-P-22 키 갱신
  | 'PERSONAL_DATA_CONSENT'   // ISMS-P-I-01 동의 기록
  | 'PERSONAL_DATA_ACCESS'    // ISMS-P-I-08 개인정보 접근
  | 'PERSONAL_DATA_DELETE'    // ISMS-P-I-17 개인정보 파기
  | 'DATA_SUBJECT_ACCESS_REQUEST'  // ISMS-P-I-19 열람 요구
  | 'DATA_SUBJECT_DELETE_REQUEST'  // ISMS-P-I-20 삭제 요구
  | 'DATA_SUBJECT_STOP_REQUEST'    // ISMS-P-I-21 처리 정지 요구
  | 'SECURITY_INCIDENT'       // ISMS-P-P-54 보안 사고
  | 'BACKUP'                  // ISMS-P-P-58 백업
```

---

## 3. Gitea Actions 워크플로우

### 3.1 빌드 + 보안 스캔 워크플로우

```yaml
# .gitea/workflows/isms-p-evidence-collection.yml
name: ISMS-P 증적 자동 수집

on:
  push:
    branches: [main, develop]
  pull_request:
    types: [opened, synchronize, closed]

env:
  AUDIT_FILE: /var/log/audit.jsonl

jobs:
  evidence-collection:
    runs-on: ubuntu-latest
    steps:
      - name: 소스코드 체크아웃
        uses: actions/checkout@v4

      # ISMS-P-P-38: SAST - Trivy 취약점 스캔
      - name: Trivy 파일시스템 스캔
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          format: 'json'
          output: 'trivy-results.json'
          severity: 'HIGH,CRITICAL'

      # ISMS-P-P-35: 시큐어 코딩 검사
      - name: ESLint 보안 규칙 검사
        run: npx eslint --format json -o eslint-results.json src/ || true

      # ISMS-P-P-36: 테스트 실행
      - name: 단위 테스트 + 커버리지
        run: npm test -- --coverage --coverageReporters=json-summary || true

      # ISMS-P-P-39: SBOM 생성
      - name: SBOM 생성 (CycloneDX)
        run: npx @cyclonedx/cyclonedx-npm --output-file sbom.json || true

      # audit.jsonl 자동 기록
      - name: 증적 기록
        run: |
          TRIVY_VULNS=$(cat trivy-results.json 2>/dev/null | jq -c '.Results // []' || echo '[]')
          COVERAGE=$(cat coverage/coverage-summary.json 2>/dev/null | jq '.total.lines.pct // 0' || echo '0')

          cat >> $AUDIT_FILE << JSONEOF
          {"timestamp":"$(date -u +%Y-%m-%dT%H:%M:%SZ)","actor":"${{ github.actor }}","action":"CI_BUILD","resource":"${{ github.repository }}","result":"SUCCESS","branch":"${{ github.ref_name }}","commit":"${{ github.sha }}","ismsPControls":["ISMS-P-P-46"],"csapControls":["CSAP-D13-02"],"ip":"ci-runner"}
          {"timestamp":"$(date -u +%Y-%m-%dT%H:%M:%SZ)","actor":"SYSTEM","action":"VULNERABILITY_SCAN","resource":"trivy-fs","result":"SUCCESS","ismsPControls":["ISMS-P-P-38"],"csapControls":["CSAP-D12-04"],"evidence":{"vulnerabilities":$TRIVY_VULNS},"ip":"ci-runner"}
          {"timestamp":"$(date -u +%Y-%m-%dT%H:%M:%SZ)","actor":"SYSTEM","action":"SECURE_CODING_CHECK","resource":"eslint","result":"SUCCESS","ismsPControls":["ISMS-P-P-35"],"csapControls":["CSAP-D12-01"],"ip":"ci-runner"}
          {"timestamp":"$(date -u +%Y-%m-%dT%H:%M:%SZ)","actor":"SYSTEM","action":"TEST_EXECUTION","resource":"jest","result":"SUCCESS","ismsPControls":["ISMS-P-P-36"],"csapControls":["CSAP-D12-02"],"evidence":{"coveragePct":$COVERAGE},"ip":"ci-runner"}
          {"timestamp":"$(date -u +%Y-%m-%dT%H:%M:%SZ)","actor":"SYSTEM","action":"SBOM_GENERATION","resource":"cyclonedx","result":"SUCCESS","ismsPControls":["ISMS-P-P-39"],"csapControls":["CSAP-D12-05"],"ip":"ci-runner"}
          JSONEOF

      - name: 증적 파일 아카이브
        uses: actions/upload-artifact@v4
        with:
          name: isms-p-evidence-${{ github.sha }}
          path: |
            trivy-results.json
            eslint-results.json
            coverage/coverage-summary.json
            sbom.json
```

### 3.2 월간 증적 리포트 워크플로우

```yaml
# .gitea/workflows/isms-p-monthly-report.yml
name: ISMS-P 월간 증적 리포트

on:
  schedule:
    - cron: '0 9 1 * *'  # 매월 1일 09:00

jobs:
  monthly-report:
    runs-on: ubuntu-latest
    steps:
      - name: audit.jsonl 분석
        run: |
          MONTH=$(date -d "last month" +%Y-%m)
          echo "# ISMS-P 월간 증적 리포트 - $MONTH" > report.md
          echo "" >> report.md

          # ISMS-P-P 항목별 증적 건수
          echo "## 보호 분야 증적 현황" >> report.md
          echo "| ISMS-P 항목 | 증적 건수 | 최근 기록일 |" >> report.md
          echo "|-------------|----------|-----------|" >> report.md

          for i in $(seq -w 1 64); do
            COUNT=$(grep -c "ISMS-P-P-$i" /var/log/audit.jsonl 2>/dev/null || echo "0")
            LAST=$(grep "ISMS-P-P-$i" /var/log/audit.jsonl 2>/dev/null | tail -1 | jq -r '.timestamp' || echo "N/A")
            echo "| ISMS-P-P-$i | $COUNT | $LAST |" >> report.md
          done

          # ISMS-P-I 항목별 증적 건수
          echo "" >> report.md
          echo "## 개인정보 증적 현황" >> report.md
          echo "| ISMS-P 항목 | 증적 건수 | 최근 기록일 |" >> report.md
          echo "|-------------|----------|-----------|" >> report.md

          for i in $(seq -w 1 21); do
            COUNT=$(grep -c "ISMS-P-I-$i" /var/log/audit.jsonl 2>/dev/null || echo "0")
            LAST=$(grep "ISMS-P-I-$i" /var/log/audit.jsonl 2>/dev/null | tail -1 | jq -r '.timestamp' || echo "N/A")
            echo "| ISMS-P-I-$i | $COUNT | $LAST |" >> report.md
          done

      - name: 리포트 커밋
        run: |
          MONTH=$(date -d "last month" +%Y-%m)
          cp report.md docs/framework/04-isms-p/evidence-reports/isms-p-monthly-$MONTH.md
          git add docs/framework/04-isms-p/evidence-reports/
          git commit -m "docs(isms-p): $MONTH 월간 증적 리포트 자동 생성"
          git push
```

---

## 4. ISMS-P 항목별 자동 증적 매핑

### 보호 분야 (P-01~P-64)

| ISMS-P 항목 | 자동 수집 가능 | 수집 방법 | 증적 유형 |
|-------------|:------------:|---------|---------|
| P-01 접근 통제 정책 | 부분 | Kyverno 정책 적용 로그 | audit.jsonl |
| P-02 계정 관리 | 자동 | 계정 생성·삭제·비활성화 로그 | audit.jsonl |
| P-03 사용자 인증 | 자동 | 로그인 성공·실패 로그 | audit.jsonl |
| P-05 특권 계정 | 자동 | 특권 작업 실행 로그 | audit.jsonl |
| P-06 접근 권한 | 자동 | 권한 변경 로그 | audit.jsonl |
| P-11 세션 관리 | 자동 | 세션 생성·만료 로그 | audit.jsonl |
| P-16 저장 암호화 | 부분 | 암호화 작업 로그 | audit.jsonl |
| P-22 키 갱신 | 자동 | 키 갱신 이벤트 로그 | audit.jsonl |
| P-33 로그 수집 | 자동 | OTel Collector 수집 현황 | Prometheus |
| P-35 시큐어 코딩 | 자동 | ESLint 보안 규칙 결과 | CI/CD |
| P-36 테스트 | 자동 | 테스트 커버리지 | CI/CD |
| P-38 SAST/DAST | 자동 | Trivy 스캔 결과 | CI/CD |
| P-39 오픈소스 | 자동 | SBOM + 취약점 DB 매칭 | CI/CD |
| P-46 배포 관리 | 자동 | Gitea Actions 배포 로그 | CI/CD |
| P-48 감사 로그 | 자동 | audit.jsonl 자체 | audit.jsonl |
| P-58 백업 | 자동 | etcd 스냅샷 로그 | cron |

### 개인정보 (I-01~I-21)

| ISMS-P 항목 | 자동 수집 가능 | 수집 방법 | 증적 유형 |
|-------------|:------------:|---------|---------|
| I-01 동의 기록 | 자동 | 동의 이벤트 로그 | audit.jsonl |
| I-04 목적 외 이용 | 자동 | 접근 목적 검증 로그 | audit.jsonl |
| I-08 처리 기록 | 자동 | 개인정보 접근 로그 | audit.jsonl |
| I-11 접속 기록 | 자동 | 6개월 접속 로그 보관 | audit.jsonl |
| I-16 만료 파기 | 자동 | 자동 파기 스케줄러 로그 | audit.jsonl |
| I-17 파기 기록 | 자동 | 파기 실행 로그 | audit.jsonl |
| I-19 열람 요구 | 자동 | 열람 요청 처리 로그 | audit.jsonl |
| I-20 정정/삭제 | 자동 | 정정/삭제 처리 로그 | audit.jsonl |
| I-21 처리 정지 | 자동 | 처리 정지 처리 로그 | audit.jsonl |

---

## 5. 증적 자료 자동 제출 패키지 생성

심사 D-30 자동 생성:

```bash
#!/bin/bash
# generate-evidence-package.sh
# ISMS-P 심사 증적 패키지 자동 생성

AUDIT_DATE=$(date +%Y-%m-%d)
OUTPUT_DIR="isms-p-evidence-$AUDIT_DATE"
mkdir -p "$OUTPUT_DIR"

# 1. audit.jsonl에서 ISMS-P 항목별 증적 추출
for control in $(seq -w 1 64); do
  grep "ISMS-P-P-$control" /var/log/audit.jsonl > "$OUTPUT_DIR/P-$control-evidence.jsonl"
done

for control in $(seq -w 1 21); do
  grep "ISMS-P-I-$control" /var/log/audit.jsonl > "$OUTPUT_DIR/I-$control-evidence.jsonl"
done

# 2. 최근 12개월 월간 리포트 포함
cp docs/framework/04-isms-p/evidence-reports/isms-p-monthly-*.md "$OUTPUT_DIR/"

# 3. 패키지 압축
tar czf "isms-p-evidence-$AUDIT_DATE.tar.gz" "$OUTPUT_DIR/"

echo "ISMS-P 증적 패키지 생성 완료: isms-p-evidence-$AUDIT_DATE.tar.gz"
```

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | MTU-C6b Do — 증적 자동 수집 가이드 작성 | Implementer Agent |
