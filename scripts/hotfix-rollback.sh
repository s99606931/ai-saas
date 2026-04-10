#!/bin/bash
# Design Ref: MTU-N237 SS2
# Plan SC: FR-HF.4
# Hotfix 롤백 스크립트

set -euo pipefail

NAMESPACE="production"
REVISION=""
HELM_RELEASE="saas-platform"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --namespace) NAMESPACE="$2"; shift 2;;
    --revision) REVISION="$2"; shift 2;;
    *) shift;;
  esac
done

echo "============================================"
echo " Hotfix 롤백: $NAMESPACE"
echo "============================================"

if [ -n "$REVISION" ]; then
  echo "[롤백] 리비전 $REVISION으로 롤백..."
  helm rollback "$HELM_RELEASE" "$REVISION" --namespace "$NAMESPACE" --wait --timeout 3m
else
  echo "[롤백] 이전 리비전으로 롤백..."
  helm rollback "$HELM_RELEASE" --namespace "$NAMESPACE" --wait --timeout 3m
fi

# 감사 로그
AUDIT_ENTRY="{\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"action\":\"HOTFIX_ROLLBACK\",\"namespace\":\"$NAMESPACE\",\"revision\":\"${REVISION:-previous}\",\"actor\":\"rollback-script\"}"
if [ -f ".claude/audit.jsonl" ]; then
  echo "$AUDIT_ENTRY" >> .claude/audit.jsonl
fi
echo "[AUDIT] $AUDIT_ENTRY"

echo ""
echo "롤백 완료: $NAMESPACE"
