import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "@/lib/router";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { accessApi } from "../api/access";
import { authApi } from "../api/auth";
import { queryKeys } from "../lib/queryKeys";

export function CliAuthPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const params = useParams();
  const [searchParams] = useSearchParams();
  const challengeId = (params.id ?? "").trim();
  const token = (searchParams.get("token") ?? "").trim();
  const currentPath = useMemo(
    () => `/cli-auth/${encodeURIComponent(challengeId)}${token ? `?token=${encodeURIComponent(token)}` : ""}`,
    [challengeId, token],
  );

  const sessionQuery = useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: () => authApi.getSession(),
    retry: false,
  });
  const challengeQuery = useQuery({
    queryKey: ["cli-auth-challenge", challengeId, token],
    queryFn: () => accessApi.getCliAuthChallenge(challengeId, token),
    enabled: challengeId.length > 0 && token.length > 0,
    retry: false,
  });

  const approveMutation = useMutation({
    mutationFn: () => accessApi.approveCliAuthChallenge(challengeId, token),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.auth.session });
      await challengeQuery.refetch();
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => accessApi.cancelCliAuthChallenge(challengeId, token),
    onSuccess: async () => {
      await challengeQuery.refetch();
    },
  });

  if (!challengeId || !token) {
    return <div className="mx-auto max-w-xl py-10 text-sm text-destructive">{t("cli_auth.invalid_url")}</div>;
  }

  if (sessionQuery.isLoading || challengeQuery.isLoading) {
    return <div className="mx-auto max-w-xl py-10 text-sm text-muted-foreground">{t("cli_auth.loading")}</div>;
  }

  if (challengeQuery.error) {
    return (
      <div className="mx-auto max-w-xl py-10">
        <div className="rounded-lg border border-border bg-card p-6">
          <h1 className="text-lg font-semibold">{t("cli_auth.unavailable_title")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {challengeQuery.error instanceof Error ? challengeQuery.error.message : t("cli_auth.invalid_or_expired")}
          </p>
        </div>
      </div>
    );
  }

  const challenge = challengeQuery.data;
  if (!challenge) {
    return <div className="mx-auto max-w-xl py-10 text-sm text-destructive">{t("cli_auth.unavailable_title")}</div>;
  }

  if (challenge.status === "approved") {
    return (
      <div className="mx-auto max-w-xl py-10">
        <div className="rounded-lg border border-border bg-card p-6">
          <h1 className="text-xl font-semibold">{t("cli_auth.approved_title")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("cli_auth.approved_subtitle")}
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            {t("cli_auth.command")}: <span className="font-mono text-foreground">{challenge.command}</span>
          </p>
        </div>
      </div>
    );
  }

  if (challenge.status === "cancelled" || challenge.status === "expired") {
    return (
      <div className="mx-auto max-w-xl py-10">
        <div className="rounded-lg border border-border bg-card p-6">
          <h1 className="text-xl font-semibold">
            {challenge.status === "expired" ? t("cli_auth.expired_title") : t("cli_auth.cancelled_title")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("cli_auth.restart_prompt")}
          </p>
        </div>
      </div>
    );
  }

  if (challenge.requiresSignIn || !sessionQuery.data) {
    return (
      <div className="mx-auto max-w-xl py-10">
        <div className="rounded-lg border border-border bg-card p-6">
          <h1 className="text-xl font-semibold">{t("board_claim.signin_required_title")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("cli_auth.signin_required_subtitle")}
          </p>
          <Button asChild className="mt-4">
            <Link to={`/auth?next=${encodeURIComponent(currentPath)}`}>{t("board_claim.signin_or_create")}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl py-10">
      <div className="rounded-lg border border-border bg-card p-6">
        <h1 className="text-xl font-semibold">{t("cli_auth.title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("cli_auth.subtitle")}
        </p>

        <div className="mt-5 space-y-3 text-sm">
          <div>
            <div className="text-muted-foreground">{t("cli_auth.command")}</div>
            <div className="font-mono text-foreground">{challenge.command}</div>
          </div>
          <div>
            <div className="text-muted-foreground">{t("cli_auth.client")}</div>
            <div className="text-foreground">{challenge.clientName ?? "msproltdai cli"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">{t("cli_auth.requested_access")}</div>
            <div className="text-foreground">
              {challenge.requestedAccess === "instance_admin_required" ? t("cli_auth.access_admin") : t("cli_auth.access_board")}
            </div>
          </div>
          {challenge.requestedCompanyName && (
            <div>
              <div className="text-muted-foreground">{t("cli_auth.requested_company")}</div>
              <div className="text-foreground">{challenge.requestedCompanyName}</div>
            </div>
          )}
        </div>

        {(approveMutation.error || cancelMutation.error) && (
          <p className="mt-4 text-sm text-destructive">
            {(approveMutation.error ?? cancelMutation.error) instanceof Error
              ? ((approveMutation.error ?? cancelMutation.error) as Error).message
              : t("cli_auth.update_failed")}
          </p>
        )}

        {!challenge.canApprove && (
          <p className="mt-4 text-sm text-destructive">
            {t("cli_auth.requires_admin")}
          </p>
        )}

        <div className="mt-5 flex gap-3">
          <Button
            onClick={() => approveMutation.mutate()}
            disabled={!challenge.canApprove || approveMutation.isPending || cancelMutation.isPending}
          >
            {approveMutation.isPending ? t("cli_auth.approving") : t("cli_auth.approve_action")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => cancelMutation.mutate()}
            disabled={approveMutation.isPending || cancelMutation.isPending}
          >
            {cancelMutation.isPending ? t("cli_auth.cancelling") : t("common.cancel")}
          </Button>
        </div>
      </div>
    </div>
  );
}
