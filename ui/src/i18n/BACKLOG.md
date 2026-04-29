# i18n Backlog — русификация paperclip-mspro UI

## Текущий статус

- ✅ **Фаза A (завершена)** — инфраструктура + главная навигация
- ⏳ **Фаза B (в работе)** — постраничный перевод

## Фаза A — что сделано

- Установлены пакеты: `react-i18next`, `i18next`, `i18next-browser-languagedetector`
- Создан `ui/src/i18n/config.ts` — русский язык по умолчанию, fallback на английский, сохранение выбора в `localStorage["mspro.ui.lang"]`
- Создан `ui/src/i18n/locales/ru.json` + `en.json` — ~100 ключевых строк в 10 namespace-ах (`app`, `nav`, `sidebar`, `common`, `agent`, `onboarding`, `status`, `approval`, `auth`, `instance`, `notfound`)
- Подключено в `ui/src/main.tsx`
- Переведены: `Sidebar.tsx` (главная навигация), ключевые блоки `App.tsx` (NoCompaniesStartPage, OnboardingRoutePage, BootstrapPendingPage, Loading indicators)

## Паттерн для Фазы B (как переводить новую страницу)

```tsx
import { useTranslation } from "react-i18next";

export function SomePage() {
  const { t } = useTranslation();
  return <button>{t("common.save")}</button>;
}
```

**Правила:**
1. Перед началом — `pnpm dev` в `paperclip-mspro`, открыть страницу в браузере
2. Найти все строки на странице, которые видит пользователь
3. Добавить ключи в `ru.json` + `en.json` под namespace страницы (например `dashboard.*`, `agents.*`)
4. Заменить хардкод на `t("namespace.key")`
5. Проверить визуально в браузере (горячая перезагрузка)
6. `pnpm typecheck` — убедиться что ничего не сломалось

## Backlog — 46 страниц

Приоритет P0 = первое что видит пользователь, P1 = часто используется, P2 = редко.

### P0 — первый контакт

- [ ] `pages/Dashboard.tsx` — главная сводка
- [ ] `pages/Agents.tsx` — список сотрудников
- [ ] `pages/AgentDetail.tsx` — карточка сотрудника
- [ ] `pages/NewAgent.tsx` — создание сотрудника
- [ ] `pages/Auth.tsx` + `pages/BoardClaim.tsx` — вход
- [ ] `components/OnboardingWizard.tsx` — ввод в должность
- [ ] `components/Layout.tsx` — шапка и chrome
- [ ] `components/MobileBottomNav.tsx` — мобильная навигация

### P1 — основная работа

- [~] `pages/Issues.tsx` + `pages/IssueDetail.tsx` — задачи (B-1.1 список готов; диалог/свойства/детальная — в работе)
- [ ] `pages/Projects.tsx` + `pages/ProjectDetail.tsx` + `pages/ProjectWorkspaceDetail.tsx`
- [ ] `pages/Goals.tsx` + `pages/GoalDetail.tsx`
- [ ] `pages/Approvals.tsx` + `pages/ApprovalDetail.tsx`
- [ ] `pages/Inbox.tsx`
- [ ] `pages/Routines.tsx` + `pages/RoutineDetail.tsx`
- [ ] `pages/ExecutionWorkspaceDetail.tsx`
- [ ] `pages/OrgChart.tsx`
- [ ] `pages/Costs.tsx`
- [ ] `pages/Activity.tsx`
- [ ] `pages/MyIssues.tsx`
- [ ] `components/SidebarAgents.tsx`, `SidebarProjects.tsx`, `SidebarNavItem.tsx`

### P2 — настройки и инструменты

- [ ] `pages/Companies.tsx`, `CompanySettings.tsx`, `CompanyExport.tsx`, `CompanyImport.tsx`, `CompanySkills.tsx`
- [ ] `pages/InstanceGeneralSettings.tsx`, `InstanceSettings.tsx`, `InstanceExperimentalSettings.tsx`
- [ ] `pages/AdapterManager.tsx`, `PluginManager.tsx`, `PluginPage.tsx`, `PluginSettings.tsx`
- [ ] `pages/DesignGuide.tsx`, `IssueChatUxLab.tsx`, `RunTranscriptUxLab.tsx`
- [ ] `pages/InviteLanding.tsx`, `CliAuth.tsx`
- [ ] `pages/NotFound.tsx`
- [ ] ~340 мелких компонентов в `components/` и `components/ui/`

### Не переводим

- Технические slug агентов (`ceo`, `head-of-website`, etc.)
- Имена БД-полей, API-эндпоинтов
- Названия файлов/путей
- Логи и ошибки разработчика (console.error, etc.)

## Ожидаемый объём

- **Фаза A**: ~100 строк в ru.json — **готово**
- **Фаза B**: ~800-1200 строк в ru.json — 5-7 дней работы при итеративном подходе «открыл страницу → перевёл что видно»

## Переключатель языка

✅ Добавлен в `InstanceGeneralSettings.tsx` в Фазе B-1 (коммит `960ddde`). Хранится в `localStorage["mspro.ui.lang"]`.
