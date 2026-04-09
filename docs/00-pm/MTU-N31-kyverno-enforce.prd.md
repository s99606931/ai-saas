# PRD: MTU-N31 Kyverno Enforce 전환

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-N31 |
| 작성일 | 2026-04-08 |
| 복잡도 | MED |
| 상태 | 착수 |

## WHY (배경)

Kyverno verify-image-signature 정책이 Audit 모드로 YAML만 준비되어 있으나, 실제 클러스터에 Kyverno가 설치되지 않은 상태. Enforce 모드로 전환하여 미서명 이미지 배포를 실제로 차단해야 CSAP D-05-03/D-12-08 공급망 보안 요건을 충족함.

## WHO (이해관계자)

- 플랫폼 운영자: Kyverno 정책 관리
- 개발자: Cosign 서명된 이미지만 배포 가능
- 보안 감사관: 공급망 보안 증적 확인

## RISK (위험)

- Kyverno Enforce 전환 시 기존 서명 없는 이미지 재배포 차단 가능
- Kyverno webhook 장애 시 전체 Pod 생성 블로킹 위험
- WSL2 리소스 한계 내 Kyverno 추가 부하

## SUCCESS (성공 기준)

- FR-N31.1: Kyverno Helm Chart 설치 완료 (kyverno 네임스페이스)
- FR-N31.2: verify-image-signature 정책 Enforce 모드 적용
- FR-N31.3: 미서명 이미지 배포 차단 검증 (실제 거부 확인)
- FR-N31.4: 기존 서비스 정상 운영 확인 (36+ pods Running 유지)
- FR-N31.5: Enforce 전환 가이드 문서 작성

## SCOPE (범위)

- 포함: Kyverno 설치, 정책 적용, 검증, 가이드
- 제외: 추가 Kyverno 정책 (require-labels 등), Kyverno Policy Reporter
