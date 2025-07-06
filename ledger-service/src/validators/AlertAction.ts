import { z } from 'zod'

export const AlertActionSchema = z.object({
  id: z.string(),
  runId: z.string().uuid(),
  playbookId: z.string().uuid(),
  stepId: z.string(),
  action: z.string(),
  status: z.string(),
  timestamp: z.string().datetime()
})

export type AlertAction = z.infer<typeof AlertActionSchema>
