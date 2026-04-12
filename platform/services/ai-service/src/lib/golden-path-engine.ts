// 골든 패스 템플릿 엔진 — FR-N403.1~5

export type VariableType = 'string' | 'number' | 'boolean' | 'enum';

export interface TemplateVariable {
  name: string;
  type: VariableType;
  required: boolean;
  defaultValue?: string | number | boolean;
  enumValues?: string[];
  pattern?: string;
}

export interface TemplateFile {
  path: string;
  content: string;
}

export interface GoldenTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  variables: TemplateVariable[];
  files: TemplateFile[];
  postSteps: string[];
}

export interface RenderResult {
  templateId: string;
  files: Array<{ path: string; content: string }>;
  postSteps: string[];
}

export class GoldenPathEngine {
  private readonly templates = new Map<string, GoldenTemplate>();

  register(template: GoldenTemplate): void {
    if (template.files.length === 0) throw new Error('GOLDEN_EMPTY_FILES');
    this.templates.set(template.id, template);
  }

  list(category?: string): GoldenTemplate[] {
    const all = Array.from(this.templates.values());
    return category ? all.filter((t) => t.category === category) : all;
  }

  render(templateId: string, variables: Record<string, string | number | boolean>): RenderResult {
    const template = this.templates.get(templateId);
    if (!template) throw new Error('GOLDEN_TEMPLATE_NOT_FOUND');
    const resolved = this.validateAndResolve(template.variables, variables);
    const files = template.files.map((f) => ({
      path: this.interpolate(f.path, resolved),
      content: this.interpolate(f.content, resolved),
    }));
    return {
      templateId,
      files,
      postSteps: template.postSteps.map((s) => this.interpolate(s, resolved)),
    };
  }

  private validateAndResolve(
    spec: TemplateVariable[],
    input: Record<string, string | number | boolean>,
  ): Record<string, string> {
    const out: Record<string, string> = {};
    for (const v of spec) {
      const raw = input[v.name];
      if (raw === undefined) {
        if (v.required && v.defaultValue === undefined) {
          throw new Error(`GOLDEN_MISSING_VAR:${v.name}`);
        }
        out[v.name] = String(v.defaultValue ?? '');
        continue;
      }
      if (v.type === 'number' && typeof raw !== 'number') {
        throw new Error(`GOLDEN_TYPE_MISMATCH:${v.name}`);
      }
      if (v.type === 'boolean' && typeof raw !== 'boolean') {
        throw new Error(`GOLDEN_TYPE_MISMATCH:${v.name}`);
      }
      if (v.type === 'enum' && !v.enumValues?.includes(String(raw))) {
        throw new Error(`GOLDEN_INVALID_ENUM:${v.name}`);
      }
      if (v.type === 'string' && v.pattern && !new RegExp(v.pattern).test(String(raw))) {
        throw new Error(`GOLDEN_PATTERN_MISMATCH:${v.name}`);
      }
      out[v.name] = String(raw);
    }
    return out;
  }

  private interpolate(template: string, vars: Record<string, string>): string {
    return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => vars[key] ?? '');
  }
}
