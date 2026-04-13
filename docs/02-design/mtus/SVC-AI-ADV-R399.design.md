# SVC-AI-ADV-R399 Design: Document Router

## 데이터
- departments: Map<deptId, { keywords: string[], staff: {id, load}[] }>

## 부서 매칭
- score(dept) = document 내 해당 부서 키워드 매칭 수
- top = dept with max score
- confidence = top.score / sum(scores) (0이면 0)

## 담당자 선택
- staff.sort((a,b) => a.load - b.load)[0]
- 부서 없음 시 fallback = 'unassigned'
