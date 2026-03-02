module.exports = async function handleNowPlaying(ctx) {
  const { interaction, state, t, replyWarn, buildTrackEmbed } = ctx;
  if (!state.now) {
    await replyWarn(interaction, t(interaction.guild.id, "warn_nothing_playing"));
    return;
  }
  await interaction.reply(
    buildTrackEmbed(state.now, t(interaction.guild.id, "now_playing_title"), "nowplaying", null, interaction.guild.id)
  );
  const message = await interaction.fetchReply();
  state.nowPlayingMessageId = message.id;
  state.nowPlayingChannelId = interaction.channelId;
};
