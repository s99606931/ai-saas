#!/bin/bash
# 아키텍처 다이어그램 자동 생성 스크립트
# Design Ref: DS-N111.1, DS-N111.2
# Plan SC: FR-N111.1, FR-N111.2

set -uo pipefail

INFRA_DIR="/data/ai-saas/infra"
OUTPUT_DIR="/data/ai-saas/docs-portal/docs/architecture"
OUTPUT_FILE="${OUTPUT_DIR}/platform-overview.md"

echo "============================================"
echo " 아키텍처 다이어그램 자동 생성"
echo "============================================"

# 출력 디렉토리 생성
mkdir -p "$OUTPUT_DIR"

# 인프라 컴포넌트 스캔
echo "[1/3] 인프라 컴포넌트 스캔 중..."
COMPONENTS=()
while IFS= read -r dir; do
  name=$(basename "$dir")
  COMPONENTS+=("$name")
done < <(find "$INFRA_DIR" -maxdepth 1 -mindepth 1 -type d | sort)

COMPONENT_COUNT=${#COMPONENTS[@]}
echo "  발견된 컴포넌트: ${COMPONENT_COUNT}개"

# 컴포넌트 분류
SECURITY_COMPONENTS=("falco" "kyverno" "cosign" "sealed-secrets" "trivy-operator" "security" "gatekeeper" "vault")
MONITORING_COMPONENTS=("monitoring" "slo" "pyroscope" "anomaly-detection" "thanos" "finops")
CICD_COMPONENTS=("cicd" "flux" "flagger" "harbor" "gitea" "renovate" "argo-rollouts" "backstage")
NETWORK_COMPONENTS=("network-policies" "gateway-api" "linkerd" "cilium")
STORAGE_COMPONENTS=("storage" "velero" "cloudnative-pg" "external-secrets" "dr")
PLATFORM_COMPONENTS=("helm" "keda" "vpa" "resource-management" "vcluster" "crossplane" "cert-manager" "chaos" "compliance" "predictive-scaling" "multi-tenant-cicd" "sonarqube")

# Mermaid 다이어그램 생성
echo "[2/3] Mermaid 다이어그램 생성 중..."

cat > "$OUTPUT_FILE" << 'HEADER'
---
title: 플랫폼 아키텍처 개요
description: 공공기관 SaaS 프레임워크 인프라 아키텍처 (자동 생성)
---

# 플랫폼 아키텍처 개요

> 이 문서는 `scripts/generate-arch-diagram.sh`에 의해 자동 생성됩니다.
> 인프라 변경 시 CI 파이프라인에서 자동 업데이트됩니다.

## 시스템 컨텍스트 다이어그램

```mermaid
graph TB
    subgraph "공공기관 SaaS 프레임워크"
        subgraph "보안 계층 (Security)"
            style 보안 계층 fill:#ffcccc
HEADER

# 보안 컴포넌트 추가
for comp in "${SECURITY_COMPONENTS[@]}"; do
  if [[ -d "$INFRA_DIR/$comp" ]]; then
    comp_upper=$(echo "$comp" | tr '-' '_' | tr '[:lower:]' '[:upper:]')
    echo "            ${comp_upper}[${comp}]" >> "$OUTPUT_FILE"
  fi
done

cat >> "$OUTPUT_FILE" << 'MID1'
        end

        subgraph "모니터링 계층 (Observability)"
            style 모니터링 계층 fill:#cce5ff
MID1

# 모니터링 컴포넌트 추가
for comp in "${MONITORING_COMPONENTS[@]}"; do
  if [[ -d "$INFRA_DIR/$comp" ]]; then
    comp_upper=$(echo "$comp" | tr '-' '_' | tr '[:lower:]' '[:upper:]')
    echo "            ${comp_upper}[${comp}]" >> "$OUTPUT_FILE"
  fi
done

cat >> "$OUTPUT_FILE" << 'MID2'
        end

        subgraph "CI/CD 계층 (Delivery)"
            style CI/CD 계층 fill:#ccffcc
MID2

# CI/CD 컴포넌트 추가
for comp in "${CICD_COMPONENTS[@]}"; do
  if [[ -d "$INFRA_DIR/$comp" ]]; then
    comp_upper=$(echo "$comp" | tr '-' '_' | tr '[:lower:]' '[:upper:]')
    echo "            ${comp_upper}[${comp}]" >> "$OUTPUT_FILE"
  fi
done

cat >> "$OUTPUT_FILE" << 'MID3'
        end

        subgraph "네트워크 계층 (Network)"
MID3

for comp in "${NETWORK_COMPONENTS[@]}"; do
  if [[ -d "$INFRA_DIR/$comp" ]]; then
    comp_upper=$(echo "$comp" | tr '-' '_' | tr '[:lower:]' '[:upper:]')
    echo "            ${comp_upper}[${comp}]" >> "$OUTPUT_FILE"
  fi
done

cat >> "$OUTPUT_FILE" << 'MID4'
        end

        subgraph "스토리지/DR 계층 (Storage)"
MID4

for comp in "${STORAGE_COMPONENTS[@]}"; do
  if [[ -d "$INFRA_DIR/$comp" ]]; then
    comp_upper=$(echo "$comp" | tr '-' '_' | tr '[:lower:]' '[:upper:]')
    echo "            ${comp_upper}[${comp}]" >> "$OUTPUT_FILE"
  fi
done

cat >> "$OUTPUT_FILE" << 'MID5'
        end

        subgraph "플랫폼 계층 (Platform)"
MID5

for comp in "${PLATFORM_COMPONENTS[@]}"; do
  if [[ -d "$INFRA_DIR/$comp" ]]; then
    comp_upper=$(echo "$comp" | tr '-' '_' | tr '[:lower:]' '[:upper:]')
    echo "            ${comp_upper}[${comp}]" >> "$OUTPUT_FILE"
  fi
done

cat >> "$OUTPUT_FILE" << 'FOOTER'
        end
    end
```

## 컴포넌트 목록

| 계층 | 컴포넌트 | 설명 |
|------|---------|------|
FOOTER

# 컴포넌트 테이블 생성
for comp in "${COMPONENTS[@]}"; do
  # 계층 분류
  layer="플랫폼"
  for sc in "${SECURITY_COMPONENTS[@]}"; do [[ "$comp" == "$sc" ]] && layer="보안"; done
  for mc in "${MONITORING_COMPONENTS[@]}"; do [[ "$comp" == "$mc" ]] && layer="모니터링"; done
  for cc in "${CICD_COMPONENTS[@]}"; do [[ "$comp" == "$cc" ]] && layer="CI/CD"; done
  for nc in "${NETWORK_COMPONENTS[@]}"; do [[ "$comp" == "$nc" ]] && layer="네트워크"; done
  for stc in "${STORAGE_COMPONENTS[@]}"; do [[ "$comp" == "$stc" ]] && layer="스토리지/DR"; done

  echo "| ${layer} | ${comp} | infra/${comp} |" >> "$OUTPUT_FILE"
done

# 메타데이터 추가
cat >> "$OUTPUT_FILE" << METADATA

---

> **자동 생성 정보**
> - 생성 시각: $(date -u +%Y-%m-%dT%H:%M:%SZ)
> - 스캔 대상: ${INFRA_DIR}
> - 컴포넌트 수: ${COMPONENT_COUNT}
> - 생성 스크립트: scripts/generate-arch-diagram.sh
METADATA

echo "[3/3] 완료"
echo ""
echo "출력 파일: ${OUTPUT_FILE}"
echo "컴포넌트 수: ${COMPONENT_COUNT}"
