# Copilot instructions for ink-board

This file tells Copilot sessions how to build, test, flash, and reason about this repository.

Build, test, and lint commands
- Build: Use PlatformIO for all builds. From the repository root:
  - Full build: pio run -e nodemcuv2
  - Build only (quiet): pio run -e nodemcuv2 --silent
- Flash/upload to a NodeMCU v2 on a known serial port:
  - pio run -t upload -e nodemcuv2 --upload-port /dev/ttyUSB0
  - If pio is installed in a virtualenv: ~/.platformio/penv/bin/pio run -t upload -e nodemcuv2 --upload-port /dev/ttyUSB0
- Serial monitor: pio device monitor -p /dev/ttyUSB0
- Tests: This project currently has no PlatformIO unit tests. If tests are added under test/, run a single test via:
  - pio test -e nodemcuv2 -f <test_name>
- Linting: No repository-specific linter configured. Use PlatformIO/Arduino-compatible linters if added.

High-level architecture
- Purpose: small embedded firmware for ESP8266 (NodeMCU v2) using the Arduino framework.
- Project layout (important parts):
  - platformio.ini — build targets and environment (env:nodemcuv2)
  - src/ — firmware source files (main.cpp is the entrypoint)
  - include/ — project header files to be included by sources
  - lib/ — project-local libraries (each library in its own folder)
  - test/ — PlatformIO unit tests (empty by default)
- Build flow: PlatformIO compiles src/ and lib/ (static libraries) according to platformio.ini and links with the Arduino ESP8266 core; output placed in .pio/build/<env> (.elf, .bin).

Key conventions and repository-specific patterns
- Board/LED handling: Use LED_BUILTIN for board-specific LEDs (NodeMCU built-in LED is commonly active-low). Avoid hardcoding GPIO numbers unless hardware-specific behaviour is required.
- Local libraries: Place any reusable code in lib/<Name>/src and add public headers to lib/<Name>/src or include/ so the PlatformIO LDF finds them automatically.
- platformio.ini is authoritative: Prefer adding build flags, upload flags, and monitor settings there so developers and CI use the same configuration.
- Packaging and toolchain: PlatformIO packages are typically stored under ~/.platformio; CI may need to install PlatformIO or use a Docker image that includes it.

AI and other assistant configs to consider
- If present, merge important rules from CLAUDE.md, .cursorrules, AGENTS.md, .windsurfrules, CONVENTIONS.md, and other assistant config files into this doc. This repo currently has no such files to merge.

MCP servers
- This is an embedded firmware project; no MCP servers (Playwright, Puppeteer, etc.) were configured. If you want an MCP server (e.g., for integration tests running on hardware-in-the-loop), add instructions here.

Short summary
- This file describes how to build, flash, and monitor the NodeMCU firmware and explains the project's high-level layout and conventions. Ask to adjust or add test/CI specifics, device port defaults, or board variants to cover additional hardware.
