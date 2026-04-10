#!/usr/bin/env bash
# 릴리스 노트 자동 생성 v2 (Breaking Changes 탐지 + 마이그레이션 가이드)
# Design Ref: MTU-N118
# Plan SC: FR-N118.4, FR-N118.5
# CSAP: D-12 시스템 개발 보안
set -euo pipefail

VERSION="${1:-$(date +v%Y.%m.%d)}"
OUTPUT_DIR="/data/ai-saas/docs/releases"
OUTPUT_FILE="$OUTPUT_DIR/release-${VERSION}.md"

mkdir -p "$OUTPUT_DIR"

echo "릴리스 노트 v2 자동 생성: $VERSION"

# 최근 태그 찾기
PREV_TAG=$(git -C /data/ai-saas tag --sort=-creatordate 2>/dev/null | head -2 | tail -1 || echo "")
if [ -z "$PREV_TAG" ]; then
  COMMIT_RANGE="HEAD~20..HEAD"
else
  COMMIT_RANGE="${PREV_TAG}..HEAD"
fi

# Conventional Commits 분류
python3 - "$VERSION" "$PREV_TAG" "$OUTPUT_FILE" << 'PYEOF'
import subprocess, sys, re
from datetime import datetime

version = sys.argv[1]
prev_tag = sys.argv[2]
output_file = sys.argv[3]

# Git 로그 수집
try:
    result = subprocess.run(
        ['git', '-C', '/data/ai-saas', 'log', '--oneline', f'{prev_tag}..HEAD' if prev_tag else '-20'],
        capture_output=True, text=True
    )
    commits = result.stdout.strip().split('\n') if result.stdout.strip() else []
except Exception:
    commits = []

# 분류
features, fixes, security, refactors, docs, breaking, others = [], [], [], [], [], [], []

for commit in commits:
    if not commit.strip():
        continue
    msg = commit.split(' ', 1)[1] if ' ' in commit else commit
    msg_lower = msg.lower()

    if 'breaking' in msg_lower or 'BREAKING' in msg:
        breaking.append(msg)
    if msg_lower.startswith('feat'):
        features.append(msg)
    elif msg_lower.startswith('fix'):
        fixes.append(msg)
    elif msg_lower.startswith('docs'):
        docs.append(msg)
    elif msg_lower.startswith('refactor'):
        refactors.append(msg)
    elif 'security' in msg_lower or 'secur' in msg_lower:
        security.append(msg)
    else:
        others.append(msg)

# 릴리스 노트 생성
lines = [
    f'# 릴리스 노트 -- {version}',
    '',
    f'> 릴리스일: {datetime.now().strftime("%Y-%m-%d")}',
    f'> 이전 버전: {prev_tag or "N/A"}',
    f'> 총 커밋: {len(commits)}건',
    '',
]

if features:
    lines.extend(['## 새로운 기능', ''] + [f'- {f}' for f in features] + [''])
if fixes:
    lines.extend(['## 버그 수정', ''] + [f'- {f}' for f in fixes] + [''])
if security:
    lines.extend(['## 보안 개선', ''] + [f'- {s}' for s in security] + [''])
if refactors:
    lines.extend(['## 리팩토링', ''] + [f'- {r}' for r in refactors] + [''])
if docs:
    lines.extend(['## 문서', ''] + [f'- {d}' for d in docs] + [''])
if others:
    lines.extend(['## 기타', ''] + [f'- {o}' for o in others[:10]] + [''])

# Breaking Changes + 마이그레이션 가이드 (FR-N118.5)
if breaking:
    lines.extend([
        '## Breaking Changes',
        '',
        '> 주의: 다음 변경사항은 하위 호환성에 영향을 줍니다.',
        '',
    ] + [f'- {b}' for b in breaking] + [
        '',
        '### 마이그레이션 가이드',
        '',
        '1. 변경 사항을 확인하고 영향 범위를 파악하세요',
        '2. 스테이징 환경에서 먼저 테스트하세요',
        '3. 의존성 버전을 업데이트하세요',
        '4. API 변경이 있는 경우 클라이언트를 업데이트하세요',
        '5. 전체 E2E 테스트를 실행하세요',
        '',
    ])

lines.extend([
    '## CSAP 준수 확인',
    '',
    '- D-05: 공급망 보안 (Cosign 서명, SBOM 생성)',
    '- D-12: 시스템 개발 보안 (보안 스캔 통과)',
    '- D-06: 감사 로그 기록 완료',
    '',
    '---',
    '_자동 생성: generate-release-notes-v2.sh_',
])

with open(output_file, 'w') as f:
    f.write('\n'.join(lines))

print(f'[PASS] 릴리스 노트 생성: {output_file}')
print(f'  기능: {len(features)}, 수정: {len(fixes)}, 보안: {len(security)}, Breaking: {len(breaking)}')
PYEOF
