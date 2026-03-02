module.exports = async function handleLanguage(ctx) {
  const { interaction, t, LANGUAGE_NAMES, setGuildLanguage, buildEmbedMessage, replyWarn } = ctx;
  const lang = interaction.options.getString("value", true);
  if (!LANGUAGE_NAMES[lang]) {
    await replyWarn(interaction, t(interaction.guild.id, "error_generic"));
    return;
  }
  setGuildLanguage(interaction.guild.id, lang);
  await interaction.reply(
    buildEmbedMessage({
      title: t(interaction.guild.id, "language_set_title"),
      description: t(interaction.guild.id, "language_set_desc", { language: LANGUAGE_NAMES[lang] }),
      icon: "queue"
    })
  );
};

