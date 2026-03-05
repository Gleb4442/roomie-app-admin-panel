/**
 * Auto-assignment scoring algorithm
 *
 * Selects the best available staff member for a task based on:
 *   1. Department match  (highest weight)
 *   2. Floor/location match
 *   3. Current workload  (lower = better)
 *   4. Shift duration    (recent starters get preference over long-shift staff)
 *
 * Returns null if no suitable staff member is on shift.
 */

import { prisma } from '../../config/database';
import { StaffDepartment } from '@prisma/client';

// Scoring weights
const WEIGHT = {
  DEPT_MATCH: 40,
  FLOOR_MATCH: 20,
  WORKLOAD: 30,   // inversely proportional
  SHIFT_FRESH: 10, // fresh shifters score higher
};

// Max active tasks considered for scoring (beyond this the staff is "overloaded")
const MAX_TASKS_SCORE = 6;

interface CandidateScore {
  staffId: string;
  score: number;
  activeTaskCount: number;
}

export async function autoAssignTask(
  hotelId: string,
  department: StaffDepartment,
  roomNumber?: string,
  options?: { excludeStaffIds?: string[] },
): Promise<string | null> {
  // 1. Get all staff on active shift
  const activeShifts = await prisma.staffShift.findMany({
    where: { hotelId, isActive: true },
    include: {
      staff: {
        select: {
          id: true,
          role: true,
          department: true,
          assignedFloor: true,
          isActive: true,
        },
      },
    },
  });

  // Filter: only LINE_STAFF and SUPERVISOR of matching department who are active
  const ELIGIBLE_ROLES = ['LINE_STAFF', 'SUPERVISOR'];
  const excludeSet = new Set(options?.excludeStaffIds ?? []);
  const candidates = activeShifts.filter(
    s => ELIGIBLE_ROLES.includes(s.staff.role)
      && s.staff.isActive
      && !excludeSet.has(s.staffId),
  );

  if (candidates.length === 0) return null;

  const staffIds = candidates.map(s => s.staffId);

  // 2. Count active tasks per staff
  const [internalCounts, orderCounts, srCounts] = await Promise.all([
    prisma.internalTask.groupBy({
      by: ['assignedToId'],
      where: {
        hotelId,
        assignedToId: { in: staffIds },
        status: { in: ['ASSIGNED', 'IN_PROGRESS'] },
      },
      _count: true,
    }),
    prisma.order.groupBy({
      by: ['assignedStaffId'],
      where: {
        hotelId,
        assignedStaffId: { in: staffIds },
        status: { in: ['CONFIRMED', 'PREPARING'] },
      },
      _count: true,
    }),
    prisma.serviceRequest.groupBy({
      by: ['assignedStaffId'],
      where: {
        hotelId,
        assignedStaffId: { in: staffIds },
        status: { in: ['confirmed', 'in_progress'] },
      },
      _count: true,
    }),
  ]);

  const countMap: Record<string, number> = {};
  internalCounts.forEach(r => {
    if (r.assignedToId) countMap[r.assignedToId] = (countMap[r.assignedToId] || 0) + r._count;
  });
  orderCounts.forEach(r => {
    if (r.assignedStaffId) countMap[r.assignedStaffId] = (countMap[r.assignedStaffId] || 0) + r._count;
  });
  srCounts.forEach(r => {
    if (r.assignedStaffId) countMap[r.assignedStaffId] = (countMap[r.assignedStaffId] || 0) + r._count;
  });

  // 3. Floor heuristic: derive floor from room number (first digit(s))
  const taskFloor = roomNumber ? extractFloor(roomNumber) : null;

  const now = Date.now();

  // 4. Score each candidate
  const scores: CandidateScore[] = candidates.map(shift => {
    const staff = shift.staff;
    const activeCount = countMap[shift.staffId] || 0;
    let score = 0;

    // Department match (exact match gets full points, else 0)
    if (staff.department === department) {
      score += WEIGHT.DEPT_MATCH;
    }

    // Floor match
    if (taskFloor !== null && staff.assignedFloor) {
      const staffFloor = parseInt(staff.assignedFloor, 10);
      if (!isNaN(staffFloor)) {
        if (staffFloor === taskFloor) {
          score += WEIGHT.FLOOR_MATCH;
        } else {
          // Partial score for adjacent floors
          const diff = Math.abs(staffFloor - taskFloor);
          if (diff === 1) score += WEIGHT.FLOOR_MATCH * 0.5;
        }
      }
    }

    // Workload score (inversely proportional, 0-MAX_TASKS_SCORE range)
    const cappedCount = Math.min(activeCount, MAX_TASKS_SCORE);
    const workloadScore = WEIGHT.WORKLOAD * (1 - cappedCount / MAX_TASKS_SCORE);
    score += workloadScore;

    // Shift freshness: staff who started < 2h ago get full bonus
    const shiftAgeMs = now - shift.startedAt.getTime();
    const shiftAgeH = shiftAgeMs / (1000 * 3600);
    const freshScore = shiftAgeH < 2 ? WEIGHT.SHIFT_FRESH :
                       shiftAgeH < 4 ? WEIGHT.SHIFT_FRESH * 0.5 : 0;
    score += freshScore;

    return { staffId: shift.staffId, score, activeTaskCount: activeCount };
  });

  // 5. Sort by score (highest first), then by least active tasks as tiebreaker
  scores.sort((a, b) =>
    b.score !== a.score ? b.score - a.score : a.activeTaskCount - b.activeTaskCount,
  );

  // Don't assign if top candidate has 0 department match and is overloaded
  const best = scores[0];
  if (!best) return null;

  // Reject if overloaded (≥ MAX_TASKS_SCORE active tasks) AND no dept match
  const hasDeptMatch = candidates.find(c => c.staffId === best.staffId)?.staff.department === department;
  if (best.activeTaskCount >= MAX_TASKS_SCORE && !hasDeptMatch) return null;

  return best.staffId;
}

function extractFloor(roomNumber: string): number | null {
  // Extracts floor from room numbers like "301" → 3, "1201" → 12
  const digits = roomNumber.replace(/\D/g, '');
  if (digits.length < 2) return null;
  // If 3-digit: first digit is floor. If 4-digit: first 2 digits.
  const floor = digits.length === 3
    ? parseInt(digits[0], 10)
    : parseInt(digits.slice(0, 2), 10);
  return isNaN(floor) ? null : floor;
}
