require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  Events,
  EmbedBuilder
} = require("discord.js");
const { Shoukaku, Connectors } = require("shoukaku");

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates]
});

const nodes = [
  {
    name: "main",
    url: `${process.env.LAVALINK_HOST || "localhost"}:${process.env.LAVALINK_PORT || "2333"}`,
    auth: process.env.LAVALINK_PASSWORD || "youshallnotpass"
  }
];

const shoukaku = new Shoukaku(new Connectors.DiscordJS(client), nodes, {
  moveOnDisconnect: false
});

const queues = new Map();

function getState(guildId) {
  if (!queues.has(guildId)) {
    queues.set(guildId, {
      player: null,
      queue: [],
      now: null,
      loop: "off",
      playing: false,
      volume: 100,
      idleTimer: null
    });
  }
  return queues.get(guildId);
}

function formatDuration(ms) {
  if (!ms || ms === 0) return "LIVE";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${minutes}:${pad(seconds)}`;
}

function trackTitle(track) {
  const title = track.info?.title || "Unknown title";
  const author = track.info?.author ? ` — ${track.info.author}` : "";
  return `${title}${author}`;
}

async function ensurePlayer(interaction, state) {
  const member = await interaction.guild.members.fetch(interaction.user.id);
  const voiceChannel = member.voice.channel;
  if (!voiceChannel) {
    throw new Error("Join a voice channel first.");
  }

  if (!state.player) {
    state.player = await shoukaku.joinVoiceChannel({
      guildId: interaction.guild.id,
      channelId: voiceChannel.id,
      shardId: interaction.guild.shardId,
      deaf: true
    });

    state.player.on("end", () => {
      state.playing = false;
      if (state.loop === "track" && state.now) {
        state.queue.unshift(state.now);
      } else if (state.loop === "queue" && state.now) {
        state.queue.push(state.now);
      }
      state.now = null;
      void playNext(interaction.guild.id);
    });

    state.player.on("stuck", () => {
      state.playing = false;
      void playNext(interaction.guild.id);
    });

    state.player.on("error", (err) => {
      console.error("Player error", err);
      state.playing = false;
    });
  }

  if (state.idleTimer) {
    clearTimeout(state.idleTimer);
    state.idleTimer = null;
  }

  return { voiceChannel };
}

async function resolveTracks(query) {
  const node = shoukaku.nodes.get("main");
  if (!node) throw new Error("Lavalink node is not ready yet.");

  const identifier = /^https?:\/\//.test(query) ? query : `ytsearch:${query}`;
  return node.rest.resolve(identifier);
}

async function playNext(guildId) {
  const state = queues.get(guildId);
  if (!state || !state.player || state.playing) return;

  const next = state.queue.shift();
  if (!next) {
    state.now = null;
    if (state.player && !state.idleTimer) {
      state.idleTimer = setTimeout(async () => {
        try {
          await state.player.destroy();
        } catch (err) {
          console.error("Idle disconnect error", err);
        }
        state.player = null;
        state.queue = [];
        state.now = null;
        state.playing = false;
        state.idleTimer = null;
      }, 300000);
    }
    return;
  }

  state.now = next;
  state.playing = true;
  if (state.idleTimer) {
    clearTimeout(state.idleTimer);
    state.idleTimer = null;
  }
  if (state.player.setVolume) {
    await state.player.setVolume(state.volume);
  }
  await state.player.playTrack({ track: next.encoded });
}

client.once(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user.tag}`);
});

shoukaku.on("ready", (name) => {
  console.log(`Lavalink node ${name} connected.`);
});

shoukaku.on("error", (name, error) => {
  console.error(`Lavalink node ${name} error`, error);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const state = getState(interaction.guild.id);

  try {
    switch (interaction.commandName) {
      case "play": {
        await interaction.deferReply();
        await ensurePlayer(interaction, state);

        const query = interaction.options.getString("query", true);
        const res = await resolveTracks(query);

        if (!res || !res.tracks || res.tracks.length === 0) {
          await interaction.editReply("No matches found.");
          return;
        }

        if (res.loadType === "PLAYLIST_LOADED") {
          state.queue.push(...res.tracks);
          await interaction.editReply(
            `Queued playlist: ${res.playlistInfo?.name || "Unknown"} (${res.tracks.length} tracks)`
          );
        } else {
          const track = res.tracks[0];
          state.queue.push(track);
          await interaction.editReply(`Queued: ${trackTitle(track)}`);
        }

        await playNext(interaction.guild.id);
        return;
      }
      case "skip": {
        if (!state.player || !state.now) {
          await interaction.reply({ content: "Nothing is playing.", ephemeral: true });
          return;
        }
        await state.player.stopTrack();
        await interaction.reply("Skipped.");
        return;
      }
      case "pause": {
        if (!state.player) {
          await interaction.reply({ content: "Nothing is playing.", ephemeral: true });
          return;
        }
        await state.player.setPaused(true);
        await interaction.reply("Paused.");
        return;
      }
      case "resume": {
        if (!state.player) {
          await interaction.reply({ content: "Nothing is playing.", ephemeral: true });
          return;
        }
        await state.player.setPaused(false);
        await interaction.reply("Resumed.");
        return;
      }
      case "nowplaying": {
        if (!state.now) {
          await interaction.reply({ content: "Nothing is playing.", ephemeral: true });
          return;
        }
        const track = state.now;
        const embed = new EmbedBuilder()
          .setTitle("Now Playing")
          .setDescription(`[${track.info.title}](${track.info.uri})`)
          .addFields(
            { name: "Artist", value: track.info.author || "Unknown", inline: true },
            { name: "Duration", value: formatDuration(track.info.length), inline: true }
          );
        await interaction.reply({ embeds: [embed] });
        return;
      }
      case "queue": {
        if (state.queue.length === 0) {
          await interaction.reply({ content: "Queue is empty.", ephemeral: true });
          return;
        }

        const lines = state.queue.slice(0, 10).map((t, i) => {
          const dur = formatDuration(t.info.length);
          return `${i + 1}. ${t.info.title} (${dur})`;
        });
        const more = state.queue.length > 10 ? `\n...and ${state.queue.length - 10} more` : "";
        const embed = new EmbedBuilder()
          .setTitle("Queue")
          .setDescription(lines.join("\n") + more)
          .addFields(
            { name: "Total in Queue", value: String(state.queue.length), inline: true },
            { name: "Loop", value: state.loop, inline: true },
            { name: "Volume", value: String(state.volume), inline: true }
          );
        if (state.now) {
          embed.addFields({
            name: "Now Playing",
            value: `[${state.now.info.title}](${state.now.info.uri})`
          });
        }
        await interaction.reply({ embeds: [embed] });
        return;
      }
      case "leave": {
        if (state.player) {
          await state.player.destroy();
          state.player = null;
          state.queue = [];
          state.now = null;
          state.playing = false;
        }
        await interaction.reply("Disconnected.");
        return;
      }
      case "loop": {
        const mode = interaction.options.getString("mode", true);
        state.loop = mode;
        await interaction.reply(`Loop mode set to ${mode}.`);
        return;
      }
      case "volume": {
        const level = interaction.options.getInteger("level", true);
        state.volume = level;
        if (state.player) {
          await state.player.setVolume(level);
        }
        await interaction.reply(`Volume set to ${level}.`);
        return;
      }
      default:
        await interaction.reply({ content: "Unknown command.", ephemeral: true });
    }
  } catch (err) {
    console.error(err);
    const message = err?.message || "Something went wrong.";
    if (interaction.deferred) {
      await interaction.editReply(message);
    } else {
      await interaction.reply({ content: message, ephemeral: true });
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
