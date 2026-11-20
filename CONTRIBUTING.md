# Contributing

You are welcome here. Journeys is a cited atlas of the biblical record, and it gets better when readers, scholars, and builders help. The project will keep improving. A careful correction is as useful as a large feature.

## Ways to help

- **Map and route data.** A stop in the wrong place, a leg that should follow a known road, a site that is missing.
- **Scholarly corrections.** A date, a citation, or a note that should be more careful about what the sources actually say.
- **Translations.** Interface strings live in `src/i18n/locales/`. Journey text lives in `content/`.
- **Code.** Bug fixes, tests, and small improvements to the app.
- **Design feedback.** Where the app is confusing. A screenshot helps.

If you want a place to start, look for issues labeled [good first issue](https://github.com/SeanLebida/journeys/labels/good%20first%20issue).

## How to start

1. Open an issue, or comment on one, so we can say hello before you spend a long time.
2. Fork the repository and branch from `development`.
3. Make the change. For journey data, edit the JSON in `content/` and run `npm run build:content` so the accuracy checks run.
4. Open a pull request into `development`.
5. Agree to the [contributor agreement](CLA.md) by checking the box in the pull request.

A note is enough when you only want to report something. Open an issue, or write to [auth@authentic.how](mailto:auth@authentic.how).

## Your agreement

You keep the copyright in what you write. Contributions are accepted under the [Individual Contributor License Agreement](CLA.md). That agreement lets Sean Lebida also offer a commercial license for the software, which is how the app can keep being maintained for the long term.

Content you add to the paths in `LICENSE-CONTENT` is still offered to everyone under CC BY-SA 4.0. Code is still offered to everyone under the AGPL, version 3 only.

Please do not send other people's copyrighted text, photos, or map data unless their license allows it and the credit stays with the file. Natural Earth geography, the OpenStreetMap West Bank barrier line, Itiner-e route geometry, Wikimedia photographs, and public-domain scripture stay under the terms named in `LICENSE-CONTENT`.

Do not add a logo, icon, or name that presents a fork as Journeys. See `TRADEMARKS.md`.
