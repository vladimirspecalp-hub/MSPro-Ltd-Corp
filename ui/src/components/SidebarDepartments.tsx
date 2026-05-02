import { useMemo, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, useLocation } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Plus } from "lucide-react";
import { useCompany } from "../context/CompanyContext";
import { useDialog } from "../context/DialogContext";
import { useSidebar } from "../context/SidebarContext";
import { agentsApi } from "../api/agents";
import { authApi } from "../api/auth";
import { heartbeatsApi } from "../api/heartbeats";
import { departmentsApi, type Department } from "../api/departments";
import { SIDEBAR_SCROLL_RESET_STATE } from "../lib/navigation-scroll";
import { queryKeys } from "../lib/queryKeys";
import { cn, agentRouteRef, agentUrl } from "../lib/utils";
import { useAgentOrder } from "../hooks/useAgentOrder";
import { AgentIcon } from "./AgentIconPicker";
import { BudgetSidebarMarker } from "./BudgetSidebarMarker";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { Agent } from "@msproltd/shared";

// localStorage key for persisting collapsed state per department
const DEPT_EXPANDED_KEY_PREFIX = "mspro.deptExpanded";

function getDeptExpandedKey(companyId: string): string {
  return `${DEPT_EXPANDED_KEY_PREFIX}:${companyId}`;
}

function loadExpandedState(companyId: string): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(getDeptExpandedKey(companyId));
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {};
}

function saveExpandedState(companyId: string, state: Record<string, boolean>): void {
  try {
    localStorage.setItem(getDeptExpandedKey(companyId), JSON.stringify(state));
  } catch { /* ignore */ }
}

interface AgentWithDept extends Agent {
  departmentId?: string | null;
}

function DepartmentGroup({
  department,
  agents,
  liveCountByAgent,
  activeAgentId,
  activeTab,
  isMobile,
  setSidebarOpen,
  expanded,
  onToggle,
  openNewAgent,
}: {
  department: Department;
  agents: AgentWithDept[];
  liveCountByAgent: Map<string, number>;
  activeAgentId: string | null;
  activeTab: string | null;
  isMobile: boolean;
  setSidebarOpen: (v: boolean) => void;
  expanded: boolean;
  onToggle: () => void;
  openNewAgent: () => void;
}) {
  const dotColor = department.color ?? "#6b7280";
  return (
    <Collapsible open={expanded} onOpenChange={onToggle}>
      <div className="group">
        <div className="flex items-center px-3 py-1.5">
          <CollapsibleTrigger className="flex items-center gap-1 flex-1 min-w-0">
            <ChevronRight
              className={cn(
                "h-3 w-3 text-muted-foreground/60 transition-transform opacity-0 group-hover:opacity-100",
                expanded && "rotate-90"
              )}
            />
            <span
              className="inline-block w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: dotColor }}
            />
            <span className="text-[10px] font-medium uppercase tracking-widest font-mono text-muted-foreground/60 truncate">
              {department.name}
            </span>
          </CollapsibleTrigger>
          <button
            onClick={(e) => { e.stopPropagation(); openNewAgent(); }}
            className="flex items-center justify-center h-4 w-4 rounded text-muted-foreground/60 hover:text-foreground hover:bg-accent/50 transition-colors opacity-0 group-hover:opacity-100"
            aria-label={`Нанять сотрудника в отдел ${department.name}`}
            title={`Нанять сотрудника в отдел ${department.name}`}
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
      </div>

      <CollapsibleContent>
        <div className="flex flex-col gap-0.5 mt-0.5">
          {agents.map((agent) => {
            const runCount = liveCountByAgent.get(agent.id) ?? 0;
            return (
              <NavLink
                key={agent.id}
                to={activeTab ? `${agentUrl(agent)}/${activeTab}` : agentUrl(agent)}
                state={SIDEBAR_SCROLL_RESET_STATE}
                onClick={() => {
                  if (isMobile) setSidebarOpen(false);
                }}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-1.5 text-[13px] font-medium transition-colors",
                  activeAgentId === agentRouteRef(agent)
                    ? "bg-accent text-foreground"
                    : "text-foreground/80 hover:bg-accent/50 hover:text-foreground"
                )}
              >
                <AgentIcon icon={agent.icon} className="shrink-0 h-3.5 w-3.5 text-muted-foreground" />
                <span className="flex-1 truncate">{agent.name}</span>
                {(agent.pauseReason === "budget" || runCount > 0) && (
                  <span className="ml-auto flex items-center gap-1.5 shrink-0">
                    {agent.pauseReason === "budget" ? (
                      <BudgetSidebarMarker title="Paused by budget" />
                    ) : null}
                    {runCount > 0 ? (
                      <span className="relative flex h-2 w-2">
                        <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
                      </span>
                    ) : null}
                    {runCount > 0 ? (
                      <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400">
                        {runCount} live
                      </span>
                    ) : null}
                  </span>
                )}
              </NavLink>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function SidebarDepartments() {
  const { t } = useTranslation();
  const [agentsOpen, setAgentsOpen] = useState(true);
  const { selectedCompanyId } = useCompany();
  const { openNewAgent } = useDialog();
  const { isMobile, setSidebarOpen } = useSidebar();
  const location = useLocation();

  const companyId = selectedCompanyId ?? "";

  // Load persisted expanded state; default all expanded
  const [expandedState, setExpandedState] = useState<Record<string, boolean>>(() =>
    companyId ? loadExpandedState(companyId) : {}
  );

  const toggleDept = useCallback((deptId: string) => {
    setExpandedState((prev) => {
      const next = { ...prev, [deptId]: !(prev[deptId] !== false) };
      if (companyId) saveExpandedState(companyId, next);
      return next;
    });
  }, [companyId]);

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(companyId),
    queryFn: () => agentsApi.list(companyId),
    enabled: !!companyId,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["departments", companyId],
    queryFn: () => departmentsApi.list(companyId),
    enabled: !!companyId,
    retry: false,
  });

  const { data: session } = useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: () => authApi.getSession(),
  });

  const { data: liveRuns } = useQuery({
    queryKey: queryKeys.liveRuns(companyId),
    queryFn: () => heartbeatsApi.liveRunsForCompany(companyId),
    enabled: !!companyId,
    refetchInterval: 10_000,
  });

  const liveCountByAgent = useMemo(() => {
    const counts = new Map<string, number>();
    for (const run of liveRuns ?? []) {
      counts.set(run.agentId, (counts.get(run.agentId) ?? 0) + 1);
    }
    return counts;
  }, [liveRuns]);

  const visibleAgents = useMemo(
    () => (agents ?? []).filter((a: Agent) => a.status !== "terminated") as AgentWithDept[],
    [agents]
  );

  const currentUserId = session?.user?.id ?? session?.session?.userId ?? null;
  const { orderedAgents } = useAgentOrder({
    agents: visibleAgents,
    companyId: selectedCompanyId,
    userId: currentUserId,
  });

  const agentMatch = location.pathname.match(/^\/(?:[^/]+\/)?agents\/([^/]+)(?:\/([^/]+))?/);
  const activeAgentId = agentMatch?.[1] ?? null;
  const activeTab = agentMatch?.[2] ?? null;

  const sortedDepts = useMemo(
    () => [...departments].sort((a, b) => a.position - b.position || a.name.localeCompare(b.name)),
    [departments]
  );

  // Group agents by departmentId; ungrouped agents go to "other" bucket
  const { deptAgents, ungroupedAgents } = useMemo(() => {
    if (sortedDepts.length === 0) {
      return { deptAgents: new Map<string, AgentWithDept[]>(), ungroupedAgents: orderedAgents };
    }
    const deptSet = new Set(sortedDepts.map((d) => d.id));
    const byDept = new Map<string, AgentWithDept[]>(sortedDepts.map((d) => [d.id, []]));
    const others: AgentWithDept[] = [];
    for (const agent of orderedAgents) {
      const dId = (agent as AgentWithDept).departmentId ?? null;
      if (dId && deptSet.has(dId)) {
        byDept.get(dId)!.push(agent);
      } else {
        others.push(agent);
      }
    }
    return { deptAgents: byDept, ungroupedAgents: others };
  }, [orderedAgents, sortedDepts]);

  const hasDepartments = sortedDepts.length > 0;

  return (
    <>
      {hasDepartments ? (
        // Render department groups
        <div className="flex flex-col">
          {sortedDepts.map((dept) => {
            const deptAgentList = deptAgents.get(dept.id) ?? [];
            if (deptAgentList.length === 0) return null;
            const isExpanded = expandedState[dept.id] !== false; // default open
            return (
              <DepartmentGroup
                key={dept.id}
                department={dept}
                agents={deptAgentList}
                liveCountByAgent={liveCountByAgent}
                activeAgentId={activeAgentId}
                activeTab={activeTab}
                isMobile={isMobile}
                setSidebarOpen={setSidebarOpen}
                expanded={isExpanded}
                onToggle={() => toggleDept(dept.id)}
                openNewAgent={openNewAgent}
              />
            );
          })}
          {ungroupedAgents.length > 0 && (
            <Collapsible open={agentsOpen} onOpenChange={setAgentsOpen}>
              <div className="group">
                <div className="flex items-center px-3 py-1.5">
                  <CollapsibleTrigger className="flex items-center gap-1 flex-1 min-w-0">
                    <ChevronRight
                      className={cn(
                        "h-3 w-3 text-muted-foreground/60 transition-transform opacity-0 group-hover:opacity-100",
                        agentsOpen && "rotate-90"
                      )}
                    />
                    <span className="text-[10px] font-medium uppercase tracking-widest font-mono text-muted-foreground/60">
                      {t("nav.agents")}
                    </span>
                  </CollapsibleTrigger>
                </div>
              </div>
              <CollapsibleContent>
                <div className="flex flex-col gap-0.5 mt-0.5">
                  {ungroupedAgents.map((agent) => {
                    const runCount = liveCountByAgent.get(agent.id) ?? 0;
                    return (
                      <NavLink
                        key={agent.id}
                        to={activeTab ? `${agentUrl(agent)}/${activeTab}` : agentUrl(agent)}
                        state={SIDEBAR_SCROLL_RESET_STATE}
                        onClick={() => { if (isMobile) setSidebarOpen(false); }}
                        className={cn(
                          "flex items-center gap-2.5 px-3 py-1.5 text-[13px] font-medium transition-colors",
                          activeAgentId === agentRouteRef(agent)
                            ? "bg-accent text-foreground"
                            : "text-foreground/80 hover:bg-accent/50 hover:text-foreground"
                        )}
                      >
                        <AgentIcon icon={agent.icon} className="shrink-0 h-3.5 w-3.5 text-muted-foreground" />
                        <span className="flex-1 truncate">{agent.name}</span>
                        {runCount > 0 && (
                          <span className="ml-auto flex items-center gap-1.5 shrink-0">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
                            </span>
                            <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400">{runCount} live</span>
                          </span>
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      ) : (
        // Fallback: no departments — flat agent list (same as SidebarAgents)
        <Collapsible open={agentsOpen} onOpenChange={setAgentsOpen}>
          <div className="group">
            <div className="flex items-center px-3 py-1.5">
              <CollapsibleTrigger className="flex items-center gap-1 flex-1 min-w-0">
                <ChevronRight
                  className={cn(
                    "h-3 w-3 text-muted-foreground/60 transition-transform opacity-0 group-hover:opacity-100",
                    agentsOpen && "rotate-90"
                  )}
                />
                <span className="text-[10px] font-medium uppercase tracking-widest font-mono text-muted-foreground/60">
                  {t("nav.agents")}
                </span>
              </CollapsibleTrigger>
              <button
                onClick={(e) => { e.stopPropagation(); openNewAgent(); }}
                className="flex items-center justify-center h-4 w-4 rounded text-muted-foreground/60 hover:text-foreground hover:bg-accent/50 transition-colors"
                aria-label={t("sidebar.new_agent_aria")}
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
          </div>
          <CollapsibleContent>
            <div className="flex flex-col gap-0.5 mt-0.5">
              {orderedAgents.map((agent) => {
                const runCount = liveCountByAgent.get(agent.id) ?? 0;
                return (
                  <NavLink
                    key={agent.id}
                    to={activeTab ? `${agentUrl(agent)}/${activeTab}` : agentUrl(agent)}
                    state={SIDEBAR_SCROLL_RESET_STATE}
                    onClick={() => { if (isMobile) setSidebarOpen(false); }}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-1.5 text-[13px] font-medium transition-colors",
                      activeAgentId === agentRouteRef(agent)
                        ? "bg-accent text-foreground"
                        : "text-foreground/80 hover:bg-accent/50 hover:text-foreground"
                    )}
                  >
                    <AgentIcon icon={agent.icon} className="shrink-0 h-3.5 w-3.5 text-muted-foreground" />
                    <span className="flex-1 truncate">{agent.name}</span>
                    {(agent.pauseReason === "budget" || runCount > 0) && (
                      <span className="ml-auto flex items-center gap-1.5 shrink-0">
                        {agent.pauseReason === "budget" ? (
                          <BudgetSidebarMarker title={t("sidebar.agent_paused_by_budget")} />
                        ) : null}
                        {runCount > 0 ? (
                          <span className="relative flex h-2 w-2">
                            <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
                          </span>
                        ) : null}
                        {runCount > 0 ? (
                          <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400">
                            {runCount} live
                          </span>
                        ) : null}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </>
  );
}
