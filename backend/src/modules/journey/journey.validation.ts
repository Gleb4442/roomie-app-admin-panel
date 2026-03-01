import { z } from 'zod';

export const currentStayQuerySchema = z.object({
  hotelId: z.string().uuid().optional(),
});

export const updateStageSchema = z.object({
  stayId: z.string().uuid(),
  stage: z.enum(['PRE_ARRIVAL', 'CHECKED_IN', 'IN_STAY', 'CHECKOUT', 'POST_STAY', 'BETWEEN_STAYS']),
  roomNumber: z.string().optional(),
});

export type CurrentStayQuery = z.infer<typeof currentStayQuerySchema>;
export type UpdateStageInput = z.infer<typeof updateStageSchema>;
