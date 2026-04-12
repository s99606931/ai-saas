# SVC-AI-ADV-R350 Plan: Emergency Resource Allocator

## 요구사항 ID: FR-350

## 기능 개요
공공 안전(소방/경찰/구급) 자원을 실시간 사건 수요에 맞춰 최적 배분한다.
사건 우선순위·거리·가용 리소스를 종합해 최소 응답시간 배분을 산출한다.

## 성공 기준 (SC)
- SC-R350-1: 우선순위(critical/high/medium/low) 가중 할당
- SC-R350-2: 유형 매칭 + 최근접 가용 자원 선택
- SC-R350-3: C/S등급 사건 데이터 차단 (N2SF N-05)
- SC-R350-4: 감사 로그 (CSAP D-06)

## N2SF 데이터 등급
- O등급: 자원 위치/가용성 메타데이터
