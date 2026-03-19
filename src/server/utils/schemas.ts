
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
    title: z.string().min(5).max(100),
    description: z.string().min(10).max(2000),
    severity: z.enum(['OPERATIONAL', 'DEGRADED', 'OUTAGE']),
    startTime: z.string().optional(),
    endTime: z.string().optional().nullable(),
  }),
});

export const regionSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(50),
  }),
});

export const componentSchema = z.object({
  body: z.object({
    regionId: z.string().uuid(),
    name: z.string().min(2).max(50),
    description: z.string().max(200).optional(),
  }),
});

export const subscriptionSchema = z.object({
  body: z.object({
    email: z.string().email(),
    regionId: z.string().uuid(),
  }),
});

export const templateSchema = z.object({
  body: z.object({
    componentName: z.string().min(2),
    name: z.string().min(2),
    title: z.string().min(5),
    description: z.string().min(10),
  }),
});
