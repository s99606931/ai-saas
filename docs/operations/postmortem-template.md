# 포스트모템 보고서

> Design Ref: MTU-N117 Design SS2.1
> Plan SC: FR-N117.1
> CSAP: D-06(침해사고 관리 -- 포스트모템 기록)
> 생성일: {{GENERATED_AT}}

---

## 1. 인시던트 요약

| 항목 | 내용 |
|------|------|
| 인시던트 ID | {{INCIDENT_ID}} |
| 제목 | {{INCIDENT_TITLE}} |
| 심각도 | {{SEVERITY}} |
| 카테고리 | {{CATEGORY}} |
| 영향 범위 | {{IMPACT_SCOPE}} |
| 시작 시각 | {{START_TIME}} |
| 종료 시각 | {{END_TIME}} |
| 지속 시간 | {{DURATION}} |
| 감지 방법 | {{DETECTION_METHOD}} |
| 대응 담당자 | {{RESPONDER}} |
| MTTR | {{MTTR}} |
| 상태 | {{STATUS}} |

---

## 2. 인시던트 타임라인

> 자동 추출 시각: {{TIMELINE_GENERATED_AT}}

| 시각 | 이벤트 | 출처 |
|------|-------|------|
{{TIMELINE_ENTRIES}}

---

## 3. 영향 분석

### 3.1 사용자 영향

| 항목 | 내용 |
|------|------|
| 영향 받은 사용자 수 | {{AFFECTED_USERS}} |
| 영향 받은 서비스 | {{AFFECTED_SERVICES}} |
| SLA 위반 여부 | {{SLA_VIOLATED}} |
| 에러 예산 소진량 | {{ERROR_BUDGET_CONSUMED}} |

### 3.2 메트릭 변화

| 메트릭 | 인시던트 전 | 인시던트 중 | 인시던트 후 |
|--------|-----------|-----------|-----------|
| 에러율 (5xx) | {{METRIC_ERROR_BEFORE}} | {{METRIC_ERROR_DURING}} | {{METRIC_ERROR_AFTER}} |
| P99 지연 (초) | {{METRIC_LATENCY_BEFORE}} | {{METRIC_LATENCY_DURING}} | {{METRIC_LATENCY_AFTER}} |
| 가용성 (%) | {{METRIC_AVAIL_BEFORE}} | {{METRIC_AVAIL_DURING}} | {{METRIC_AVAIL_AFTER}} |
| CPU 사용률 (%) | {{METRIC_CPU_BEFORE}} | {{METRIC_CPU_DURING}} | {{METRIC_CPU_AFTER}} |
| 메모리 사용률 (%) | {{METRIC_MEM_BEFORE}} | {{METRIC_MEM_DURING}} | {{METRIC_MEM_AFTER}} |

---

## 4. 근본 원인 분석 (5 Whys)

### 질문 체인

| 단계 | 질문 | 답변 |
|------|------|------|
| Why 1 | {{WHY1_Q}} | {{WHY1_A}} |
| Why 2 | {{WHY2_Q}} | {{WHY2_A}} |
| Why 3 | {{WHY3_Q}} | {{WHY3_A}} |
| Why 4 | {{WHY4_Q}} | {{WHY4_A}} |
| Why 5 | {{WHY5_Q}} | {{WHY5_A}} |

### 근본 원인 요약

| 항목 | 내용 |
|------|------|
| 근본 원인 유형 | {{ROOT_CAUSE_TYPE}} |
| 근본 원인 설명 | {{ROOT_CAUSE_DESCRIPTION}} |
| 기여 요인 | {{CONTRIBUTING_FACTORS}} |

> 근본 원인 유형: 사람(Human) / 프로세스(Process) / 기술(Technology)

---

## 5. 대응 이력

| 시각 | 담당자 | 조치 내용 | 결과 |
|------|-------|----------|------|
{{RESPONSE_ENTRIES}}

---

## 6. 개선 조치

### 6.1 단기 조치 (1주일 이내)

| 번호 | 조치 내용 | 담당자 | 기한 | 상태 |
|------|----------|-------|------|------|
{{SHORT_TERM_ACTIONS}}

### 6.2 중기 조치 (1개월 이내)

| 번호 | 조치 내용 | 담당자 | 기한 | 상태 |
|------|----------|-------|------|------|
{{MID_TERM_ACTIONS}}

### 6.3 장기 조치 (분기 이내)

| 번호 | 조치 내용 | 담당자 | 기한 | 상태 |
|------|----------|-------|------|------|
{{LONG_TERM_ACTIONS}}

---

## 7. 교훈 (Lessons Learned)

### 7.1 잘된 점

{{WHAT_WENT_WELL}}

### 7.2 개선이 필요한 점

{{WHAT_NEEDS_IMPROVEMENT}}

### 7.3 행운이었던 점

{{WHERE_WE_GOT_LUCKY}}

---

## 8. 감사 추적 (CSAP D-06)

| 항목 | 내용 |
|------|------|
| 감사 로그 경로 | `.claude/audit.jsonl` |
| 관련 알림 규칙 | `infra/monitoring/incident-classification-rules.yaml` |
| 관련 대시보드 | `infra/monitoring/dashboards/incident-management.json` |
| 포스트모템 생성자 | `scripts/generate-postmortem.sh` |
| 검증 스크립트 | `scripts/test-auto-postmortem.sh` |

---

## 9. 검토 이력

| 일자 | 검토자 | 의견 | 승인 |
|------|-------|------|------|
{{REVIEW_ENTRIES}}

---

> 이 문서는 `scripts/generate-postmortem.sh`에 의해 자동 생성되었습니다.
> 행안부 정보시스템 감리기준(고시 제2023-1호) 준수
