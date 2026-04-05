#!/bin/bash
# archive-auto-commit.sh
# Claude Code PostToolUse 훅 — archive 디렉터리에 report.md 추가 시 자동 git 커밋
#
# 트리거: Write 도구로 docs/archive/**/*.report.md 작성 완료 시
# 동작1:  해당 MTU 아카이브 디렉터리 전체 자동 스테이징 후 커밋
# 동작2:  PDCA 진행 폴더(01-plan, 02-design, 03-analysis, 03-report, 04-report)의
#         동일 MTU 파일을 git rm으로 정리 후 커밋

set -euo pipefail

# CLAUDE_TOOL_INPUT 환경변수에서 file_path 추출
FILE_PATH=$(echo "${CLAUDE_TOOL_INPUT:-}" | python3 -c "
import json, sys
try:
    d = json.loads(sys.stdin.read())
    print(d.get('file_path', ''))
except Exception:
    print('')
" 2>/dev/null || echo "")

# archive 경로가 아니면 종료
if [[ "$FILE_PATH" != docs/archive/* ]]; then
  exit 0
fi

# report.md 파일만 커밋 트리거 (완료 신호)
if [[ "$FILE_PATH" != *".report.md" ]]; then
  exit 0
fi

# 아카이브 디렉터리 (상위 폴더)
ARCHIVE_DIR=$(dirname "$FILE_PATH")
DIR_NAME=$(basename "$ARCHIVE_DIR")

# 레포 루트로 이동
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo "/data/ai-saas")
cd "$REPO_ROOT"

# 스테이징할 신규 파일이 있는지 확인
PENDING=$(git status --short "$ARCHIVE_DIR" 2>/dev/null | grep -cE "^\?\?" || true)
if [[ "${PENDING:-0}" -eq 0 ]]; then
  # 이미 커밋된 상태이면 종료
  exit 0
fi

# MTU ID 추출 (예: MTU-C1-csap-master-checklist → MTU-C1)
MTU_ID=$(echo "$DIR_NAME" | grep -oE "MTU-[A-Z][0-9a-z]+" 2>/dev/null | head -1 || echo "$DIR_NAME")

# 아카이브 디렉터리 전체 스테이징
git add "$ARCHIVE_DIR/"

# 매칭 설계 문서가 미커밋 상태면 함께 스테이징
DESIGN_FILE="docs/02-design/mtus/${DIR_NAME}.design.md"
if [[ -f "$DESIGN_FILE" ]]; then
  DESIGN_STATUS=$(git status --short "$DESIGN_FILE" 2>/dev/null || echo "")
  if echo "$DESIGN_STATUS" | grep -qE "^\?\?"; then
    git add "$DESIGN_FILE"
  fi
fi

# report.md 첫 번째 H1 제목 추출
TITLE=$(grep -m1 "^# " "$FILE_PATH" 2>/dev/null | sed 's/^# //' | head -c 60 || echo "$DIR_NAME PDCA 완료")

# 감사 로그 기록
echo "{\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"event\":\"archive-auto-commit\",\"mtu\":\"${MTU_ID}\",\"dir\":\"${ARCHIVE_DIR}\"}" \
  >> .claude/audit.jsonl 2>/dev/null || true

# 자동 커밋 (아카이브)
git commit -m "$(cat <<EOF
archive(${MTU_ID}): ${TITLE}

auto-committed by PostToolUse archive hook (report.md 완료 신호)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"

echo "[archive-hook] 아카이브 커밋 완료: archive(${MTU_ID}) — ${TITLE}"

# ── PDCA 진행 파일 정리 ──────────────────────────────────────────────────────
# 아카이브 완료 후 PDCA 진행 폴더의 동일 MTU 파일을 git rm으로 제거

PDCA_TARGETS=()
for f in \
  "docs/01-plan/mtus/${DIR_NAME}.plan.md" \
  "docs/02-design/mtus/${DIR_NAME}.design.md" \
  "docs/03-analysis/features/${DIR_NAME}.analysis.md" \
  "docs/03-report/mtus/${MTU_ID}.report.md" \
  "docs/04-report/features/${DIR_NAME}.report.md" \
  "docs/04-report/${DIR_NAME}.report.md"; do
  if [[ -f "$f" ]]; then
    PDCA_TARGETS+=("$f")
  fi
done

if [[ ${#PDCA_TARGETS[@]} -gt 0 ]]; then
  git rm "${PDCA_TARGETS[@]}"
  git commit -m "$(cat <<EOF
refactor(docs): ${MTU_ID} PDCA 진행 파일 ${#PDCA_TARGETS[@]}개 정리 (아카이브 완료)

아카이브 경로: ${ARCHIVE_DIR}
제거 파일: ${PDCA_TARGETS[*]}

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
  echo "[archive-hook] PDCA 파일 정리 완료: ${MTU_ID} (${#PDCA_TARGETS[@]}개 제거)"
else
  echo "[archive-hook] PDCA 정리 대상 없음: ${MTU_ID}"
fi
