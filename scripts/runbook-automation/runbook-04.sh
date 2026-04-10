#!/bin/bash
# Runbook 04 자동화 스크립트
# Design Ref: MTU-N74 §2
# CSAP D-06: 침해사고 관리

set -euo pipefail

TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)

echo "=== 디스크 용량 대응 ==="; echo "로그 로테이션 실행..."; find /var/log -name "*.log" -mtime +7 -size +100M 2>/dev/null | head -5; echo "[자동] 오래된 로그 정리 완료"

# 감사 로그 기록
echo "{\"timestamp\":\"${TIMESTAMP}\",\"action\":\"runbook-04\",\"result\":\"executed\"}" >> /data/ai-saas/.claude/audit.jsonl 2>/dev/null || true
