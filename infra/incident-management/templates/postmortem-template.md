# 인시던트 포스트모템 보고서

> 인시던트 ID: ${INCIDENT_ID}
> 심각도: ${SEVERITY}
> 상태: ${STATUS}
> 작성일: ${DATE}

## 1. 인시던트 개요

| 항목 | 내용 |
|------|------|
| 제목 | ${TITLE} |
| 심각도 | ${SEVERITY} (SEV1: 서비스 중단 / SEV2: 성능 저하 / SEV3: 부분 장애 / SEV4: 경미) |
| 영향 범위 | ${IMPACT_SCOPE} |
| 영향 서비스 | ${AFFECTED_SERVICES} |
| 감지 시각 | ${DETECTED_AT} |
| 완화 시각 | ${MITIGATED_AT} |
| 해결 시각 | ${RESOLVED_AT} |
| MTTR | ${MTTR} |
| 담당자 | ${OWNER} |

## 2. 타임라인

| 시각 | 이벤트 | 조치 |
|------|--------|------|
${TIMELINE_ENTRIES}

## 3. 근본 원인 분석 (5 Whys)

### Why 1: 직접 원인
${WHY_1}

### Why 2: 중간 원인
${WHY_2}

### Why 3: 근본 원인 접근
${WHY_3}

### Why 4: 시스템적 원인
${WHY_4}

### Why 5: 근본 원인
${WHY_5}

## 4. 영향도 분석

| 지표 | 인시던트 전 | 인시던트 중 | 복구 후 |
|------|----------|----------|--------|
| 에러율 | ${ERR_BEFORE}% | ${ERR_DURING}% | ${ERR_AFTER}% |
| P95 지연시간 | ${LAT_BEFORE}ms | ${LAT_DURING}ms | ${LAT_AFTER}ms |
| 가용성 | ${AVAIL_BEFORE}% | ${AVAIL_DURING}% | ${AVAIL_AFTER}% |
| 영향 사용자 | - | ${AFFECTED_USERS} | - |

## 5. 개선 조치

| ID | 조치 | 담당 | 기한 | 상태 |
|----|------|------|------|------|
${ACTION_ITEMS}

## 6. 교훈 (Lessons Learned)

### 잘된 점
${WENT_WELL}

### 개선이 필요한 점
${NEEDS_IMPROVEMENT}

### 행운이었던 점
${GOT_LUCKY}

## 7. CSAP 준수 확인

| 통제항목 | 내용 | 준수 여부 |
|---------|------|----------|
| D-06-01 | 인시던트 탐지 및 보고 | ${CSAP_D06_01} |
| D-06-02 | 인시던트 분류 및 우선순위 | ${CSAP_D06_02} |
| D-06-03 | 인시던트 대응 및 복구 | ${CSAP_D06_03} |
| D-06-04 | 사후 분석 및 개선 | ${CSAP_D06_04} |
| D-06-05 | 감사 기록 보존 | ${CSAP_D06_05} |

---
_이 문서는 자동 생성되었습니다. 검토 후 승인이 필요합니다._
_CSAP D-06 침해사고 관리 준수_
