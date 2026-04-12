# SVC-AI-ADV-R361 Design

## 알고리즘
- metrics: complexity, coverage, duplication, securityIssues
- normalize 후 가중합: coverage*0.3 + (1-complexity/10)*0.2 + (1-duplication)*0.2 + (1-securityIssues/10)*0.3
- score < threshold(0.7) → block=true
