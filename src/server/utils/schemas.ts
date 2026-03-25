
import { z } from 'zod';

export const loginSchema = z.object({
  body: z.object({
    username: z.string().min(3),
    password: z.string().min(6),
  }),
});

export const incidentSchema = z.object({
  body: z.object({
    componentIds: z.array(z.string().uuid()).min(1),
    title: z.string().min(1).max(200),
    description: z.string().min(1).max(5000),
    severity: z.enum(['OPERATIONAL', 'DEGRADED', 'OUTAGE']),
    startTime: z.string().optional(),
    endTime: z.string().optional().nullable(),
  }),
});

export const regionSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100),
  }),
});

export const componentSchema = z.object({
  body: z.object({
    regionId: z.string().uuid(),
    name: z.string().min(1).max(100),
    description: z.string().max(1000).optional(),
  }),
});

export const subscriptionSchema = z.object({
  body: z.object({
    email: z.string().email(),
    regionId: z.string().uuid().optional(),
    regionIds: z.array(z.string().uuid()).optional(),
  }).refine(data => data.regionId || (data.regionIds && data.regionIds.length > 0), {
    message: "Either regionId or regionIds must be provided",
    path: ["regionId"],
  }),
});

export const templateSchema = z.object({
  body: z.object({
    componentName: z.string().min(1),
    name: z.string().min(1),
    title: z.string().min(1),
    description: z.string().min(1),
  }),
});
