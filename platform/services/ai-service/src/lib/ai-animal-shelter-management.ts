// Design Ref: §동물 보호소 관리 — 수용·입양·건강 상태 추적
// Plan SC: FR-R567.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export type AnimalSpecies = 'dog' | 'cat' | 'bird' | 'rabbit' | 'other';
export type AnimalStatus = 'intake' | 'quarantine' | 'adoptable' | 'adopted' | 'euthanasia-review';

export interface Animal {
  animalId: string;
  species: AnimalSpecies;
  ageMonths: number;
  healthScore: number; // 0~100
  temperament: 'friendly' | 'shy' | 'aggressive' | 'unknown';
  intakeDate: string;
  status: AnimalStatus;
}

export interface AdoptionMatch {
  animalId: string;
  suitabilityScore: number;
  notes: string[];
}

export interface AdopterProfile {
  adopterId: string;
  hasChildren: boolean;
  hasOtherPets: boolean;
  experienceLevel: 'none' | 'some' | 'expert';
  housingType: 'apartment' | 'house';
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

export class AnimalShelterManagement {
  private readonly animals = new Map<string, Animal>();
  private readonly capacity: number;
  private readonly auditLog: AuditEntry[] = [];

  constructor(capacity: number = 100) {
    if (capacity <= 0) throw new Error('수용량은 0보다 커야 합니다');
    this.capacity = capacity;
  }

  private append(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R567.1
  intake(animal: Animal, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (this.animals.size >= this.capacity) {
      throw new Error(`수용 한계 도달: ${this.capacity}`);
    }
    if (animal.healthScore < 0 || animal.healthScore > 100) {
      throw new Error('건강 점수는 0~100 범위여야 합니다');
    }
    if (animal.ageMonths < 0) throw new Error('나이는 0 이상이어야 합니다');
    this.animals.set(animal.animalId, { ...animal });
    this.append('INTAKE', { animalId: animal.animalId, species: animal.species });
  }

  // Plan SC: FR-R567.2
  updateStatus(animalId: string, status: AnimalStatus): void {
    const a = this.animals.get(animalId);
    if (!a) throw new Error(`동물 미등록: ${animalId}`);
    a.status = status;
    this.append('UPDATE_STATUS', { animalId, status });
  }

  // Plan SC: FR-R567.3
  matchAdopter(adopter: AdopterProfile, grade: DataGrade = 'O'): AdoptionMatch[] {
    blockClassifiedData(grade);
    const candidates: AdoptionMatch[] = [];

    for (const animal of this.animals.values()) {
      if (animal.status !== 'adoptable') continue;
      let score = 50;
      const notes: string[] = [];

      if (animal.healthScore >= 85) {
        score += 15;
        notes.push('건강 상태 양호');
      } else if (animal.healthScore < 60) {
        score -= 15;
        notes.push('건강 관리 주의');
      }

      if (animal.temperament === 'friendly') {
        score += 15;
      } else if (animal.temperament === 'aggressive') {
        if (adopter.hasChildren) {
          score -= 40;
          notes.push('자녀 가정 부적합 (공격성)');
        } else if (adopter.experienceLevel !== 'expert') {
          score -= 20;
          notes.push('경험자 권장');
        }
      }

      if (adopter.housingType === 'apartment' && animal.species === 'dog' && animal.ageMonths < 12) {
        score -= 10;
        notes.push('공동주택 강아지 적응 고려');
      }
      if (adopter.hasOtherPets && animal.temperament === 'friendly') {
        score += 5;
        notes.push('기존 반려동물 사회화 유리');
      }
      if (adopter.experienceLevel === 'expert') {
        score += 5;
      }

      candidates.push({
        animalId: animal.animalId,
        suitabilityScore: Math.max(0, Math.min(100, score)),
        notes,
      });
    }

    candidates.sort((a, b) => b.suitabilityScore - a.suitabilityScore);
    this.append('MATCH', { adopterId: adopter.adopterId, matches: candidates.length });
    return candidates;
  }

  // Plan SC: FR-R567.4
  adopt(animalId: string, adopterId: string): void {
    const a = this.animals.get(animalId);
    if (!a) throw new Error(`동물 미등록: ${animalId}`);
    if (a.status !== 'adoptable') throw new Error(`입양 가능 상태 아님: ${a.status}`);
    a.status = 'adopted';
    this.append('ADOPT', { animalId, adopterId });
  }

  // Plan SC: FR-R567.5
  listAnimals(status?: AnimalStatus): Animal[] {
    const all = Array.from(this.animals.values()).map(a => ({ ...a }));
    return status ? all.filter(a => a.status === status) : all;
  }

  // Plan SC: FR-R567.6
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
