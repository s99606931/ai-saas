# MTU-N561~N580 — R15 E2E 시나리오 통합 검증

- **이름**: R15 E2E 종단간 시나리오 검증
- **FR**: FR-N561.1~2, FR-N571.1~3, FR-N575.1~2, FR-N578.1~2, FR-N580.1~2 (11개)
- **CSAP**: D-06, D-08, D-12
- **matchRate**: 100%
- **테스트**: 221/221 PASS (전체 E2E 스위트 12 파일)
- **E2E 파일**:
  - `platform/tests/e2e/scenarios/civil-petition-automation.e2e.test.ts`
  - `platform/tests/e2e/scenarios/ai-agent-delegation.e2e.test.ts`
  - `platform/tests/e2e/scenarios/tenant-onboarding.e2e.test.ts`
  - `platform/tests/e2e/scenarios/csap-evidence-collection.e2e.test.ts`
  - `platform/tests/e2e/scenarios/slo-error-budget.e2e.test.ts`
- **부수 수정**: `gateway-routing.e2e.test.ts` drift 1건 수정 (plugin-not-found 일치)
- **아카이브 일자**: 2026-04-11
