module.exports = async function handleShuffle(ctx) {
  const { interaction, state, t, replyWarn, buildEmbedMessage, updateQueueMessage } = ctx;
  if (state.queue.length < 2) {
    await replyWarn(interaction, t(interaction.guild.id, "queue_not_enough_shuffle"));
    return;
  }
  for (let i = state.queue.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [state.queue[i], state.queue[j]] = [state.queue[j], state.queue[i]];
  }
  await interaction.reply(
    buildEmbedMessage({
      title: t(interaction.guild.id, "shuffled_title"),
      description: t(interaction.guild.id, "shuffled_desc"),
      icon: "shuffle"
    })
  );
  await updateQueueMessage(interaction.guild.id);
};

