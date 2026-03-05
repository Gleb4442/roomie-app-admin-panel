import { Router, Request, Response } from 'express';
import {
  getDepartments, createDepartment, updateDepartment,
  getStaffGroups, createStaffGroup, updateStaffGroup,
  addGroupMember, removeGroupMember,
} from './department.service';
import { authenticateDashboardManager, verifyHotelAccess } from '../../shared/middleware/dashboardAuth';

const router = Router();

// All routes require dashboard auth
router.use(authenticateDashboardManager as any);

// ── Departments ─────────────────────────────────────────────

router.get('/departments/:hotelId', verifyHotelAccess as any, async (req: Request, res: Response) => {
  const departments = await getDepartments(req.params.hotelId as string);
  res.json(departments);
});

router.post('/departments/:hotelId', verifyHotelAccess as any, async (req: Request, res: Response) => {
  const { slug, names } = req.body;
  if (!slug || !names) {
    res.status(400).json({ error: 'slug and names are required' });
    return;
  }
  const dept = await createDepartment(req.params.hotelId as string, { slug, names });
  res.status(201).json(dept);
});

router.patch('/departments/:hotelId/:departmentId', verifyHotelAccess as any, async (req: Request, res: Response) => {
  const dept = await updateDepartment(
    req.params.departmentId as string,
    req.params.hotelId as string,
    req.body,
  );
  res.json(dept);
});

// ── Staff Groups ────────────────────────────────────────────

router.get('/staff-groups/:hotelId', verifyHotelAccess as any, async (req: Request, res: Response) => {
  const groups = await getStaffGroups(req.params.hotelId as string);
  res.json(groups);
});

router.post('/staff-groups/:hotelId', verifyHotelAccess as any, async (req: Request, res: Response) => {
  const { name, type, departmentId, floors, shiftStart, shiftEnd, skills } = req.body;
  if (!name || !type || !departmentId) {
    res.status(400).json({ error: 'name, type, and departmentId are required' });
    return;
  }
  const group = await createStaffGroup(req.params.hotelId as string, {
    name, type, departmentId, floors, shiftStart, shiftEnd, skills,
  });
  res.status(201).json(group);
});

router.patch('/staff-groups/:hotelId/:groupId', verifyHotelAccess as any, async (req: Request, res: Response) => {
  const group = await updateStaffGroup(
    req.params.groupId as string,
    req.params.hotelId as string,
    req.body,
  );
  res.json(group);
});

router.post('/staff-groups/:hotelId/:groupId/members', verifyHotelAccess as any, async (req: Request, res: Response) => {
  const { staffId, action } = req.body;
  if (!staffId) {
    res.status(400).json({ error: 'staffId is required' });
    return;
  }
  if (action === 'remove') {
    await removeGroupMember(req.params.groupId as string, staffId);
    res.json({ success: true });
  } else {
    const member = await addGroupMember(req.params.groupId as string, staffId);
    res.status(201).json(member);
  }
});

export default router;
