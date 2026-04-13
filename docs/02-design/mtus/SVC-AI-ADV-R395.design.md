# SVC-AI-ADV-R395 Design: Meeting Scheduler

## 입력
- attendees: { id, availableSlots: number[], preferredSlots: number[] }[]
- room: { capacity: number }
- candidateSlots: number[]

## 알고리즘
- availabilityRatio(slot) = attendees where slot in available / total attendees
- preferenceScore(slot) = attendees where slot in preferred / total
- roomFit = attendees.length <= room.capacity ? 1 : 0
- slotScore = avail*0.5 + pref*0.3 + roomFit*0.2
- return top3 슬롯 (score desc)

## N2SF / CSAP
- C/S 등급 차단
- 감사 로그: recommend 호출 기록
