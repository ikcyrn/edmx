const handleLanguage = require("./language");
const handlePlay = require("./play");
const handleSkip = require("./skip");
const handlePause = require("./pause");
const handleResume = require("./resume");
const handleNowPlaying = require("./nowplaying");
const handleQueue = require("./queue");
const handleShuffle = require("./shuffle");
const handleClear = require("./clear");
const handleLeave = require("./leave");

module.exports = {
  language: { run: handleLanguage, requiresVoice: false },
  play: { run: handlePlay, requiresVoice: true },
  skip: { run: handleSkip, requiresVoice: true },
  pause: { run: handlePause, requiresVoice: true },
  resume: { run: handleResume, requiresVoice: true },
  nowplaying: { run: handleNowPlaying, requiresVoice: true },
  queue: { run: handleQueue, requiresVoice: true },
  shuffle: { run: handleShuffle, requiresVoice: true },
  clear: { run: handleClear, requiresVoice: true },
  leave: { run: handleLeave, requiresVoice: true }
};

