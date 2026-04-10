# MTU-N212: 이미지 풀 레이턴시 -- Design
> 버전: 1.0.0 | 작성일: 2026-04-10 | 작성자: PM Lead
## Design Anchor
| 항목 | 결정 |
|------|------|
| 아키텍처 | kubelet_image_pull_duration_seconds 히스토그램 |
### Recording Rules
```yaml
img_pull:duration_p50/p90/p99, img_pull:failure_rate, img_pull:pull_rate
```
### Alerting Rules
| 알림 | 조건 | 심각도 |
|------|------|--------|
| ImagePullSlow | p99 > 60s | warning |
| ImagePullFailing | 실패율 > 5% | critical |
## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초안 | PM Lead |
