# SVC-AI-ADV-R396 Design: Benefits Calculator

## 데이터 구조
- Program: { id, name, incomeCap, minAge, baseAmount, perMemberBonus }
- Applicant: { income, age, householdSize }

## 계산
```
eligible = income <= incomeCap && age >= minAge
amount = eligible ? base + perMemberBonus * (householdSize - 1) : 0
```

## 감사
- program.register, applicant.evaluate
