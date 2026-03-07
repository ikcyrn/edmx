module.exports = async function handleLeave(ctx) {
  const { interaction, state, t, shoukaku, buildEmbedMessage, updateQueueMessage, updateNowPlayingMessage } = ctx;
  if (state.player) {
    state.expectedPlayerClose = true;
    await state.player.destroy();
    state.player = null;
    state.queue = [];
    state.now = null;
    state.nowDisplay = null;
    state.playing = false;
  }
  try {
    shoukaku.leaveVoiceChannel(interaction.guild.id);
  } catch (err) {
    console.error("Error leaving voice channel", err);
  }
  await interaction.reply(
    buildEmbedMessage({
      title: t(interaction.guild.id, "disconnected_title"),
      description: t(interaction.guild.id, "disconnected_desc"),
      icon: "leave"
    })
  );
  await updateQueueMessage(interaction.guild.id);
  await updateNowPlayingMessage(interaction.guild.id);
};
