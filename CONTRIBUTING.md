# Contributing to Mechvibes X 🎹🚀

Thank you for your interest in contributing to **Mechvibes X**! We want to make this the best open-source mechanical keyboard simulation software.

There are many ways you can contribute: submitting custom soundpacks, improving the audio engine, updating layout presets, or reporting bugs.

---

## 🎵 Submitting Custom Soundpacks

Mechvibes X is nothing without its community soundpacks. If you have recorded or created a soundpack, please share it!

### How to submit:
1. **Create an Issue:** Open an issue with the tag `soundpack-submission` and attach a `.zip` archive containing your soundpack directory.
2. **Submit a Pull Request (Recommended):**
   - Place your soundpack folder directly under `src/audio/`.
   - Make sure it has a valid `config.json` configuration file mapping keys to audio samples.
   - Run `bun run start` to test it locally.
   - Submit a PR!

---

## 🛠️ Contributing to Code

We welcome code improvements, performance optimizations, and layout presets!

### Code Rules:
- Keep the codebase lightweight. Mechvibes X aims to be an optimized and resource-efficient version of Mechvibes.
- Write clean and readable Javascript code.

### Getting Started:
1. Fork the repository.
2. Clone your fork and run `bun install`.
3. Make changes and test them locally using `bun run start`.
4. Commit your changes and submit a Pull Request to the `main` branch.

Thank you for helping us grow! 🌟
