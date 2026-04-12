# SVC-AI-ADV-R360 Design

## 알고리즘
- tenders 배열에서 낙찰가 평균/분산 계산
- 동일 입찰자 반복 비율 + 가격 편차 < threshold → 담합 의심도 증가
- collusionScore = (repeatRatio * 0.5) + (lowVariance * 0.5)
