import { prisma } from '../../config/database';
import { GroupType } from '@prisma/client';

// ── Departments ─────────────────────────────────────────────

export async function getDepartments(hotelId: string) {
  return prisma.department.findMany({
    where: { hotelId },
    orderBy: { slug: 'asc' },
    include: {
      _count: { select: { staffGroups: true, serviceCategories: true } },
    },
  });
}

export async function createDepartment(hotelId: string, data: {
  slug: string;
  names: Record<string, string>;
}) {
  return prisma.department.create({
    data: { hotelId, slug: data.slug, names: data.names },
  });
}

export async function updateDepartment(departmentId: string, hotelId: string, data: {
  names?: Record<string, string>;
  isActive?: boolean;
}) {
  return prisma.department.update({
    where: { id: departmentId },
    data,
  });
}

/**
 * Seed default departments for a hotel from the StaffDepartment enum values.
 */
export async function seedDefaultDepartments(hotelId: string) {
  const defaults: Array<{ slug: string; names: Record<string, string> }> = [
    { slug: 'housekeeping', names: { en: 'Housekeeping', uk: 'Господарча служба', ru: 'Хозяйственная служба' } },
    { slug: 'maintenance', names: { en: 'Maintenance', uk: 'Технічна служба', ru: 'Техническая служба' } },
    { slug: 'food_and_beverage', names: { en: 'Food & Beverage', uk: 'Їжа та напої', ru: 'Еда и напитки' } },
    { slug: 'front_office', names: { en: 'Front Office', uk: 'Рецепція', ru: 'Рецепция' } },
    { slug: 'security', names: { en: 'Security', uk: 'Охорона', ru: 'Охрана' } },
    { slug: 'management', names: { en: 'Management', uk: 'Менеджмент', ru: 'Управление' } },
    { slug: 'concierge', names: { en: 'Concierge', uk: 'Консьєрж', ru: 'Консьерж' } },
  ];

  for (const dept of defaults) {
    await prisma.department.upsert({
      where: { hotelId_slug: { hotelId, slug: dept.slug } },
      update: {},
      create: { hotelId, slug: dept.slug, names: dept.names },
    });
  }
}

// ── Staff Groups ────────────────────────────────────────────

export async function getStaffGroups(hotelId: string) {
  return prisma.staffGroup.findMany({
    where: { hotelId },
    include: {
      department: { select: { id: true, slug: true, names: true } },
      members: {
        include: {
          staff: { select: { id: true, firstName: true, lastName: true, role: true, department: true } },
        },
      },
    },
    orderBy: { name: 'asc' },
  });
}

export async function createStaffGroup(hotelId: string, data: {
  name: string;
  type: GroupType;
  departmentId: string;
  floors?: number[];
  shiftStart?: string;
  shiftEnd?: string;
  skills?: string[];
}) {
  return prisma.staffGroup.create({
    data: {
      hotelId,
      name: data.name,
      type: data.type,
      departmentId: data.departmentId,
      floors: data.floors ?? [],
      shiftStart: data.shiftStart,
      shiftEnd: data.shiftEnd,
      skills: data.skills ?? [],
    },
    include: {
      department: { select: { id: true, slug: true, names: true } },
    },
  });
}

export async function updateStaffGroup(groupId: string, hotelId: string, data: {
  name?: string;
  type?: GroupType;
  floors?: number[];
  shiftStart?: string;
  shiftEnd?: string;
  skills?: string[];
  isActive?: boolean;
}) {
  return prisma.staffGroup.update({
    where: { id: groupId },
    data,
  });
}

export async function addGroupMember(groupId: string, staffId: string) {
  return prisma.staffGroupMember.upsert({
    where: { groupId_staffId: { groupId, staffId } },
    update: {},
    create: { groupId, staffId },
  });
}

export async function removeGroupMember(groupId: string, staffId: string) {
  return prisma.staffGroupMember.deleteMany({
    where: { groupId, staffId },
  });
}
