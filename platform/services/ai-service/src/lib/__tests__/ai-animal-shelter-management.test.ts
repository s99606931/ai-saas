import { describe, it, expect, beforeEach } from 'vitest';
import {
  AnimalShelterManagement,
  type Animal,
  type AdopterProfile,
} from '../ai-animal-shelter-management';

const animal = (id: string, over: Partial<Animal> = {}): Animal => ({
  animalId: id,
  species: 'dog',
  ageMonths: 24,
  healthScore: 88,
  temperament: 'friendly',
  intakeDate: '2026-01-01',
  status: 'adoptable',
  ...over,
});

const adopter = (over: Partial<AdopterProfile> = {}): AdopterProfile => ({
  adopterId: 'u1',
  hasChildren: false,
  hasOtherPets: false,
  experienceLevel: 'some',
  housingType: 'house',
  ...over,
});

describe('AnimalShelterManagement', () => {
  let ai: AnimalShelterManagement;

  beforeEach(() => {
    ai = new AnimalShelterManagement(10);
  });

  it('수용 및 목록', () => {
    ai.intake(animal('a1'));
    expect(ai.listAnimals().length).toBe(1);
  });

  it('수용 한계 초과 차단', () => {
    const small = new AnimalShelterManagement(1);
    small.intake(animal('a1'));
    expect(() => small.intake(animal('a2'))).toThrow('한계');
  });

  it('친화적 동물 우선 매칭', () => {
    ai.intake(animal('a1', { temperament: 'friendly', healthScore: 90 }));
    ai.intake(animal('a2', { temperament: 'shy', healthScore: 65 }));
    const matches = ai.matchAdopter(adopter());
    expect(matches[0]!.animalId).toBe('a1');
  });

  it('공격성 동물 자녀 가정 차단', () => {
    ai.intake(animal('a1', { temperament: 'aggressive' }));
    const matches = ai.matchAdopter(adopter({ hasChildren: true }));
    expect(matches[0]!.notes.some(n => n.includes('자녀'))).toBe(true);
  });

  it('입양 상태 전환', () => {
    ai.intake(animal('a1'));
    ai.adopt('a1', 'u1');
    expect(ai.listAnimals('adopted').length).toBe(1);
  });

  it('C등급 차단', () => {
    expect(() => ai.intake(animal('a1'), 'C')).toThrow('BLOCKED');
  });
});
