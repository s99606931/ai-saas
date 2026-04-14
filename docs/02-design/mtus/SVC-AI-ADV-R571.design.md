# SVC-AI-ADV-R571 Design — AI기반 공공 서비스 추천 엔진 v3

## 인터페이스

```typescript
interface ServiceEntry {
  serviceId: string;
  category: string;
  region: string;        // 'ALL' 또는 특정 지역
  ageGroups: string[];
}

interface RecommendInput {
  userId: string;
  dataGrade: 'C' | 'S' | 'O';
  ageGroup: string;
  region: string;
  requestedCategories: string[];
  availableServices: ServiceEntry[];
}

interface RecommendResult {
  userIdMasked: string;
  recommendedServices: string[];   // serviceId 목록
  totalMatched: number;
}
```

## 핵심 알고리즘

- N2SF C/S → throw `BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`
- 매칭: category∈requestedCategories && (region==='ALL'||region===입력region) && ageGroup∈ageGroups
- userId 마스킹: 앞2자+***+뒤2자, 4자 미만→***
- 감사 로그: recommend 호출 시 전수 기록

## CSAP 참조
- D-06: 감사 로그 전수 기록
- N-05: C/S 등급 AI 전송 차단
