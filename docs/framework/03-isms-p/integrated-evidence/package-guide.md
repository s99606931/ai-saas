# 통합 증적 제출 패키지 가이드

> **문서 ID**: ISMS-P-PACKAGE-GUIDE
> **버전**: 1.0.0 | **일자**: 2026-04-06 | **작성자**: PM Agent
> **Plan SC**: FR-ISMS3.3, FR-ISMS3.5 | **Design Ref**: MTU-ISMS3 Design 2.2

---

## 1. 개요

CSAP + ISMS-P 심사에 동시 대응할 수 있는 통합 증적 패키지 구성 가이드입니다. 단일 증적 저장소에서 심사 유형별 뷰를 제공하여 증적 일관성을 보장합니다.

---

## 2. 증적 패키지 디렉토리 구조

```
evidence-package/
├── INDEX.md                           # 전체 색인 (101항목 매핑)
├── 00-common/                         # 공통 증적
│   ├── organization-chart.pdf         # 조직도
│   ├── security-policy.pdf            # 정보보호정책서
│   ├── ciso-appointment.pdf           # CISO 임명장
│   └── legal-index.pdf               # 법령 인덱스
├── 01-management-system/              # 관리체계 (16항목)
│   ├── M01-executive-participation/
│   ├── M02-ciso-designation/
│   ├── M03-organization/
│   ├── M04-scope-definition/
│   ├── M05-asset-identification/
│   ├── M06-flow-analysis/
│   ├── M07-risk-assessment/
│   ├── M08-countermeasure-selection/
│   ├── M09-implementation/
│   ├── M10-sharing/
│   ├── M11-operation-status/
│   ├── M12-legal-compliance/
│   ├── M13-periodic-review/
│   ├── M14-internal-audit/
│   ├── M15-improvement/
│   └── M16-executive-report/
├── 02-protection-measures/            # 보호대책 (64항목)
│   ├── P01-policy-management/
│   ├── P02-organization-management/
│   ├── ...
│   └── P64-source-management/
├── 03-personal-data/                  # 개인정보 (21항목)
│   ├── I01-consent/
│   ├── I02-purpose/
│   ├── ...
│   └── I21-breach-response/
└── csap-shared/                       # CSAP 공유 증적 (36항목)
    ├── README.md                      # CSAP 공유 증적 설명
    ├── D01-policy/
    ├── D02-organization/
    ├── D03-personnel/
    ├── D04-asset/
    ├── D05-supply-chain/
    ├── D06-incident/
    ├── D07-disaster-recovery/
    ├── D08-access-control/
    ├── D09-encryption/
    ├── D10-network/
    ├── D11-virtualization/
    └── D12-development/
```

---

## 3. 심사원별 증적 뷰

### 3.1 CSAP 심사용 뷰

CSAP 심사원에게는 다음 경로의 증적을 제출합니다:

```
CSAP 심사 패키지:
├── csap-shared/              # CSAP 79항목 전용 증적
├── 00-common/                # 공통 증적 (조직도, 정책서 등)
└── CSAP-INDEX.md             # CSAP 79항목 -> 증적 매핑 색인
```

**CSAP-INDEX.md 형식**:
```markdown
| CSAP ID | 항목명 | 증적 경로 | 제출 형태 | 상태 |
|---------|-------|---------|---------|------|
| D01-01 | 정보보호 정책 수립 | csap-shared/D01-policy/policy.pdf | PDF | 제출 완료 |
| ... | ... | ... | ... | ... |
```

### 3.2 ISMS-P 심사용 뷰

ISMS-P 심사원에게는 전체 패키지를 제출합니다:

```
ISMS-P 심사 패키지:
├── 01-management-system/     # 관리체계 16항목
├── 02-protection-measures/   # 보호대책 64항목
├── 03-personal-data/         # 개인정보 21항목
├── csap-shared/              # CSAP 중복 증적 (심볼릭 링크)
├── 00-common/                # 공통 증적
└── ISMS-INDEX.md             # ISMS-P 101항목 -> 증적 매핑 색인
```

**ISMS-INDEX.md 형식**:
```markdown
| ISMS-P ID | 항목명 | 증적 경로 | CSAP 재활용 | 상태 |
|-----------|-------|---------|-----------|------|
| 1.1.1 | 경영진의 참여 | csap-shared/D01-policy/ | CSAP D01-01 | 재활용 |
| 1.1.4 | 범위 설정 | 01-management-system/M04-scope/ | 신규 | 작성 중 |
| ... | ... | ... | ... | ... |
```

### 3.3 통합 뷰 (내부 관리용)

```markdown
| 증적명 | CSAP ID | ISMS-P ID | 증적 경로 | 최신 버전 | 갱신일 |
|--------|---------|-----------|---------|---------|--------|
| 정보보호정책서 | D01-01 | 1.1.1, 1.3.2 | csap-shared/D01-policy/ | v1.0.0 | 2026-04 |
```

---

## 4. 증적 제출 형태별 가이드

### 4.1 문서형 증적

| 형태 | 설명 | 준비 방법 |
|------|------|---------|
| PDF (서명) | 경영진/CISO 서명 필요 | Markdown -> PDF 변환 + 전자 서명 |
| PDF (일반) | 문서 증적 | Markdown -> PDF 변환 |
| 엑셀 | 체크리스트/목록 | CSV/XLSX 형식 |

**PDF 변환 명령**:
```bash
# Markdown -> PDF 변환 (pandoc 활용)
pandoc input.md -o output.pdf --pdf-engine=xelatex \
  -V mainfont="NanumGothic" \
  -V geometry:margin=2.5cm
```

### 4.2 시스템형 증적

| 형태 | 설명 | 준비 방법 |
|------|------|---------|
| 스크린샷 | 시스템 설정/화면 캡처 | 날짜 + 시스템명 표기 |
| 로그 덤프 | 감사 로그/시스템 로그 | 기간 지정 + 무결성 해시 |
| 설정 파일 | 보안 설정 내용 | 시크릿 마스킹 후 제출 |

**로그 덤프 스크립트**:
```bash
# 감사 로그 덤프 (기간 지정)
cat .claude/audit.jsonl | \
  jq -r "select(.timestamp >= \"2026-01-01\" and .timestamp <= \"2026-12-31\")" \
  > evidence-package/csap-shared/D06-incident/audit-log-2026.json

# SHA-256 무결성 해시
sha256sum evidence-package/csap-shared/D06-incident/audit-log-2026.json \
  > evidence-package/csap-shared/D06-incident/audit-log-2026.json.sha256
```

### 4.3 프로세스형 증적

| 형태 | 설명 | 준비 방법 |
|------|------|---------|
| 시연 스크립트 | 시스템 동작 시연 | 단계별 시나리오 문서화 |
| 워크플로우 | 프로세스 흐름 증명 | Gitea Actions 실행 이력 |
| 인터뷰 답변 | 구두 확인 | Q&A 가이드 사전 준비 |

---

## 5. 증적 패키지 생성 스크립트

```bash
#!/bin/bash
# scripts/generate-evidence-package.sh
# 사용법: ./scripts/generate-evidence-package.sh [output-dir]

OUTPUT_DIR="${1:-evidence-package}"
DATE=$(date +%Y-%m-%d)

echo "증적 패키지 생성 시작: ${OUTPUT_DIR} (${DATE})"

# 디렉토리 구조 생성
mkdir -p "${OUTPUT_DIR}"/{00-common,01-management-system,02-protection-measures,03-personal-data,csap-shared}

# 프레임워크 문서 복사 (CSAP 공유 증적)
cp -r docs/framework/01-security-policy/ "${OUTPUT_DIR}/csap-shared/D01-policy/"
cp -r docs/framework/02-csap/ "${OUTPUT_DIR}/csap-shared/"

# INDEX.md 생성
cat > "${OUTPUT_DIR}/INDEX.md" << EOF
# 통합 증적 패키지 INDEX
> 생성일: ${DATE}
> CSAP 79항목 + ISMS-P 101항목 통합
EOF

echo "증적 패키지 생성 완료: ${OUTPUT_DIR}"
```

---

## 6. 갱신 시 패키지 업데이트 절차

### 6.1 CSAP 증적 변경 시

1. `csap-shared/` 해당 디렉토리 증적 업데이트
2. CSAP-INDEX.md 버전 갱신
3. ISMS-INDEX.md 중복 항목 상태 확인
4. 변경 이력 커밋 (`evidence: CSAP-{ID} 증적 갱신`)

### 6.2 ISMS-P 증적 변경 시

1. 해당 영역 디렉토리 증적 업데이트
2. ISMS-INDEX.md 버전 갱신
3. 중복 항목이면 csap-shared/ 동시 업데이트
4. 변경 이력 커밋 (`evidence: ISMS-{ID} 증적 갱신`)

### 6.3 정기 갱신 (분기별)

1. 전체 증적 최신성 점검 (자동 스크립트)
2. 만료/변경 필요 증적 식별
3. 갱신 작업 + INDEX 업데이트
4. 갱신 보고서 작성

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-06 | 최초 작성 | PM Agent |
