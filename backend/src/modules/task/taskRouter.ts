/**
 * TaskRouter — determines department → group → assignee for a task.
 *
 * Flow:
 *   1. Resolve department from: explicit param > service category default > enum fallback
 *   2. Find matching StaffGroup (by department + optional floor/shift/skill filters)
 *   3. Pick best staff from group members using scoring (workload, floor, shift freshness)
 *   4. Falls back to existing autoAssignTask() if no group match
 */

import { prisma } from '../../config/database';
import { StaffDepartment } from '@prisma/client';
import { autoAssignTask } from '../staff/autoAssign.service';

interface RouteTaskParams {
  hotelId: string;
  /** Explicit department DB id */
  departmentId?: string;
  /** Fallback: department enum slug (e.g. 'housekeeping') */
  departmentSlug?: string;
  /** Legacy enum department for backward compat */
  departmentEnum?: StaffDepartment;
  /** Service category id — used to look up defaultDepartmentId */
  serviceCategoryId?: string;
  /** Room number — used for floor-based group matching */
  roomNumber?: string;
  /** Required skills for skill-based group matching */
  requiredSkills?: string[];
  /** Staff IDs to exclude (e.g. after decline) */
  excludeStaffIds?: string[];
}

interface RouteResult {
  staffId: string | null;
  departmentId?: string;
  groupId?: string;
  method: 'group_route' | 'auto_assign' | 'none';
}

export async function routeTask(params: RouteTaskParams): Promise<RouteResult> {
  const { hotelId, roomNumber, requiredSkills, excludeStaffIds } = params;

  // Step 1: Resolve department
  const departmentId = await resolveDepartment(params);

  // Step 2: Find matching staff groups
  if (departmentId) {
    const groups = await prisma.staffGroup.findMany({
      where: {
        hotelId,
        departmentId,
        isActive: true,
      },
      include: {
        members: {
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
        },
      },
    });

    if (groups.length > 0) {
      // Step 3: Filter groups by type-specific criteria
      const taskFloor = roomNumber ? extractFloor(roomNumber) : null;
      const rankedGroups = rankGroups(groups, taskFloor, requiredSkills);

      for (const group of rankedGroups) {
        // Get active members, excluding declined staff
        const eligibleMembers = group.members.filter(
          m => m.staff.isActive
            && !excludeStaffIds?.includes(m.staff.id)
            && ['LINE_STAFF', 'SUPERVISOR'].includes(m.staff.role),
        );

        if (eligibleMembers.length === 0) continue;

        // Pick best from group using workload scoring
        const staffId = await pickBestFromGroup(
          hotelId,
          eligibleMembers.map(m => m.staff),
          taskFloor,
        );

        if (staffId) {
          return { staffId, departmentId, groupId: group.id, method: 'group_route' };
        }
      }
    }
  }

  // Step 4: Fall back to legacy auto-assign
  const fallbackDept = params.departmentEnum
    || await departmentIdToEnum(departmentId)
    || StaffDepartment.HOUSEKEEPING;

  const staffId = await autoAssignTask(hotelId, fallbackDept, roomNumber);

  if (staffId && excludeStaffIds?.includes(staffId)) {
    // If the auto-assigned staff was excluded, return none
    return { staffId: null, departmentId, method: 'none' };
  }

  return {
    staffId,
    departmentId,
    method: staffId ? 'auto_assign' : 'none',
  };
}

// ── Helpers ──────────────────────────────────────────────────

async function resolveDepartment(params: RouteTaskParams): Promise<string | undefined> {
  // Priority 1: explicit departmentId
  if (params.departmentId) return params.departmentId;

  // Priority 2: service category default
  if (params.serviceCategoryId) {
    const cat = await prisma.serviceCategory.findUnique({
      where: { id: params.serviceCategoryId },
      select: { defaultDepartmentId: true },
    });
    if (cat?.defaultDepartmentId) return cat.defaultDepartmentId;
  }

  // Priority 3: department slug lookup
  if (params.departmentSlug && params.hotelId) {
    const dept = await prisma.department.findUnique({
      where: { hotelId_slug: { hotelId: params.hotelId, slug: params.departmentSlug } },
      select: { id: true },
    });
    if (dept) return dept.id;
  }

  // Priority 4: enum → slug mapping
  if (params.departmentEnum && params.hotelId) {
    const slug = params.departmentEnum.toLowerCase();
    const dept = await prisma.department.findUnique({
      where: { hotelId_slug: { hotelId: params.hotelId, slug } },
      select: { id: true },
    });
    if (dept) return dept.id;
  }

  return undefined;
}

async function departmentIdToEnum(departmentId?: string): Promise<StaffDepartment | null> {
  if (!departmentId) return null;
  const dept = await prisma.department.findUnique({
    where: { id: departmentId },
    select: { slug: true },
  });
  if (!dept) return null;

  const enumMap: Record<string, StaffDepartment> = {
    housekeeping: StaffDepartment.HOUSEKEEPING,
    maintenance: StaffDepartment.MAINTENANCE,
    food_and_beverage: StaffDepartment.FOOD_AND_BEVERAGE,
    front_office: StaffDepartment.FRONT_OFFICE,
    security: StaffDepartment.SECURITY,
    management: StaffDepartment.MANAGEMENT,
  };

  return enumMap[dept.slug] || null;
}

function rankGroups(
  groups: Array<{ id: string; type: string; floors: number[]; skills: string[]; members: any[] }>,
  taskFloor: number | null,
  requiredSkills?: string[],
): typeof groups {
  return groups
    .map(g => {
      let relevance = 0;

      // FLOOR groups: match if task floor is in group's floor list
      if (g.type === 'FLOOR' && taskFloor !== null && g.floors.includes(taskFloor)) {
        relevance += 30;
      }

      // SKILL groups: match if group has required skills
      if (g.type === 'SKILL' && requiredSkills?.length) {
        const matched = requiredSkills.filter(s => g.skills.includes(s)).length;
        relevance += (matched / requiredSkills.length) * 25;
      }

      // SHIFT groups: always somewhat relevant (time-based matching happens at member level)
      if (g.type === 'SHIFT') relevance += 10;

      // CUSTOM groups: low default relevance
      if (g.type === 'CUSTOM') relevance += 5;

      // More members = more capacity
      relevance += Math.min(g.members.length, 10);

      return { ...g, relevance };
    })
    .sort((a, b) => b.relevance - a.relevance);
}

async function pickBestFromGroup(
  hotelId: string,
  staffList: Array<{ id: string; role: string; department: string; assignedFloor: string | null }>,
  taskFloor: number | null,
): Promise<string | null> {
  if (staffList.length === 0) return null;

  const staffIds = staffList.map(s => s.id);

  // Check who's on shift
  const activeShifts = await prisma.staffShift.findMany({
    where: { hotelId, isActive: true, staffId: { in: staffIds } },
    select: { staffId: true, startedAt: true },
  });

  const onShiftIds = new Set(activeShifts.map(s => s.staffId));
  const onShiftStaff = staffList.filter(s => onShiftIds.has(s.id));
  if (onShiftStaff.length === 0) return null;

  // Count active tasks
  const onShiftStaffIds = onShiftStaff.map(s => s.id);
  const [internalCounts, orderCounts, srCounts] = await Promise.all([
    prisma.internalTask.groupBy({
      by: ['assignedToId'],
      where: { hotelId, assignedToId: { in: onShiftStaffIds }, status: { in: ['ASSIGNED', 'IN_PROGRESS'] } },
      _count: true,
    }),
    prisma.order.groupBy({
      by: ['assignedStaffId'],
      where: { hotelId, assignedStaffId: { in: onShiftStaffIds }, status: { in: ['CONFIRMED', 'PREPARING'] } },
      _count: true,
    }),
    prisma.serviceRequest.groupBy({
      by: ['assignedStaffId'],
      where: { hotelId, assignedStaffId: { in: onShiftStaffIds }, status: { in: ['confirmed', 'in_progress'] } },
      _count: true,
    }),
  ]);

  const countMap: Record<string, number> = {};
  internalCounts.forEach(r => { if (r.assignedToId) countMap[r.assignedToId] = (countMap[r.assignedToId] || 0) + r._count; });
  orderCounts.forEach(r => { if (r.assignedStaffId) countMap[r.assignedStaffId] = (countMap[r.assignedStaffId] || 0) + r._count; });
  srCounts.forEach(r => { if (r.assignedStaffId) countMap[r.assignedStaffId] = (countMap[r.assignedStaffId] || 0) + r._count; });

  const shiftMap = new Map(activeShifts.map(s => [s.staffId, s]));
  const now = Date.now();

  // Score
  const scored = onShiftStaff.map(staff => {
    let score = 0;
    const activeCount = countMap[staff.id] || 0;

    // Workload (lower = better)
    score += 30 * (1 - Math.min(activeCount, 6) / 6);

    // Floor match
    if (taskFloor !== null && staff.assignedFloor) {
      const sf = parseInt(staff.assignedFloor, 10);
      if (!isNaN(sf)) {
        if (sf === taskFloor) score += 20;
        else if (Math.abs(sf - taskFloor) === 1) score += 10;
      }
    }

    // Shift freshness
    const shift = shiftMap.get(staff.id);
    if (shift) {
      const ageH = (now - shift.startedAt.getTime()) / 3600000;
      score += ageH < 2 ? 10 : ageH < 4 ? 5 : 0;
    }

    return { staffId: staff.id, score, activeCount };
  });

  scored.sort((a, b) => b.score !== a.score ? b.score - a.score : a.activeCount - b.activeCount);

  return scored[0]?.staffId ?? null;
}

function extractFloor(roomNumber: string): number | null {
  const digits = roomNumber.replace(/\D/g, '');
  if (digits.length === 0) return null;

  let floor: number;
  if (digits.length <= 2) {
    // "5" → floor 0 (ground), "25" → floor 2
    floor = digits.length === 1 ? 0 : parseInt(digits[0], 10);
  } else if (digits.length === 3) {
    // "305" → floor 3
    floor = parseInt(digits[0], 10);
  } else {
    // "1205" → floor 12, "2001" → floor 20
    floor = parseInt(digits.slice(0, digits.length - 2), 10);
  }

  return isNaN(floor) ? null : floor;
}
