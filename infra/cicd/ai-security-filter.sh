#!/bin/bash
# AI CI/CD 보안 필터 — PII 마스킹
# Design Ref: MTU-N77 §2
# Plan SC: FR-N77.3
# CSAP 매핑: D-09, N2SF N-05

# N2SF 데이터 등급 검증: O등급만 AI API 전송 허용
# C/S등급 데이터 키워드 차단
check_data_grade() {
  local input="$1"
  # C등급 키워드 차단
  if echo "$input" | grep -qiE '주민등록|주민번호|계좌번호|카드번호|여권번호|운전면허'; then
    echo "ERROR: C등급 데이터 감지됨. AI API 전송 차단." >&2
    return 1
  fi
  # S등급 키워드 차단
  if echo "$input" | grep -qiE '국방|기밀|대외비|1급비밀|2급비밀|3급비밀'; then
    echo "ERROR: S등급 데이터 감지됨. AI API 전송 차단." >&2
    return 1
  fi
  return 0
}

# PII 마스킹 함수
mask_pii() {
  local input="$1"
  echo "$input" | \
    # IP 주소 마스킹
    sed -E 's/[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/[MASKED-IP]/g' | \
    # 이메일 마스킹
    sed -E 's/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/[MASKED-EMAIL]/g' | \
    # API 키 마스킹 (sk-*, ghp_*, ghs_*)
    sed -E 's/(sk-|ghp_|ghs_|glpat-)[a-zA-Z0-9]{20,}/[MASKED-KEY]/g' | \
    # 비밀번호 패턴 마스킹
    sed -E 's/(password|passwd|pwd|secret|token|credential)[=: ]+[^ "'"'"']+/\1=[MASKED-SECRET]/gi' | \
    # 주민등록번호 패턴 마스킹
    sed -E 's/[0-9]{6}-[0-9]{7}/[MASKED-RRN]/g' | \
    # Base64 인코딩 시크릿 패턴 (20자 이상 연속 base64)
    sed -E 's/[A-Za-z0-9+\/]{40,}={0,2}/[MASKED-BASE64]/g'
}

# 메인 실행
if [ "$#" -lt 1 ]; then
  echo "사용법: $0 <입력파일 또는 ->"
  echo "  cat build.log | $0 -"
  echo "  $0 build.log"
  exit 1
fi

INPUT="$1"
if [ "$INPUT" = "-" ]; then
  DATA=$(cat)
else
  DATA=$(cat "$INPUT")
fi

# 1단계: 데이터 등급 검증
if ! check_data_grade "$DATA"; then
  exit 1
fi

# 2단계: PII 마스킹
MASKED=$(mask_pii "$DATA")

# 3단계: 마스킹 결과 출력
echo "$MASKED"
