module.exports = async function handlePlay(ctx) {
  const {
    interaction,
    state,
    t,
    ensurePlayer,
    getNodeOverloadReason,
    buildEmbedMessage,
    resolveTracks,
    normalizeLoadResult,
    clearQueueFinishTimer,
    buildTrackEmbed,
    playNext,
    updateQueueMessage
  } = ctx;

  await interaction.deferReply();
  await ensurePlayer(interaction, state);
  state.lastChannelId = interaction.channelId;
  state.queueFinishedNotified = false;

  const overloadReason = getNodeOverloadReason();
  if (overloadReason) {
    await interaction.editReply(
      buildEmbedMessage({
        title: t(interaction.guild.id, "busy_title"),
        description: t(interaction.guild.id, "busy_desc"),
        icon: "warning"
      })
    );
    return;
  }

  const query = interaction.options.getString("query", true);
  const res = await resolveTracks(query);
  const result = normalizeLoadResult(res);
  const loadType = (result.loadType || "").toUpperCase();

  if (loadType === "LOAD_FAILED") {
    await interaction.editReply(
      buildEmbedMessage({
        title: t(interaction.guild.id, "load_failed_title"),
        description: t(interaction.guild.id, "load_failed_desc"),
        icon: "warning"
      })
    );
    return;
  }
  if (loadType === "NO_MATCHES") {
    await interaction.editReply(
      buildEmbedMessage({
        title: t(interaction.guild.id, "no_matches_title"),
        description: t(interaction.guild.id, "no_matches_desc"),
        icon: "warning"
      })
    );
    return;
  }

  if (!result || result.tracks.length === 0) {
    await interaction.editReply(
      buildEmbedMessage({
        title: t(interaction.guild.id, "no_matches_title"),
        description: t(interaction.guild.id, "no_matches_desc"),
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

  const isPlaying = Boolean(state.now && state.playing && state.player?.track);
  clearQueueFinishTimer(state);

  if (!isPlaying) {
    const hasStalePlaybackState = Boolean(
      state.player && (state.player.track || state.playing || state.now || state.suppressStopEvents > 0)
    );
    if (hasStalePlaybackState) {
      try {
        state.expectedPlayerClose = true;
        await state.player.destroy();
      } catch (err) {
        state.expectedPlayerClose = false;
        console.error("Failed to destroy stale player before restarting playback", err);
      }
      state.player = null;
      state.suppressStopEvents = 0;
      state.playing = false;
      state.now = null;
      state.nowDisplay = null;
      await ensurePlayer(interaction, state);
    }
  }

  if (isCollection && result.tracks.length > 1) {
    state.queue.push(...result.tracks);
    await interaction.editReply(
      buildEmbedMessage({
        title: t(interaction.guild.id, "queued_playlist_title"),
        description: t(interaction.guild.id, "queued_playlist_desc", {
          name: result.playlistInfo?.name || t(interaction.guild.id, "unknown_title"),
          count: result.tracks.length
        }),
        icon: "queue"
      })
    );
    if (!isPlaying) {
      const first = result.tracks[0];
      const context = t(interaction.guild.id, "from_playlist_context", {
        name: result.playlistInfo?.name || t(interaction.guild.id, "unknown_title"),
        count: result.tracks.length
      });
      await interaction.followUp(
        buildTrackEmbed(first, t(interaction.guild.id, "now_playing_title"), "nowplaying", context, interaction.guild.id)
      );
    }
  } else {
    const track = result.tracks[0];
    state.queue.push(track);
    if (isPlaying) {
      await interaction.editReply(
        buildTrackEmbed(
          track,
          t(interaction.guild.id, "queued_track_title"),
          "queue",
          t(interaction.guild.id, "queued_track_desc"),
          interaction.guild.id
        )
      );
    } else {
      await interaction.editReply(
        buildTrackEmbed(track, t(interaction.guild.id, "now_playing_title"), "nowplaying", null, interaction.guild.id)
      );
    }
  }

  if (!isPlaying) {
    state.playing = false;
    state.now = null;
    state.nowDisplay = null;
    await playNext(interaction.guild.id, true, { announce: false });
    if (!state.now && state.queue.length > 0) {
      try {
        if (state.player) {
          state.expectedPlayerClose = true;
          await state.player.destroy();
        }
      } catch (err) {
        state.expectedPlayerClose = false;
        console.error("Failed to reset player after unsuccessful playback start", err);
      }
      state.player = null;
      await ensurePlayer(interaction, state);
      await playNext(interaction.guild.id, true, { announce: false });
    }
  } else {
    await updateQueueMessage(interaction.guild.id);
  }
};
