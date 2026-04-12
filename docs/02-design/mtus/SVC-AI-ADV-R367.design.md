# SVC-AI-ADV-R367 Design

## 알고리즘
- health = 1 - (age/maxAge)*0.3 - (usage/maxUsage)*0.3 - damage*0.4
- health < 0.5 → priority HIGH
- 정렬: priority DESC, health ASC
