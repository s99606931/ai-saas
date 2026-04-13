// Design Ref: §스쿨버스 노선 최적화 — 탑승지점 클러스터링 + 거리 최소화
// Plan SC: FR-R553.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export interface Student {
  studentId: string;
  lat: number;
  lng: number;
  schoolId: string;
  needsAssistance: boolean;
}

export interface BusStop {
  stopId: string;
  lat: number;
  lng: number;
  assignedStudents: string[];
}

export interface RoutePlan {
  routeId: string;
  schoolId: string;
  stopSequence: string[];
  totalDistanceKm: number;
  estimatedDurationMin: number;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

export class SchoolBusRouteOptimizer {
  private students = new Map<string, Student>();
  private stops = new Map<string, BusStop>();
  private readonly auditLog: AuditEntry[] = [];

  private append(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R553.1
  addStudent(s: Student, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (Math.abs(s.lat) > 90 || Math.abs(s.lng) > 180) {
      throw new Error('좌표 범위가 올바르지 않습니다');
    }
    this.students.set(s.studentId, { ...s });
    this.append('ADD_STUDENT', { studentId: s.studentId, schoolId: s.schoolId });
  }

  // Plan SC: FR-R553.2
  createStop(stop: Omit<BusStop, 'assignedStudents'>, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    this.stops.set(stop.stopId, { ...stop, assignedStudents: [] });
    this.append('CREATE_STOP', { stopId: stop.stopId });
  }

  // Plan SC: FR-R553.3
  assignNearestStop(studentId: string, grade: DataGrade = 'O'): string {
    blockClassifiedData(grade);
    const student = this.students.get(studentId);
    if (!student) throw new Error(`학생 미등록: ${studentId}`);
    if (this.stops.size === 0) throw new Error('등록된 탑승지점이 없습니다');

    let nearest: BusStop | undefined;
    let minDist = Number.POSITIVE_INFINITY;
    for (const stop of this.stops.values()) {
      const d = this.haversine(student.lat, student.lng, stop.lat, stop.lng);
      if (d < minDist) {
        minDist = d;
        nearest = stop;
      }
    }
    if (!nearest) throw new Error('최근접 탑승지점 계산 실패');
    if (!nearest.assignedStudents.includes(studentId)) {
      nearest.assignedStudents.push(studentId);
    }
    this.append('ASSIGN_STOP', { studentId, stopId: nearest.stopId });
    return nearest.stopId;
  }

  // Plan SC: FR-R553.4
  optimizeRoute(
    routeId: string,
    schoolId: string,
    stopIds: string[],
    grade: DataGrade = 'O',
  ): RoutePlan {
    blockClassifiedData(grade);
    if (stopIds.length === 0) throw new Error('경유지가 비어 있습니다');
    const stopList = stopIds.map(id => {
      const stop = this.stops.get(id);
      if (!stop) throw new Error(`탑승지점 미등록: ${id}`);
      return stop;
    });

    // Nearest-neighbor heuristic starting from first stop
    const visited = new Set<string>();
    const sequence: string[] = [];
    const firstStop = stopList[0]!;
    let current = firstStop;
    sequence.push(current.stopId);
    visited.add(current.stopId);
    let totalDistance = 0;

    while (visited.size < stopList.length) {
      let nextStop: BusStop | undefined;
      let bestDist = Number.POSITIVE_INFINITY;
      for (const candidate of stopList) {
        if (visited.has(candidate.stopId)) continue;
        const d = this.haversine(current.lat, current.lng, candidate.lat, candidate.lng);
        if (d < bestDist) {
          bestDist = d;
          nextStop = candidate;
        }
      }
      if (!nextStop) break;
      totalDistance += bestDist;
      current = nextStop;
      sequence.push(current.stopId);
      visited.add(current.stopId);
    }

    const plan: RoutePlan = {
      routeId,
      schoolId,
      stopSequence: sequence,
      totalDistanceKm: Math.round(totalDistance * 100) / 100,
      estimatedDurationMin: Math.round((totalDistance / 30) * 60 + sequence.length * 1.5),
    };
    this.append('OPTIMIZE_ROUTE', { routeId, stopCount: sequence.length });
    return plan;
  }

  private haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const toRad = (x: number): number => (x * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
  }

  // Plan SC: FR-R553.5
  getStop(stopId: string): BusStop | undefined {
    const s = this.stops.get(stopId);
    return s ? { ...s, assignedStudents: [...s.assignedStudents] } : undefined;
  }

  // Plan SC: FR-R553.6
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
