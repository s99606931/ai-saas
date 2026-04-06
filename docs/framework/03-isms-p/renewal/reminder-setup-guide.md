# ISMS-P 자동 리마인더 설정 가이드

> **문서 ID**: ISMS-P-REMINDER-GUIDE
> **버전**: 1.0.0 | **일자**: 2026-04-06 | **작성자**: PM Agent
> **Plan SC**: FR-ISMS4.3, FR-ISMS4.4 | **Design Ref**: MTU-ISMS4 Design 2.3

---

## 1. 개요

ISMS-P 인증 주기 관리를 자동화하기 위한 리마인더 설정 가이드입니다. Gitea Issues + Gitea Actions cron을 활용하여 외부 서비스 의존 없이 알림을 구현합니다.

---

## 2. Gitea Issues 기반 리마인더

### 2.1 자동 생성 이슈 유형

| 이슈 유형 | 주기 | 제목 형식 | 라벨 |
|---------|------|---------|------|
| 갱신 준비 | 3년 (D-180) | `[ISMS-P] 갱신 준비 착수 (D-180)` | `isms-p`, `renewal` |
| 사후심사 | 매년 | `[ISMS-P] 연간 사후심사 준비` | `isms-p`, `surveillance` |
| 분기 점검 | 매 분기 | `[ISMS-P] Q{분기} 내부 점검` | `isms-p`, `quarterly` |
| 취약점 점검 | 반기 | `[ISMS-P] 반기 취약점 점검` | `isms-p`, `vulnerability` |
| 교육 실시 | 매년 | `[ISMS-P] 연간 보안 교육 실시` | `isms-p`, `training` |
| 경영진 보고 | 반기 | `[ISMS-P] 경영진 보고` | `isms-p`, `report` |

### 2.2 이슈 템플릿

```markdown
# [ISMS-P] {이슈 유형} — {YYYY-MM}

## 기한
- **착수일**: YYYY-MM-DD
- **완료 기한**: YYYY-MM-DD

## 체크리스트
- [ ] 사전 준비 완료
- [ ] 증적 수집/갱신
- [ ] 결과 보고서 작성
- [ ] CISO 승인

## 담당자
- 주담당: @ciso
- 부담당: @security-team

## 참조
- docs/framework/03-isms-p/renewal/renewal-checklist.md
- docs/framework/03-isms-p/renewal/annual-surveillance-procedure.md
```

---

## 3. Gitea Actions 크론 워크플로우

### 3.1 분기별 내부 점검 리마인더

```yaml
# .gitea/workflows/isms-quarterly-reminder.yml
name: ISMS-P 분기별 내부 점검 리마인더

on:
  schedule:
    # 매 분기 첫 영업일 09:00 KST (00:00 UTC)
    - cron: '0 0 1 1,4,7,10 *'

jobs:
  create-issue:
    runs-on: ubuntu-latest
    steps:
      - name: 분기 계산
        id: quarter
        run: |
          MONTH=$(date +%m)
          if [ "$MONTH" -le 3 ]; then Q=1
          elif [ "$MONTH" -le 6 ]; then Q=2
          elif [ "$MONTH" -le 9 ]; then Q=3
          else Q=4; fi
          echo "quarter=$Q" >> $GITHUB_OUTPUT
          echo "year=$(date +%Y)" >> $GITHUB_OUTPUT

      - name: Gitea API로 이슈 생성
        run: |
          curl -X POST "$GITEA_URL/api/v1/repos/$REPO/issues" \
            -H "Authorization: token $GITEA_TOKEN" \
            -H "Content-Type: application/json" \
            -d '{
              "title": "[ISMS-P] Q${{ steps.quarter.outputs.quarter }} 내부 점검 (${{ steps.quarter.outputs.year }})",
              "body": "## ISMS-P Q${{ steps.quarter.outputs.quarter }} 내부 점검\n\n### 체크리스트\n- [ ] 점검 계획 수립\n- [ ] 증적 최신성 확인\n- [ ] 점검 실행\n- [ ] 결과 보고서 작성\n- [ ] CISO 승인\n\n### 참조\n- renewal/annual-surveillance-procedure.md",
              "labels": [{"name": "isms-p"}, {"name": "quarterly"}],
              "assignees": ["ciso"]
            }'
        env:
          GITEA_URL: ${{ secrets.GITEA_URL }}
          GITEA_TOKEN: ${{ secrets.GITEA_TOKEN }}
          REPO: ${{ github.repository }}
```

### 3.2 반기별 취약점 점검 리마인더

```yaml
# .gitea/workflows/isms-vulnerability-reminder.yml
name: ISMS-P 반기 취약점 점검 리마인더

on:
  schedule:
    # 매년 4월, 10월 1일 09:00 KST
    - cron: '0 0 1 4,10 *'

jobs:
  create-issue:
    runs-on: ubuntu-latest
    steps:
      - name: Gitea API로 이슈 생성
        run: |
          HALF=$([ $(date +%m) -le 6 ] && echo "상반기" || echo "하반기")
          curl -X POST "$GITEA_URL/api/v1/repos/$REPO/issues" \
            -H "Authorization: token $GITEA_TOKEN" \
            -H "Content-Type: application/json" \
            -d "{
              \"title\": \"[ISMS-P] ${HALF} 취약점 정기 점검 ($(date +%Y))\",
              \"body\": \"## 취약점 정기 점검\n\n### 도구\n- [ ] Trivy (컨테이너)\n- [ ] npm audit (의존성)\n- [ ] OWASP ZAP (웹)\n\n### 기준\n- 0 Critical, 0 High\n\n### 참조\n- scripts/security-audit.sh\",
              \"labels\": [{\"name\": \"isms-p\"}, {\"name\": \"vulnerability\"}]
            }"
        env:
          GITEA_URL: ${{ secrets.GITEA_URL }}
          GITEA_TOKEN: ${{ secrets.GITEA_TOKEN }}
          REPO: ${{ github.repository }}
```

### 3.3 연간 사후심사 리마인더

```yaml
# .gitea/workflows/isms-annual-reminder.yml
name: ISMS-P 연간 사후심사 리마인더

on:
  schedule:
    # 매년 5월 1일 (심사 2~3개월 전 준비 시작)
    - cron: '0 0 1 5 *'

jobs:
  create-issue:
    runs-on: ubuntu-latest
    steps:
      - name: Gitea API로 이슈 생성
        run: |
          curl -X POST "$GITEA_URL/api/v1/repos/$REPO/issues" \
            -H "Authorization: token $GITEA_TOKEN" \
            -H "Content-Type: application/json" \
            -d "{
              \"title\": \"[ISMS-P] $(date +%Y)년 연간 사후심사 준비\",
              \"body\": \"## 연간 사후심사 준비\n\n### 일정 (예상)\n- 5월: 준비 착수\n- 6월: 증적 정비\n- 7~8월: 사후심사\n\n### 체크리스트\n- [ ] 인증기관 일정 협의\n- [ ] 전회 결함 보완 확인\n- [ ] 101항목 증적 최신화\n- [ ] 내부 모의 점검\n- [ ] 심사 장소/인원 확정\",
              \"labels\": [{\"name\": \"isms-p\"}, {\"name\": \"surveillance\"}],
              \"assignees\": [\"ciso\"]
            }"
        env:
          GITEA_URL: ${{ secrets.GITEA_URL }}
          GITEA_TOKEN: ${{ secrets.GITEA_TOKEN }}
          REPO: ${{ github.repository }}
```

---

## 4. 인증 범위 변경 신고 절차

### 4.1 변경 사유 유형

| 유형 | 예시 | 신고 필요 여부 |
|------|------|-------------|
| 조직 변경 | 합병, 분할, 조직 개편 | 필수 (30일 이내) |
| 시스템 변경 | 인프라 전환, 신규 시스템 도입 | 필수 (30일 이내) |
| 서비스 변경 | 신규 서비스 출시, 서비스 폐지 | 필수 (30일 이내) |
| 경미한 변경 | 담당자 변경, 사무실 이전 | 사후심사 시 보고 |

### 4.2 변경 신고 절차

```
변경 발생 → 변경 영향도 분석 → 인증기관 신고 → 추가 심사 여부 결정
   D+0         D+3                D+30(최대)      인증기관 결정
```

### 4.3 변경 신고 양식

```markdown
# ISMS-P 인증 범위 변경 신고서

## 1. 기관 정보
- 기관명:
- 인증번호:
- 인증 유효기간:

## 2. 변경 내용
- 변경 유형: [조직/시스템/서비스]
- 변경 일자:
- 변경 전:
- 변경 후:
- 변경 사유:

## 3. 영향도 분석
- 인증 범위 영향: [확대/축소/변경 없음]
- 영향 받는 항목 수:
- 추가 심사 필요 여부 (기관 의견):

## 4. 조치 계획
- 증적 갱신 계획:
- 완료 예정일:

## 5. 첨부
- 변경 전후 비교표
- 영향도 분석 보고서
```

---

## 5. 설정 체크리스트

### 5.1 최초 설정 시

- [ ] Gitea Labels 생성: `isms-p`, `renewal`, `surveillance`, `quarterly`, `vulnerability`, `training`, `report`
- [ ] `.gitea/workflows/isms-quarterly-reminder.yml` 배포
- [ ] `.gitea/workflows/isms-vulnerability-reminder.yml` 배포
- [ ] `.gitea/workflows/isms-annual-reminder.yml` 배포
- [ ] Gitea Secrets 설정: `GITEA_URL`, `GITEA_TOKEN`
- [ ] CISO 계정 Gitea 알림 설정 확인

### 5.2 인증 취득 후

- [ ] 갱신 D-180 리마인더 수동 등록 (인증일 기준 역산)
- [ ] 사후심사 연간 일정 확정 후 리마인더 조정
- [ ] 경영진 보고 일정 리마인더 추가

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-06 | 최초 작성 | PM Agent |
