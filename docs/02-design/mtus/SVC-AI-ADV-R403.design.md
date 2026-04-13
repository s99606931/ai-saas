# SVC-AI-ADV-R403 Design: Finance Optimizer

## 항목
- { id, name, benefit, cost }

## 알고리즘
- roi = benefit / max(cost, 1)
- sorted = items.sort((a,b) => b.roi - a.roi)
- expandList = sorted.slice(0, 3)
- reduceList = sorted.filter(r => r.roi < 1.0).slice(-3)
- reallocAmount = sum(reduceList.cost) * 0.2
