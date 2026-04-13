# SVC-AI-ADV-R397 Design: Social Media Monitor

## 키워드
- crisis: ["폭발","화재","사고","붕괴","사망"]
- complaint: ["불만","항의","환불","무능","실망"]
- positive: ["좋다","감사","훌륭","만족"]

## 점수
- score = positive*20 - complaint*30 - crisis*50 (clip -100~100)
- category: crisis >=1 ? 'crisis' : complaint >=1 ? 'complaint' : positive >=1 ? 'positive' : 'neutral'

## alertLevel (집계)
- crisis >= 2 → high
- crisis >=1 || complaint >= 3 → med
- else → low
