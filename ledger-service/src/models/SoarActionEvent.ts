import { z } from 'zod'

export const SoarActionEventSchema = z.object({
  runId: z.string().uuid(),
  playbookId: z.string().uuid(),
  stepId: z.string(),
  action: z.string(),
  status: z.enum(['success', 'failed', 'skipped']),
  details: z.record(z.any()).optional(),
  timestamp: z.string().datetime()
})

export type SoarActionEvent = z.infer<typeof SoarActionEventSchema>
