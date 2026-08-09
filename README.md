# IGNIS — Instagram Enhancement Suite

A fast, self-contained userscript for high-quality Instagram media downloads.

- **Instant** — payloads resolve from the page (0 requests) or a single fast API call; downloads start immediately.
- **Everything** — posts, carousels, reels, stories, highlights, HD profile pictures, captions (.txt), EXIF metadata.
- **One file, always** — DASH video+audio is merged into a single MP4 via Mediabunny; if merging ever fails it falls back to the single progressive MP4 (audio included). Never separate files.
- **Reliable** — `GM_xmlhttpRequest` transports, current 2026 Instagram endpoints (REST `api/v1/media/{pk}/info`, doc_id GraphQL, embedded page JSON), sane defaults.

## Install

Install the userscript in Tampermonkey / Violentmonkey / Greasemonkey:

```
https://cdn.jsdelivr.net/gh/mheci/ignis@main/ignis.user.js
```

or from the raw GitHub file:

```
https://raw.githubusercontent.com/mheci/ignis/main/ignis.user.js
```

### Updates

The script declares `@updateURL` / `@downloadURL` pointing at this repository, so your userscript manager checks for new versions automatically (jsDelivr CDN, cached). Version bumps are detected by comparing the `@version` header; there is no auto-install — the manager prompts you.

## Features

- Download posts, carousels, reels, stories and highlights with one click
- HD profile picture download
- Thumbnail download for videos
- Download captions as `.txt`
- EXIF metadata (artist, post URL, date) on photos
- DASH merge: highest-quality video + audio into a single MP4
- Direct download modes (all / visible resource) without dialogs
- External download mode via `GM_download` for very large files
- Configurable filename templates
- Keyboard: `S` download focused post, `Shift+?` shortcuts, `Alt+W` settings, `Alt+S` download story, `Alt+Z` debug, `Alt+R` reload

## Settings

Open Settings from the userscript manager menu (`Alt+W`) — tabs for Downloads and Keyboard, plus an About tab. Right-click the *Auto Rename Files* row to edit the filename template.

## Development

```sh
node build.js        # concatenates src/part1-6.js, strips comments, emits ignis.user.js
node --check ignis.user.js
```

A GitHub Actions workflow (`build.yml`) rebuilds the userscript on every push and commits the result, keeping the hosted file in sync.

## Disclaimer

This project is independent and unaffiliated with Instagram or any other project. All processing is local; network requests go only to Instagram/CDN hosts. Download content only when you have the right to do so.

## License

GPL-3.0-only
