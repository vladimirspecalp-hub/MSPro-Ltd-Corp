import { Router } from "express";
import type { Db } from "@msproltd/db";
import { createDepartmentSchema, updateDepartmentSchema } from "@msproltd/shared";
import { validate } from "../middleware/validate.js";
import { departmentService, logActivity } from "../services/index.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";

export function departmentRoutes(db: Db) {
  const router = Router();
  const svc = departmentService(db);

  router.get("/companies/:companyId/departments", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const result = await svc.list(companyId);
    res.json(result);
  });

  router.post("/companies/:companyId/departments", validate(createDepartmentSchema), async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const dept = await svc.create(companyId, req.body);
    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "department.created",
      entityType: "department",
      entityId: dept.id,
      details: { name: dept.name },
    });
    res.status(201).json(dept);
  });

  router.patch("/companies/:companyId/departments/:id", validate(updateDepartmentSchema), async (req, res) => {
    const { companyId, id } = req.params as { companyId: string; id: string };
    assertCompanyAccess(req, companyId);
    const existing = await svc.getByCompanyAndId(companyId, id);
    if (!existing) {
      res.status(404).json({ error: "Department not found" });
      return;
    }
    const dept = await svc.update(id, req.body);
    if (!dept) {
      res.status(404).json({ error: "Department not found" });
      return;
    }
    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "department.updated",
      entityType: "department",
      entityId: dept.id,
      details: req.body,
    });
    res.json(dept);
  });

  router.delete("/companies/:companyId/departments/:id", async (req, res) => {
    const { companyId, id } = req.params as { companyId: string; id: string };
    assertCompanyAccess(req, companyId);
    const existing = await svc.getByCompanyAndId(companyId, id);
    if (!existing) {
      res.status(404).json({ error: "Department not found" });
      return;
    }
    const dept = await svc.remove(id);
    if (!dept) {
      res.status(404).json({ error: "Department not found" });
      return;
    }
    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "department.deleted",
      entityType: "department",
      entityId: dept.id,
    });
    res.json(dept);
  });

  return router;
}
