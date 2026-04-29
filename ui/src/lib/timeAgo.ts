/**
 * Relative time formatter — "5 минут назад" / "5m ago".
 *
 * Уважает текущий язык i18next. Использует Intl.RelativeTimeFormat —
 * правильные русские plurals (1 минуту / 2 минуты / 5 минут / 21 минута)
 * получаются автоматически.
 *
 * Для коротких периодов (< 30 сек) возвращает "только что" / "just now"
 * через i18n ключ relative.just_now.
 */
import { formatRelativeTime } from "./i18n-format";

export function timeAgo(date: Date | string): string {
  return formatRelativeTime(date);
}
