# SVC-AI-ADV-R352 Design

## 알고리즘
- quasi-identifier key = fields.join('|')
- 그룹핑 후 각 그룹 크기<k → kViolations
- 각 그룹 sensitive distinct<l → lViolations
- compliant = k·l 위반 없음
