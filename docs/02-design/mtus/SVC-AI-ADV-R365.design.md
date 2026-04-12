# SVC-AI-ADV-R365 Design

## 알고리즘
- 줄 단위 split 후 LCS 기반이 아닌 간소화: 이전 세트/이후 세트 차집합
- added = after - before, removed = before - after, unchanged = intersection
- impactScore = (added.size + removed.size) / max(before.size, after.size)
