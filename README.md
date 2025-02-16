This is a module for the [MagicMirror²](https://github.com/MichMich/MagicMirror/).

[![MagicMirror2](https://img.shields.io/badge/MagicMirror-2.2.2-lightgray.svg)](https://github.com/MichMich/MagicMirror)
[![GitHub last commit](https://img.shields.io/github/last-commit/ivlovric/MMM-MagicDraw/main)](https://github.com/ivlovric/MMM-MagicDraw)
[![Maintenance](https://img.shields.io/badge/Maintained%3F-yes-green.svg)](https://github.com/ivlovric/MMM-MagicDraw/graphs/commit-activity)

Drawing board for Magic Mirror with touch interactive UI interface


## Installation

### Install

In your terminal, go to your [MagicMirror²][mm] Module folder and clone MMM-MagicDraw:

```bash
cd ~/MagicMirror/modules
git clone https://github.com/ivlovric/MMM-MagicDraw.git
```

### Update

```bash
cd ~/MagicMirror/modules/MMM-MagicDraw
git pull
```

## Using the module

To use this module, add it to the modules array in the `config/config.js` file:

```js
    {
        module: 'MMM-MagicDraw',
        position: 'fullscreen_above'
    },
```


## Configuration options

None

## Sending notifications to the module

Notification|Description
------|-----------
`TEMPLATE_RANDOM_TEXT`|Payload must contain the text that needs to be shown on this module

## Developer commands

- `npm install` - Install devDependencies like ESLint.
- `npm run lint` - Run linting and formatter checks.
- `npm run lint:fix` - Fix linting and formatter issues.

[mm]: https://github.com/MagicMirrorOrg/MagicMirror
