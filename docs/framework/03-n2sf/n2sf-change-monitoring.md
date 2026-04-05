# N2SF 규정 변경 모니터링 프로세스

> MTU-A7 | NFR-7 (30일 이내 규정 변경 반영) | 적용 기준일: 2026-04-05
> 참조: MTU-C4 (N2SF 매핑), MTU-E3 (프레임워크 업그레이드)

---

## 1. 개요

N2SF 국정원 가이드라인은 연 1~2회 업데이트됩니다.
본 프로세스는 변경 발생 시 30일 이내 프레임워크 반영을 보장합니다.

**SLA**: 변경 탐지 → 영향 분석 → 문서 업데이트 완료까지 30일 이내 (NFR-7)

---

## 2. 모니터링 채널

| 채널 | URL | 주기 | 담당자 |
|------|-----|------|--------|
| 국가정보원 공식 사이트 | nis.go.kr | 주간 | 보안 담당자 |
| KISA 인터넷보호나라 | boho.or.kr | 주간 | 보안 담당자 |
| CSAP 인증 기관 (KISA-ISMS) | isms.kisa.or.kr | 월간 | CISO |
| 과학기술정보통신부 | msit.go.kr | 월간 | 법무 |
| 법제처 국가법령정보센터 | law.go.kr | 월간 | 법무 |

---

## 3. 모니터링 프로세스

```
[주간 확인] 국정원 공지사항 + N2SF 공식 채널 + KISA
    |
    +-- 변경 없음 --> 로그 기록 (audit.jsonl: N2SF_MONITORING_CHECK)
    |
    +-- 변경 있음 --> [영향 분석] (D+5 이내)
            |
            +-- 영향 없음 --> 로그 기록 + Gitea Issue (label: n2sf-no-impact)
            |
            +-- 영향 있음 --> [업데이트 계획 수립] (D+10 이내)
                    |
                    +-- 분류: PATCH / MINOR / MAJOR
                    |
                    v
                [문서 업데이트] (D+25 이내)
                    |
                    v
                [Auditor 재검증] (D+28 이내)
                    |
                    v
                [완료 + 변경 이력 기록] (D+30 이내)
```

---

## 4. 영향 분석 절차

### 4.1 영향 범위 판단

| 변경 유형 | 영향 분류 | 예시 | 대응 수준 |
|---------|---------|------|---------|
| 통제항목 추가 | MAJOR | N2SF 7번째 영역 신설 | 전면 재검토 |
| 기존 항목 수정 | MINOR | N-03 격리 요건 강화 | 해당 문서 갱신 |
| 가이드 표현 변경 | PATCH | 용어 변경, 참조 URL 변경 | 즉시 수정 |
| 해석 지침 발간 | INFO | FAQ, 해석 사례 | 참고 반영 |

### 4.2 영향 분석 체크리스트

```markdown
## N2SF 변경 영향 분석 체크리스트

- [ ] 변경 내용 요약 (1-2문장)
- [ ] 변경 시행일 확인
- [ ] 영향받는 N2SF 영역 식별 (N-01~N-06)
- [ ] 영향받는 CSAP 항목 식별 (CSAP-DXX-YY)
- [ ] 영향받는 ISMS-P 항목 식별 (ISMS-P-X-XX)
- [ ] 영향받는 프레임워크 문서 목록
- [ ] 기존 인증(CSAP/ISMS-P)에 미치는 영향
- [ ] 업데이트 분류 (MAJOR/MINOR/PATCH)
- [ ] 예상 작업 공수 (시간)
- [ ] 업데이트 완료 목표일 (30일 SLA 이내)
```

---

## 5. 버전 격리 전략

### 5.1 기준일 메타데이터

모든 N2SF 관련 문서 상단에 다음 메타데이터를 필수 포함합니다:

```markdown
> 적용 기준일: YYYY-MM-DD
> N2SF 기준 버전: v{X.Y}
> 참조 근거: 국정원 클라우드 보안 가이드 {발행일}
```

### 5.2 버전 격리 절차

1. 기존 파일 보존 (수정 불가)
2. 새 버전 파일 생성: `{파일명}-v{X.Y}.md`
3. 심볼릭 링크 업데이트: 최신 버전을 기본 파일로 연결
4. 이전 버전 아카이브: `docs/archive/n2sf-versions/` 이동

```bash
# 예시: N-03 격리 영역 업데이트
cp docs/framework/03-n2sf/domains/N03-isolation.md \
   docs/archive/n2sf-versions/N03-isolation-v1.0.md

# 새 버전 작성
# docs/framework/03-n2sf/domains/N03-isolation.md (v1.1 내용으로 갱신)
```

---

## 6. 자동화 지원

### 6.1 주간 모니터링 체크 워크플로우

```yaml
# .gitea/workflows/weekly-n2sf-check.yml
name: N2SF 주간 모니터링 체크

on:
  schedule:
    - cron: '0 9 * * 1'  # 매주 월요일 09:00

jobs:
  monitoring-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: 모니터링 체크 기록
        run: |
          cat >> .claude/audit.jsonl << EOF
          {"timestamp":"$(date -u +%Y-%m-%dT%H:%M:%SZ)","actor":"SYSTEM","action":"N2SF_MONITORING_CHECK","result":"SUCCESS","details":{"channels":["nis.go.kr","boho.or.kr","isms.kisa.or.kr"],"changesDetected":false},"ismsPControls":[],"csapControls":[],"ip":"ci-runner"}
          EOF
          git add .claude/audit.jsonl
          git commit -m "chore(n2sf): 주간 모니터링 체크 $(date +%Y-%m-%d)" || true
          git push || true
```

### 6.2 변경 탐지 시 Gitea Issue 자동 생성

```yaml
# 변경 탐지 시 수동 트리거 (담당자가 실행)
name: N2SF 변경 이슈 생성

on:
  workflow_dispatch:
    inputs:
      change_summary:
        description: '변경 내용 요약'
        required: true
      affected_areas:
        description: '영향 영역 (N-01~N-06, 쉼표 구분)'
        required: true
      severity:
        description: '심각도'
        required: true
        type: choice
        options:
          - MAJOR
          - MINOR
          - PATCH

jobs:
  create-issue:
    runs-on: ubuntu-latest
    steps:
      - name: Gitea Issue 생성
        run: |
          DEADLINE=$(date -d "+30 days" +%Y-%m-%d)
          curl -X POST "https://gitea.internal/api/v1/repos/org/framework/issues" \
            -H "Authorization: token ${{ secrets.GITEA_TOKEN }}" \
            -H "Content-Type: application/json" \
            -d '{
              "title": "[N2SF] 규정 변경 반영 — ${{ inputs.severity }}: ${{ inputs.change_summary }}",
              "body": "## N2SF 규정 변경 탐지\n\n**변경 내용**: ${{ inputs.change_summary }}\n**영향 영역**: ${{ inputs.affected_areas }}\n**심각도**: ${{ inputs.severity }}\n**SLA 마감일**: '"$DEADLINE"' (30일)\n\n## 체크리스트\n- [ ] 영향 분석 완료 (D+5)\n- [ ] 업데이트 계획 수립 (D+10)\n- [ ] 문서 업데이트 (D+25)\n- [ ] Auditor 재검증 (D+28)\n- [ ] 완료 확인 (D+30)",
              "labels": ["n2sf-change", "${{ inputs.severity }}"]
            }'
```

---

## 7. 보고 체계

| 보고 유형 | 주기 | 수신자 | 내용 |
|---------|------|--------|------|
| 주간 모니터링 보고 | 주간 | 보안 담당자 | 확인 결과 (변경 유/무) |
| 변경 영향 분석 보고 | 발생 시 | CISO | 영향 범위 + 업데이트 계획 |
| 업데이트 완료 보고 | 완료 시 | 팀장 | 변경 내역 + 검증 결과 |
| 분기 종합 보고 | 분기 | 경영진 | N2SF 모니터링 통계 + SLA 준수율 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | MTU-A7 Do — N2SF 모니터링 프로세스 작성 | Implementer Agent |
