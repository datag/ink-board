# ink-board Dashboard

## Setup

```shell
nvm use
npm install
```

## Configure

Copy `dashboard.json5.example` to `dashboard.json5` and edit the configuration.

## Run

```shell
node render.js --config dashboard.json5

# Write debug.png but doesn't publish to device
node render.js --config dashboard.json5 --dry-run
```

## Fonts

### Press Start 2P

https://fonts.google.com/specimen/Press+Start+2P

mkdir -p fonts && \
│ curl -L "https://github.com/google/fonts/raw/main/ofl/pressstart2p/PressStart2P-Regular.ttf" \
│ -o fonts/PressStart2P-Regular.ttf
