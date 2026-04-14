# SVC-AI-ADV-R569 Design — AI기반 공공기관 조달 자동화 v2

## 인터페이스

```typescript
interface ProcurementInput {
  procurementId: string;
  itemCategory: string;
  estimatedAmount: number;
  vendorCount: number;
  isEmergency: boolean;
  budgetAvailable: number;
}

type ProcurementMethod = 'EMERGENCY_PURCHASE' | 'OPEN_BID' | 'LIMITED_BID' | 'DIRECT_CONTRACT';

interface ProcurementResult {
  procurementId: string;
  canAutoApprove: boolean;
  procurementMethod: ProcurementMethod;
  budgetMarginRate: number;  // 소수점 1자리
}
```

## 핵심 알고리즘

- 자동 승인: estimatedAmount <= budgetAvailable×0.1 && vendorCount>=3 && !isEmergency
- 조달 방식: isEmergency→EMERGENCY_PURCHASE / amount>50000000→OPEN_BID / >10000000→LIMITED_BID / else DIRECT_CONTRACT
- 예산 여유율: (budgetAvailable - estimatedAmount) / budgetAvailable × 100 (소수점 1자리)
- 감사 로그: process 호출 시 전수 기록

## CSAP 참조
- D-06: 감사 로그 전수 기록
