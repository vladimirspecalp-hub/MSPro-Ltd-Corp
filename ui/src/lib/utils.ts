import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { deriveAgentUrlKey, deriveProjectUrlKey, normalizeProjectUrlKey, hasNonAsciiContent } from "@paperclipai/shared";
import type { BillingType, FinanceDirection, FinanceEventKind } from "@paperclipai/shared";
import i18n from "@/i18n/config";
import {
  formatDate as i18nFormatDate,
  formatDateTime as i18nFormatDateTime,
  formatShortDate as i18nFormatShortDate,
  formatRelativeTime,
} from "./i18n-format";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Длинная дата с локалью текущего языка.
 * Backwards-compatible — возвращает string как раньше.
 */
export function formatDate(date: Date | string): string {
  return i18nFormatDate(date);
}

export function formatDateTime(date: Date | string): string {
  return i18nFormatDateTime(date);
}

export function formatShortDate(date: Date | string): string {
  return i18nFormatShortDate(date);
}

/**
 * "5 минут назад" / "5 minutes ago".
 * Использует Intl.RelativeTimeFormat — корректные русские plurals автоматически.
 */
export function relativeTime(date: Date | string): string {
  return formatRelativeTime(date);
}

export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

/**
 * Provider display name — "Anthropic", "OpenAI", и т.п. — обычно не переводится
 * (это бренды). Но для AWS Bedrock / Claude CLI / etc. — берём из i18n.
 */
export function providerDisplayName(provider: string): string {
  const key = `providers.${provider.toLowerCase()}`;
  const translated = i18n.t(key, { defaultValue: "" });
  if (translated) return translated;
  // Fallback на брендовое имя без перевода
  const fallback: Record<string, string> = {
    anthropic: "Anthropic",
    aws_bedrock: "AWS Bedrock",
    openai: "OpenAI",
    openrouter: "OpenRouter",
    chatgpt: "ChatGPT",
    google: "Google",
    cursor: "Cursor",
    jetbrains: "JetBrains AI",
  };
  return fallback[provider.toLowerCase()] ?? provider;
}

export function billingTypeDisplayName(billingType: BillingType): string {
  return i18n.t(`billing_type.${billingType}`, {
    defaultValue: billingType.replace(/_/g, " "),
  });
}

export function quotaSourceDisplayName(source: string): string {
  return i18n.t(`quota_source.${source}`, { defaultValue: source });
}

function coerceBillingType(value: unknown): BillingType | null {
  if (
    value === "metered_api" ||
    value === "subscription_included" ||
    value === "subscription_overage" ||
    value === "credits" ||
    value === "fixed" ||
    value === "unknown"
  ) {
    return value;
  }
  return null;
}

function readRunCostUsd(payload: Record<string, unknown> | null): number {
  if (!payload) return 0;
  for (const key of ["costUsd", "cost_usd", "total_cost_usd"] as const) {
    const value = payload[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return 0;
}

export function visibleRunCostUsd(
  usage: Record<string, unknown> | null,
  result: Record<string, unknown> | null = null,
): number {
  const billingType = coerceBillingType(usage?.billingType) ?? coerceBillingType(result?.billingType);
  if (billingType === "subscription_included") return 0;
  return readRunCostUsd(usage) || readRunCostUsd(result);
}

export function financeEventKindDisplayName(eventKind: FinanceEventKind): string {
  return i18n.t(`finance_event.${eventKind}`, {
    defaultValue: eventKind.replace(/_/g, " "),
  });
}

export function financeDirectionDisplayName(direction: FinanceDirection): string {
  return direction === "credit"
    ? i18n.t("finance_direction.credit", { defaultValue: "Credit" })
    : i18n.t("finance_direction.debit", { defaultValue: "Debit" });
}

/** Build an issue URL using the human-readable identifier when available. */
export function issueUrl(issue: { id: string; identifier?: string | null }): string {
  return `/issues/${issue.identifier ?? issue.id}`;
}

/** Build an agent route URL using the short URL key when available. */
export function agentRouteRef(agent: { id: string; urlKey?: string | null; name?: string | null }): string {
  return agent.urlKey ?? deriveAgentUrlKey(agent.name, agent.id);
}

/** Build an agent URL using the short URL key when available. */
export function agentUrl(agent: { id: string; urlKey?: string | null; name?: string | null }): string {
  return `/agents/${agentRouteRef(agent)}`;
}

/** Build a project route reference, falling back to UUID when the derived key is ambiguous. */
export function projectRouteRef(project: { id: string; urlKey?: string | null; name?: string | null }): string {
  const key = project.urlKey ?? deriveProjectUrlKey(project.name, project.id);
  // Guard for rolling deploys or legacy data where the server returned a bare slug without UUID suffix.
  if (key === normalizeProjectUrlKey(project.name) && hasNonAsciiContent(project.name)) return project.id;
  return key;
}

/** Build a project URL using the short URL key when available. */
export function projectUrl(project: { id: string; urlKey?: string | null; name?: string | null }): string {
  return `/projects/${projectRouteRef(project)}`;
}

/** Build a project workspace URL scoped under its project. */
export function projectWorkspaceUrl(
  project: { id: string; urlKey?: string | null; name?: string | null },
  workspaceId: string,
): string {
  return `${projectUrl(project)}/workspaces/${workspaceId}`;
}
