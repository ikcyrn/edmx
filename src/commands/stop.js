module.exports = async function handleStop(ctx) {
  const {
    interaction,
    state,
    t,
    replyWarn,
    buildEmbedMessage,
    stopCurrentForTransition,
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
    const stopped = await stopCurrentForTransition(state, "Failed to stop current track for stop command");
    if (!stopped && state.player) {
      try {
        await state.player.destroy();
      } catch (err) {
        console.error("Failed to destroy player during stop command", err);
      }
      state.player = null;
    }
  }
  clearQueueFinishTimer(state);
  state.queue = [];
  state.now = null;
  state.nowDisplay = null;
  state.playing = false;

  await interaction.reply(
    buildEmbedMessage({
      title: t(interaction.guild.id, "stopped_title"),
      description: t(interaction.guild.id, "stopped_desc"),
      icon: "stop"
    })
  );
  await updateQueueMessage(interaction.guild.id);
  await updateNowPlayingMessage(interaction.guild.id);
};
