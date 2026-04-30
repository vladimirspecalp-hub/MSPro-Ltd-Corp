import { and, asc, eq } from "drizzle-orm";
import type { Db } from "@msproltd/db";
import { departments } from "@msproltd/db";

export function departmentService(db: Db) {
  return {
    list: (companyId: string) =>
      db
        .select()
        .from(departments)
        .where(eq(departments.companyId, companyId))
        .orderBy(asc(departments.position), asc(departments.createdAt)),

    getById: (id: string) =>
      db
        .select()
        .from(departments)
        .where(eq(departments.id, id))
        .then((rows) => rows[0] ?? null),

    getByCompanyAndId: (companyId: string, id: string) =>
      db
        .select()
        .from(departments)
        .where(and(eq(departments.companyId, companyId), eq(departments.id, id)))
        .then((rows) => rows[0] ?? null),

    create: (companyId: string, data: Omit<typeof departments.$inferInsert, "companyId" | "id" | "createdAt" | "updatedAt">) =>
      db
        .insert(departments)
        .values({ ...data, companyId })
        .returning()
        .then((rows) => rows[0]),

    update: (id: string, data: Partial<Omit<typeof departments.$inferInsert, "id" | "companyId" | "createdAt" | "updatedAt">>) =>
      db
        .update(departments)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(departments.id, id))
        .returning()
        .then((rows) => rows[0] ?? null),

    remove: (id: string) =>
      db
        .delete(departments)
        .where(eq(departments.id, id))
        .returning()
        .then((rows) => rows[0] ?? null),
  };
}
