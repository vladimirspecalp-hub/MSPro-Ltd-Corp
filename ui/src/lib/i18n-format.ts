/**
 * Date / number / relative-time formatters that respect i18next current language.
 *
 * Используется вместо `toLocaleDateString("en-US", ...)` и хардкод-строк "5m ago".
 * Авто-обновляется при смене языка через i18n.changeLanguage().
 */
import i18n from "@/i18n/config";

/**
 * BCP-47 локаль текущего языка ("ru-RU" / "en-US"), пригодная для Intl.
 */
export function currentLocale(): string {
  switch (i18n.language) {
    case "ru":
      return "ru-RU";
    case "en":
    default:
      return "en-US";
  }
}

/**
 * Длинная дата: "24 апреля 2026 г." / "April 24, 2026"
 */
export function formatDate(value: string | number | Date | null | undefined): string {
  if (value == null) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(currentLocale(), {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(d);
}

/**
 * Дата и время: "24 апр. 2026 г., 16:38" / "Apr 24, 2026, 4:38 PM"
 */
export function formatDateTime(value: string | number | Date | null | undefined): string {
  if (value == null) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(currentLocale(), {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/**
 * Короткая дата: "24.04.2026" / "4/24/2026"
 */
export function formatShortDate(value: string | number | Date | null | undefined): string {
  if (value == null) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(currentLocale()).format(d);
}

/**
 * Только время: "16:38" / "4:38 PM"
 */
export function formatTime(value: string | number | Date | null | undefined): string {
  if (value == null) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(currentLocale(), {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/**
 * Число с локальной группировкой разрядов: "1 234 567" / "1,234,567"
 */
export function formatNumber(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "";
  return new Intl.NumberFormat(currentLocale()).format(value);
}

/**
 * Денежная сумма из центов: "$12.34" / "12,34 ₽" (зависит от валюты)
 * Для USD — оставляем USD везде, валюту не локализуем.
 */
export function formatCurrencyCents(cents: number | null | undefined, currency = "USD"): string {
  if (cents == null || Number.isNaN(cents)) return "";
  const amount = cents / 100;
  return new Intl.NumberFormat(currentLocale(), {
    style: "currency",
    currency,
    minimumFractionDigits: amount === Math.floor(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Относительное время в стиле "2 минуты назад" / "2 minutes ago".
 *
 * Использует Intl.RelativeTimeFormat — он сам обрабатывает русские plurals
 * корректно (1 минута / 2 минуты / 5 минут / 21 минута).
 *
 * Для "только что" возвращает соответствующий ключ из i18n (т.к. RelativeTimeFormat
 * не поддерживает "0 секунд назад" — выдаёт коряво).
 */
export function formatRelativeTime(
  value: string | number | Date | null | undefined,
  options?: { now?: Date; t?: (key: string) => string },
): string {
  if (value == null) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";

  const now = options?.now ?? new Date();
  const diffMs = d.getTime() - now.getTime();
  const absSec = Math.abs(diffMs) / 1000;

  // < 30 секунд — "только что"
  if (absSec < 30) {
    return options?.t ? options.t("relative.just_now") : i18n.t("relative.just_now");
  }

  const rtf = new Intl.RelativeTimeFormat(currentLocale(), { numeric: "auto" });

  // Выбираем подходящую единицу
  const minute = 60;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;
  const month = 30 * day;
  const year = 365 * day;

  let unit: Intl.RelativeTimeFormatUnit;
  let amount: number;
  if (absSec < minute) {
    unit = "second";
    amount = Math.round(diffMs / 1000);
  } else if (absSec < hour) {
    unit = "minute";
    amount = Math.round(diffMs / 1000 / minute);
  } else if (absSec < day) {
    unit = "hour";
    amount = Math.round(diffMs / 1000 / hour);
  } else if (absSec < week) {
    unit = "day";
    amount = Math.round(diffMs / 1000 / day);
  } else if (absSec < month) {
    unit = "week";
    amount = Math.round(diffMs / 1000 / week);
  } else if (absSec < year) {
    unit = "month";
    amount = Math.round(diffMs / 1000 / month);
  } else {
    unit = "year";
    amount = Math.round(diffMs / 1000 / year);
  }

  return rtf.format(amount, unit);
}
