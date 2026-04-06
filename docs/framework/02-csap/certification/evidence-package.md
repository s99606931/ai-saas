# CSAP 증적 패키지 구성 안내

> **문서 ID**: CSAP-CERT-EVIDENCE
> **버전**: 1.0.0 | **일자**: 2026-04-06 | **작성자**: PM Agent
> **Plan SC**: FR-CSAP5.4 | **Design Ref**: MTU-CSAP5 Design 3
> **참조**: evidence-mapping.md, checklist-master.md

---

## 1. 개요

CSAP 표준등급 심사 시 제출할 증적 패키지를 13개 분야별로 구성합니다. 각 분야의 증적 유형과 수집 경로를 명시하여 심사 대응 시 누락 없이 제출할 수 있도록 합니다.

---

## 2. 증적 패키지 디렉토리 구조

```
csap-evidence-package/
├── 00-신청서류/
│   ├── 신청서.md (application-template.md 기반)
│   ├── 사업자등록증.pdf
│   ├── 서비스설명서.md
│   └── 자가진단결과서.md (checklist-master.md)
│
├── D01-정보보호정책/
│   ├── 정보보호정책서.md
│   ├── 경영진승인문서.pdf
│   ├── 정책공표이력.md
│   └── 정기검토회의록.md
│
├── D02-조직보안/
│   ├── 조직도.md
│   ├── CISO임명장.pdf
│   └── 업무분장표.md
│
├── D03-인적보안/
│   ├── 보안서약서_양식.md
│   ├── 보안교육계획서.md
│   ├── 교육이수확인서.md
│   └── 퇴직자체크리스트.md
│
├── D04-자산관리/
│   ├── 정보자산목록.md
│   ├── 자산등급분류표.md
│   └── 매체관리대장.md
│
├── D05-공급망보안/
│   ├── 공급업체보안평가.md
│   ├── SBOM_목록.json (Trivy 생성)
│   └── 라이선스검사결과.md
│
├── D06-침해사고관리/
│   ├── 사고대응절차서.md
│   ├── 감사로그샘플.jsonl (audit.jsonl 발췌)
│   ├── 보안모니터링_스크린샷.png
│   └── 로그분석보고서.md
│
├── D07-재해복구/
│   ├── BCP_DRP_계획서.md
│   ├── 백업설정_증적.md
│   └── 복원테스트결과.md
│
├── D08-접근통제/
│   ├── RBAC_구현_코드.md (auth-sdk 발췌)
│   ├── 세션관리_설정.md (JWT 설정)
│   ├── 로그인실패_잠금.md (security-monitor)
│   ├── 비밀번호정책.md
│   ├── 테넌트격리_구현.md
│   └── 시연_스크린샷/
│       ├── 01_사용자생성.png
│       ├── 02_RBAC설정.png
│       ├── 03_접근차단_403.png
│       └── 04_계정잠금.png
│
├── D09-암호화/
│   ├── AES256_설정.md
│   ├── TLS13_인증서.md
│   ├── bcrypt_해시확인.md
│   └── 키관리_절차.md
│
├── D10-네트워크보안/
│   ├── NetworkPolicy_설정.md
│   ├── 방화벽_규칙.md
│   ├── 침입탐지_설정.md
│   └── DLP_구현.md
│
├── D11-가상화보안/
│   ├── Docker_securityContext.md
│   ├── Trivy_이미지스캔결과.md
│   ├── 리소스제한_설정.md (docker-compose)
│   ├── Cosign_서명검증.md
│   └── healthcheck_설정.md
│
├── D12-시스템개발보안/
│   ├── 시큐어코딩_규칙.md (csap-compliance.md)
│   ├── Zod_입력검증.md
│   ├── Prisma_SQL주입방지.md
│   ├── CICD_보안스캔.md (security.yml)
│   ├── Trivy_취약점점검결과.md
│   ├── npm_audit_결과.md
│   ├── OWASP_ZAP_결과.html
│   └── 코드리뷰_이력.md
│
└── D13-공공기관추가/
    ├── 보안관제_설정.md (security-monitor-service)
    ├── N2SF_데이터등급.md
    ├── 준수현황_대시보드.md (compliance-service)
    ├── 감사추적_설정.md (audit-service)
    └── 사고통보_절차.md
```

---

## 3. 증적 수집 방법

### 3.1 자동 수집 가능 증적

| 증적 | 수집 방법 | 명령어/경로 |
|------|---------|-----------|
| Trivy 스캔 결과 | scripts/security-audit.sh | reports/ |
| npm audit 결과 | pnpm audit --json | reports/ |
| OWASP ZAP 결과 | Docker 실행 | reports/zap/ |
| SBOM | trivy image --format cyclonedx | reports/ |
| 감사 로그 | audit.jsonl 발췌 | .claude/audit.jsonl |
| CI/CD 로그 | Gitea Actions 이력 | .gitea/workflows/ |
| OSCAL 검증 | scripts/oscal-validate.sh | 콘솔 출력 |

### 3.2 수동 수집 필요 증적

| 증적 | 수집 방법 | 담당 |
|------|---------|------|
| CISO 임명장 | 스캔/PDF 저장 | 경영진 |
| 정책서 승인 서명 | 스캔/PDF 저장 | CISO |
| 보안 교육 이수 확인서 | 교육 시스템 추출 | 보안 담당자 |
| 보안 서약서 | 스캔/PDF 저장 | 인사 담당 |
| 시연 스크린샷 | 시연 시 캡처 | 개발팀 |

### 3.3 증적 패키지 생성 스크립트

```bash
#!/bin/bash
# 증적 패키지 자동 수집 (자동 수집 가능 항목만)
EVIDENCE_DIR="csap-evidence-package"
mkdir -p "$EVIDENCE_DIR"/{D05,D06,D11,D12}

# Trivy 스캔
./scripts/security-audit.sh
cp reports/vulnerability/*/trivy-*.json "$EVIDENCE_DIR/D12/"
cp reports/vulnerability/*/npm-audit-*.json "$EVIDENCE_DIR/D12/"

# SBOM 생성
for svc in auth-service user-service tenant-service; do
  trivy image --format cyclonedx \
    --output "$EVIDENCE_DIR/D05/sbom-${svc}.json" \
    "public-saas/${svc}:latest" 2>/dev/null || true
done

# 감사 로그 발췌 (최근 7일)
if [ -f ".claude/audit.jsonl" ]; then
  tail -100 .claude/audit.jsonl > "$EVIDENCE_DIR/D06/audit-sample.jsonl"
fi

# OSCAL 검증
./scripts/oscal-validate.sh > "$EVIDENCE_DIR/D12/oscal-validation.txt" 2>&1

echo "증적 패키지 수집 완료: $EVIDENCE_DIR/"
```

---

## 4. 증적 품질 기준

| 기준 | 설명 |
|------|------|
| 최신성 | 심사일 기준 30일 이내 발행 |
| 진본성 | 원본 또는 인증된 사본 |
| 완전성 | 해당 항목의 모든 증거 포함 |
| 추적성 | 통제항목 ↔ 증적 1:1 매핑 |
| 기밀성 | 민감 정보 마스킹 (PII 등) |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-06 | 최초 작성 | PM Agent |
