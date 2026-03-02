module.exports = async function handleStop(ctx) {
  const {
    interaction,
    state,
    t,
    replyWarn,
    buildEmbedMessage,
    stopCurrentForTransition,
    updateQueueMessage,
    updateNowPlayingMessage
  } = ctx;

  const hasCurrent = Boolean(state.now || state.player?.track);
  const hadQueue = state.queue.length > 0;
  if (!hasCurrent && !hadQueue) {
    await replyWarn(interaction, t(interaction.guild.id, "warn_nothing_playing"));
    return;
  }

  if (hasCurrent) {
    await stopCurrentForTransition(state, "Failed to stop current track for stop command");
  }
  state.queue = [];
  state.now = null;
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

