# 프로젝트 문서 정리 보고서

**작성일**: 2026-04-11
**작업자**: Implementer Agent (claude-sonnet-4-6)
**대상 디렉토리**: `/data/ai-saas/docs/01-plan/mtus/`

---

## 이동된 파일

| 파일 | 이동 전 위치 | 이동 후 위치 | 이유 |
|-----|-------------|-------------|------|
| SVC-AI-ADV-R2.plan.md | docs/01-plan/mtus/ | docs/archive/2026-04/SVC-AI-ADV-legacy/ | 구버전 (R5로 계열 통합, 내용: Plan-Execute + 에이전트 메모리 FR-ADV2.1~2.6) |
| SVC-AI-ADV-R3.plan.md | docs/01-plan/mtus/ | docs/archive/2026-04/SVC-AI-ADV-legacy/ | 구버전 (R5로 계열 통합, 내용: AI Safety & Guardrails FR-ADV3.1~3.5) |
| SVC-AI-ADV-R4.plan.md | docs/01-plan/mtus/ | docs/archive/2026-04/SVC-AI-ADV-legacy/ | 구버전 (R5로 계열 통합, 내용: Structured Tool Use / Function Calling FR-ADV4.1~4.5) |

**R5 처리 결과**: `docs/01-plan/mtus/SVC-AI-ADV-R5.plan.md` 파일 상단에 통합 메모 주석 추가 완료.
추가된 내용:
```
<!-- 통합: R2~R4 내용 포함됨, 2026-04-11 -->
<!-- R2: Plan-Execute + 에이전트 메모리 (FR-ADV2.1~2.6) -->
<!-- R3: AI Safety & Guardrails (FR-ADV3.1~3.5) -->
<!-- R4: Structured Tool Use / Function Calling (FR-ADV4.1~4.5) -->
<!-- 구버전 파일 이동 위치: docs/archive/2026-04/SVC-AI-ADV-legacy/ -->
```

---

## SVC-RATELIMIT 버전 검토 결과

| 파일 | 작성일 | 내용 요약 | 조치 |
|-----|--------|----------|------|
| SVC-RATELIMIT-R19.plan.md | 2026-04-09 | 테넌트별 요금제 기반 Sliding Window Rate Limiting (FR-RL.1~6). 버스트 허용, 큐잉, 관리 엔드포인트 포함. 요금제 계층(Free/Standard/Enterprise) 구체화. | 이동 불필요 — R19와 R27은 별도 Round 계획 문서이며 이전/이후 버전 관계가 아님 |
| SVC-RATELIMIT-R27.plan.md | 2026-04-11 | Rate Limiter 라이브러리 기본 요건 (FR-RL.1~6). 17개 마이크로서비스 적용 목적. Phase 1 in-memory, Phase 2 Redis 예정. | 이동 불필요 — 독립적 MTU 계획 문서 |

**결론**: SVC-RATELIMIT-R19와 R27은 동일 번호의 리비전이 아닌 별개 MTU 계획 문서입니다. 이동 또는 병합 불필요.

---

## SVC-GRACEFUL 버전 검토 결과

| 파일 | 작성일 | 내용 요약 | 조치 |
|-----|--------|----------|------|
| SVC-GRACEFUL-R26.plan.md | 확인됨 | Graceful Shutdown 관련 단일 파일 | 중복 없음 — 이동 불필요 |

---

## 중복 MTU-N 번호 목록 (수동 검토 필요)

아래 MTU 번호에 2개 이상의 파일이 존재합니다. 각 파일의 실제 내용을 검토하여 올바른 번호 재부여 또는 병합이 필요합니다.

| MTU 번호 | 파일 1 | 파일 2 | 권장 조치 |
|---------|--------|--------|----------|
| N28 | MTU-N28-k3s-cicd-migration.plan.md | MTU-N28-networkpolicy-isolation.plan.md | 한 파일 번호 재부여 필요 |
| N35 | MTU-N35-cicd-automation.plan.md | MTU-N35-helm-umbrella.plan.md | 한 파일 번호 재부여 필요 |
| N36 | MTU-N36-monitoring-system.plan.md | MTU-N36-release-update.plan.md | 한 파일 번호 재부여 필요 |
| N89 | MTU-N89-audit-completeness.plan.md | MTU-N89-victoriametrics-storage.plan.md | 한 파일 번호 재부여 필요 |
| N90 | MTU-N90-grafana-performance.plan.md | MTU-N90-openssf-scorecard.plan.md | 한 파일 번호 재부여 필요 |
| N91 | MTU-N91-alert-noise-reduction.plan.md | MTU-N91-semgrep-quality-gate.plan.md | 한 파일 번호 재부여 필요 |
| N92 | MTU-N92-anomaly-detection-adaptive.plan.md | MTU-N92-immutable-infra-prodready.plan.md | 한 파일 번호 재부여 필요 |
| N93 | MTU-N93-ebpf-zero-trust.plan.md | MTU-N93-predictive-scaling.plan.md | 한 파일 번호 재부여 필요 |
| N94 | MTU-N94-release-migration-auto.plan.md | MTU-N94-runbook-automation.plan.md | 한 파일 번호 재부여 필요 |
| N95 | MTU-N95-incident-classification.plan.md | MTU-N95-qgate-100-pipeline.plan.md | 한 파일 번호 재부여 필요 |
| N96 | MTU-N96-multitenant-monitoring.plan.md | MTU-N96-round7-integration.plan.md | 한 파일 번호 재부여 필요 |
| N97 | MTU-N97-finops-dashboard.plan.md | MTU-N97-storage-tiering.plan.md | 한 파일 번호 재부여 필요 |
| N98 | MTU-N98-cilium-bandwidth.plan.md | MTU-N98-monitoring-e2e-test.plan.md | 한 파일 번호 재부여 필요 |
| N99 | MTU-N99-crossplane-iac.plan.md | MTU-N99-csap-audit-monitoring.plan.md | 한 파일 번호 재부여 필요 |
| N100 | MTU-N100-backstage-idp.plan.md | MTU-N100-round7-integration.plan.md | 한 파일 번호 재부여 필요 |
| N169 | MTU-N169-cert-renewal-monitoring.plan.md | MTU-N169-dora-metrics.plan.md | 한 파일 번호 재부여 필요 |
| N170 | MTU-N170-keycloak-sso.plan.md | MTU-N170-service-catalog-metadata.plan.md | 한 파일 번호 재부여 필요 |
| N171 | MTU-N171-distributed-tracing-correlation.plan.md | MTU-N171-k6-perf-regression.plan.md | 한 파일 번호 재부여 필요 |
| N172 | MTU-N172-flux-sync-monitoring.plan.md | MTU-N172-gitops-promotion-gates.plan.md | 한 파일 번호 재부여 필요 |
| N173 | MTU-N173-mlflow-model-registry.plan.md | MTU-N173-pvc-capacity-monitoring.plan.md | 한 파일 번호 재부여 필요 |
| N174 | MTU-N174-dns-resolution-monitoring.plan.md | MTU-N174-round15-integration.plan.md | 한 파일 번호 재부여 필요 |
| N175 | MTU-N175-otel-auto-instrumentation.plan.md | MTU-N175-round15-integration.plan.md | 한 파일 번호 재부여 필요 |
| N176 | MTU-N176-etcd-health-monitoring.plan.md | MTU-N176-hubble-network-observability.plan.md | 한 파일 번호 재부여 필요 |
| N177 | MTU-N177-node-resource-forecasting.plan.md | MTU-N177-tech-debt-measurement.plan.md | 한 파일 번호 재부여 필요 |
| N178 | MTU-N178-round16-integration.plan.md | MTU-N178-slo-auto-escalation.plan.md | 한 파일 번호 재부여 필요 |
| N179 | MTU-N179-unified-audit-trail.plan.md | MTU-N179.plan.md | 한 파일 번호 재부여 필요 (MTU-N179.plan.md는 명칭 없는 스텁 파일로 의심) |
| N180 | MTU-N180-round16-integration.plan.md | MTU-N180.plan.md | 한 파일 번호 재부여 필요 (MTU-N180.plan.md는 명칭 없는 스텁 파일로 의심) |
| N234 | MTU-N234-feature-flag-platform.plan.md | MTU-N234-otel-collector-monitoring.plan.md | 한 파일 번호 재부여 필요 |
| N235 | MTU-N235-ldap-ad-integration.plan.md | MTU-N235-round24-integration.plan.md | 한 파일 번호 재부여 필요 |
| N236 | MTU-N236-keycloak-multitenant-provisioning.plan.md | MTU-N236.plan.md | 한 파일 번호 재부여 필요 (MTU-N236.plan.md는 명칭 없는 스텁 파일로 의심) |
| N237 | MTU-N237-hotfix-pipeline.plan.md | MTU-N237.plan.md | 한 파일 번호 재부여 필요 |
| N238 | MTU-N238-change-impact-analysis.plan.md | MTU-N238.plan.md | 한 파일 번호 재부여 필요 |
| N239 | MTU-N239-business-kpi-dashboard.plan.md | MTU-N239.plan.md | 한 파일 번호 재부여 필요 |
| N240 | MTU-N240-public-api-standard-validation.plan.md | MTU-N240.plan.md | 한 파일 번호 재부여 필요 |
| N241 | MTU-N241-egov-framework-compatibility.plan.md | MTU-N241.plan.md | 한 파일 번호 재부여 필요 |

**총 중복 번호 수**: 35개 MTU 번호에 중복 파일 존재

---

## 정리 불필요 확인 목록

- 임시 파일 (.tmp, .bak): 확인된 없음
- 아카이브 대기 파일 (단순 구버전): SVC-AI-ADV-R2/R3/R4 이동 완료
- SVC-GRACEFUL-R26: 중복 없음, 유지
- SVC-RATELIMIT-R19/R27: 별개 MTU로 판단, 유지

---

## 다음 단계 권장 사항

1. **MTU-N 중복 번호 해소**: 위 35개 중복 번호에 대해 PM 검토 후 한 파일에 새 번호를 부여. 명칭 없는 스텁 파일(`MTU-N179.plan.md`, `MTU-N180.plan.md`, `MTU-N236~N241.plan.md` 형태)은 내용 확인 후 삭제 또는 이름 변경 처리.
2. **SVC-RATELIMIT-R19/R27 통합 검토**: 두 파일이 동일 기능(Sliding Window Rate Limiting)을 다루므로 중복 요건 여부를 PM이 확인하여 하나로 통합하거나 각 Round의 독립 MTU임을 명시적으로 기록.
3. **MTU-N 번호 관리 정책 수립**: 향후 새 MTU 생성 시 번호 중복 방지를 위한 `docs/guides/onboarding/mtu-numbering-policy.md` 작성 권장.
4. **docs/archive/2026-04/SVC-AI-ADV-legacy/**: 아카이브된 R2/R3/R4 파일은 6개월 보존 후(2026-10-11 이후) 삭제 검토.
