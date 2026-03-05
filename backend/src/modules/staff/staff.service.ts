import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/database';
import { env } from '../../config/environment';
import { StaffRole, StaffDepartment, TaskStatus, TaskPriority } from '@prisma/client';
import { recordStatusChange } from '../task/taskStatusTracker';

const STAFF_JWT_SECRET = process.env.STAFF_JWT_SECRET || 'staff-secret-change-in-prod';
const ACCESS_TOKEN_EXPIRY = '8h';
const REFRESH_TOKEN_EXPIRY = '30d';

// ── Auth ─────────────────────────────────────────────────────

export async function loginStaff(hotelId: string, email: string, password: string) {
  const staff = await prisma.staffMember.findUnique({
    where: { hotelId_email: { hotelId, email } },
  });

  if (!staff || !staff.isActive) {
    throw new Error('INVALID_CREDENTIALS');
  }

  const valid = await bcrypt.compare(password, staff.passwordHash);
  if (!valid) throw new Error('INVALID_CREDENTIALS');

  const payload = { staffId: staff.id, hotelId: staff.hotelId, role: staff.role };
  const accessToken = jwt.sign(payload, STAFF_JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
  const refreshToken = jwt.sign({ staffId: staff.id }, STAFF_JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });

  return { accessToken, refreshToken, staff: formatStaff(staff) };
}

export async function loginStaffByPin(hotelId: string, pin: string) {
  const staff = await prisma.staffMember.findFirst({
    where: { hotelId, pin: await bcrypt.hash(pin, 10), isActive: true },
  });

  if (!staff) throw new Error('INVALID_CREDENTIALS');

  // Compare pin properly
  const allStaff = await prisma.staffMember.findMany({
    where: { hotelId, isActive: true, pin: { not: null } },
  });

  let matched = null;
  for (const s of allStaff) {
    if (s.pin && await bcrypt.compare(pin, s.pin)) {
      matched = s;
      break;
    }
  }

  if (!matched) throw new Error('INVALID_CREDENTIALS');

  const payload = { staffId: matched.id, hotelId: matched.hotelId, role: matched.role };
  const accessToken = jwt.sign(payload, STAFF_JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });

  return { accessToken, staff: formatStaff(matched) };
}

export function verifyStaffToken(token: string) {
  return jwt.verify(token, STAFF_JWT_SECRET) as {
    staffId: string;
    hotelId: string;
    role: StaffRole;
  };
}

export async function getStaffById(staffId: string) {
  return prisma.staffMember.findUnique({
    where: { id: staffId },
    select: {
      id: true, hotelId: true, email: true, phone: true,
      firstName: true, lastName: true, role: true, department: true,
      isActive: true, avatarUrl: true, assignedFloor: true, createdAt: true,
    },
  });
}

// ── Shifts ────────────────────────────────────────────────────

export async function startShift(staffId: string, hotelId: string) {
  await prisma.staffShift.updateMany({
    where: { staffId, isActive: true },
    data: { isActive: false, endedAt: new Date() },
  });

  return prisma.staffShift.create({
    data: { staffId, hotelId },
  });
}

export async function endShift(staffId: string) {
  return prisma.staffShift.updateMany({
    where: { staffId, isActive: true },
    data: { isActive: false, endedAt: new Date() },
  });
}

export async function getActiveShift(staffId: string) {
  return prisma.staffShift.findFirst({
    where: { staffId, isActive: true },
  });
}

// ── Unified Task List ─────────────────────────────────────────

export async function getUnifiedTasks(hotelId: string, filters: {
  staffId?: string;
  role: StaffRole;
  department: StaffDepartment;
  status?: string[];
  onlyMine?: boolean;
  roomNumber?: string;
  priority?: TaskPriority;
}) {
  const { staffId, role, department, status, onlyMine, roomNumber, priority } = filters;

  // Determine visibility by role
  const isLineStaff = role === 'LINE_STAFF';
  const canSeeAllDepts = ['GENERAL_MANAGER', 'RECEPTIONIST'].includes(role);

  // 1. Internal tasks
  const internalWhere: any = { hotelId };

  if (isLineStaff || onlyMine) {
    internalWhere.assignedToId = staffId;
  } else if (!canSeeAllDepts) {
    internalWhere.department = department;
  }

  if (status?.length) {
    internalWhere.status = { in: status };
  }
  if (roomNumber) internalWhere.roomNumber = roomNumber;
  if (priority) internalWhere.priority = priority;

  const internalTasks = await prisma.internalTask.findMany({
    where: internalWhere,
    include: {
      createdBy: { select: { id: true, firstName: true, lastName: true } },
      assignedTo: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      checklist: true,
      template: { select: { name: true } },
    },
    orderBy: [
      { priority: 'desc' },
      { dueAt: 'asc' },
      { createdAt: 'desc' },
    ],
  });

  // 2. Service requests (housekeeping, spa, transport)
  const srWhere: any = { hotelId };
  if (isLineStaff || onlyMine) srWhere.assignedStaffId = staffId;
  if (roomNumber) srWhere.roomNumber = roomNumber;
  if (priority) srWhere.priority = priority;

  const serviceRequests = await prisma.serviceRequest.findMany({
    where: srWhere,
    include: {
      category: { select: { name: true, icon: true } },
      items: { include: { serviceItem: { select: { name: true } } } },
      guest: { select: { firstName: true, phone: true } },
    },
    orderBy: [{ createdAt: 'desc' }],
  });

  // 3. Orders (food) — only F&B or managers
  let orders: any[] = [];
  if (canSeeAllDepts || department === 'FOOD_AND_BEVERAGE') {
    const orderWhere: any = {
      hotelId,
      status: { notIn: ['DELIVERED', 'COMPLETED', 'CANCELLED'] },
    };
    if (isLineStaff || onlyMine) orderWhere.assignedStaffId = staffId;
    if (roomNumber) orderWhere.roomNumber = roomNumber;

    orders = await prisma.order.findMany({
      where: orderWhere,
      include: {
        items: { include: { service: { select: { name: true } } } },
        guest: { select: { firstName: true, phone: true } },
      },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  // Normalize to unified format
  return [
    ...internalTasks.map(t => normalizeInternalTask(t)),
    ...serviceRequests.map(t => normalizeServiceRequest(t)),
    ...orders.map(t => normalizeOrder(t)),
  ].sort((a, b) => {
    const priorityWeight: Record<string, number> = { URGENT: 4, HIGH: 3, NORMAL: 2, LOW: 1 };
    const diff = (priorityWeight[b.priority] ?? 2) - (priorityWeight[a.priority] ?? 2);
    if (diff !== 0) return diff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

// ── Task Actions ──────────────────────────────────────────────

export async function updateTaskStatus(
  taskType: 'INTERNAL' | 'ORDER' | 'SERVICE_REQUEST',
  taskId: string,
  newStatus: string,
  staffId: string,
  holdReason?: string,
) {
  const now = new Date();

  if (taskType === 'INTERNAL') {
    const task = await prisma.internalTask.findUnique({ where: { id: taskId }, select: { status: true, hotelId: true, roomId: true } });
    const previousStatus = task?.status ?? null;

    const updates: any = { status: newStatus, updatedAt: now };
    if (newStatus === 'ACCEPTED') updates.acceptedAt = now;
    if (newStatus === 'IN_PROGRESS') updates.startedAt = now;
    if (newStatus === 'COMPLETED') updates.completedAt = now;
    if (newStatus === 'CLOSED') updates.closedAt = now;
    if (newStatus === 'ON_HOLD' && holdReason) updates.holdReason = holdReason;

    const result = await prisma.internalTask.update({ where: { id: taskId }, data: updates });

    if (task) {
      recordStatusChange({
        taskId, taskType, hotelId: task.hotelId,
        fromStatus: previousStatus, toStatus: newStatus,
        changedById: staffId, changedByType: 'staff',
        reason: holdReason,
      }).catch(() => {});

      // If this was a room cleaning task, update room status
      if (newStatus === 'COMPLETED' && task.roomId) {
        import('../housekeeping/room.service').then(({ onCleaningTaskCompleted }) => {
          onCleaningTaskCompleted(taskId).catch(() => {});
        }).catch(() => {});
      }
    }

    return result;
  }

  if (taskType === 'SERVICE_REQUEST') {
    const sr = await prisma.serviceRequest.findUnique({ where: { id: taskId }, select: { status: true, hotelId: true } });
    const previousStatus = sr?.status ?? null;

    const statusMap: Record<string, string> = {
      ASSIGNED: 'confirmed',
      ACCEPTED: 'accepted',
      IN_PROGRESS: 'in_progress',
      COMPLETED: 'done',
      CANCELLED: 'cancelled',
    };
    const mappedStatus = statusMap[newStatus] || newStatus;

    const srUpdates: any = {
      status: mappedStatus,
      assignedStaffId: staffId,
    };
    if (newStatus === 'ACCEPTED') srUpdates.acceptedAt = now;
    if (newStatus === 'IN_PROGRESS') srUpdates.startedAt = now;
    if (newStatus === 'COMPLETED') srUpdates.completedAt = now;

    const result = await prisma.serviceRequest.update({
      where: { id: taskId },
      data: srUpdates,
    });

    if (sr) {
      recordStatusChange({
        taskId, taskType, hotelId: sr.hotelId,
        fromStatus: previousStatus, toStatus: mappedStatus,
        changedById: staffId, changedByType: 'staff',
      }).catch(() => {});
    }

    return result;
  }

  if (taskType === 'ORDER') {
    const order = await prisma.order.findUnique({ where: { id: taskId }, select: { status: true, hotelId: true } });
    const previousStatus = order?.status ?? null;

    const statusMap: Record<string, string> = {
      ASSIGNED: 'CONFIRMED',
      IN_PROGRESS: 'PREPARING',
      COMPLETED: 'DELIVERED',
      CANCELLED: 'CANCELLED',
    };
    const mappedStatus = statusMap[newStatus] || newStatus;

    const result = await prisma.order.update({
      where: { id: taskId },
      data: {
        status: mappedStatus as any,
        assignedStaffId: staffId,
      },
    });

    if (order) {
      recordStatusChange({
        taskId, taskType, hotelId: order.hotelId,
        fromStatus: previousStatus, toStatus: mappedStatus,
        changedById: staffId, changedByType: 'staff',
      }).catch(() => {});
    }

    return result;
  }
}

export async function assignTask(
  taskType: 'INTERNAL' | 'ORDER' | 'SERVICE_REQUEST',
  taskId: string,
  assignedToId: string,
  note?: string,
  assignedById?: string,
) {
  if (taskType === 'INTERNAL') {
    const task = await prisma.internalTask.findUnique({ where: { id: taskId }, select: { status: true, hotelId: true } });
    const result = await prisma.internalTask.update({
      where: { id: taskId },
      data: {
        assignedToId,
        status: 'ASSIGNED' as any,
      },
    });
    if (task) {
      recordStatusChange({
        taskId, taskType, hotelId: task.hotelId,
        fromStatus: task.status, toStatus: 'ASSIGNED',
        changedById: assignedById, changedByType: assignedById ? 'staff' : 'system',
      }).catch(() => {});
    }
    return result;
  }
  if (taskType === 'SERVICE_REQUEST') {
    const sr = await prisma.serviceRequest.findUnique({ where: { id: taskId }, select: { status: true, hotelId: true } });
    const result = await prisma.serviceRequest.update({
      where: { id: taskId },
      data: { assignedStaffId: assignedToId, staffNote: note },
    });
    if (sr) {
      recordStatusChange({
        taskId, taskType, hotelId: sr.hotelId,
        fromStatus: sr.status, toStatus: sr.status, // assignment doesn't change SR status
        changedById: assignedById, changedByType: assignedById ? 'staff' : 'system',
      }).catch(() => {});
    }
    return result;
  }
  if (taskType === 'ORDER') {
    const order = await prisma.order.findUnique({ where: { id: taskId }, select: { status: true, hotelId: true } });
    const result = await prisma.order.update({
      where: { id: taskId },
      data: { assignedStaffId: assignedToId, staffNote: note },
    });
    if (order) {
      recordStatusChange({
        taskId, taskType, hotelId: order.hotelId,
        fromStatus: order.status, toStatus: order.status,
        changedById: assignedById, changedByType: assignedById ? 'staff' : 'system',
      }).catch(() => {});
    }
    return result;
  }
}

export async function addComment(
  taskId: string,
  taskType: string,
  staffId: string,
  text: string,
) {
  return prisma.taskComment.create({
    data: { taskId, taskType, staffId, text },
    include: { author: { select: { firstName: true, lastName: true } } },
  });
}

export async function addAttachment(
  taskId: string,
  taskType: string,
  staffId: string,
  fileUrl: string,
  label?: string,
) {
  return prisma.taskAttachment.create({
    data: { taskId, taskType, staffId, fileUrl, label },
  });
}

export async function getTaskComments(taskId: string, taskType: string) {
  return prisma.taskComment.findMany({
    where: { taskId, taskType },
    include: { author: { select: { firstName: true, lastName: true, avatarUrl: true } } },
    orderBy: { createdAt: 'asc' },
  });
}

// ── Internal Task CRUD ────────────────────────────────────────

export async function createInternalTask(data: {
  hotelId: string;
  title: string;
  description?: string;
  department: StaffDepartment;
  locationLabel?: string;
  roomNumber?: string;
  priority?: TaskPriority;
  createdById: string;
  templateId?: string;
  slaMinutes?: number;
  assignedToId?: string;
}) {
  const dueAt = data.slaMinutes
    ? new Date(Date.now() + data.slaMinutes * 60 * 1000)
    : undefined;

  const { assignedToId, ...rest } = data;
  const status: TaskStatus = assignedToId ? 'ASSIGNED' : 'NEW';

  const task = await prisma.internalTask.create({
    data: {
      ...rest,
      status,
      dueAt,
      assignedToId: assignedToId || undefined,
    },
    include: {
      createdBy: { select: { firstName: true, lastName: true } },
    },
  });

  // If template has checklist items, create checklist
  if (data.templateId) {
    const items = await prisma.checklistItem.findMany({
      where: { templateId: data.templateId },
    });
    if (items.length > 0) {
      const completedItems: Record<string, boolean> = {};
      items.forEach(i => { completedItems[i.id] = false; });
      await prisma.taskChecklist.create({
        data: { taskId: task.id, taskType: 'INTERNAL', completedItems },
      });
    }
  }

  // Record creation in audit trail
  recordStatusChange({
    taskId: task.id,
    taskType: 'INTERNAL',
    hotelId: data.hotelId,
    fromStatus: null,
    toStatus: status,
    changedById: data.createdById,
    changedByType: 'staff',
  }).catch(() => {});

  return task;
}

export async function updateChecklist(
  taskId: string,
  itemId: string,
  checked: boolean,
) {
  const checklist = await prisma.taskChecklist.findUnique({ where: { taskId } });
  if (!checklist) throw new Error('CHECKLIST_NOT_FOUND');

  const completedItems = checklist.completedItems as Record<string, boolean>;
  completedItems[itemId] = checked;

  const isComplete = Object.values(completedItems).every(Boolean);

  return prisma.taskChecklist.update({
    where: { taskId },
    data: { completedItems, isComplete },
  });
}

// ── Online Staff (on active shift) ───────────────────────────

export async function getOnlineStaff(hotelId: string) {
  const activeShifts = await prisma.staffShift.findMany({
    where: { hotelId, isActive: true },
    include: {
      staff: {
        select: {
          id: true, firstName: true, lastName: true,
          role: true, department: true, avatarUrl: true, assignedFloor: true,
        },
      },
    },
  });

  // Count active tasks per staff
  const staffIds = activeShifts.map(s => s.staffId);

  const [internalCounts, orderCounts, srCounts] = await Promise.all([
    prisma.internalTask.groupBy({
      by: ['assignedToId'],
      where: { hotelId, assignedToId: { in: staffIds }, status: { in: ['ASSIGNED', 'IN_PROGRESS'] } },
      _count: true,
    }),
    prisma.order.groupBy({
      by: ['assignedStaffId'],
      where: { hotelId, assignedStaffId: { in: staffIds }, status: { in: ['CONFIRMED', 'PREPARING'] } },
      _count: true,
    }),
    prisma.serviceRequest.groupBy({
      by: ['assignedStaffId'],
      where: { hotelId, assignedStaffId: { in: staffIds }, status: { in: ['confirmed', 'in_progress'] } },
      _count: true,
    }),
  ]);

  const countMap: Record<string, number> = {};
  internalCounts.forEach(r => { if (r.assignedToId) countMap[r.assignedToId] = (countMap[r.assignedToId] || 0) + r._count; });
  orderCounts.forEach(r => { if (r.assignedStaffId) countMap[r.assignedStaffId] = (countMap[r.assignedStaffId] || 0) + r._count; });
  srCounts.forEach(r => { if (r.assignedStaffId) countMap[r.assignedStaffId] = (countMap[r.assignedStaffId] || 0) + r._count; });

  return activeShifts.map(s => ({
    ...s.staff,
    shiftStartedAt: s.startedAt,
    activeTaskCount: countMap[s.staffId] || 0,
  }));
}

// ── Staff Management (for Dashboard) ─────────────────────────

export async function createStaffMember(data: {
  hotelId: string;
  email: string;
  phone?: string;
  firstName: string;
  lastName?: string;
  role: StaffRole;
  department: StaffDepartment;
  password: string;
  assignedFloor?: string;
}) {
  const passwordHash = await bcrypt.hash(data.password, 10);
  const { password, ...rest } = data;

  return prisma.staffMember.create({
    data: { ...rest, passwordHash },
    select: {
      id: true, email: true, firstName: true, lastName: true,
      role: true, department: true, isActive: true, createdAt: true,
    },
  });
}

export async function listStaffMembers(hotelId: string) {
  return prisma.staffMember.findMany({
    where: { hotelId },
    select: {
      id: true, email: true, phone: true, firstName: true, lastName: true,
      role: true, department: true, isActive: true, assignedFloor: true,
      avatarUrl: true, createdAt: true,
      shifts: {
        where: { isActive: true },
        take: 1,
        select: { startedAt: true },
      },
    },
    orderBy: { firstName: 'asc' },
  });
}

export async function updateStaffMember(
  staffId: string,
  hotelId: string,
  data: Partial<{
    firstName: string;
    lastName: string;
    phone: string;
    role: StaffRole;
    department: StaffDepartment;
    isActive: boolean;
    assignedFloor: string;
    password: string;
  }>,
) {
  const updates: any = { ...data };
  if (data.password) {
    updates.passwordHash = await bcrypt.hash(data.password, 10);
    delete updates.password;
  }

  return prisma.staffMember.update({
    where: { id: staffId, hotelId },
    data: updates,
    select: {
      id: true, email: true, firstName: true, lastName: true,
      role: true, department: true, isActive: true,
    },
  });
}

// ── Task Templates ────────────────────────────────────────────

export async function getTemplates(hotelId: string) {
  return prisma.taskTemplate.findMany({
    where: { hotelId, isActive: true },
    include: {
      checklistItems: {
        orderBy: { sortOrder: 'asc' },
        select: { id: true, text: true, isRequired: true, sortOrder: true },
      },
    },
    orderBy: [{ department: 'asc' }, { name: 'asc' }],
  });
}

// ── Dashboard: TMS Stats ──────────────────────────────────────

export async function getTMSStats(hotelId: string) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [byStatus, byDept, slaData] = await Promise.all([
    prisma.internalTask.groupBy({
      by: ['status'],
      where: { hotelId, createdAt: { gte: thirtyDaysAgo } },
      _count: true,
    }),
    prisma.internalTask.groupBy({
      by: ['department'],
      where: { hotelId, createdAt: { gte: thirtyDaysAgo } },
      _count: true,
    }),
    prisma.internalTask.findMany({
      where: { hotelId, dueAt: { not: null }, completedAt: { not: null }, createdAt: { gte: thirtyDaysAgo } },
      select: { dueAt: true, completedAt: true },
    }),
  ]);

  const withinSLA = slaData.filter(t => t.completedAt! <= t.dueAt!).length;
  const slaCompliance = slaData.length > 0 ? Math.round((withinSLA / slaData.length) * 100) : null;

  return {
    byStatus: byStatus.map(r => ({ status: r.status, count: r._count })),
    byDepartment: byDept.map(r => ({ department: r.department, count: r._count })),
    slaCompliance,
    slaTotal: slaData.length,
    totalTasks: byStatus.reduce((s, r) => s + r._count, 0),
  };
}

// ── Dashboard: PIN Reset ──────────────────────────────────────

export async function resetStaffPin(staffId: string, hotelId: string, newPin: string) {
  const pinHash = await bcrypt.hash(newPin, 10);
  return prisma.staffMember.update({
    where: { id: staffId, hotelId },
    data: { pin: pinHash },
    select: { id: true },
  });
}

// ── Dashboard: Template Management ───────────────────────────

export async function listTemplatesForDashboard(hotelId: string) {
  return prisma.taskTemplate.findMany({
    where: { hotelId },
    include: {
      checklistItems: { orderBy: { sortOrder: 'asc' } },
    },
    orderBy: [{ department: 'asc' }, { name: 'asc' }],
  });
}

export async function createTemplateWithItems(data: {
  hotelId: string;
  name: string;
  department: string;
  defaultPriority?: string;
  slaMinutes?: number;
  checklistItems?: { text: string; isRequired?: boolean; sortOrder?: number }[];
}) {
  const { checklistItems, department, defaultPriority, ...rest } = data;
  return prisma.taskTemplate.create({
    data: {
      ...rest,
      department: department as StaffDepartment,
      ...(defaultPriority ? { defaultPriority: defaultPriority as TaskPriority } : {}),
      checklistItems: checklistItems?.length ? {
        create: checklistItems.map((item, idx) => ({
          text: item.text,
          isRequired: item.isRequired ?? true,
          sortOrder: item.sortOrder ?? idx,
        })),
      } : undefined,
    },
    include: { checklistItems: { orderBy: { sortOrder: 'asc' } } },
  });
}

export async function updateTemplateWithItems(
  templateId: string,
  hotelId: string,
  data: {
    name?: string;
    department?: string;
    defaultPriority?: string;
    slaMinutes?: number;
    isActive?: boolean;
    checklistItems?: { text: string; isRequired?: boolean; sortOrder?: number }[];
  },
) {
  const { checklistItems, department, ...rest } = data;
  const templateData: any = { ...rest };
  if (department) templateData.department = department as StaffDepartment;

  if (checklistItems !== undefined) {
    await prisma.checklistItem.deleteMany({ where: { templateId } });
    if (checklistItems.length > 0) {
      await prisma.checklistItem.createMany({
        data: checklistItems.map((item, idx) => ({
          templateId,
          text: item.text,
          isRequired: item.isRequired ?? true,
          sortOrder: item.sortOrder ?? idx,
        })),
      });
    }
  }

  return prisma.taskTemplate.update({
    where: { id: templateId, hotelId },
    data: templateData,
    include: { checklistItems: { orderBy: { sortOrder: 'asc' } } },
  });
}

export async function deactivateTemplate(templateId: string, hotelId: string) {
  return prisma.taskTemplate.update({
    where: { id: templateId, hotelId },
    data: { isActive: false },
    select: { id: true },
  });
}

// ── Push Tokens ───────────────────────────────────────────────

export async function savePushToken(staffId: string, expoPushToken: string) {
  return prisma.staffMember.update({
    where: { id: staffId },
    data: { expoPushToken },
    select: { id: true },
  });
}

export async function getSupervisorsOnShift(hotelId: string): Promise<string[]> {
  const SUPERVISOR_ROLES = ['SUPERVISOR', 'HEAD_OF_DEPT', 'GENERAL_MANAGER'];
  const shifts = await prisma.staffShift.findMany({
    where: { hotelId, isActive: true },
    include: {
      staff: { select: { role: true, expoPushToken: true } },
    },
  });
  return shifts
    .filter(s => SUPERVISOR_ROLES.includes(s.staff.role) && s.staff.expoPushToken)
    .map(s => s.staff.expoPushToken!);
}

export async function getStaffPushToken(staffId: string): Promise<string | null> {
  const s = await prisma.staffMember.findUnique({
    where: { id: staffId },
    select: { expoPushToken: true },
  });
  return s?.expoPushToken ?? null;
}

// ── Helpers ───────────────────────────────────────────────────

function formatStaff(staff: any) {
  const { passwordHash, pin, fcmToken, ...safe } = staff;
  return safe;
}

function normalizeInternalTask(t: any) {
  return {
    id: t.id,
    taskType: 'INTERNAL' as const,
    title: t.title,
    description: t.description,
    locationLabel: t.locationLabel,
    roomNumber: t.roomNumber,
    roomId: t.roomId,
    priority: t.priority,
    status: t.status,
    department: t.department,
    assignedTo: t.assignedTo,
    createdBy: t.createdBy,
    checklist: t.checklist,
    templateName: t.template?.name,
    dueAt: t.dueAt,
    startedAt: t.startedAt,
    completedAt: t.completedAt,
    holdReason: t.holdReason,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    slaMinutes: t.slaMinutes,
    // Phase 3: Enhanced fields
    escalationLevel: t.escalationLevel ?? 0,
    slaBreached: t.slaBreached ?? false,
    etaMinutes: t.etaMinutes,
    etaUpdatedAt: t.etaUpdatedAt,
    acceptedAt: t.acceptedAt,
    rating: t.rating,
    ratingComment: t.ratingComment,
    ratedAt: t.ratedAt,
    isBillable: t.isBillable ?? false,
    cost: t.cost ? Number(t.cost) : null,
    currency: t.currency,
    source: t.source ?? 'STAFF',
    syncStatus: t.syncStatus ?? 'NOT_SYNCED',
    assigneeGroupId: t.assigneeGroupId,
    externalTmsId: t.externalTmsId,
  };
}

function normalizeServiceRequest(sr: any) {
  return {
    id: sr.id,
    taskType: 'SERVICE_REQUEST' as const,
    title: sr.category?.name || 'Service Request',
    description: sr.comment,
    locationLabel: sr.roomNumber ? `Room ${sr.roomNumber}` : undefined,
    roomNumber: sr.roomNumber,
    priority: sr.priority || 'NORMAL',
    status: mapSRStatus(sr.status),
    department: mapCategoryToDept(sr.category?.slug),
    assignedTo: sr.assignedStaffId ? { id: sr.assignedStaffId } : null,
    guest: sr.guest,
    items: sr.items?.map((i: any) => i.serviceItem?.name),
    createdAt: sr.createdAt,
    updatedAt: sr.updatedAt,
    // Phase 3: Enhanced fields
    escalationLevel: sr.escalationLevel ?? 0,
    slaBreached: sr.slaBreached ?? false,
    slaMinutes: sr.slaMinutes,
    dueAt: sr.dueAt,
    etaMinutes: sr.etaMinutes,
    etaUpdatedAt: sr.etaUpdatedAt,
    startedAt: sr.startedAt,
    completedAt: sr.completedAt,
    acceptedAt: sr.acceptedAt,
    rating: sr.rating,
    ratingComment: sr.ratingComment,
    ratedAt: sr.ratedAt,
    source: sr.source ?? 'BUTTON',
    syncStatus: sr.syncStatus ?? 'NOT_SYNCED',
    assigneeGroupId: sr.assigneeGroupId,
  };
}

function normalizeOrder(o: any) {
  return {
    id: o.id,
    taskType: 'ORDER' as const,
    title: `Order ${o.orderNumber}`,
    description: o.specialInstructions,
    locationLabel: o.roomNumber ? `Room ${o.roomNumber}` : undefined,
    roomNumber: o.roomNumber,
    priority: o.priority || 'NORMAL',
    status: mapOrderStatus(o.status),
    department: 'FOOD_AND_BEVERAGE' as const,
    assignedTo: o.assignedStaffId ? { id: o.assignedStaffId } : null,
    guest: o.guest,
    items: o.items?.map((i: any) => `${i.service?.name} x${i.quantity}`),
    subtotal: o.subtotal,
    currency: o.currency,
    orderNumber: o.orderNumber,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    // Phase 3: Enhanced fields
    escalationLevel: o.escalationLevel ?? 0,
    slaBreached: o.slaBreached ?? false,
    slaMinutes: o.slaMinutes,
    dueAt: o.dueAt,
    etaMinutes: o.etaMinutes,
    etaUpdatedAt: o.etaUpdatedAt,
    rating: o.rating,
    ratingComment: o.ratingComment,
    ratedAt: o.ratedAt,
    source: o.source ?? 'BUTTON',
    syncStatus: o.syncStatus ?? 'NOT_SYNCED',
  };
}

function mapSRStatus(status: string): TaskStatus {
  const map: Record<string, TaskStatus> = {
    pending: 'NEW',
    confirmed: 'ASSIGNED',
    in_progress: 'IN_PROGRESS',
    done: 'COMPLETED',
    cancelled: 'CANCELLED',
  };
  return map[status] || 'NEW';
}

function mapOrderStatus(status: string): TaskStatus {
  const map: Record<string, TaskStatus> = {
    PENDING: 'NEW',
    CONFIRMED: 'ASSIGNED',
    PREPARING: 'IN_PROGRESS',
    READY: 'COMPLETED',
    IN_TRANSIT: 'IN_PROGRESS',
    DELIVERED: 'CLOSED',
    CANCELLED: 'CANCELLED',
  };
  return map[status] || 'NEW';
}

function mapCategoryToDept(slug?: string): StaffDepartment {
  if (!slug) return 'HOUSEKEEPING';
  if (slug.includes('food') || slug.includes('drink') || slug.includes('bar')) return 'FOOD_AND_BEVERAGE';
  if (slug.includes('spa') || slug.includes('wellness')) return 'HOUSEKEEPING';
  if (slug.includes('transport') || slug.includes('taxi')) return 'FRONT_OFFICE';
  return 'HOUSEKEEPING';
}
