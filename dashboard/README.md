# ink-board Dashboard

## Setup

```shell
nvm use
npm install
```

> [!NOTE]
> Might require these dependencies to be installed globally:
> `sudo apt install libpixman-1-dev libcairo2-dev libpango1.0-dev libjpeg62-turbo-dev libgif-dev`

## Configure

Copy `dashboard.json5.example` to `dashboard.json5` and edit the configuration.

## Run

```shell
node render.js --config dashboard.json5

# Write debug.png but doesn't publish to device
node render.js --config dashboard.json5 --dry-run
```

> [!NOTE]
> Requires ImageMagick to be installed and available in the PATH.
> `sudo apt install imagemagick`

## Fonts

### Press Start 2P

https://fonts.google.com/specimen/Press+Start+2P

```shell
curl -L "https://github.com/google/fonts/raw/main/ofl/pressstart2p/PressStart2P-Regular.ttf" -o fonts/PressStart2P-Regular.ttf
```
