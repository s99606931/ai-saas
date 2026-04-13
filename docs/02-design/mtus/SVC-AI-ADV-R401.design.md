# SVC-AI-ADV-R401 Design: Contract Risk Scorer

## 키워드
- critical: ["무한책임","즉시해지","전액배상"]
- high: ["위약금","일방해지","지연배상"]
- med: ["지체상금","검수지연"]

## 알고리즘
- countMatches(clauseText, kw) = 조항에 포함된 키워드 수
- clauseScore = min(100, critical*40 + high*25 + med*10)
- overall = 조항 점수 평균
- grade: overall >= 70 → high, >= 40 → med, else low
