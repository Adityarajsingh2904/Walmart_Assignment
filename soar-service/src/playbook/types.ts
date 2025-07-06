import { z } from 'zod';

export const StepSchema = z.discriminatedUnion('type', [
  z.object({
    id: z.string(),
    type: z.literal('isolate_host'),
    host: z.string(),
  }),
  z.object({
    id: z.string(),
    type: z.literal('reset_password'),
    host: z.string(),
    user: z.string(),
  }),
  z.object({
    id: z.string(),
    type: z.literal('notify'),
    channel: z.string(),
    target: z.string(),
    message: z.string(),
  }),
]);

export type Step = z.infer<typeof StepSchema>;

export const PlaybookSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  triggers: z.object({
    class: z.string(),
    severity: z.array(z.enum(['low', 'medium', 'high'])),
  }),
  steps: z.array(StepSchema),
  version: z.string(),
  createdAt: z.string().datetime().optional(),
});

export type Playbook = z.infer<typeof PlaybookSchema>;
