# SVC-AI-ADV-R355 Design

## 알고리즘
- predicted = SMA(last windowSize)
- predicted > target → scale-out, delta = ceil((predicted-target)/perNodeCapacity)
- predicted < lowWatermark → scale-in, delta=1
- else hold
