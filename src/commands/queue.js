module.exports = async function handleQueue(ctx) {
  const { interaction, state, t, replyWarn, buildQueuePayload, ICONS } = ctx;
  if (state.queue.length === 0) {
    await replyWarn(interaction, t(interaction.guild.id, "queue_empty_warn"));
    return;
  }
  const payload = buildQueuePayload(state, 1, interaction.user.id);
  await interaction.reply(payload);
  const message = await interaction.fetchReply();
  const attachment = message.attachments.find((a) => a.name === ICONS.queue);
  state.queueMessageId = message.id;
  state.queueChannelId = interaction.channelId;
  state.lastChannelId = interaction.channelId;
  state.queuePage = 1;
  state.queueIconUrl = attachment ? attachment.url : null;
};

