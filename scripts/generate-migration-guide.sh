#!/bin/bash
# generate-migration-guide.sh — 마이그레이션 가이드 자동 생성
# Design Ref: MTU-N94 Design §2
# Plan SC: FR-N94.2, FR-N94.3

set -euo pipefail

PREVIOUS_TAG="${1:-$(git describe --tags --abbrev=0 2>/dev/null || echo 'HEAD~50')}"
CURRENT_TAG="${2:-HEAD}"
OUTPUT_FILE="${3:-docs/release/MIGRATION-GUIDE-$(date +%Y%m%d).md}"

echo "=========================================="
echo "  마이그레이션 가이드 자동 생성"
echo "  범위: $PREVIOUS_TAG..$CURRENT_TAG"
echo "=========================================="

# BREAKING CHANGE 커밋 수집
BREAKING=$(git log "$PREVIOUS_TAG".."$CURRENT_TAG" --grep="BREAKING" --format="%s%n%b" 2>/dev/null || echo "")

# Helm values 변경 감지
HELM_CHANGES=$(git diff "$PREVIOUS_TAG".."$CURRENT_TAG" -- "infra/helm/**/values.yaml" "infra/helm/**/*.yaml" 2>/dev/null | head -100 || echo "")

# API 변경 감지
API_CHANGES=$(git diff "$PREVIOUS_TAG".."$CURRENT_TAG" -- "src/**/routes/**" "src/**/api/**" "packages/**/routes/**" 2>/dev/null | grep "^[+-].*path\|^[+-].*route\|^[+-].*endpoint" | head -30 || echo "")

# DB 마이그레이션 파일 감지
DB_MIGRATIONS=$(git diff "$PREVIOUS_TAG".."$CURRENT_TAG" --name-only -- "migrations/" "src/**/migration*" 2>/dev/null || echo "")

mkdir -p "$(dirname "$OUTPUT_FILE")"

cat > "$OUTPUT_FILE" << HEREDOC
# 마이그레이션 가이드

> **대상 버전**: ${PREVIOUS_TAG} -> ${CURRENT_TAG}
> **생성일**: $(date +%Y-%m-%d)
> **자동 생성**: generate-migration-guide.sh

---

## 1. 사전 준비

- [ ] 현재 환경 백업 완료 (Velero 또는 DB 백업)
- [ ] 릴리스 노트 확인 완료
- [ ] 스테이징 환경 테스트 완료
- [ ] 롤백 계획 수립 완료

## 2. 파괴적 변경사항 (Breaking Changes)

HEREDOC

if [ -n "$BREAKING" ]; then
    echo "$BREAKING" | while IFS= read -r line; do
        [ -n "$line" ] && echo "- $line" >> "$OUTPUT_FILE"
    done
else
    echo "*파괴적 변경사항 없음*" >> "$OUTPUT_FILE"
fi

cat >> "$OUTPUT_FILE" << HEREDOC

## 3. Helm 차트 변경사항

HEREDOC

if [ -n "$HELM_CHANGES" ]; then
    echo '```diff' >> "$OUTPUT_FILE"
    echo "$HELM_CHANGES" >> "$OUTPUT_FILE"
    echo '```' >> "$OUTPUT_FILE"
else
    echo "*Helm values 변경 없음*" >> "$OUTPUT_FILE"
fi

cat >> "$OUTPUT_FILE" << HEREDOC

## 4. API 변경사항

HEREDOC

if [ -n "$API_CHANGES" ]; then
    echo '```diff' >> "$OUTPUT_FILE"
    echo "$API_CHANGES" >> "$OUTPUT_FILE"
    echo '```' >> "$OUTPUT_FILE"
else
    echo "*API 변경 없음*" >> "$OUTPUT_FILE"
fi

cat >> "$OUTPUT_FILE" << HEREDOC

## 5. 데이터베이스 마이그레이션

HEREDOC

if [ -n "$DB_MIGRATIONS" ]; then
    echo "$DB_MIGRATIONS" | while IFS= read -r line; do
        [ -n "$line" ] && echo "- \`$line\`" >> "$OUTPUT_FILE"
    done
    echo "" >> "$OUTPUT_FILE"
    echo "마이그레이션 실행:" >> "$OUTPUT_FILE"
    echo '```bash' >> "$OUTPUT_FILE"
    echo 'npm run db:migrate' >> "$OUTPUT_FILE"
    echo '```' >> "$OUTPUT_FILE"
else
    echo "*DB 마이그레이션 없음*" >> "$OUTPUT_FILE"
fi

cat >> "$OUTPUT_FILE" << 'HEREDOC'

## 6. 업그레이드 절차

```bash
# 1. Flux 일시 중지
flux suspend kustomization --all

# 2. DB 백업
bash scripts/db-backup.sh

# 3. Helm 업그레이드
helm upgrade ai-saas infra/helm/ai-saas-umbrella -f values-prod.yaml

# 4. 마이그레이션 실행
npm run db:migrate

# 5. 헬스 체크
bash scripts/healthcheck.sh

# 6. Flux 재개
flux resume kustomization --all

# 7. 카나리 배포 확인
kubectl get canaries -A
```

## 7. 롤백 절차

```bash
# 즉시 롤백
helm rollback ai-saas 0

# DB 복원 (필요 시)
bash scripts/db-restore.sh

# Velero 복원 (전체 복원 시)
velero restore create --from-backup latest
```

## 8. 검증 체크리스트

- [ ] 모든 Pod Running 상태
- [ ] 헬스 체크 PASS
- [ ] SLO 오류 예산 정상 범위
- [ ] 감사 로그 정상 기록
- [ ] 모니터링 대시보드 정상
HEREDOC

echo "마이그레이션 가이드 생성: $OUTPUT_FILE"
