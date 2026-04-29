# paperclip-mspro

Приватный MSPRO-форк проекта [Paperclip](https://github.com/paperclipai/paperclip) (MIT License). Используется как внутренняя control plane для управления AI-агентами по всем отделам MSPRO.

## Отличия от upstream

Изначальный Paperclip поддерживает и подписочную авторизацию Claude Code, и API-ключи (pay-per-token). Эта ветка **жёстко запрещает API-режим** — чтобы случайно не уйти в минус по токенному биллингу.

### Что изменено

1. **Subscription-only billing** в `claude-local` и `cursor-local` adapters
   - `resolveClaudeBillingType()` всегда возвращает `"subscription"`
   - `guardSubscriptionOnly()` — pre-flight guard который падает если в env встречаются `ANTHROPIC_API_KEY`, `CURSOR_API_KEY`, `OPENAI_API_KEY`, `CLAUDE_CODE_USE_BEDROCK`, `ANTHROPIC_BEDROCK_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
   - Bedrock-ветви вырезаны из `execute.ts` и `test.ts`

2. **Удалены лишние adapters**
   - codex-local, gemini-local, opencode-local, pi-local, openclaw-gateway, hermes-local
   - Остались: `claude_local`, `cursor`, `process`, `http`

3. **UI косметика**
   - Title → «MSPRO Operations»
   - Primary-цвет — фирменный `#820101`, accent — `#B14141`
   - На странице создания агента — баннер «Subscription-only»

## Предусловия

- `claude` CLI установлен и авторизован через `claude login` (Max-подписка)
- Node 20+, pnpm 9+
- Postgres для prod, PGlite (embedded) для dev

## Запуск (dev)

```bash
pnpm install
pnpm dev    # API + UI на http://localhost:3100
```

## История

- `c6667df` — initial fork
- `adad665` — subscription-only billing lockdown
- `6f1e7bb` — removed unused adapters
- (далее — косметика + первый запуск)

## Upstream

Для сравнения с оригиналом и обновлений см. `C:\CODE\paperclip`. Делать merge вручную, предварительно прогоняя guard-тесты.

## Оригинальная документация Paperclip

См. `doc/`:
- [doc/GOAL.md](doc/GOAL.md) — продуктовое видение
- [doc/PRODUCT.md](doc/PRODUCT.md) — концепции Company, Agent, Task
- [doc/SPEC-implementation.md](doc/SPEC-implementation.md) — V1 build contract
- [doc/DEVELOPING.md](doc/DEVELOPING.md) — разработка
- [doc/DATABASE.md](doc/DATABASE.md) — схема БД

## Лицензия

Upstream под MIT (см. [LICENSE](LICENSE)). Этот форк — приватный, не публикуется.
