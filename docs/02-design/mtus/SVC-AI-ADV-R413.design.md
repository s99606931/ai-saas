# SVC-AI-ADV-R413 Design — AI기반 공공기관 직원 역량 자동 매칭

## §R413 설계 결정
- 매칭 점수: 요구 역량 대비 보유 역량 교집합 비율 × 100
- 경력 보너스: yearsOfExperience ≥ 5 → +10점
- 상위 matchCount명 반환 (점수 내림차순)
- PII: employeeId 감사 로그 마스킹 (앞2+*+뒤2)
- 감사 로그: employee.register, skill.match 액션

## 인터페이스
```typescript
interface EmployeeProfile { employeeId, name, skills: string[], yearsOfExperience, department }
interface ProjectRequirement { projectId, requiredSkills: string[], minExperienceYears }
interface SkillMatchResult { projectId, matches: { employeeId, maskedEmployeeId, matchScore, matchedSkills }[], topCandidate }
```
