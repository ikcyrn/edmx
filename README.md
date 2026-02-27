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
