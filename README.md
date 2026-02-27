# edmx

Discord music bot using discord.js + Lavalink.

## Setup

1) Install dependencies:

```bash
npm install
```

2) Create `.env` from `.env.example` and fill in values.

3) Start Lavalink:

- Download `Lavalink.jar` and place `lavalink/application.yml` next to it.
- Copy `lavalink/application.yml.example` to `lavalink/application.yml` and set the password.
- If you want Spotify/YouTube Music link support, add the Lavasrc plugin JAR next to `Lavalink.jar`
  and configure credentials in the `plugins.lavasrc` section.

4) Register slash commands:

```bash
npm run deploy
```

5) Run the bot:

```bash
npm start
```

## Docker

1) Copy `lavalink/application.yml.example` to `lavalink/application.yml` and set your password.
   If you want Spotify/YouTube Music links, fill in the `plugins.lavasrc.spotify` credentials.
   Lavalink will auto-download the Lavasrc plugin on startup.

2) Create `.env` from `.env.example` and fill in the Discord token, client ID, and Lavalink password.

3) Register slash commands (one-time, or after changes):

```bash
docker compose run --rm bot npm run deploy
```

4) Start everything:

```bash
docker compose up --build
```

## Lavalink Version

The Lavalink Docker image builds from a specific version. Update the build arg in
`docker-compose.yml` if you want a newer release.

## Commands

- `/play query`
- `/skip`
- `/pause`
- `/resume`
- `/nowplaying`
- `/queue`
- `/leave`
- `/loop mode`
- `/volume level`

## Notes

- `GUILD_ID` in `.env` makes slash command updates instant for a dev server. Omit it for global commands.
- Lavalink must be running and reachable by the bot.
- The bot auto-disconnects after 5 minutes of idle time in a guild.
