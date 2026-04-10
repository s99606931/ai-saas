#!/usr/bin/env bash
# =============================================================================
# 포스트모템 자동 생성 스크립트
# Design Ref: MTU-N117 Design SS2.2
# Plan SC: FR-N117.1, FR-N117.2, FR-N117.3, FR-N117.4, FR-N117.5
# CSAP: D-06(침해사고 관리 -- 포스트모템 자동 생성)
#
# 사용법:
#   ./scripts/generate-postmortem.sh \
#     --alert-name "SLORollbackTriggerBurnRate" \
#     --severity "P1" \
#     --category "availability" \
#     --start "2026-04-10T10:00:00Z" \
#     --end "2026-04-10T10:30:00Z" \
#     --namespace "production" \
#     --service "api-server" \
#     --responder "SRE팀"
#
# 또는 대화형 모드:
#   ./scripts/generate-postmortem.sh --interactive
#
# 의존성: curl, jq, date
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# 전역 변수
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUTPUT_DIR="$PROJECT_ROOT/docs/postmortems"
AUDIT_LOG="$PROJECT_ROOT/.claude/audit.jsonl"

PROMETHEUS_URL="${PROMETHEUS_URL:-http://localhost:9090}"
LOKI_URL="${LOKI_URL:-http://localhost:3100}"

# 인시던트 기본값
INCIDENT_ID="INC-$(date +%Y)-$(printf '%03d' $((RANDOM % 999 + 1)))"
ALERT_NAME=""
SEVERITY=""
CATEGORY=""
START_TIME=""
END_TIME=""
NAMESPACE=""
SERVICE=""
RESPONDER=""
INTERACTIVE=false
DRY_RUN=false

# 색상 코드
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# ---------------------------------------------------------------------------
# 로깅 함수
# ---------------------------------------------------------------------------
log_info() { echo -e "${BLUE}[INFO]${NC} $(date '+%H:%M:%S') $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $(date '+%H:%M:%S') $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $(date '+%H:%M:%S') $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $(date '+%H:%M:%S') $1"; }

# ---------------------------------------------------------------------------
# 감사 로그 기록 (CSAP D-06)
# ---------------------------------------------------------------------------
log_audit() {
  local action="$1"
  local detail="$2"
  local entry="{\"timestamp\":\"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\",\"actor\":\"postmortem-generator\",\"action\":\"$action\",\"detail\":\"$detail\",\"incident_id\":\"$INCIDENT_ID\"}"
  echo "$entry" >> "$AUDIT_LOG" 2>/dev/null || true
}

# ---------------------------------------------------------------------------
# 사용법
# ---------------------------------------------------------------------------
usage() {
  cat <<'USAGE'
사용법: generate-postmortem.sh [옵션]

필수 옵션:
  --alert-name NAME     알림 이름 (예: SLORollbackTriggerBurnRate)
  --severity LEVEL      심각도 (P1|P2|P3|P4)
  --category CAT        카테고리 (security|availability|performance|infrastructure|deployment|data)
  --start TIME          인시던트 시작 시각 (ISO 8601)
  --end TIME            인시던트 종료 시각 (ISO 8601)

선택 옵션:
  --namespace NS        쿠버네티스 네임스페이스 (기본: production)
  --service SVC         영향 받은 서비스명
  --responder NAME      대응 담당자
  --incident-id ID      인시던트 ID (자동 생성됨)
  --output-dir DIR      출력 디렉토리 (기본: docs/postmortems/)
  --interactive         대화형 모드
  --dry-run             실제 API 호출 없이 템플릿만 생성
  -h, --help            도움말
USAGE
  exit 0
}

# ---------------------------------------------------------------------------
# 인수 파싱
# ---------------------------------------------------------------------------
parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --alert-name)   ALERT_NAME="$2"; shift 2 ;;
      --severity)     SEVERITY="$2"; shift 2 ;;
      --category)     CATEGORY="$2"; shift 2 ;;
      --start)        START_TIME="$2"; shift 2 ;;
      --end)          END_TIME="$2"; shift 2 ;;
      --namespace)    NAMESPACE="$2"; shift 2 ;;
      --service)      SERVICE="$2"; shift 2 ;;
      --responder)    RESPONDER="$2"; shift 2 ;;
      --incident-id)  INCIDENT_ID="$2"; shift 2 ;;
      --output-dir)   OUTPUT_DIR="$2"; shift 2 ;;
      --interactive)  INTERACTIVE=true; shift ;;
      --dry-run)      DRY_RUN=true; shift ;;
      -h|--help)      usage ;;
      *)              log_error "알 수 없는 옵션: $1"; usage ;;
    esac
  done
}

# ---------------------------------------------------------------------------
# 입력 검증 (CSAP D-12: 입력 검증)
# ---------------------------------------------------------------------------
validate_inputs() {
  local errors=0

  if [[ -z "$ALERT_NAME" ]]; then
    log_error "알림 이름(--alert-name)은 필수입니다"
    errors=$((errors + 1))
  fi

  if [[ -z "$SEVERITY" ]]; then
    log_error "심각도(--severity)는 필수입니다"
    errors=$((errors + 1))
  elif [[ ! "$SEVERITY" =~ ^P[1-4]$ ]]; then
    log_error "심각도는 P1~P4 중 하나여야 합니다: $SEVERITY"
    errors=$((errors + 1))
  fi

  if [[ -z "$CATEGORY" ]]; then
    log_error "카테고리(--category)는 필수입니다"
    errors=$((errors + 1))
  elif [[ ! "$CATEGORY" =~ ^(security|availability|performance|infrastructure|deployment|data)$ ]]; then
    log_error "카테고리가 올바르지 않습니다: $CATEGORY"
    errors=$((errors + 1))
  fi

  if [[ -z "$START_TIME" ]]; then
    log_error "시작 시각(--start)은 필수입니다"
    errors=$((errors + 1))
  fi

  if [[ -z "$END_TIME" ]]; then
    log_error "종료 시각(--end)은 필수입니다"
    errors=$((errors + 1))
  fi

  if [[ $errors -gt 0 ]]; then
    log_error "$errors 개의 입력 오류 발견. --help를 참조하세요."
    exit 1
  fi

  # 기본값 설정
  NAMESPACE="${NAMESPACE:-production}"
  SERVICE="${SERVICE:-unknown}"
  RESPONDER="${RESPONDER:-미지정}"
}

# ---------------------------------------------------------------------------
# 대화형 모드
# ---------------------------------------------------------------------------
interactive_mode() {
  echo -e "${CYAN}========================================${NC}"
  echo -e "${CYAN}  포스트모템 자동 생성 (대화형 모드)${NC}"
  echo -e "${CYAN}========================================${NC}"
  echo ""

  read -rp "알림 이름: " ALERT_NAME
  read -rp "심각도 (P1/P2/P3/P4): " SEVERITY
  read -rp "카테고리 (security/availability/performance/infrastructure/deployment/data): " CATEGORY
  read -rp "인시던트 시작 시각 (ISO 8601, 예: 2026-04-10T10:00:00Z): " START_TIME
  read -rp "인시던트 종료 시각 (ISO 8601): " END_TIME
  read -rp "네임스페이스 [production]: " NAMESPACE
  read -rp "서비스명 [unknown]: " SERVICE
  read -rp "대응 담당자: " RESPONDER
}

# ---------------------------------------------------------------------------
# 지속 시간 계산
# ---------------------------------------------------------------------------
calculate_duration() {
  local start_epoch end_epoch duration_seconds
  start_epoch=$(date -d "$START_TIME" +%s 2>/dev/null || echo 0)
  end_epoch=$(date -d "$END_TIME" +%s 2>/dev/null || echo 0)

  if [[ $start_epoch -eq 0 || $end_epoch -eq 0 ]]; then
    echo "계산 불가"
    return
  fi

  duration_seconds=$((end_epoch - start_epoch))

  if [[ $duration_seconds -lt 60 ]]; then
    echo "${duration_seconds}초"
  elif [[ $duration_seconds -lt 3600 ]]; then
    echo "$((duration_seconds / 60))분 $((duration_seconds % 60))초"
  else
    echo "$((duration_seconds / 3600))시간 $(((duration_seconds % 3600) / 60))분"
  fi
}

# ---------------------------------------------------------------------------
# Prometheus에서 타임라인 추출 (FR-N117.2)
# ---------------------------------------------------------------------------
extract_prometheus_timeline() {
  log_info "Prometheus에서 인시던트 타임라인 추출 중..."

  if [[ "$DRY_RUN" == true ]]; then
    log_info "[DRY-RUN] Prometheus API 호출 건너뜀"
    echo "| $START_TIME | 알림 발생: $ALERT_NAME ($SEVERITY) | Prometheus |"
    echo "| $END_TIME | 알림 해소: $ALERT_NAME | Prometheus |"
    return
  fi

  local start_epoch end_epoch
  start_epoch=$(date -d "$START_TIME" +%s 2>/dev/null || echo 0)
  end_epoch=$(date -d "$END_TIME" +%s 2>/dev/null || echo 0)

  # ALERTS 메트릭에서 활성 알림 조회
  local alerts_result
  alerts_result=$(curl -sf --max-time 10 \
    "${PROMETHEUS_URL}/api/v1/query_range?query=ALERTS%7Balertname%3D%22${ALERT_NAME}%22%7D&start=${start_epoch}&end=${end_epoch}&step=60s" \
    2>/dev/null || echo '{"status":"error"}')

  if echo "$alerts_result" | jq -e '.status == "success"' > /dev/null 2>&1; then
    log_success "Prometheus API 응답 성공"
    local values
    values=$(echo "$alerts_result" | jq -r '.data.result[0].values // [] | .[] | "\(.[0]) \(.[1])"' 2>/dev/null)

    local prev_state="0"
    while read -r ts val; do
      [[ -z "$ts" ]] && continue
      local readable_time
      readable_time=$(date -d "@${ts%.*}" '+%Y-%m-%d %H:%M:%S' 2>/dev/null || echo "$ts")

      if [[ "$val" == "1" && "$prev_state" == "0" ]]; then
        echo "| ${readable_time} | 알림 발생: ${ALERT_NAME} (${SEVERITY}) | Prometheus |"
      elif [[ "$val" == "0" && "$prev_state" == "1" ]]; then
        echo "| ${readable_time} | 알림 해소: ${ALERT_NAME} | Prometheus |"
      fi
      prev_state="$val"
    done <<< "$values"
  else
    log_warn "Prometheus API 응답 실패, 기본 타임라인 사용"
    echo "| $START_TIME | 알림 발생: $ALERT_NAME ($SEVERITY) | Prometheus |"
    echo "| $END_TIME | 알림 해소: $ALERT_NAME | Prometheus |"
  fi
}

# ---------------------------------------------------------------------------
# 카테고리별 5 Whys 기본 질문 생성 (FR-N117.3)
# ---------------------------------------------------------------------------
generate_five_whys_questions() {
  local cat="$1"

  case "$cat" in
    security)
      echo "어떤 보안 이벤트가 감지되었는가?"
      echo "해당 접근/행위가 왜 가능했는가?"
      echo "접근 통제 정책에 어떤 누락이 있었는가?"
      echo "정책 검토 프로세스가 왜 이를 발견하지 못했는가?"
      echo "보안 테스트/감사 체계에 어떤 공백이 있었는가?"
      ;;
    availability)
      echo "어떤 서비스/컴포넌트가 중단되었는가?"
      echo "해당 컴포넌트가 왜 실패했는가?"
      echo "리소스 한도 설정이 왜 부적절했는가?"
      echo "용량 계획이 왜 이를 예측하지 못했는가?"
      echo "모니터링/알림이 왜 사전에 경고하지 못했는가?"
      ;;
    performance)
      echo "어떤 성능 지표가 SLO를 위반했는가?"
      echo "해당 지표가 왜 저하되었는가?"
      echo "성능 저하 원인이 왜 사전에 방지되지 않았는가?"
      echo "부하 테스트가 왜 이 시나리오를 검증하지 못했는가?"
      echo "오토스케일링이 왜 적절히 대응하지 못했는가?"
      ;;
    infrastructure)
      echo "어떤 인프라 컴포넌트가 실패했는가?"
      echo "해당 컴포넌트의 장애 원인은 무엇인가?"
      echo "이중화/장애 복구 체계가 왜 작동하지 않았는가?"
      echo "인프라 점검 프로세스에 어떤 누락이 있었는가?"
      echo "인프라 설계에 어떤 단일 장애점이 존재하는가?"
      ;;
    deployment)
      echo "어떤 배포가 문제를 일으켰는가?"
      echo "해당 변경이 왜 장애를 유발했는가?"
      echo "CI/CD 파이프라인이 왜 이를 사전에 감지하지 못했는가?"
      echo "카나리/블루-그린 배포가 왜 작동하지 않았는가?"
      echo "배포 정책/절차에 어떤 공백이 있었는가?"
      ;;
    data)
      echo "어떤 데이터 이상이 발생했는가?"
      echo "데이터 이상의 원인은 무엇인가?"
      echo "데이터 무결성 검증이 왜 이를 감지하지 못했는가?"
      echo "백업/복구 절차가 왜 즉시 적용되지 못했는가?"
      echo "데이터 거버넌스 체계에 어떤 공백이 있었는가?"
      ;;
  esac
}

# ---------------------------------------------------------------------------
# 개선 조치 자동 생성 (FR-N117.4)
# ---------------------------------------------------------------------------
generate_improvement_actions() {
  local cat="$1"
  local sev="$2"

  echo "### 6.1 단기 조치 (1주일 이내)"
  echo ""
  echo "| 번호 | 조치 내용 | 담당자 | 기한 | 상태 |"
  echo "|------|----------|-------|------|------|"

  case "$cat" in
    security)
      echo "| 1 | 관련 접근 통제 정책 즉시 강화 | 보안팀 | +1일 | 대기 |"
      echo "| 2 | 영향 받은 계정/서비스 접근 권한 검토 | 보안팀 | +3일 | 대기 |"
      ;;
    availability)
      echo "| 1 | Liveness/Readiness probe 타임아웃 조정 | SRE팀 | +1일 | 대기 |"
      echo "| 2 | 리소스 Request/Limit 재조정 | SRE팀 | +3일 | 대기 |"
      ;;
    performance)
      echo "| 1 | 병목 쿼리/엔드포인트 최적화 | 개발팀 | +3일 | 대기 |"
      echo "| 2 | 캐시 전략 검토 및 적용 | 개발팀 | +5일 | 대기 |"
      ;;
    infrastructure)
      echo "| 1 | 장애 컴포넌트 이중화 구성 확인 | 인프라팀 | +1일 | 대기 |"
      echo "| 2 | 디스크/메모리 용량 여유 확보 | 인프라팀 | +3일 | 대기 |"
      ;;
    deployment)
      echo "| 1 | 배포 파이프라인 롤백 테스트 | DevOps팀 | +1일 | 대기 |"
      echo "| 2 | 카나리 배포 비율/기준 조정 | DevOps팀 | +3일 | 대기 |"
      ;;
    data)
      echo "| 1 | 데이터 무결성 검증 스크립트 실행 | DBA팀 | +1일 | 대기 |"
      echo "| 2 | 백업 복구 절차 테스트 | DBA팀 | +3일 | 대기 |"
      ;;
  esac

  echo ""
  echo "### 6.2 중기 조치 (1개월 이내)"
  echo ""
  echo "| 번호 | 조치 내용 | 담당자 | 기한 | 상태 |"
  echo "|------|----------|-------|------|------|"
  echo "| 1 | 관련 알림 규칙 임계값 재검토 | SRE팀 | +2주 | 대기 |"
  echo "| 2 | 런북 업데이트 (이번 인시던트 반영) | SRE팀 | +2주 | 대기 |"
  echo "| 3 | 관련 E2E 테스트 시나리오 추가 | QA팀 | +3주 | 대기 |"

  echo ""
  echo "### 6.3 장기 조치 (분기 이내)"
  echo ""
  echo "| 번호 | 조치 내용 | 담당자 | 기한 | 상태 |"
  echo "|------|----------|-------|------|------|"
  echo "| 1 | 아키텍처 취약점 분석 및 개선 | 아키텍트 | +2개월 | 대기 |"

  if [[ "$sev" == "P1" ]]; then
    echo "| 2 | 카오스 엔지니어링 시나리오 추가 (재현 테스트) | SRE팀 | +2개월 | 대기 |"
  fi
}

# ---------------------------------------------------------------------------
# 포스트모템 문서 생성
# ---------------------------------------------------------------------------
generate_postmortem() {
  log_info "포스트모템 문서 생성 시작..."
  log_audit "POSTMORTEM_GENERATE_START" "incident=$INCIDENT_ID alert=$ALERT_NAME severity=$SEVERITY"

  mkdir -p "$OUTPUT_DIR"

  # 타임라인 추출
  local timeline
  timeline=$(extract_prometheus_timeline)

  # 지속 시간 계산
  local duration
  duration=$(calculate_duration)

  # 5 Whys 질문 생성
  local whys
  whys=$(generate_five_whys_questions "$CATEGORY")
  local why_array=()
  while IFS= read -r line; do
    why_array+=("$line")
  done <<< "$whys"

  # 영향도 판단
  local impact_scope
  case "$SEVERITY" in
    P1) impact_scope="전체 서비스" ;;
    P2) impact_scope="단일 서비스" ;;
    P3) impact_scope="부분 기능" ;;
    P4) impact_scope="비프로덕션" ;;
  esac

  # 카테고리 한글
  local category_ko
  case "$CATEGORY" in
    security)        category_ko="보안" ;;
    availability)    category_ko="가용성" ;;
    performance)     category_ko="성능" ;;
    infrastructure)  category_ko="인프라" ;;
    deployment)      category_ko="배포" ;;
    data)            category_ko="데이터" ;;
  esac

  # 개선 조치 생성
  local actions
  actions=$(generate_improvement_actions "$CATEGORY" "$SEVERITY")

  # 출력 파일
  local output_file="$OUTPUT_DIR/${INCIDENT_ID}.md"
  local generated_at
  generated_at=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  cat > "$output_file" << POSTMORTEM
# 포스트모템 보고서

> CSAP: D-06(침해사고 관리 -- 포스트모템 기록)
> 생성일: ${generated_at}
> 생성 도구: scripts/generate-postmortem.sh

---

## 1. 인시던트 요약

| 항목 | 내용 |
|------|------|
| 인시던트 ID | ${INCIDENT_ID} |
| 제목 | ${ALERT_NAME} |
| 심각도 | ${SEVERITY} |
| 카테고리 | ${category_ko} (${CATEGORY}) |
| 영향 범위 | ${impact_scope} |
| 시작 시각 | ${START_TIME} |
| 종료 시각 | ${END_TIME} |
| 지속 시간 | ${duration} |
| 감지 방법 | Prometheus AlertManager 자동 감지 |
| 대응 담당자 | ${RESPONDER} |
| MTTR | ${duration} |
| 상태 | 해소 (Resolved) |

---

## 2. 인시던트 타임라인

> 자동 추출 시각: ${generated_at}

| 시각 | 이벤트 | 출처 |
|------|-------|------|
${timeline}

---

## 3. 영향 분석

### 3.1 사용자 영향

| 항목 | 내용 |
|------|------|
| 영향 받은 서비스 | ${SERVICE} |
| 네임스페이스 | ${NAMESPACE} |
| SLA 위반 여부 | (분석 필요) |
| 에러 예산 소진량 | (분석 필요) |

### 3.2 메트릭 변화

| 메트릭 | 인시던트 전 | 인시던트 중 | 인시던트 후 |
|--------|-----------|-----------|-----------|
| 에러율 (5xx) | (분석 필요) | (분석 필요) | (분석 필요) |
| P99 지연 (초) | (분석 필요) | (분석 필요) | (분석 필요) |
| 가용성 (%) | (분석 필요) | (분석 필요) | (분석 필요) |

---

## 4. 근본 원인 분석 (5 Whys)

### 질문 체인

| 단계 | 질문 | 답변 |
|------|------|------|
| Why 1 | ${why_array[0]:-분석 필요} | (분석 후 작성) |
| Why 2 | ${why_array[1]:-분석 필요} | (분석 후 작성) |
| Why 3 | ${why_array[2]:-분석 필요} | (분석 후 작성) |
| Why 4 | ${why_array[3]:-분석 필요} | (분석 후 작성) |
| Why 5 | ${why_array[4]:-분석 필요} | (분석 후 작성) |

### 근본 원인 요약

| 항목 | 내용 |
|------|------|
| 근본 원인 유형 | (분석 후 작성: 사람/프로세스/기술) |
| 근본 원인 설명 | (분석 후 작성) |
| 기여 요인 | (분석 후 작성) |

---

## 5. 대응 이력

| 시각 | 담당자 | 조치 내용 | 결과 |
|------|-------|----------|------|
| ${START_TIME} | AlertManager | 자동 알림 발송 | 전달 완료 |
| | ${RESPONDER} | 인시던트 확인 및 대응 시작 | 진행 |
| ${END_TIME} | ${RESPONDER} | 인시던트 해소 확인 | 완료 |

---

## 6. 개선 조치

${actions}

---

## 7. 교훈 (Lessons Learned)

### 7.1 잘된 점

(포스트모템 검토 시 작성)

### 7.2 개선이 필요한 점

(포스트모템 검토 시 작성)

### 7.3 행운이었던 점

(포스트모템 검토 시 작성)

---

## 8. 감사 추적 (CSAP D-06)

| 항목 | 내용 |
|------|------|
| 감사 로그 경로 | \`.claude/audit.jsonl\` |
| 관련 알림 규칙 | \`infra/monitoring/incident-classification-rules.yaml\` |
| 포스트모템 생성자 | \`scripts/generate-postmortem.sh\` |
| 검증 스크립트 | \`scripts/test-auto-postmortem.sh\` |

---

## 9. 검토 이력

| 일자 | 검토자 | 의견 | 승인 |
|------|-------|------|------|
| (검토 후 기록) | | | |

---

> 이 문서는 scripts/generate-postmortem.sh에 의해 자동 생성되었습니다.
> 행안부 정보시스템 감리기준(고시 제2023-1호) 준수
POSTMORTEM

  log_success "포스트모템 생성 완료: $output_file"
  log_audit "POSTMORTEM_GENERATE_COMPLETE" "output=$output_file incident=$INCIDENT_ID"

  # 결과 요약
  echo ""
  echo -e "${CYAN}========================================${NC}"
  echo -e "${CYAN}  포스트모템 생성 결과${NC}"
  echo -e "${CYAN}========================================${NC}"
  echo -e "  인시던트 ID:  ${GREEN}${INCIDENT_ID}${NC}"
  echo -e "  심각도:       ${SEVERITY}"
  echo -e "  카테고리:     ${category_ko}"
  echo -e "  지속 시간:    ${duration}"
  echo -e "  출력 파일:    ${GREEN}${output_file}${NC}"
  echo -e "${CYAN}========================================${NC}"
}

# ---------------------------------------------------------------------------
# 메인
# ---------------------------------------------------------------------------
main() {
  parse_args "$@"

  if [[ "$INTERACTIVE" == true ]]; then
    interactive_mode
  fi

  validate_inputs
  generate_postmortem
}

main "$@"
