# SVC-AI-ADV-R357 Design

## 알고리즘
- 부서별 skillScore 평균 → gap = average - person.skillScore
- 위험 가중치:
  - performance<3 +30, tenureYears<2 +20, trainingHours<10 +15,
  - absenceDays>10 +25, salaryPercentile<40 +10
- cap 100
