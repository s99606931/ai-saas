import { describe, it, expect } from 'vitest';
import { AdaptiveLayoutAi, type AccessibilityNeeds } from '../adaptive-layout-ai';

describe('AdaptiveLayoutAi', () => {
  const svc = new AdaptiveLayoutAi();

  const normalNeeds: AccessibilityNeeds = {
    highContrast: false,
    largeText: false,
    screenReader: false,
    reducedMotion: false,
  };

  it('detects mobile device', () => {
    const d = svc.detectDevice(500, 'touch');
    expect(d.deviceKind).toBe('mobile');
  });

  it('builds navigation by role', () => {
    const device = svc.detectDevice(1200, 'mouse');
    const nav = svc.buildNavigation('admin', device);
    expect(nav.items.length).toBeGreaterThan(3);
    expect(nav.orientation).toBe('horizontal');
  });

  it('proposes single-column for mobile', () => {
    const device = svc.detectDevice(400, 'touch');
    const layout = svc.proposeLayout(device, normalNeeds, 'citizen');
    expect(layout.columns).toBe(1);
  });

  it('applies high contrast when needed', () => {
    const device = svc.detectDevice(1200, 'mouse');
    const needs: AccessibilityNeeds = { ...normalNeeds, highContrast: true };
    const layout = svc.proposeLayout(device, needs, 'admin');
    expect(layout.contrastMode).toBe('high');
  });

  it('evaluates accessibility WCAG AA', () => {
    const device = svc.detectDevice(1200, 'mouse');
    const layout = svc.proposeLayout(device, normalNeeds, 'admin');
    const report = svc.evaluateAccessibility(layout, normalNeeds);
    expect(report.wcagAa).toBe(true);
    expect(report.score).toBe(1);
  });

  it('flags missing high contrast', () => {
    const device = svc.detectDevice(1200, 'mouse');
    const layout = svc.proposeLayout(device, normalNeeds, 'admin');
    const needs: AccessibilityNeeds = { ...normalNeeds, highContrast: true };
    const report = svc.evaluateAccessibility(layout, needs);
    expect(report.wcagAa).toBe(false);
  });
});
