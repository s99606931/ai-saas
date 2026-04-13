# SVC-AI-ADV-R416 Design — AI기반 공공 데이터 활용 지수 산출

## §R416 설계 결정
- N2SF: dataGrade C/S → throw `BLOCKED: ${grade}등급 데이터 활용 지수 산출 차단 (N2SF N-05)`
- 활용 지수: (accessCount × 0.4 + downloadCount × 0.6) / maxValue × 100 (0~100 정규화)
- 저활용 기준: utilizationIndex < 20 → LOW_UTILIZATION
- 고활용 기준: utilizationIndex >= 70 → HIGH_UTILIZATION
- 감사 로그: dataset.register, utilization.calculate 액션

## 인터페이스
```typescript
interface PublicDataset { datasetId, name, category, dataGrade: 'C'|'S'|'O', accessCount, downloadCount, lastAccessedAt }
interface UtilizationIndex { datasetId, utilizationScore, utilizationLevel: 'HIGH'|'MEDIUM'|'LOW_UTILIZATION', recommendations }
interface UtilizationReport { totalDatasets, calculatedCount, blockedCount, averageScore, datasets: UtilizationIndex[] }
```
