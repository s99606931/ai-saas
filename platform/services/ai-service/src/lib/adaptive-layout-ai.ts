// Design Ref: MTU-N449 §UI 적응형 레이아웃 AI
// Plan SC: FR-N449.1~5

export type DeviceKind = 'desktop' | 'tablet' | 'mobile';
export type InputKind = 'mouse' | 'touch' | 'keyboard-only';

export interface DeviceProfile {
  deviceKind: DeviceKind;
  widthPx: number;
  inputKind: InputKind;
}

export interface AccessibilityNeeds {
  highContrast: boolean;
  largeText: boolean;
  screenReader: boolean;
  reducedMotion: boolean;
}

export type UserRole = 'admin' | 'operator' | 'viewer' | 'citizen';

export interface NavigationConfig {
  items: string[];
  orientation: 'horizontal' | 'vertical';
  showLabels: boolean;
}

export interface LayoutProposal {
  deviceKind: DeviceKind;
  columns: number;
  fontSize: number;
  contrastMode: 'normal' | 'high';
  navigation: NavigationConfig;
  reducedAnimations: boolean;
}

export interface AccessibilityReport {
  wcagAa: boolean;
  issues: string[];
  score: number;
}

export class AdaptiveLayoutAi {
  /** FR-N449.1 디바이스 감지 */
  detectDevice(widthPx: number, inputKind: InputKind): DeviceProfile {
    let deviceKind: DeviceKind = 'desktop';
    if (widthPx < 600) deviceKind = 'mobile';
    else if (widthPx < 1024) deviceKind = 'tablet';
    return { deviceKind, widthPx, inputKind };
  }

  /** FR-N449.3 역할별 네비 구성 */
  buildNavigation(role: UserRole, device: DeviceProfile): NavigationConfig {
    const itemsByRole: Record<UserRole, string[]> = {
      admin: ['대시보드', '사용자', '감사로그', '설정', '시스템'],
      operator: ['대시보드', '작업', '알림'],
      viewer: ['대시보드', '보고서'],
      citizen: ['홈', '신청', '내 이력'],
    };
    const items = itemsByRole[role];
    return {
      items,
      orientation: device.deviceKind === 'mobile' ? 'vertical' : 'horizontal',
      showLabels: device.deviceKind !== 'mobile',
    };
  }

  /** FR-N449.4 레이아웃 제안 */
  proposeLayout(device: DeviceProfile, needs: AccessibilityNeeds, role: UserRole): LayoutProposal {
    let columns = 3;
    if (device.deviceKind === 'tablet') columns = 2;
    if (device.deviceKind === 'mobile') columns = 1;

    const fontSize = needs.largeText ? 18 : 14;
    const contrastMode = needs.highContrast ? 'high' : 'normal';
    return {
      deviceKind: device.deviceKind,
      columns,
      fontSize,
      contrastMode,
      navigation: this.buildNavigation(role, device),
      reducedAnimations: needs.reducedMotion,
    };
  }

  /** FR-N449.5 접근성 점수 평가 (WCAG 2.2 AA 체크리스트) */
  evaluateAccessibility(layout: LayoutProposal, needs: AccessibilityNeeds): AccessibilityReport {
    const issues: string[] = [];
    if (layout.fontSize < 14) issues.push('폰트 크기 14px 미만');
    if (needs.highContrast && layout.contrastMode !== 'high') {
      issues.push('고대비 요청 미반영');
    }
    if (needs.reducedMotion && !layout.reducedAnimations) {
      issues.push('애니메이션 감소 요청 미반영');
    }
    if (needs.screenReader && !layout.navigation.showLabels && layout.deviceKind !== 'mobile') {
      issues.push('스크린리더용 레이블 누락');
    }
    const score = Math.max(0, 1 - issues.length * 0.1);
    return {
      wcagAa: issues.length === 0,
      issues,
      score: +score.toFixed(2),
    };
  }
}

export const adaptiveLayoutAi = new AdaptiveLayoutAi();
