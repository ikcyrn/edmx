module.exports = async function handlePause(ctx) {
  const { interaction, state, t, replyWarn, buildEmbedMessage } = ctx;
  if (!state.player || !state.now) {
    await replyWarn(interaction, t(interaction.guild.id, "warn_nothing_playing"));
    return;
  }
  await state.player.setPaused(true);
  await interaction.reply(
    buildEmbedMessage({
      title: t(interaction.guild.id, "paused_title"),
      description: t(interaction.guild.id, "paused_desc"),
      icon: "pause"
    })
  );
};

