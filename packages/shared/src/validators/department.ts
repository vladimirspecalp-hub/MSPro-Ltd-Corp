import { z } from "zod";

export const createDepartmentSchema = z.object({
  name: z.string().min(1),
  color: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
  position: z.number().int().optional(),
});

export type CreateDepartment = z.infer<typeof createDepartmentSchema>;

export const updateDepartmentSchema = createDepartmentSchema.partial();

export type UpdateDepartment = z.infer<typeof updateDepartmentSchema>;
