# Teach — мобильный клиент

React Native + Expo (SDK 57), Expo Router, TypeScript. iOS-first, Android поддерживается той же кодовой базой.

## Почему React Native + Expo, а не SwiftUI

- **Android обязателен.** SwiftUI дал бы вторую кодовую базу на Kotlin/Compose для всех девяти экранов и всей офлайн-логики. Один код на обе платформы — главный аргумент.
- **Дизайн уже описан в веб-терминах** (CSS-переменные, flex, px). Токены и вёрстка переносятся в RN почти один в один; SwiftUI потребовал бы переосмысления каждого размера.
- **Экосистема закрывает все требования брифа:** `expo-sqlite` (офлайн-first БД), `expo-secure-store` (токен отдельно от БД), `expo-apple-authentication` + `expo-auth-session` (Apple/Google), `expo-speech-recognition` (платформенный STT: SFSpeechRecognizer / Android SpeechRecognizer), `ts-fsrs` (FSRS без собственной реализации).
- **Скорость итераций:** hot reload, web-превью для проверки токенов, EAS для сборок. Бриф §5.2 сам склоняется к этому варианту при .NET-бэкенде.
- Цена: нативные модули (STT, Apple Sign-In) требуют dev-build, а не Expo Go. Это разовая настройка.

## Структура

```
mobile/
  app/                      # маршруты Expo Router (файл = экран)
    _layout.tsx             # шрифты, тема, Stack
    (auth)/sign-in.tsx      # авторизация
    (tabs)/                 # Сегодня · Повторы · Справочники · Предметы
    session/[id].tsx        # сессия урока / повторов
    recap.tsx               # разбор
    setup.tsx               # новый предмет (4 шага)
    subject/[id].tsx        # настройки предмета
    profile.tsx             # профиль
    ref/[id].tsx            # детальный справочник
  src/
    theme/                  # tokens.ts (DESIGN.md §2–3), typography.ts, ThemeProvider
    ui/                     # примитивы: Txt, Screen, Logo, Button, Card, Pill, Segment, Toggle…
    i18n/                   # словарь ru/en (из прототипа), типизированные ключи
    store/                  # zustand: settings (g), session, auth
    db/                     # expo-sqlite: схема, миграции, репозитории
    domain/                 # типы (Subject, Lesson, LearningRecord, ReviewItem, Reference) и FSRS
    features/               # логика экранов: session, reviews, refs, subjects
    voice/                  # STT-адаптер: push-to-talk / hands-free
  assets/
```

Правило: `app/` содержит только маршруты и композицию; всё, что можно протестировать без навигации, живёт в `src/`.

## Токены

`src/theme/tokens.ts` — палитра light/dark с именами CSS-переменных прототипа (`--mintInk` → `c.mintInk`), радиусы, отступы, размеры хит-таргетов. `src/theme/typography.ts` — Golos Text (400–700) и IBM Plex Mono (400–500) через `@expo-google-fonts/*`, именованные стили (`h1`, `question`, `kicker`, `chip`…). Доступ через `useTheme()`; текст — `<Txt t="h1" color="ink">`.

Тема выбирается в Профиле; до выбора следует системной.

## Иконки и релиз

`scripts/make-icons.py` рисует все иконки из знака бренда без внешних зависимостей (iOS без альфа-канала, adaptive-иконки Android, сплэш, favicon). Версия `expo.version` и `ios.buildNumber` в `app.json`; `ITSAppUsesNonExemptEncryption=false` снимает вопрос про шифрование в App Store Connect. Кнопка Google показывается только при заданных client id (в dev-сборке всегда). Сидовые предметы (английский, QA, история) помечены чипом «демо».

## Хранилище

`src/db/` — expo-sqlite, файл на аккаунт (`teach-<accountId>.db`), миграции через `PRAGMA user_version`, таблицы `review_cards`, `review_log`, `kv`. Выход из аккаунта закрывает БД, файл остаётся. На web (только превью) — in-memory репозиторий с тем же интерфейсом.

Интервалы повторов — FSRS (`ts-fsrs`, без краткосрочных шагов): ошибка → 1 день, успех → 3 дня на новой карточке. Одна ссылка на шаг урока — одна карточка; повторное прохождение пересчитывает срок.

## Контент и прогрессия

`src/content/` — `ContentService`: локальная заглушка прототипа или `HttpContentService` при `EXPO_PUBLIC_CONTENT_URL` (сервер `server/`). Мастер создаёт предмет, сервер готовит диагностику в фоне; после каждого разбора записи уходят на сервер и готовится следующий урок, карточка на «Сегодня» показывает этапы, затем «Урок N · …». Пока идёт урок N, сессия просит сервер заготовить N+1 (`prefetchNextLesson`), и после «Готово» или × в разборе следующий урок обычно приходит сразу. Если приложение закрыли во время подготовки, вкладки при запуске продолжают ждать урок (`resumePrepare`), а не шлют разбор повторно. Длительность урока из настроек предмета (3/5/10 мин, по умолчанию 10) уходит на сервер и задаёт бюджет урока. Сидовые предметы (английский, QA, история) статичны. Язык предмета определяется при создании (`src/domain/languages.ts`) и задаёт локаль распознавания и подписи пилла «Язык распознавания».

## Запуск

```bash
npm install
npx expo start          # Metro для dev-сборки
npx expo start --web    # быстрый просмотр (SecureStore и SQLite заменены памятью)
npm run typecheck
npm test
```

Dev-переменные: `EXPO_PUBLIC_AUTH_LOCAL=1` — вход локальной сессией без провайдера (симулятор, автотесты); `EXPO_PUBLIC_GOOGLE_{IOS,ANDROID,WEB}_CLIENT_ID` — Google-вход; `EXPO_PUBLIC_CONTENT_URL=http://<host>:5180` — сервер-оркестратор (`server/`), без него мастер работает на локальной заглушке; `EXPO_PUBLIC_CONTENT_TOKEN` — bearer-токен сервера; `EXPO_PUBLIC_VOICE_SIM=1` — симуляция STT вместо платформенного; `EXPO_PUBLIC_VOICE_SMOKE=1` — дымовая проверка нативного STT при старте (лог `[voice]`).

## Голос

`src/voice/` — адаптер `SpeechRecognizer`: платформенный STT через `expo-speech-recognition` (SFSpeechRecognizer / Android SpeechRecognizer, только dev-сборка) и симуляция прототипа (web, `EXPO_PUBLIC_VOICE_SIM=1`). Режим из Профиля: «Удерживать» — одна реплика на pressIn/pressOut, «Без рук» — continuous до повторного тапа. Язык распознавания — из настроек предмета. Если STT недоступен или разрешение не дано, кнопка микрофона не показывается; текстовый ввод доступен всегда. В iOS-симуляторе SFSpeechRecognizer не инициализируется («Failed to initialize recognizer») — реальное распознавание проверяется на устройстве.

### iOS-симулятор на этой машине

`npx expo run:ios` выбирает спаренный физический iPhone и падает на подписи; CocoaPods под Ruby 4 требует UTF-8 локали. Рабочий путь:

```bash
LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 npx expo prebuild --platform ios
cd ios && xcodebuild -workspace Teach.xcworkspace -scheme Teach -configuration Debug -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 17 Pro' -derivedDataPath build CODE_SIGNING_ALLOWED=NO build
xcrun simctl install booted build/Build/Products/Debug-iphonesimulator/Teach.app && xcrun simctl launch booted app.teach.mobile
```

### Сборка на iPhone

Команда `PW7867VU3L` прописана в `app.json` (`ios.appleTeamId`). На телефоне должен быть включён Developer Mode (Настройки → Конфиденциальность и безопасность), Mac и iPhone в одной Wi‑Fi сети (Debug-сборка грузит JS с Metro по адресу из `ip.txt`).

```bash
cd ios && xcodebuild -workspace Teach.xcworkspace -scheme Teach -configuration Debug -sdk iphoneos -destination 'id=<UDID>' -derivedDataPath build-device -allowProvisioningUpdates -allowProvisioningDeviceRegistration DEVELOPMENT_TEAM=PW7867VU3L build
xcrun devicectl device install app --device <UDID> build-device/Build/Products/Debug-iphoneos/Teach.app
xcrun devicectl device process launch --terminate-existing --device <UDID> app.teach.mobile
```

Release с встроенным бандлом (без Metro, без dev-входа, реальный Apple Sign-In): те же команды с `-configuration Release`, артефакт в `build-device/Build/Products/Release-iphoneos/Teach.app`. Профиль команды содержит `com.apple.developer.applesignin`.

UDID телефона: `xcrun devicectl list devices`. Проверено 2026-09-09: нативный STT на iPhone 16 Pro Max отдаёт промежуточные результаты по словам и финальную фразу.

### TestFlight

Архив и загрузка идут локально через сессию Apple ID в Xcode, ключ App Store Connect API не нужен:

```bash
cd ios && cp ../ExportOptions.plist . && export EXPO_PUBLIC_CONTENT_URL=https://teach-tutor-api.fly.dev EXPO_PUBLIC_CONTENT_TOKEN=$(cat ../../server/.secrets/api-token)
xcodebuild -workspace Teach.xcworkspace -scheme Teach -configuration Release -sdk iphoneos -destination 'generic/platform=iOS' -archivePath build-device/Teach.xcarchive -allowProvisioningUpdates DEVELOPMENT_TEAM=PW7867VU3L archive
xcodebuild -exportArchive -archivePath build-device/Teach.xcarchive -exportOptionsPlist ExportOptions.plist -exportPath build-device/export -allowProvisioningUpdates
```

Перед каждой новой загрузкой увеличить `ios.buildNumber` в `app.json` и выполнить prebuild. Предупреждения «Upload Symbols Failed» для React/hermes безвредны. Первая сборка 0.1.0 (1) загружена 2026-09-09.

Metro без watchman не видит правок — после изменения кода перезапускать `expo start --clear`. Разрешение на распознавание речи `simctl privacy` не выдаёт; в симуляторе его можно проставить в `~/Library/Developer/CoreSimulator/Devices/<UDID>/data/Library/TCC/TCC.db` (`kTCCServiceSpeechRecognition`, `auth_value=2`).
