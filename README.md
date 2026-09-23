# Music Bot

Music bot plugin for Sharkord that searches music through Tune Box and streams
it into a voice channel. Built against **plugin SDK v2**.

## Dependencies

The plugin downloads FFmpeg on first run into its data directory
(`<data-dir>/plugin-data/music-bot/bin`). That directory survives plugin updates,
so the binary is only fetched once.

## Manual Installation

1. Download the latest release from the [Releases](https://github.com/lemonc7/music-bot/releases) page.
2. Move the `music-bot` folder to your Sharkord plugins directory, typically located at `~/.config/sharkord/plugins`. See: [Data Dir](https://sharkord.com/docs/data-dir).

## Usage

Open the music player from the note icon in the top bar while you are connected
to a voice channel:

- **Search Tune Box** — choose NetEase or Kuwo, then search matching songs with
  title, artist, album, and artwork. Use **Load more** to append the next page.
  Selecting a result plays it when the channel is idle or queues it when
  something is already on.
- **Stop** — stops playback and clears the channel's playback state.
- **Skip** — moves to the next queued track.
- Playback volume is controlled per listener through Sharkord's stream card.
- Hover a queue row to play it immediately or drop it from the queue.

## Permissions

Access is the host's, not the plugin's: every action requires
`JOIN_VOICE_CHANNELS` by default, and the player button is only shown to roles
that hold it. A server owner narrows either of those per role under the plugin's
permissions, without touching plugin settings.

The panel reads that back through `useCanUseAction`, so a control the user is
not allowed to use is disabled rather than failing on click. The server checks
again on every call — the disabled state is UI, not the boundary.

## Commands

`/update-ffmpeg` requires `MANAGE_PLUGINS`. It answers immediately and keeps
updating in the background; follow progress in the plugin's Logs tab.

The new binary is moved into place once it is fully downloaded, so a failed
download leaves the working one untouched and playback is not interrupted.

## Tune Box integration

Tune Box must expose `GET /api/search` and `GET /api/preview`. Configure a URL
reachable from the Sharkord server process, not from the browser. For Docker
deployments this is normally the Tune Box service name, for example
`http://tune-box:8080`.

The current MVP does not authenticate these endpoints, so keep Tune Box and
Sharkord on a trusted private network.

## Settings

- **Tune Box Base URL** — Tune Box server URL (default `http://localhost:8080`).
- **Bitrate** — the Opus bitrate sent to the voice channel (default `128k`).
  This is independent of Tune Box's 320kbps MP3 preview quality.

## Screenshots

![Screenshot of the music bot plugin](https://i.imgur.com/tElMrbn.png)

## Troubleshooting

If search fails, verify that Sharkord can reach the configured Tune Box URL and
that `GET /api/search` responds. If a result cannot play, test the same provider
and track ID through Tune Box's `GET /api/preview` endpoint and inspect both
applications' logs.

## Development

Set `SHARKORD_PLUGINS_PATH` in `.env` and every `bun run build` lands straight in
your server's plugins directory.
