module.exports = async function handleClear(ctx) {
  const { interaction, state, t, replyWarn, buildEmbedMessage, updateQueueMessage } = ctx;
  if (state.queue.length === 0) {
    await replyWarn(interaction, t(interaction.guild.id, "queue_already_empty"));
    return;
  }
  state.queue = [];
  await interaction.reply(
    buildEmbedMessage({
      title: t(interaction.guild.id, "queue_cleared_title"),
      description: t(interaction.guild.id, "queue_cleared_desc"),
      icon: "queue"
    })
  );
  await updateQueueMessage(interaction.guild.id);
};

