module.exports = async function handleSkip(ctx) {
  const { interaction, state, t, replyWarn, buildEmbedMessage, playNext, buildTrackEmbed, stopCurrentForTransition } = ctx;
  if (!state.player || !state.now) {
    await replyWarn(interaction, t(interaction.guild.id, "warn_nothing_playing"));
    return;
  }
  const position = interaction.options.getInteger("position");
  if (position !== null && position !== undefined) {
    if (position < 0) {
      await replyWarn(interaction, t(interaction.guild.id, "warn_negative_position"));
      return;
    }
    if (position === 0) {
      state.playing = false;
      state.now = null;
      await stopCurrentForTransition(state, "Failed to stop current track for skip");
      await interaction.reply(
        buildEmbedMessage({
          title: t(interaction.guild.id, "skipped_title"),
          description: t(interaction.guild.id, "skipped_current_desc"),
          icon: "skip"
        })
      );
      await playNext(interaction.guild.id, true);
      if (state.now) {
        await interaction.followUp(
          buildTrackEmbed(state.now, t(interaction.guild.id, "now_playing_title"), "nowplaying", null, interaction.guild.id)
        );
      }
      return;
    }
    if (position < 1 || position > state.queue.length) {
      await replyWarn(interaction, t(interaction.guild.id, "warn_position_out_of_range", { length: state.queue.length }));
      return;
    }
    state.queue.splice(0, position - 1);
    state.playing = false;
    state.now = null;
    await stopCurrentForTransition(state, "Failed to stop current track for positional skip");
    await interaction.reply(
      buildEmbedMessage({
        title: t(interaction.guild.id, "skipped_title"),
        description: t(interaction.guild.id, "skipped_to_desc", { position }),
        icon: "skip"
      })
    );
    await playNext(interaction.guild.id, true);
    if (state.now) {
      await interaction.followUp(
        buildTrackEmbed(state.now, t(interaction.guild.id, "now_playing_title"), "nowplaying", null, interaction.guild.id)
      );
    }
    return;
  }
  state.playing = false;
  state.now = null;
  await stopCurrentForTransition(state, "Failed to stop current track for skip");
  await interaction.reply(
    buildEmbedMessage({
      title: t(interaction.guild.id, "skipped_title"),
      description: t(interaction.guild.id, "skipped_desc"),
      icon: "skip"
    })
  );
  await playNext(interaction.guild.id, true);
  if (state.now) {
    await interaction.followUp(
      buildTrackEmbed(state.now, t(interaction.guild.id, "now_playing_title"), "nowplaying", null, interaction.guild.id)
    );
  }
};

