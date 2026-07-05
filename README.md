# Mechvibes X 🎧🚀

[![GitHub Release](https://img.shields.io/github/v/release/FytikProdd/mechvibes-x?include_prereleases&label=Release&color=blue)](https://github.com/FytikProdd/mechvibes-x/releases/latest)
[![License](https://img.shields.io/github/license/FytikProdd/mechvibes-x?color=green)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows-lightgrey)](#)

[English](#english) | [Русский](#русский)

---

## English

**Mechvibes X** is a cleaned, optimized, and modern fork of the original [Mechvibes](https://github.com/hainguyents13/mechvibes). It brings mechanical keyboard sounds to your system with exclusive premium audio features.

### 🌟 New Exclusive Features

1. **Spatial Audio (3D sound panning) 🎧**
   - Sound shifts dynamically between left and right channels based on the physical position of the key you press.
   - Fully toggleable in the main UI and system tray.
2. **Pitch & Volume Randomization 🎵**
   - Tweak pitch (±4%) and volume (±7.5%) randomly on each keypress.
   - Eliminates repetitive robotic patterns ("machine-gun" effect) and replicates realistic typing variance.
3. **Clean & Optimized Codebase ⚡**
   - Comment-stripped, minified-ready, and lightweight Electron implementation for lower memory consumption.
   - Built and locked with Bun package manager for fast development.

### 🎵 Soundpacks Notice & Credits
Please note that **Mechvibes X does NOT contain any of the default/original soundpacks** from the legacy Mechvibes. All soundpacks included in this fork are completely new and custom! 

All credits for the sounds go to this Discord community:
👉 **[Discord Server](https://discord.com/invite/BFEUztB5Sc)**

---

### 📦 Quick Download

You don't need to build from source. Just head over to the **[Releases](https://github.com/FytikProdd/mechvibes-x/releases)** page, download `Mechvibes X 1.0.2.exe`, run it, and enjoy!

---

### 🛠️ Build from Source

If you prefer to compile it yourself:
1. Clone the repository.
2. Make sure you have [Bun](https://bun.sh) or [Node.js](https://nodejs.org) installed.
3. Install dependencies:
   ```bash
   bun install
   ```
4. Run the build command for Windows:
   ```bash
   bun run build:win
   ```
5. Find the portable installer in the `dist/` directory.

---

## Русский

**Mechvibes X** — это очищенный, оптимизированный и современный форк оригинального проекта [Mechvibes](https://github.com/hainguyents13/mechvibes). Приложение воспроизводит звуки механических переключателей при нажатии клавиш на мембранных или ноутбучных клавиатурах.

### 🌟 Уникальные особенности Mechvibes X

1. **Пространственное аудио (3D панорамирование) 🎧**
   - Звук динамически смещается влево или вправо в наушниках в зависимости от физического расположения нажатой клавиши.
   - Можно легко включить или выключить в интерфейсе и меню системного трея.
2. **Случайная тональность и громкость 🎵**
   - Высота звука (±4%) и его громкость (±7.5%) меняются при каждом нажатии.
   - Это убирает эффект "пулемета" (одинаковых звуков) и делает печать максимально естественной и живой.
3. **Очищенный и оптимизированный код ⚡**
   - Полностью удалены комментарии и лишний мусор для повышения производительности и снижения потребления ОЗУ.
   - Проект собирается с помощью современного менеджера Bun.

### 🎵 Примечание и Авторы звуков
Обратите внимание, что **Mechvibes X НЕ содержит ни одного стандартного пака звуков** из оригинальной версии Mechvibes. Все звуковые паки полностью новые и уникальные!

Авторство всех используемых звуков принадлежит Discord-сообществу:
👉 **[Discord-сервер](https://discord.com/invite/BFEUztB5Sc)**

---

### 📦 Быстрая загрузка

Готовый портативный исполняемый файл можно скачать в разделе **[Releases](https://github.com/FytikProdd/mechvibes-x/releases)**. Достаточно скачать `Mechvibes X 1.0.2.exe`, запустить и печатать со звуком!

---

### 🛠️ Сборка из исходников

Если вы хотите собрать приложение самостоятельно:
1. Склонируйте репозиторий.
2. Установите [Bun](https://bun.sh) или [Node.js](https://nodejs.org).
3. Установите зависимости:
   ```bash
   bun install
   ```
4. Запустите сборку для Windows:
   ```bash
   bun run build:win
   ```
5. Готовый файл появится в папке `dist/`.
