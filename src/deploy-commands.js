require("dotenv").config();
const { REST, Routes, SlashCommandBuilder } = require("discord.js");

const commands = [
  new SlashCommandBuilder()
    .setName("play")
    .setDescription("Play a track, playlist, or album from a link or search query")
    .addStringOption((opt) =>
      opt
        .setName("query")
        .setDescription("Spotify/YouTube Music link or search query")
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName("skip")
    .setDescription("Skip the current track or jump to a position in the queue")
    .addIntegerOption((opt) =>
      opt
        .setName("position")
        .setDescription("Queue position to skip to (0 = current, 1 = next track)")
        .setRequired(false)
    ),
  new SlashCommandBuilder().setName("pause").setDescription("Pause playback"),
  new SlashCommandBuilder().setName("resume").setDescription("Resume playback"),
  new SlashCommandBuilder().setName("stop").setDescription("Stop playback and clear current track"),
  new SlashCommandBuilder().setName("nowplaying").setDescription("Show the current track"),
  new SlashCommandBuilder().setName("queue").setDescription("Show the queue"),
  new SlashCommandBuilder().setName("shuffle").setDescription("Shuffle the queue"),
  new SlashCommandBuilder().setName("clear").setDescription("Clear the queue"),
  new SlashCommandBuilder().setName("leave").setDescription("Disconnect the bot"),
].map((c) => c.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    if (!process.env.CLIENT_ID) throw new Error("Missing CLIENT_ID");
    if (process.env.GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), {
        body: commands
      });
      console.log("Registered guild commands.");
      return;
    }

    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
    console.log("Registered global commands.");
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
