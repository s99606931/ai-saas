# SVC-AI-ADV-R400 Design: Safety Score Engine

## 입력
- region: { crimeRate, fireRate, accidentRate, disasterRate } (per 10k, 월간)
- scale: { crime:10, fire:20, accident:5, disaster:50 }

## 계산
- domainScore(rate, s) = max(0, 100 - rate * s)
- totalScore = (crimeS + fireS + accidentS + disasterS) / 4
- riskFactors = [domain where score < 60]
- grade: A(>=85), B(>=70), C(>=50), D(<50)
