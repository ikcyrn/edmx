module.exports = async function handleResume(ctx) {
  const { interaction, state, t, replyWarn, buildEmbedMessage } = ctx;
  if (!state.player || !state.now) {
    await replyWarn(interaction, t(interaction.guild.id, "warn_nothing_playing"));
    return;
  }
  await state.player.setPaused(false);
  await interaction.reply(
    buildEmbedMessage({
      title: t(interaction.guild.id, "resumed_title"),
      description: t(interaction.guild.id, "resumed_desc"),
      icon: "resume"
    })
  );
};

