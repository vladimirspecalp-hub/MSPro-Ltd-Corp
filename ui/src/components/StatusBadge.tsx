import { cn } from "../lib/utils";
import { statusBadge, statusBadgeDefault } from "../lib/status-colors";

const STATUS_LABELS_RU: Record<string, string> = {
  backlog: "Очередь",
  planned: "Запланирован",
  in_progress: "В работе",
  active: "Активный",
  paused: "На паузе",
  blocked: "Заблокирован",
  in_review: "На проверке",
  review: "Проверка",
  completed: "Завершён",
  done: "Готово",
  cancelled: "Отменён",
  canceled: "Отменён",
  archived: "В архиве",
  draft: "Черновик",
  todo: "К выполнению",
  open: "Открыт",
  closed: "Закрыт",
};

export function StatusBadge({ status }: { status: string }) {
  const label = STATUS_LABELS_RU[status] ?? status.replace("_", " ");
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap shrink-0",
        statusBadge[status] ?? statusBadgeDefault
      )}
    >
      {label}
    </span>
  );
}
