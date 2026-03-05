/**
 * UnifiedTask — single contract for all frontends.
 *
 * Normalizes InternalTask, ServiceRequest, and Order into one shape.
 * Used by staff mobile, dashboard, and guest mobile.
 */

export type TaskType = 'INTERNAL' | 'ORDER' | 'SERVICE_REQUEST';

export type TaskSource = 'STAFF' | 'BUTTON' | 'CHAT' | 'QR' | 'SYSTEM' | 'POS';

export type SyncStatus = 'NOT_SYNCED' | 'SYNCING' | 'SYNCED' | 'SYNC_FAILED';

export interface UnifiedTask {
  // Identity
  id: string;
  taskType: TaskType;
  hotelId: string;

  // Display
  title: string;
  description?: string | null;
  category?: string | null;
  categorySlug?: string | null;
  department?: string | null;

  // Location
  roomNumber?: string | null;
  locationLabel?: string | null;

  // Status & Priority
  status: string;
  priority: string;
  escalationLevel: number;
  slaBreached: boolean;
  holdReason?: string | null;

  // Timing
  slaMinutes?: number | null;
  dueAt?: string | null;
  etaMinutes?: number | null;
  etaUpdatedAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  acceptedAt?: string | null;
  createdAt: string;
  updatedAt: string;

  // Assignment
  assignedStaffId?: string | null;
  assignedStaffName?: string | null;
  assigneeGroupId?: string | null;
  createdById?: string | null;
  createdByName?: string | null;

  // Guest info (for service requests / orders)
  guestId?: string | null;
  guestName?: string | null;

  // Rating
  rating?: number | null;
  ratingComment?: string | null;
  ratedAt?: string | null;

  // Billing (internal tasks)
  isBillable?: boolean;
  cost?: number | null;
  currency?: string | null;

  // Source & Integration
  source: string;
  chatMessageId?: string | null;
  externalTmsId?: string | null;
  externalTmsType?: string | null;
  syncStatus: string;

  // Order-specific
  orderNumber?: string | null;
  orderType?: string | null;
  items?: UnifiedTaskItem[] | null;
  totalAmount?: number | null;

  // Checklist
  hasChecklist?: boolean;
  checklistComplete?: boolean;

  // Relations (included on detail view)
  statusHistory?: TaskStatusEntry[] | null;
  notes?: TaskNoteEntry[] | null;
  photos?: TaskPhotoEntry[] | null;
  comments?: TaskCommentEntry[] | null;
}

export interface UnifiedTaskItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  notes?: string | null;
}

export interface TaskStatusEntry {
  id: string;
  fromStatus?: string | null;
  toStatus: string;
  changedById?: string | null;
  changedByType: string;
  reason?: string | null;
  createdAt: string;
}

export interface TaskNoteEntry {
  id: string;
  authorId: string;
  authorType: string;
  content: string;
  isInternal: boolean;
  createdAt: string;
}

export interface TaskPhotoEntry {
  id: string;
  url: string;
  type: string;
  uploadedById: string;
  uploadedAt: string;
}

export interface TaskCommentEntry {
  id: string;
  staffId: string;
  staffName?: string;
  text: string;
  createdAt: string;
}
