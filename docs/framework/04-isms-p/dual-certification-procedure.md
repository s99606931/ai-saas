# ISMS-P 2027 의무화 인증 취득 가이드

> MTU-E1 | FR-8.4 | 적용 기준일: 2026-04-05
> 참조: MTU-C6a (ISMS-P 101항목), MTU-C6b (증적 자동화), 과기정통부 ISMS-P 의무화 고시

---

## 1. 개요

2027년 7월 ISMS-P 의무화 시행에 대비한 공공기관 SaaS 서비스의 인증 취득 완성 가이드입니다.
CSAP 인증과의 이중 인증 전략을 통해 심사 부담을 최소화합니다.

---

## 2. 2026~2027 준비 타임라인

| 시기 | 마일스톤 | 담당 | 산출물 |
|------|---------|------|--------|
| 2026-01 | ISMS-P 의무화 예고 (과기정통부 고시) | 법무 | 고시 분석 보고서 |
| 2026-04 | MTU-C6a: 101항목 체크리스트 완성 | 보안팀 | checklist-101.md |
| 2026-06 | MTU-C6b: 자동 증적 수집 인프라 완성 | 개발팀 | evidence-automation-guide.md |
| 2026-07 | 시범 운영 개시 (자가진단 + 내부 모의 심사) | CISO | 자가진단 결과서 |
| 2026-10 | 1차 내부 예비 점검 (갭 분석) | 보안팀 | 갭 분석 보고서 |
| 2027-01 | 본심사 신청 (KISA) | CISO | 심사 신청서 |
| 2027-03 | 현장 심사 대응 | 전체 | 증적 패키지 |
| 2027-05 | 보완 조치 완료 | 개발팀 | 보완 보고서 |
| 2027-07 | ISMS-P 인증서 발급 (의무화 시행 동시) | CISO | 인증서 |

---

## 3. 심사 단계별 대응 절차

### 3.1 제1단계: 서류 심사 (예비 심사)

**준비물 체크리스트**:

| 구분 | 문서명 | 출처 MTU | 자동화 |
|------|--------|---------|--------|
| 필수 | 정보보호 정책서 | MTU-C2a D01 | 템플릿 제공 |
| 필수 | 위험 관리 계획서 | MTU-C6a M05-M08 | 템플릿 제공 |
| 필수 | 내부 감사 보고서 | MTU-C6a M13-M16 | audit.jsonl 자동 생성 |
| 필수 | 개인정보 처리방침 | MTU-C6b I01-I07 | 템플릿 제공 |
| 선택 | 사업계획서 | MTU-F5 T01 | 기존 산출물 |
| 선택 | 시스템 구성도 | MTU-I1 + MTU-E2 | 아키텍처 문서 |

**자동화 지원**:
```yaml
# Gitea Actions: 서류 심사 패키지 자동 생성
name: ISMS-P 서류 심사 패키지
on:
  workflow_dispatch:
    inputs:
      audit_date:
        description: '심사 예정일 (YYYY-MM-DD)'
        required: true
jobs:
  generate-package:
    runs-on: ubuntu-latest
    steps:
      - name: audit.jsonl에서 정책 준수 현황 추출
        run: |
          cat /var/log/audit/audit.jsonl | \
            jq -r 'select(.ismsPControls != null) | [.timestamp, .action, .ismsPControls[]] | @csv' > \
            isms-p-compliance-status.csv

      - name: 101항목 준수율 계산
        run: |
          TOTAL=101
          COVERED=$(cat isms-p-compliance-status.csv | cut -d',' -f3 | sort -u | wc -l)
          echo "ISMS-P 준수율: ${COVERED}/${TOTAL} ($(( COVERED * 100 / TOTAL ))%)"
```

### 3.2 제2단계: 현장 심사 (인터뷰 + 실증)

**담당자별 인터뷰 대본 가이드**:

| 역할 | 예상 질문 | 준비 사항 | 증적 |
|------|---------|---------|------|
| CISO | 정보보호 정책 수립 과정 | 정책 승인 이력 | M01-M04 증적 |
| 보안 담당 | 취약점 점검 주기/방법 | Trivy 스캔 이력 | P-38 증적 |
| 개발 책임자 | 시큐어 코딩 적용 현황 | ESLint 보안 규칙 | P-33~35 증적 |
| DBA | 개인정보 암호화 방법 | AES-256 설정 확인 | I-10 증적 |
| 인프라 관리자 | 네트워크 격리 구성 | NetworkPolicy 확인 | P-30~32 증적 |

**실증 시연 준비**:
```bash
# 현장 심사 시연 스크립트
# 1. 접근 통제 시연 (ISMS-P P-01)
kubectl auth can-i --as=regular-user create pods -n production
# Expected: no

# 2. 암호화 시연 (ISMS-P P-15)
openssl s_client -connect service.internal:443 | grep "TLSv1.3"
# Expected: Protocol: TLSv1.3

# 3. 감사 로그 시연 (ISMS-P P-50)
tail -5 /var/log/audit/audit.jsonl | jq .
# Expected: JSON with ismsPControls field

# 4. 개인정보 마스킹 시연 (ISMS-P I-10)
curl -s https://api.internal/user/1 | jq .
# Expected: PII fields masked (주민번호 → ***-****)
```

### 3.3 제3단계: 보완 조치

**보완 프로세스**:
```
현장 심사 종료
    ↓
결함 목록 수령 (KISA)
    ↓
결함별 GitHub Issue 자동 생성 (60일 이내 조치)
    ↓
조치 완료 → 증적 수집 → 보완 보고서 자동 생성
    ↓
KISA 제출
```

### 3.4 제4단계: 인증서 발급 및 유지

| 항목 | 내용 |
|------|------|
| 유효기간 | 3년 |
| 사후 심사 | 연 1회 |
| 갱신 알림 | 만료 180일 전 자동 알림 |
| 변경 보고 | 중대 변경 시 30일 이내 KISA 보고 |

---

## 4. CSAP + ISMS-P 이중 인증 중복 매핑

### 4.1 완전 중복 항목 (30개)

| CSAP 항목 | ISMS-P 항목 | 분야 |
|---------|----------|------|
| CSAP-D08-01 | ISMS-P-P-01 | 접근 통제 정책 |
| CSAP-D08-02 | ISMS-P-P-02 | 사용자 인증 |
| CSAP-D08-03 | ISMS-P-P-03 | 권한 관리 |
| CSAP-D08-04 | ISMS-P-P-04 | 특권 계정 관리 |
| CSAP-D08-05 | ISMS-P-P-05 | 접근 로그 관리 |
| CSAP-D08-06 | ISMS-P-P-06 | 세션 관리 |
| CSAP-D08-07 | ISMS-P-P-07 | 원격 접근 통제 |
| CSAP-D08-08 | ISMS-P-P-08 | 물리적 접근 통제 |
| CSAP-D09-01 | ISMS-P-P-15 | 암호 정책 |
| CSAP-D09-02 | ISMS-P-P-16 | 암호 키 관리 |
| CSAP-D09-03 | ISMS-P-P-17 | 전송 암호화 |
| CSAP-D09-04 | ISMS-P-P-18 | 저장 암호화 |
| CSAP-D10-01 | ISMS-P-P-30 | 네트워크 접근 통제 |
| CSAP-D10-02 | ISMS-P-P-31 | 네트워크 분리 |
| CSAP-D10-03 | ISMS-P-P-32 | 방화벽 정책 |
| CSAP-D10-04 | ISMS-P-P-33 | 침입 탐지 |
| CSAP-D10-05 | ISMS-P-P-34 | 보안 관제 |
| CSAP-D12-01 | ISMS-P-P-35 | 보안 개발 프로세스 |
| CSAP-D12-02 | ISMS-P-P-36 | 소스코드 보안 검토 |
| CSAP-D12-03 | ISMS-P-P-37 | 시큐어 코딩 |
| CSAP-D12-04 | ISMS-P-P-38 | 취약점 점검 |
| CSAP-D12-05 | ISMS-P-P-39 | 패치 관리 |
| CSAP-D06-01 | ISMS-P-P-50 | 감사 로그 정책 |
| CSAP-D06-02 | ISMS-P-P-51 | 로그 보관 |
| CSAP-D06-03 | ISMS-P-P-52 | 침해사고 대응 |
| CSAP-D06-04 | ISMS-P-P-53 | 사고 보고 절차 |
| CSAP-D06-05 | ISMS-P-P-54 | 사후 분석 |
| CSAP-D07-01 | ISMS-P-P-55 | 사업 연속성 |
| CSAP-D07-02 | ISMS-P-P-56 | 재해 복구 |
| CSAP-D07-03 | ISMS-P-P-57 | 백업 관리 |

### 4.2 이중 인증 효율화 전략

```
CSAP 인증 취득 (1차)
    ↓
CSAP 증적 30개 → ISMS-P 심사에 자동 재활용
    ↓
ISMS-P 전용 61항목만 추가 준비
    ↓
ISMS-P 심사 시 실제 추가 작업: 전체의 약 40%
    ↓
이중 인증 비용 절감: 약 60%
```

---

## 5. 자가진단 도구

```bash
#!/bin/bash
# ISMS-P 자가진단 스크립트
# Design Ref: MTU-C6b evidence-automation-guide.md

echo "=== ISMS-P 자가진단 실행 ==="
echo "기준일: $(date +%Y-%m-%d)"
echo ""

# 1. 관리체계 16항목 (MTU-C6a)
echo "[관리체계] M01-M16 문서 존재 확인..."
MGMT_DOCS=0
for doc in M01-M04 M05-M08 M09-M12 M13-M16; do
  if [ -f "docs/framework/04-isms-p/management-controls/${doc}*.md" ]; then
    MGMT_DOCS=$((MGMT_DOCS + 1))
  fi
done
echo "  관리체계 문서: ${MGMT_DOCS}/4 파일"

# 2. 보호대책 64항목 (MTU-C6b)
echo "[보호대책] P01-P64 문서 존재 확인..."
PROT_DOCS=0
for doc in P01-P14 P15-P29 P30-P44 P45-P64; do
  if [ -f "docs/framework/04-isms-p/protection-controls/${doc}*.md" ]; then
    PROT_DOCS=$((PROT_DOCS + 1))
  fi
done
echo "  보호대책 문서: ${PROT_DOCS}/4 파일"

# 3. 개인정보 21항목 (MTU-C6b)
echo "[개인정보] I01-I21 문서 존재 확인..."
PRIV_DOCS=0
for doc in I01-I07 I08-I14 I15-I21; do
  if [ -f "docs/framework/04-isms-p/privacy-controls/${doc}*.md" ]; then
    PRIV_DOCS=$((PRIV_DOCS + 1))
  fi
done
echo "  개인정보 문서: ${PRIV_DOCS}/3 파일"

# 4. 증적 수집 현황
echo "[증적] audit.jsonl ISMS-P 항목 커버리지..."
if [ -f ".claude/audit.jsonl" ]; then
  TOTAL_ENTRIES=$(wc -l < .claude/audit.jsonl)
  echo "  감사 로그 항목 수: ${TOTAL_ENTRIES}"
fi

echo ""
echo "=== 자가진단 완료 ==="
```

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 최초 작성 — 심사 4단계 + 이중 인증 30개 매핑 | Claude Code |
