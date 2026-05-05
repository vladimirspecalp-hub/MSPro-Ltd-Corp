import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { PatchInstanceGeneralSettings, BackupRetentionPolicy } from "@msproltd/shared";
import {
  DAILY_RETENTION_PRESETS,
  WEEKLY_RETENTION_PRESETS,
  MONTHLY_RETENTION_PRESETS,
  DEFAULT_BACKUP_RETENTION,
} from "@msproltd/shared";
import { Download, Globe, LogOut, RotateCcw, SlidersHorizontal } from "lucide-react";
import { authApi } from "@/api/auth";
import { instanceSettingsApi } from "@/api/instanceSettings";
import {
  updaterApi,
  type BackupInfo,
  type UpdateInfo,
  type UpdateProgressEvent,
} from "@/api/updater";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { cn } from "../lib/utils";

const FEEDBACK_TERMS_URL = import.meta.env.VITE_FEEDBACK_TERMS_URL?.trim() || "https://mspro-ltd.ing/tos";

export function InstanceGeneralSettings() {
  const { t, i18n } = useTranslation();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);

  const signOutMutation = useMutation({
    mutationFn: () => authApi.signOut(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.session });
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : t("instance.sign_out_failed"));
    },
  });

  useEffect(() => {
    setBreadcrumbs([
      { label: t("sidebar.instance_settings") },
      { label: t("instance.general") },
    ]);
  }, [setBreadcrumbs, t]);

  const generalQuery = useQuery({
    queryKey: queryKeys.instance.generalSettings,
    queryFn: () => instanceSettingsApi.getGeneral(),
  });

  const updateGeneralMutation = useMutation({
    mutationFn: instanceSettingsApi.updateGeneral,
    onSuccess: async () => {
      setActionError(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.instance.generalSettings });
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : t("instance.general_update_failed"));
    },
  });

  if (generalQuery.isLoading) {
    return <div className="text-sm text-muted-foreground">{t("common.loading")}</div>;
  }

  if (generalQuery.error) {
    return (
      <div className="text-sm text-destructive">
        {generalQuery.error instanceof Error
          ? generalQuery.error.message
          : t("common.failed_to_load")}
      </div>
    );
  }

  const censorUsernameInLogs = generalQuery.data?.censorUsernameInLogs === true;
  const keyboardShortcuts = generalQuery.data?.keyboardShortcuts === true;
  const feedbackDataSharingPreference = generalQuery.data?.feedbackDataSharingPreference ?? "prompt";
  const backupRetention: BackupRetentionPolicy = generalQuery.data?.backupRetention ?? DEFAULT_BACKUP_RETENTION;

  return (
    <div className="max-w-4xl space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">{t("instance.general")}</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {t("instance.general_subtitle")}
        </p>
      </div>

      {actionError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {actionError}
        </div>
      )}

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">{t("language.label")}</h2>
            </div>
            <p className="max-w-2xl text-sm text-muted-foreground">
              {t("instance.language_help")}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant={i18n.language === "ru" ? "default" : "outline"}
              size="sm"
              onClick={() => i18n.changeLanguage("ru")}
            >
              {t("language.ru")}
            </Button>
            <Button
              variant={i18n.language === "en" ? "default" : "outline"}
              size="sm"
              onClick={() => i18n.changeLanguage("en")}
            >
              {t("language.en")}
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <h2 className="text-sm font-semibold">{t("instance.censor_username_title")}</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              {t("instance.censor_username_help")}
            </p>
          </div>
          <ToggleSwitch
            checked={censorUsernameInLogs}
            onCheckedChange={() => updateGeneralMutation.mutate({ censorUsernameInLogs: !censorUsernameInLogs })}
            disabled={updateGeneralMutation.isPending}
            aria-label={t("instance.censor_username_aria")}
          />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <h2 className="text-sm font-semibold">{t("instance.shortcuts_title")}</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              {t("instance.shortcuts_help")}
            </p>
          </div>
          <ToggleSwitch
            checked={keyboardShortcuts}
            onCheckedChange={() => updateGeneralMutation.mutate({ keyboardShortcuts: !keyboardShortcuts })}
            disabled={updateGeneralMutation.isPending}
            aria-label={t("instance.shortcuts_aria")}
          />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="space-y-5">
          <div className="space-y-1.5">
            <h2 className="text-sm font-semibold">{t("instance.backup_title")}</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              {t("instance.backup_help")}
            </p>
          </div>

          <div className="space-y-1.5">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("instance.backup_daily")}</h3>
            <div className="flex flex-wrap gap-2">
              {DAILY_RETENTION_PRESETS.map((days) => {
                const active = backupRetention.dailyDays === days;
                return (
                  <button
                    key={days}
                    type="button"
                    disabled={updateGeneralMutation.isPending}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                      active
                        ? "border-foreground bg-accent text-foreground"
                        : "border-border bg-background hover:bg-accent/50",
                    )}
                    onClick={() =>
                      updateGeneralMutation.mutate({
                        backupRetention: { ...backupRetention, dailyDays: days },
                      })
                    }
                  >
                    <div className="text-sm font-medium">{t("instance.backup_days", { count: days })}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("instance.backup_weekly")}</h3>
            <div className="flex flex-wrap gap-2">
              {WEEKLY_RETENTION_PRESETS.map((weeks) => {
                const active = backupRetention.weeklyWeeks === weeks;
                const label = t("instance.backup_week", { count: weeks });
                return (
                  <button
                    key={weeks}
                    type="button"
                    disabled={updateGeneralMutation.isPending}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                      active
                        ? "border-foreground bg-accent text-foreground"
                        : "border-border bg-background hover:bg-accent/50",
                    )}
                    onClick={() =>
                      updateGeneralMutation.mutate({
                        backupRetention: { ...backupRetention, weeklyWeeks: weeks },
                      })
                    }
                  >
                    <div className="text-sm font-medium">{label}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("instance.backup_monthly")}</h3>
            <div className="flex flex-wrap gap-2">
              {MONTHLY_RETENTION_PRESETS.map((months) => {
                const active = backupRetention.monthlyMonths === months;
                const label = t("instance.backup_month", { count: months });
                return (
                  <button
                    key={months}
                    type="button"
                    disabled={updateGeneralMutation.isPending}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                      active
                        ? "border-foreground bg-accent text-foreground"
                        : "border-border bg-background hover:bg-accent/50",
                    )}
                    onClick={() =>
                      updateGeneralMutation.mutate({
                        backupRetention: { ...backupRetention, monthlyMonths: months },
                      })
                    }
                  >
                    <div className="text-sm font-medium">{label}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <h2 className="text-sm font-semibold">{t("instance.ai_feedback_title")}</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              {t("instance.ai_feedback_help")}
            </p>
            {FEEDBACK_TERMS_URL ? (
              <a
                href={FEEDBACK_TERMS_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                {t("instance.ai_feedback_terms")}
              </a>
            ) : null}
          </div>
          {feedbackDataSharingPreference === "prompt" ? (
            <div className="rounded-lg border border-border/70 bg-accent/20 px-3 py-2 text-sm text-muted-foreground">
              {t("instance.ai_feedback_no_default")}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {[
              {
                value: "allowed",
                label: t("instance.ai_feedback_allow"),
                description: t("instance.ai_feedback_allow_desc"),
              },
              {
                value: "not_allowed",
                label: t("instance.ai_feedback_deny"),
                description: t("instance.ai_feedback_deny_desc"),
              },
            ].map((option) => {
              const active = feedbackDataSharingPreference === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  disabled={updateGeneralMutation.isPending}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                    active
                      ? "border-foreground bg-accent text-foreground"
                      : "border-border bg-background hover:bg-accent/50",
                  )}
                  onClick={() =>
                    updateGeneralMutation.mutate({
                      feedbackDataSharingPreference: option.value as
                        | "allowed"
                        | "not_allowed",
                    })
                  }
                >
                  <div className="text-sm font-medium">{option.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {option.description}
                  </div>
                </button>
              );
            })}
          </div>
          <p
            className="text-xs text-muted-foreground"
            dangerouslySetInnerHTML={{ __html: t("instance.ai_feedback_devnote_html") }}
          />
        </div>
      </section>

      <UpdatesSection />

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <h2 className="text-sm font-semibold">{t("instance.sign_out_title")}</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              {t("instance.sign_out_help")}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={signOutMutation.isPending}
            onClick={() => signOutMutation.mutate()}
          >
            <LogOut className="size-4" />
            {signOutMutation.isPending ? t("instance.sign_out_pending") : t("instance.sign_out_button")}
          </Button>
        </div>
      </section>
    </div>
  );
}

type UpdateProgressState =
  | { kind: "idle" }
  | { kind: "started" }
  | { kind: "downloading"; downloaded: number; total: number | null }
  | { kind: "verifying" }
  | { kind: "installing" }
  | { kind: "done" };

function progressPercent(state: UpdateProgressState): number {
  switch (state.kind) {
    case "idle":
      return 0;
    case "started":
      return 2;
    case "downloading": {
      if (!state.total || state.total <= 0) return 5;
      const pct = (state.downloaded / state.total) * 80;
      return Math.max(5, Math.min(80, Math.round(pct)));
    }
    case "verifying":
      return 85;
    case "installing":
      return 95;
    case "done":
      return 100;
  }
}

function formatTimestamp(value: string, locale: string): string {
  try {
    return new Date(value).toLocaleString(locale === "ru" ? "ru-RU" : "en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return value;
  }
}

function UpdatesSection() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [progress, setProgress] = useState<UpdateProgressState>({ kind: "idle" });

  const updateInfoQuery = useQuery<UpdateInfo, Error>({
    queryKey: ["updater", "checkForUpdate"],
    queryFn: () => updaterApi.checkForUpdate(),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const backupsQuery = useQuery<BackupInfo[], Error>({
    queryKey: ["updater", "listBackups"],
    queryFn: () => updaterApi.listBackups(),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const installMutation = useMutation({
    mutationFn: async () => {
      setUpdateError(null);
      setProgress({ kind: "started" });
      await updaterApi.installUpdate((event: UpdateProgressEvent) => {
        switch (event.event) {
          case "started":
            setProgress({ kind: "started" });
            break;
          case "progress":
            setProgress({
              kind: "downloading",
              downloaded: event.data.downloaded,
              total: event.data.total,
            });
            break;
          case "verifying":
            setProgress({ kind: "verifying" });
            break;
          case "installing":
            setProgress({ kind: "installing" });
            break;
          case "done":
            setProgress({ kind: "done" });
            break;
        }
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["updater"] });
    },
    onError: (error) => {
      setUpdateError(error instanceof Error ? error.message : t("instance.updates_install_failed"));
      setProgress({ kind: "idle" });
    },
  });

  const rollbackMutation = useMutation({
    mutationFn: async () => {
      setUpdateError(null);
      await updaterApi.rollbackToBackup();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["updater"] });
    },
    onError: (error) => {
      setUpdateError(error instanceof Error ? error.message : t("instance.updates_rollback_failed"));
    },
  });

  const info = updateInfoQuery.data;
  const backups = backupsQuery.data ?? [];
  const hasBackups = backups.length > 0;
  const isChecking = updateInfoQuery.isFetching;
  const isInstalling = installMutation.isPending;
  const isRollingBack = rollbackMutation.isPending;
  const updateAvailable = info?.available === true && !!info.newVersion;
  const showProgress = isInstalling || progress.kind !== "idle";
  const percent = progressPercent(progress);

  let progressLabel = "";
  switch (progress.kind) {
    case "started":
      progressLabel = t("instance.updates_progress_started");
      break;
    case "downloading":
      progressLabel = t("instance.updates_progress_downloading", { percent });
      break;
    case "verifying":
      progressLabel = t("instance.updates_progress_verifying");
      break;
    case "installing":
      progressLabel = t("instance.updates_progress_installing");
      break;
    case "done":
      progressLabel = t("instance.updates_progress_done");
      break;
    default:
      progressLabel = "";
  }

  const checkErrorMsg = updateInfoQuery.error
    ? updateInfoQuery.error.message || t("instance.updates_check_failed")
    : null;
  const backupsErrorMsg = backupsQuery.error
    ? backupsQuery.error.message || t("instance.updates_load_backups_failed")
    : null;

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="space-y-5">
        <div className="space-y-1.5">
          <h2 className="text-sm font-semibold">{t("instance.updates_title")}</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {t("instance.updates_help")}
          </p>
        </div>

        {(updateError || checkErrorMsg) && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {updateError ?? checkErrorMsg}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-background px-3 py-2">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("instance.updates_current_version")}
            </div>
            <div className="text-sm font-medium">
              {info?.currentVersion ?? (isChecking ? t("instance.updates_checking") : "—")}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-background px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("instance.updates_available_version")}
              </span>
              {updateAvailable && (
                <Badge variant="default" className="text-[10px] tracking-wide">
                  {t("instance.updates_new_badge")}
                </Badge>
              )}
            </div>
            <div className="text-sm font-medium">
              {info?.newVersion
                ?? (isChecking ? t("instance.updates_checking") : info ? t("instance.updates_up_to_date") : "—")}
            </div>
          </div>
        </div>

        {showProgress && (
          <div className="space-y-1.5">
            <div className="text-xs text-muted-foreground">{progressLabel}</div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all duration-200"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={isChecking || isInstalling || isRollingBack}
            onClick={() => updateInfoQuery.refetch()}
          >
            {isChecking ? t("instance.updates_checking") : t("instance.updates_check_button")}
          </Button>
          <Button
            variant="default"
            size="sm"
            disabled={!updateAvailable || isInstalling || isRollingBack}
            onClick={() => installMutation.mutate()}
          >
            <Download className="size-4" />
            {isInstalling ? t("instance.updates_installing") : t("instance.updates_install_button")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!hasBackups || isInstalling || isRollingBack}
            onClick={() => rollbackMutation.mutate()}
          >
            <RotateCcw className="size-4" />
            {isRollingBack ? t("instance.updates_rolling_back") : t("instance.updates_rollback_button")}
          </Button>
        </div>

        <div className="space-y-1.5">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("instance.updates_backups_title")}
          </h3>
          {backupsErrorMsg ? (
            <div className="text-sm text-destructive">{backupsErrorMsg}</div>
          ) : !hasBackups ? (
            <div className="text-sm text-muted-foreground">{t("instance.updates_no_backups")}</div>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border bg-background">
              {backups.map((backup) => (
                <li
                  key={`${backup.version}-${backup.installedAt}`}
                  className="flex items-center justify-between px-3 py-2 text-sm"
                >
                  <span className="font-medium">v{backup.version}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatTimestamp(backup.installedAt, i18n.language)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
