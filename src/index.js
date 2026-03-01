require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  Events,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");
const path = require("path");
const fs = require("fs");
const { Shoukaku, Connectors } = require("shoukaku");

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates]
});

const nodes = [
  {
    name: "main",
    url: `${process.env.LAVALINK_HOST || "localhost"}:${process.env.LAVALINK_PORT || "2333"}`,
    auth: process.env.LAVALINK_PASSWORD || "youshallnotpass",
    secure: false,
    version: "v4"
  }
];

const shoukaku = new Shoukaku(new Connectors.DiscordJS(client), nodes, {
  moveOnDisconnect: false
});

const queues = new Map();
let lastLavalinkHint = 0;
let lavalinkReady = false;
let lavalinkAuthFailed = false;
let nodeReconnectTimer = null;

const ICONS = {
  play: "play.png",
  pause: "pause.png",
  resume: "resume.png",
  skip: "skip.png",
  stop: "stop.png",
  nowplaying: "nowplaying.png",
  queue: "queue.png",
  shuffle: "shuffle.png",
  leave: "leave.png",
  warning: "warning.png",
  error: "error.png"
};

const ICON_COLORS = {
  play: 0x6366f1,
  pause: 0x6366f1,
  resume: 0x6366f1,
  skip: 0x6366f1,
  stop: 0x6366f1,
  nowplaying: 0x6366f1,
  queue: 0x6366f1,
  shuffle: 0x6366f1,
  leave: 0x6366f1,
  warning: 0xfbbf24,
  error: 0xf87171
};

function iconPath(name) {
  const file = ICONS[name];
  if (!file) return null;
  const full = path.join(__dirname, "..", "assets", file);
  return fs.existsSync(full) ? full : null;
}

function buildEmbedMessage({ title, description, icon }) {
  const embed = new EmbedBuilder();
  if (icon && ICON_COLORS[icon]) {
    embed.setColor(ICON_COLORS[icon]);
  }
  const normalizeShort = (text) => (text ? text.replace(/[.!?]+$/u, "") : text);
  if (title) {
    if (icon && ICONS[icon]) {
      embed.setAuthor({ name: title, iconURL: `attachment://${ICONS[icon]}` });
    } else {
      embed.setTitle(title);
    }
  }
  if (description) {
    if (description.length <= 60) {
      const shortText = normalizeShort(description);
      if (!title) {
        embed.setTitle(shortText);
      } else if (icon && ICONS[icon]) {
        embed.setAuthor({ name: shortText, iconURL: `attachment://${ICONS[icon]}` });
      } else {
        embed.setTitle(shortText);
      }
    } else {
      embed.setDescription(description);
    }
  }
  const filePath = icon ? iconPath(icon) : null;
  const files = filePath ? [{ attachment: filePath, name: ICONS[icon] }] : [];
  return { embeds: [embed], files };
}

const QUEUE_PAGE_SIZE = 10;
const QUEUE_LINE_WIDTH = 36;

function buildQueuePayload(state, page, userId, iconUrl) {
  const total = state.queue.length;
  const totalPages = Math.max(1, Math.ceil(total / QUEUE_PAGE_SIZE));
  const clampedPage = Math.min(Math.max(page, 1), totalPages);
  if (total === 0) {
    const embed = new EmbedBuilder()
      .setColor(ICON_COLORS.queue)
      .setAuthor({
        name: "Queue",
        iconURL: iconUrl || `attachment://${ICONS.queue}`
      })
      .setDescription("Queue is empty.");
    return {
      embeds: [embed],
      files: iconUrl ? [] : (iconPath("queue") ? [{ attachment: iconPath("queue"), name: ICONS.queue }] : []),
      components: []
    };
  }
  const start = (clampedPage - 1) * QUEUE_PAGE_SIZE;
  const slice = state.queue.slice(start, start + QUEUE_PAGE_SIZE);
  const wrapText = (text, width) => {
    const out = [];
    let current = text;
    while (current.length > width) {
      out.push(current.slice(0, width));
      current = current.slice(width);
    }
    out.push(current);
    return out;
  };

  const lines = [];
  slice.forEach((t, i) => {
    const dur = `(${formatDuration(t.info.length)})`;
    const prefix = `${start + i + 1}. `;
    const indent = " ".repeat(prefix.length);
    const maxBody = Math.max(QUEUE_LINE_WIDTH - prefix.length, 10);
    const title = t.info.title;
    const titleLine = `${title} ${dur}`;

    if (titleLine.length <= maxBody) {
      lines.push(`${prefix}${titleLine}`);
      return;
    }

    const wrappedTitle = wrapText(title, maxBody);
    wrappedTitle.forEach((part, idx) => {
      lines.push(`${idx === 0 ? prefix : indent}${part}`);
    });
    lines.push(`${indent}${dur}`);
  });

  while (lines.length < QUEUE_PAGE_SIZE) lines.push("");
  const padded = lines.map((l) => l.padEnd(QUEUE_LINE_WIDTH, " "));
  const embed = new EmbedBuilder()
    .setColor(ICON_COLORS.queue)
    .setAuthor({
      name: `Queue — Page ${clampedPage}/${totalPages}`,
      iconURL: iconUrl || `attachment://${ICONS.queue}`
    })
    .setDescription(`\`\`\`\n${padded.join("\n")}\n\`\`\``)
    .addFields(
      { name: "Total in Queue", value: String(total), inline: true },
      { name: "Total Duration", value: formatDuration(sumQueueDuration(state.queue)), inline: true }
    );
  if (state.now) {
    embed.addFields({
      name: "Now Playing",
      value: `[${state.now.info.title}](${state.now.info.uri})`
    });
  }
  const prevDisabled = clampedPage <= 1;
  const nextDisabled = clampedPage >= totalPages;
  const firstDisabled = clampedPage <= 1;
  const lastDisabled = clampedPage >= totalPages;
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`queue:first:${clampedPage}:${userId}`)
      .setLabel("Top")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(firstDisabled),
    new ButtonBuilder()
      .setCustomId(`queue:prev:${clampedPage}:${userId}`)
      .setLabel("Previous")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(prevDisabled),
    new ButtonBuilder()
      .setCustomId(`queue:next:${clampedPage}:${userId}`)
      .setLabel("Next")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(nextDisabled),
    new ButtonBuilder()
      .setCustomId(`queue:last:${clampedPage}:${userId}`)
      .setLabel("End")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(lastDisabled)
  );
  return {
    embeds: [embed],
    files: iconUrl ? [] : (iconPath("queue") ? [{ attachment: iconPath("queue"), name: ICONS.queue }] : []),
    components: [row]
  };
}

function getLavalinkHttpUrl() {
  const host = process.env.LAVALINK_HOST || "localhost";
  const port = process.env.LAVALINK_PORT || "2333";
  return `http://${host}:${port}/v4/info`;
}

function waitForNodeReady(timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const existing = shoukaku.nodes.get("main");
    if (existing && existing.state === 1) {
      resolve();
      return;
    }
    if (existing && typeof existing.connect === "function" && existing.state !== 1) {
      try {
        existing.connect();
      } catch (err) {
        console.error("Failed to trigger Lavalink node connect", err);
      }
    }
    const onReady = (name) => {
      if (name === "main") {
        shoukaku.off("ready", onReady);
        resolve();
      }
    };
    shoukaku.on("ready", onReady);
    setTimeout(() => {
      shoukaku.off("ready", onReady);
      reject(new Error("Audio connection not ready. Try again in a moment."));
    }, timeoutMs);
  });
}

function ensureNodeReconnectLoop() {
  if (nodeReconnectTimer) return;
  nodeReconnectTimer = setInterval(() => {
    const node = shoukaku.nodes.get("main");
    if (!node) return;
    if (node.state === 1) {
      clearInterval(nodeReconnectTimer);
      nodeReconnectTimer = null;
      return;
    }
    if (typeof node.connect === "function") {
      try {
        node.connect();
      } catch (err) {
        console.error("Failed to connect Lavalink node", err);
      }
    }
  }, 5000);
}

async function waitForLavalink() {
  const password = process.env.LAVALINK_PASSWORD || "youshallnotpass";
  let delay = 1000;
  while (true) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    try {
      const res = await fetch(getLavalinkHttpUrl(), {
        method: "GET",
        headers: { Authorization: password },
        signal: controller.signal
      });
      clearTimeout(timeout);
      if (res.ok) {
        console.log("Lavalink is ready.");
        lavalinkReady = true;
        lavalinkAuthFailed = false;
        return;
      }
      if (res.status === 401) {
        lavalinkAuthFailed = true;
      }
      console.log(`Waiting for Lavalink (status ${res.status})...`);
    } catch (err) {
      clearTimeout(timeout);
      console.log("Waiting for Lavalink to become available...");
    }
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 2, 10000);
  }
}

function getState(guildId) {
  if (!queues.has(guildId)) {
    queues.set(guildId, {
      player: null,
      queue: [],
      now: null,
      loop: "off",
      playing: false,
      volume: 100,
      idleTimer: null,
      queueMessageId: null,
      queueChannelId: null,
      queueIconUrl: null,
      queuePage: 1
    });
  }
  return queues.get(guildId);
}

function resetState(state) {
  if (state.idleTimer) {
    clearTimeout(state.idleTimer);
    state.idleTimer = null;
  }
  state.player = null;
  state.queue = [];
  state.now = null;
  state.playing = false;
}

async function updateQueueMessage(guildId) {
  const state = getState(guildId);
  if (!state.queueMessageId || !state.queueChannelId) return;
  try {
    const channel = await client.channels.fetch(state.queueChannelId);
    if (!channel || !channel.isTextBased()) return;
    const message = await channel.messages.fetch(state.queueMessageId);
    const payload = buildQueuePayload(state, state.queuePage || 1, null, state.queueIconUrl || null);
    await message.edit(payload);
  } catch (err) {
    console.error("Failed to update queue message", err);
  }
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

function sumQueueDuration(tracks) {
  return tracks.reduce((acc, t) => acc + (t?.info?.length || 0), 0);
}

function trackTitle(track) {
  const title = track.info?.title || "Unknown title";
  const author = track.info?.author ? ` — ${track.info.author}` : "";
  return `${title}${author}`;
}

function isPlayerConnected(player) {
  const conn = player?.connection;
  if (!conn) return false;
  if (typeof conn.connected === "boolean") return conn.connected;
  if (typeof conn.ready === "boolean") return conn.ready;
  if (typeof conn.state === "string") return conn.state.toLowerCase() === "connected";
  if (typeof conn.state === "number") return conn.state === 2;
  return true;
}

function buildTrackEmbed(track, title, icon, context) {
  const info = track.info || {};
  const embed = new EmbedBuilder()
    .setColor(ICON_COLORS.nowplaying)
    .setAuthor({
      name: title,
      iconURL: `attachment://${ICONS[icon]}`
    })
    .setTitle(info.title || "Unknown title")
    .setURL(info.uri || null)
    .addFields(
      { name: "Artist", value: info.author || "Unknown", inline: true },
      { name: "Duration", value: formatDuration(info.length), inline: true }
    );
  if (context) {
    embed.setDescription(context);
  }
  if (info.artworkUrl) embed.setThumbnail(info.artworkUrl);
  return {
    embeds: [embed],
    files: [{ attachment: iconPath(icon), name: ICONS[icon] }]
  };
}

async function ensurePlayer(interaction, state) {
  if (!lavalinkReady) {
    if (lavalinkAuthFailed) {
      throw new Error("Lavalink auth failed. Please check `LAVALINK_PASSWORD`.");
    }
    throw new Error("Lavalink is starting. Try again in a moment.");
  }
  await waitForNodeReady();
  const me = interaction.guild.members.me || (await interaction.guild.members.fetchMe());
  const member = await interaction.guild.members.fetch(interaction.user.id);
  const voiceChannel = member.voice.channel;
  if (!voiceChannel) {
    throw new Error("Join a voice channel first.");
  }
  const perms = voiceChannel.permissionsFor(me);
  if (!perms?.has("ViewChannel")) {
    throw new Error("I can't see that voice channel. Please update permissions.");
  }
  if (!perms?.has("Connect")) {
    throw new Error("I need permission to connect to that voice channel.");
  }
  if (!perms?.has("Speak")) {
    throw new Error("I need permission to speak in that voice channel.");
  }

  if (!state.player) {
    const existingPlayer = shoukaku.players?.get?.(interaction.guild.id);
    if (existingPlayer) {
      state.player = existingPlayer;
    }
  }

  const existingConnection = shoukaku.connections.get(interaction.guild.id);
  if (existingConnection && existingConnection.channelId && existingConnection.channelId !== voiceChannel.id) {
    try {
      shoukaku.leaveVoiceChannel(interaction.guild.id);
    } catch (err) {
      console.error("Error leaving stale voice connection", err);
    }
  }

  if (state.player) {
    if (!isPlayerConnected(state.player)) {
      try {
        await state.player.destroy();
      } catch (err) {
        console.error("Error destroying disconnected player", err);
      }
      state.player = null;
    }
    const currentChannelId = state.player.connection?.channelId;
    if (currentChannelId && currentChannelId !== voiceChannel.id) {
      throw new Error(`I'm already playing in <#${currentChannelId}>. Join me there or use /leave first.`);
    }
    if (!currentChannelId || currentChannelId !== voiceChannel.id) {
      try {
        await state.player.destroy();
      } catch (err) {
        console.error("Error destroying stale player", err);
      }
      state.player = null;
    }
  }

  if (!state.player) {
    try {
      state.player = await shoukaku.joinVoiceChannel({
        guildId: interaction.guild.id,
        channelId: voiceChannel.id,
        shardId: interaction.guild.shardId,
        deaf: true
      });
    } catch (err) {
      const message = err?.message || "";
      if (message.includes("existing connection")) {
        const existingPlayer = shoukaku.players?.get?.(interaction.guild.id);
        if (existingPlayer) {
          state.player = existingPlayer;
        } else {
          try {
            shoukaku.leaveVoiceChannel(interaction.guild.id);
          } catch (leaveErr) {
            console.error("Error leaving stale voice connection", leaveErr);
          }
          await new Promise((r) => setTimeout(r, 2000));
          state.player = await shoukaku.joinVoiceChannel({
            guildId: interaction.guild.id,
            channelId: voiceChannel.id,
            shardId: interaction.guild.shardId,
            deaf: true
          });
        }
      } else if (message.includes("voice connection") || message.includes("not established")) {
        try {
          shoukaku.leaveVoiceChannel(interaction.guild.id);
        } catch (leaveErr) {
          console.error("Error leaving failed voice connection", leaveErr);
        }
        await new Promise((r) => setTimeout(r, 2000));
        state.player = await shoukaku.joinVoiceChannel({
          guildId: interaction.guild.id,
          channelId: voiceChannel.id,
          shardId: interaction.guild.shardId,
          deaf: true
        });
      } else {
        throw err;
      }
    }

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

    state.player.on("closed", () => {
      resetState(state);
    });
  }

  if (state.idleTimer) {
    clearTimeout(state.idleTimer);
    state.idleTimer = null;
  }

  return { voiceChannel };
}

async function resolveTracks(query) {
  if (!lavalinkReady) {
    if (lavalinkAuthFailed) {
      throw new Error("Lavalink auth failed. Please check `LAVALINK_PASSWORD`.");
    }
    throw new Error("Lavalink is starting. Try again in a moment.");
  }
  const node = shoukaku.nodes.get("main");
  if (!node) throw new Error("Lavalink node is not ready yet.");

  const identifier = /^https?:\/\//.test(query) ? query : `scsearch:${query}`;
  return node.rest.resolve(identifier);
}

function normalizeLoadResult(res) {
  const loadType = res?.loadType || res?.loadtype || "";
  if (Array.isArray(res?.tracks)) {
    return { loadType, tracks: res.tracks, playlistInfo: res.playlistInfo };
  }
  if (res?.data) {
    if (Array.isArray(res.data)) {
      return { loadType, tracks: res.data, playlistInfo: res.playlistInfo };
    }
    if (Array.isArray(res.data?.tracks)) {
      return { loadType, tracks: res.data.tracks, playlistInfo: res.data.info };
    }
    if (res.data?.encoded) {
      return { loadType, tracks: [res.data], playlistInfo: null };
    }
  }
  return { loadType, tracks: [], playlistInfo: null };
}

async function replyError(interaction, message) {
  const payload = buildEmbedMessage({
    title: "Error",
    description: message,
    icon: "error"
  });
  if (interaction.deferred) {
    await interaction.editReply(payload);
    return;
  }
  await interaction.reply({ ...payload, ephemeral: true });
}

async function replyWarn(interaction, message) {
  const payload = buildEmbedMessage({
    title: "Warning",
    description: message,
    icon: "warning"
  });
  if (interaction.deferred) {
    await interaction.editReply(payload);
    return;
  }
  await interaction.reply({ ...payload, ephemeral: true });
}

async function requireSameVoiceChannel(interaction) {
  const member = await interaction.guild.members.fetch(interaction.user.id);
  const userChannel = member.voice.channel;
  const me = interaction.guild.members.me || (await interaction.guild.members.fetchMe());
  const botChannel = me.voice.channel;

  if (botChannel) {
    if (!userChannel) {
      await replyWarn(interaction, "Join voice channel to use commands.");
      return false;
    }
    if (userChannel.id !== botChannel.id) {
      await replyWarn(interaction, `Join <#${botChannel.id}> to control playback.`);
      return false;
    }
    return true;
  }

  if (!userChannel) {
    await replyWarn(interaction, "Join a voice channel to use music commands.");
    return false;
  }
  return true;
}

async function playNext(guildId) {
  const state = queues.get(guildId);
  if (!state || !state.player || state.playing) return;

  const next = state.queue.shift();
  if (!next) {
    state.now = null;
    await updateQueueMessage(guildId);
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
  if (state.player.setPaused) {
    await state.player.setPaused(false);
  }
  await state.player.playTrack({ track: { encoded: next.encoded } });
  await updateQueueMessage(guildId);
}

client.once(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await waitForLavalink();
  ensureNodeReconnectLoop();
});

shoukaku.on("ready", (name) => {
  console.log(`Lavalink node ${name} connected.`);
  if (nodeReconnectTimer) {
    clearInterval(nodeReconnectTimer);
    nodeReconnectTimer = null;
  }
});

shoukaku.on("error", (name, error) => {
  const now = Date.now();
  const code = error?.code;
  const status = error?.status;
  if ((code === "ECONNREFUSED" || status === 401) && now - lastLavalinkHint > 5000) {
    lastLavalinkHint = now;
    console.log(
      "Lavalink not ready or auth mismatch. Waiting for it to become available..."
    );
  }
  if (code === "ECONNREFUSED") {
    ensureNodeReconnectLoop();
  }
  console.error(`Lavalink node ${name} error`, error);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isButton()) {
    const [type, action, pageStr, userId] = interaction.customId.split(":");
    if (type !== "queue") return;
    const allowed = await requireSameVoiceChannel(interaction);
    if (!allowed) return;
    const state = getState(interaction.guild.id);
    const page = Number.parseInt(pageStr, 10) || 1;
    const totalPages = Math.max(1, Math.ceil(state.queue.length / QUEUE_PAGE_SIZE));
    let nextPage = page;
    if (action === "next") nextPage = page + 1;
    if (action === "prev") nextPage = page - 1;
    if (action === "first") nextPage = 1;
    if (action === "last") nextPage = totalPages;
    const attachment = interaction.message.attachments.find((a) => a.name === ICONS.queue);
    const iconUrl = attachment ? attachment.url : null;
    state.queuePage = nextPage;
    state.queueIconUrl = iconUrl || state.queueIconUrl;
    state.queueMessageId = interaction.message.id;
    state.queueChannelId = interaction.channelId;
    await interaction.update(buildQueuePayload(state, nextPage, interaction.user.id, iconUrl));
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const allowed = await requireSameVoiceChannel(interaction);
  if (!allowed) return;

  const state = getState(interaction.guild.id);

  try {
    switch (interaction.commandName) {
      case "play": {
        await interaction.deferReply();
        await ensurePlayer(interaction, state);

        const query = interaction.options.getString("query", true);
        const res = await resolveTracks(query);
        const result = normalizeLoadResult(res);
        const loadType = (result.loadType || "").toUpperCase();

        if (loadType === "LOAD_FAILED") {
          await interaction.editReply(
            buildEmbedMessage({
              title: "Load failed",
              description: "I couldn't load that track. The provider might be blocked or unavailable.",
              icon: "warning"
            })
          );
          return;
        }
        if (loadType === "NO_MATCHES") {
          await interaction.editReply(
            buildEmbedMessage({
              title: "No matches",
              description: "No matches found. Try another link or search.",
              icon: "warning"
            })
          );
          return;
        }

        if (!result || result.tracks.length === 0) {
          await interaction.editReply(
            buildEmbedMessage({
              title: "No matches",
              description: "No matches found. Try another link or search.",
              icon: "warning"
            })
          );
          return;
        }

        const isCollection =
          /\/(playlist|album)\//.test(query) ||
          result.loadType === "PLAYLIST_LOADED" ||
          result.loadType === "playlist_loaded" ||
          Boolean(result.playlistInfo?.name);

        if (isCollection && result.tracks.length > 1) {
          state.queue.push(...result.tracks);
          await interaction.editReply(
            buildEmbedMessage({
              title: "Queued playlist",
              description: `${result.playlistInfo?.name || "Unknown"} (${result.tracks.length} tracks)`,
              icon: "queue"
            })
          );
          const first = result.tracks[0];
          const context = `From: ${result.playlistInfo?.name || "Unknown"} • ${result.tracks.length} tracks`;
          await interaction.followUp(buildTrackEmbed(first, "Now Playing", "nowplaying", context));
        } else {
          const track = result.tracks[0];
          state.queue.push(track);
          await interaction.editReply(buildTrackEmbed(track, "Now Playing", "nowplaying"));
        }

        await playNext(interaction.guild.id);
        return;
      }
      case "skip": {
        if (!state.player || !state.now) {
          await replyWarn(interaction, "Nothing is playing right now.");
          return;
        }
        const position = interaction.options.getInteger("position");
        let nextTrack = null;
        if (position !== null && position !== undefined) {
          if (position < 0) {
            await replyWarn(interaction, "Position cannot be negative. Use 0 to skip the current track.");
            return;
          }
          if (position === 0) {
            await state.player.stopTrack();
            nextTrack = state.queue[0] || null;
            await interaction.reply(buildEmbedMessage({
              title: "Skipped",
              description: "Skipped current track.",
              icon: "skip"
            }));
            if (nextTrack) {
              await interaction.followUp(buildTrackEmbed(nextTrack, "Now Playing", "nowplaying"));
            }
            return;
          }
          if (position < 1 || position > state.queue.length) {
            await replyWarn(interaction, `Position out of range. Queue length is ${state.queue.length}.`);
            return;
          }
          state.queue.splice(0, position - 1);
          nextTrack = state.queue[0] || null;
          await state.player.stopTrack();
          await interaction.reply(buildEmbedMessage({
            title: "Skipped",
            description: `Skipped to position ${position}.`,
            icon: "skip"
          }));
          if (nextTrack) {
            await interaction.followUp(buildTrackEmbed(nextTrack, "Now Playing", "nowplaying"));
          }
          return;
        }
        nextTrack = state.queue[0] || null;
        await state.player.stopTrack();
        await interaction.reply(buildEmbedMessage({
          title: "Skipped",
          description: "Skipped.",
          icon: "skip"
        }));
        if (nextTrack) {
          await interaction.followUp(buildTrackEmbed(nextTrack, "Now Playing", "nowplaying"));
        }
        return;
      }
      case "pause": {
        if (!state.player) {
          await replyWarn(interaction, "Nothing is playing right now.");
          return;
        }
        await state.player.setPaused(true);
        await interaction.reply(
          buildEmbedMessage({
            title: "Paused",
            description: "Playback paused.",
            icon: "pause"
          })
        );
        return;
      }
      case "resume": {
        if (!state.player) {
          await replyWarn(interaction, "Nothing is playing right now.");
          return;
        }
        await state.player.setPaused(false);
        await interaction.reply(
          buildEmbedMessage({
            title: "Resumed",
            description: "Playback resumed.",
            icon: "resume"
          })
        );
        return;
      }
      case "stop": {
        if (!state.player || !state.now) {
          await replyWarn(interaction, "Nothing is playing right now.");
          return;
        }
        await state.player.stopTrack();
        state.now = null;
        state.playing = false;
        await interaction.reply(
          buildEmbedMessage({
            title: "Stopped",
            description: "Playback stopped.",
            icon: "stop"
          })
        );
        await updateQueueMessage(interaction.guild.id);
        return;
      }
      case "nowplaying": {
        if (!state.now) {
          await replyWarn(interaction, "Nothing is playing right now.");
          return;
        }
        const track = state.now;
        await interaction.reply(buildTrackEmbed(track, "Now Playing", "nowplaying"));
        return;
      }
      case "queue": {
        if (state.queue.length === 0) {
          await replyWarn(interaction, "Queue is empty.");
          return;
        }
        const payload = buildQueuePayload(state, 1, interaction.user.id);
        await interaction.reply(payload);
        const message = await interaction.fetchReply();
        const attachment = message.attachments.find((a) => a.name === ICONS.queue);
        state.queueMessageId = message.id;
        state.queueChannelId = interaction.channelId;
        state.queuePage = 1;
        state.queueIconUrl = attachment ? attachment.url : null;
        return;
      }
      case "shuffle": {
        if (state.queue.length < 2) {
          await replyWarn(interaction, "Not enough tracks in the queue to shuffle.");
          return;
        }
        for (let i = state.queue.length - 1; i > 0; i -= 1) {
          const j = Math.floor(Math.random() * (i + 1));
          [state.queue[i], state.queue[j]] = [state.queue[j], state.queue[i]];
        }
        await interaction.reply(
          buildEmbedMessage({
            title: "Shuffled",
            description: "Queue shuffled.",
            icon: "shuffle"
          })
        );
        await updateQueueMessage(interaction.guild.id);
        return;
      }
      case "clear": {
        if (state.queue.length === 0) {
          await replyWarn(interaction, "Queue is already empty.");
          return;
        }
        state.queue = [];
        await interaction.reply(
          buildEmbedMessage({
            title: "Queue cleared",
            description: "All queued tracks removed.",
            icon: "queue"
          })
        );
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
        try {
          shoukaku.leaveVoiceChannel(interaction.guild.id);
        } catch (err) {
          console.error("Error leaving voice channel", err);
        }
        await interaction.reply(
          buildEmbedMessage({
            title: "Disconnected",
            description: "Gracefully leaving...",
            icon: "leave"
          })
        );
        await updateQueueMessage(interaction.guild.id);
        return;
      }
      default:
        await replyWarn(interaction, "Unknown command.");
    }
  } catch (err) {
    console.error(err);
    const message = err?.message || "Something went wrong.";
    await replyError(interaction, message);
  }
});

client.on(Events.VoiceStateUpdate, (oldState, newState) => {
  const me = newState.guild.members.me;
  if (!me || newState.id !== me.id) return;
  if (oldState.channelId && !newState.channelId) {
    const state = getState(newState.guild.id);
    resetState(state);
    try {
      shoukaku.leaveVoiceChannel(newState.guild.id);
    } catch (err) {
      console.error("Error leaving voice channel on disconnect", err);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
