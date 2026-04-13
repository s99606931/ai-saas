# SVC-AI-ADV-R470 Plan — 부처 간 자금 이체 AI

## Executive Summary
| 관점 | 내용 |
|------|------|
| WHY | 부처 간 자금 이체 자동화 및 검증으로 회계 투명성 확보 |
| WHO | 기획재정부, 국고국 |
| WHAT | 이체 요청 → 검증 결과 + 실행 상태 |
| HOW | 잔액·한도·승인 코드 3단계 검증 |

## Context Anchor
- WHY: 수동 이체 시 오류 및 지연 발생
- WHO: 국고 자금 담당자
- RISK: 잔액 부족 이체 → 사전 차단
- SUCCESS: 이체 오류 0건
- SCOPE: `intergovernmental-fund-transfer-ai.ts`

## 요구사항
- FR-470.1: `Account = { agency, balance, dailyLimit, usedToday }`
- FR-470.2: `TransferRequest = { from, to, amount, approvalCode: string }`
- FR-470.3: `process(req, fromAcct, toAcct)` → `{ success: boolean, reason?: string, newFromBalance, newToBalance }`
- FR-470.4: 검증 — amount > 0, fromAcct.balance ≥ amount, (fromAcct.usedToday + amount) ≤ fromAcct.dailyLimit, approvalCode 패턴 `/^APR-\d{6}$/`
- FR-470.5: 검증 통과 시 잔액·usedToday 갱신, 실패 시 reason 기록
- FR-470.6: N2SF C/S 차단 + `getAuditLog()`

## 추적성
FR-470.* ↔ `intergovernmental-fund-transfer-ai.ts` ↔ 테스트 ↔ CSAP D-06 N2SF N-05
