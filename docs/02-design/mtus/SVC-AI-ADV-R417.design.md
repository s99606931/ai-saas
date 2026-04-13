# SVC-AI-ADV-R417 Design — AI기반 자동 컨테이너 보안 스캐닝 v2

## §R417 설계 결정
- CVE 점수: CRITICAL=40, HIGH=20, MEDIUM=10, LOW=5
- 보안 점수: 100 - 각 CVE 점수 합산 (최소 0)
- 배포 판단: CRITICAL CVE 존재 OR runAsRoot → BLOCK
- HIGH CVE ≥ 2개 → WARNING
- 그 외 → PASS
- 감사 로그: image.scan 액션

## 인터페이스
```typescript
interface ContainerImage { imageId, imageName, tag, runAsRoot, layers }
interface ImageCve { cveId, severity: 'CRITICAL'|'HIGH'|'MEDIUM'|'LOW', packageName, fixAvailable }
interface ScanReport { imageId, securityScore, deploymentDecision: 'BLOCK'|'WARNING'|'PASS', criticalCount, highCount, cves, recommendations }
```
