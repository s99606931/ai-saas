// Design Ref: MTU-N418 §화이트라벨 엔진
// Plan SC: FR-N418.1~5

export interface BrandConfig {
  tenantId: string;
  brandName: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  fontFamily?: string;
  customDomain?: string;
  supportEmail?: string;
}

export interface ThemeVariables {
  [key: string]: string;
}

export interface EmailTemplate {
  subject: string;
  html: string;
}

export class WhiteLabelEngine {
  /** FR-N418.1 브랜드 검증 */
  validateBrand(cfg: BrandConfig): { ok: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!cfg.brandName) errors.push('brandName 필수');
    if (!/^#[0-9A-Fa-f]{6}$/.test(cfg.primaryColor)) errors.push('primaryColor HEX 형식 오류');
    if (!/^#[0-9A-Fa-f]{6}$/.test(cfg.secondaryColor)) errors.push('secondaryColor HEX 형식 오류');
    try {
      new URL(cfg.logoUrl);
    } catch {
      errors.push('logoUrl 형식 오류');
    }
    return { ok: errors.length === 0, errors };
  }

  /** FR-N418.2 CSS 변수 생성 */
  generateThemeVariables(cfg: BrandConfig): ThemeVariables {
    const primary = cfg.primaryColor;
    const secondary = cfg.secondaryColor;
    return {
      '--brand-primary': primary,
      '--brand-primary-hover': this.shade(primary, -10),
      '--brand-primary-light': this.shade(primary, 20),
      '--brand-secondary': secondary,
      '--brand-font': cfg.fontFamily ?? 'system-ui, sans-serif',
    };
  }

  private shade(hex: string, percent: number): string {
    const num = parseInt(hex.slice(1), 16);
    const r = (num >> 16) + Math.round((percent / 100) * 255);
    const g = ((num >> 8) & 0xff) + Math.round((percent / 100) * 255);
    const b = (num & 0xff) + Math.round((percent / 100) * 255);
    const clamp = (v: number): number => Math.max(0, Math.min(255, v));
    return (
      '#' +
      [clamp(r), clamp(g), clamp(b)]
        .map((v) => v.toString(16).padStart(2, '0'))
        .join('')
    );
  }

  /** FR-N418.3 이메일 템플릿 렌더 */
  renderEmail(cfg: BrandConfig, template: string, data: Record<string, string>): EmailTemplate {
    let html = template;
    const merged: Record<string, string> = {
      brandName: cfg.brandName,
      logoUrl: cfg.logoUrl,
      primaryColor: cfg.primaryColor,
      supportEmail: cfg.supportEmail ?? '',
      ...data,
    };
    for (const [k, v] of Object.entries(merged)) {
      html = html.replaceAll(`{{${k}}}`, v);
    }
    return { subject: `[${cfg.brandName}] ${data.subject ?? '안내'}`, html };
  }

  /** FR-N418.4 커스텀 도메인 검증 */
  validateDomain(domain: string): { valid: boolean; reason?: string } {
    const re = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.[a-z]{2,})+$/;
    if (!re.test(domain)) return { valid: false, reason: '형식 오류' };
    if (domain.includes('..')) return { valid: false, reason: '중복 점' };
    if (domain.length > 253) return { valid: false, reason: '길이 초과' };
    return { valid: true };
  }

  /** FR-N418.5 브랜드 일관성 검사 (색상 대비) */
  checkConsistency(cfg: BrandConfig): { score: number; warnings: string[] } {
    const warnings: string[] = [];
    const contrast = this.contrastRatio(cfg.primaryColor, '#FFFFFF');
    if (contrast < 4.5) warnings.push('primary ↔ 흰색 대비 WCAG AA 미달');
    if (cfg.primaryColor.toLowerCase() === cfg.secondaryColor.toLowerCase()) {
      warnings.push('primary와 secondary 색상 동일');
    }
    const score = +Math.max(0, 1 - warnings.length * 0.3).toFixed(2);
    return { score, warnings };
  }

  private contrastRatio(a: string, b: string): number {
    const L = (hex: string): number => {
      const n = parseInt(hex.slice(1), 16);
      const r = ((n >> 16) & 0xff) / 255;
      const g = ((n >> 8) & 0xff) / 255;
      const bl = (n & 0xff) / 255;
      const f = (c: number): number =>
        c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(bl);
    };
    const la = L(a);
    const lb = L(b);
    const light = Math.max(la, lb);
    const dark = Math.min(la, lb);
    return +((light + 0.05) / (dark + 0.05)).toFixed(2);
  }
}

export const whiteLabelEngine = new WhiteLabelEngine();
