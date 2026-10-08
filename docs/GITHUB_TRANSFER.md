# Перенесення через GitHub

Рекомендовано приватний репозиторій: для перенесення на VPS відкривати код не потрібно.
GitHub Pages не вмикаємо. Git і Node.js потрібні на домашньому ноутбуці.

## На поточному комп'ютері

На GitHub натисни **New repository**, назви `volatility-index`, вибери **Private**.
Не додавай README, .gitignore або license під час створення: локальні файли вже є.
Скопіюй HTTPS URL нового репозиторію. У PowerShell у папці проєкту:

```powershell
cd C:\Users\aazizbekov\volatility-index
git init -b main
git add .
git status --short
git diff --cached --stat
```

Перед комітом переглянь список: `.env`, ключів, `node_modules`, хвилинних live-кешів
там не має бути. Raw validation JSON, CSV і `site/dist/data/market.json` потрібні.
Потім виконай, замінивши YOUR_USERNAME своїм логіном:

```powershell
git commit -m "Prepare volatility website and VPS handoff"
git remote add origin https://github.com/YOUR_USERNAME/volatility-index.git
git push -u origin main
```

Якщо Git просить ім'я/email, встанови їх лише для цього репозиторію через
`git config user.name "Твоє ім'я"` та `git config user.email "Твій GitHub email"`,
після чого повтори commit. Можна використати noreply email із GitHub Settings.
Для HTTPS увійди через Git Credential Manager/браузер. Пароль акаунта GitHub
не використовується як Git-пароль. Не вставляй токен у URL або файли проєкту.

Це інструкція для першого завантаження. Якщо вже існує origin або коміти на GitHub,
спочатку перевір `git remote -v` / `git status`; не використовуй force push.

## На домашньому ноутбуці

У потрібній батьківській папці:

```sh
git clone https://github.com/YOUR_USERNAME/volatility-index.git
cd volatility-index
cd site
npm ci
npm run build
npm test
npm start
```

Відкрий http://127.0.0.1:4173/. У Codex відкрий кореневу папку `volatility-index`,
а не лише `site`, і надішли підказку з кінця `docs/HANDOFF.md`.
Вихідний офіційний знімок включено; живі хвилинні кеші завантажаться заново.

Після наступних змін використовуй звичайні `git add`, `git commit`, `git push`,
а на іншому ноутбуці — `git pull` за відсутності конфліктних локальних змін.
