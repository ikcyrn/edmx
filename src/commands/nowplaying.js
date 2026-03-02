module.exports = async function handleNowPlaying(ctx) {
  const { interaction, state, t, replyWarn, buildTrackEmbed } = ctx;
  const current = state.nowDisplay || state.now;
  if (!current) {
    await replyWarn(interaction, t(interaction.guild.id, "warn_nothing_playing"));
    return;
  }
  await interaction.reply(
    buildTrackEmbed(current, t(interaction.guild.id, "now_playing_title"), "nowplaying", null, interaction.guild.id)
  );
  const message = await interaction.fetchReply();
  state.nowPlayingMessageId = message.id;
  state.nowPlayingChannelId = interaction.channelId;
};
