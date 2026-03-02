module.exports = async function handleStop(ctx) {
  const {
    interaction,
    state,
    t,
    replyWarn,
    buildEmbedMessage,
    clearQueueFinishTimer,
    updateQueueMessage,
    updateNowPlayingMessage
  } = ctx;

  const hasPlayer = Boolean(state.player);
  const hasCurrent = Boolean(state.now || state.player?.track);
  const hadQueue = state.queue.length > 0;
  if (!hasPlayer && !hasCurrent && !hadQueue) {
    await replyWarn(interaction, t(interaction.guild.id, "warn_nothing_playing"));
    return;
  }

  if (hasPlayer) {
    try {
      await state.player.destroy();
    } catch (err) {
      console.error("Failed to destroy player during stop command", err);
    } finally {
      state.player = null;
    }
  }

  if (state.idleTimer) {
    clearTimeout(state.idleTimer);
    state.idleTimer = null;
  }
  clearQueueFinishTimer(state);
  state.retryCounts = {};
  state.retrySeen = {};
  state.suppressStopEvents = 0;
  state.queueFinishedNotified = false;
  state.queue = [];
  state.now = null;
  state.nowDisplay = null;
  state.playing = false;
  state.startedAt = null;

  await interaction.reply(
    buildEmbedMessage({
      title: t(interaction.guild.id, "stopped_title"),
      description: t(interaction.guild.id, "stopped_desc"),
      icon: "stop"
    })
  );

  // Keep queue/nowplaying message references but refresh content to reflect stopped state.
  if (state.queueMessageId || state.queueChannelId || state.nowPlayingMessageId || state.nowPlayingChannelId) {
    try {
      await updateQueueMessage(interaction.guild.id);
    } catch (err) {
      console.error("Failed to refresh queue message after stop", err);
    }
    try {
      await updateNowPlayingMessage(interaction.guild.id);
    } catch (err) {
      console.error("Failed to refresh now playing message after stop", err);
    }
  }
};
