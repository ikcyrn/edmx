require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  Events,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");
const path = require("path");
const fs = require("fs");
const { Shoukaku, Connectors } = require("shoukaku");

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates]
});

const nodes = [
  {
    name: "main",
    url: `${process.env.LAVALINK_HOST || "localhost"}:${process.env.LAVALINK_PORT || "2333"}`,
    auth: process.env.LAVALINK_PASSWORD || "youshallnotpass",
    secure: false,
    version: "v4"
  }
];

const shoukaku = new Shoukaku(new Connectors.DiscordJS(client), nodes, {
  moveOnDisconnect: false
});

const queues = new Map();
let lastLavalinkHint = 0;
let lavalinkReady = false;
let lavalinkAuthFailed = false;
let nodeReconnectTimer = null;

const ICONS = {
  play: "play.png",
  pause: "pause.png",
  resume: "resume.png",
  skip: "skip.png",
  nowplaying: "nowplaying.png",
  queue: "queue.png",
  shuffle: "shuffle.png",
  leave: "leave.png",
  warning: "warning.png",
  error: "error.png"
};

const ICON_COLORS = {
  play: 0x6366f1,
  pause: 0x6366f1,
  resume: 0x6366f1,
  skip: 0x6366f1,
  nowplaying: 0x6366f1,
  queue: 0x6366f1,
  shuffle: 0x6366f1,
  leave: 0x6366f1,
  warning: 0xfbbf24,
  error: 0xf87171
};

const OVERLOAD_CPU_THRESHOLD = 0.9;
const OVERLOAD_MEM_FREE_MB = 256;
const EARLY_END_TOLERANCE = 0.99;
const EARLY_END_MIN_MS = 10000;

const LANGUAGE_FILE = path.join(__dirname, "..", "data", "language.json");
const LANGUAGE_NAMES = {
  en: "English",
  "zh-CN": "简体中文",
  "zh-TW": "繁體中文",
  ja: "日本語",
  ko: "한국어"
};
const MESSAGES = {
  en: {
    error_title: "Error",
    warning_title: "Warning",
    error_generic: "Something went wrong. Please try again in a moment.",
    err_lavalink_auth: "Lavalink auth failed. Please check `LAVALINK_PASSWORD`.",
    err_lavalink_starting: "Lavalink is starting. Try again in a moment.",
    err_lavalink_node_not_ready: "Lavalink node is not ready yet.",
    err_audio_connection_not_ready: "Audio connection not ready. Try again in a moment.",
    err_join_voice: "Join a voice channel first.",
    err_join_voice_commands: "Join a voice channel to use music commands.",
    err_join_voice_control: "Join voice channel to use commands.",
    err_join_specific: "Join <#{channelId}> to control playback.",
    err_view_channel: "I can't see that voice channel. Please update permissions.",
    err_connect_channel: "I need permission to connect to that voice channel.",
    err_speak_channel: "I need permission to speak in that voice channel.",
    err_already_playing: "I'm already playing in <#{channelId}>. Join me there or use /leave first.",
    load_failed_title: "Load failed",
    load_failed_desc: "I couldn't load that track. The provider might be blocked or unavailable.",
    no_matches_title: "No matches",
    no_matches_desc: "No matches found. Try another link or search.",
    queued_playlist_title: "Queued playlist",
    queued_playlist_desc: "{name} ({count} tracks)",
    queued_track_title: "Added to queue",
    queued_track_desc: "Added to the end of the queue.",
    now_playing_title: "Now Playing",
    unknown_title: "Unknown title",
    unknown_artist: "Unknown",
    artist_label: "Artist",
    duration_label: "Duration",
    from_playlist_context: "From: {name} • {count} tracks",
    warn_nothing_playing: "Nothing is playing right now.",
    warn_negative_position: "Position cannot be negative. Use 0 to skip the current track.",
    warn_position_out_of_range: "Position out of range. Queue length is {length}.",
    skipped_title: "Skipped",
    skipped_current_desc: "Skipped current track.",
    skipped_to_desc: "Skipped to position {position}.",
    skipped_desc: "Skipped.",
    paused_title: "Paused",
    paused_desc: "Playback paused.",
    resumed_title: "Resumed",
    resumed_desc: "Playback resumed.",
    queue_title: "Queue",
    queue_page_title: "Queue — Page {page}/{total}",
    queue_empty_desc: "Queue is empty.",
    queue_total_label: "Total in Queue",
    queue_duration_label: "Total Duration",
    now_playing_label: "Now Playing",
    queue_empty_warn: "Queue is empty.",
    queue_already_empty: "Queue is already empty.",
    queue_not_enough_shuffle: "Not enough tracks in the queue to shuffle.",
    shuffled_title: "Shuffled",
    shuffled_desc: "Queue shuffled.",
    queue_cleared_title: "Queue cleared",
    queue_cleared_desc: "All queued tracks removed.",
    disconnected_title: "Disconnected",
    disconnected_desc: "Gracefully leaving...",
    busy_title: "Busy",
    busy_desc: "I'm a bit busy right now. Please try again in a minute.",
    unknown_command: "Unknown command.",
    language_set_title: "Language updated",
    language_set_desc: "Language set to {language}.",
    language_current_title: "Language",
    language_current_desc: "Current language: {language}."
  },
  "zh-CN": {
    error_title: "错误",
    warning_title: "提醒",
    error_generic: "出了点问题，请稍后再试。",
    err_lavalink_auth: "音频服务器认证失败，请检查密码。",
    err_lavalink_starting: "音频服务器正在启动，请稍后再试。",
    err_lavalink_node_not_ready: "音频服务器还没准备好。",
    err_audio_connection_not_ready: "语音连接还没准备好，请稍后再试。",
    err_join_voice: "请先加入语音频道。",
    err_join_voice_commands: "请加入语音频道后再使用指令。",
    err_join_voice_control: "请加入语音频道以使用指令。",
    err_join_specific: "请加入 <#{channelId}> 以控制播放。",
    err_view_channel: "我看不到那个语音频道，请检查权限。",
    err_connect_channel: "我需要连接语音频道的权限。",
    err_speak_channel: "我需要在语音频道讲话的权限。",
    err_already_playing: "我已经在 <#{channelId}> 播放了。请加入该频道或先用 /leave。",
    load_failed_title: "加载失败",
    load_failed_desc: "我无法加载该音频，可能被屏蔽或不可用。",
    no_matches_title: "无匹配",
    no_matches_desc: "没有找到结果，请换一个链接或搜索词。",
    queued_playlist_title: "已加入播放列表",
    queued_playlist_desc: "{name}（{count}首）",
    queued_track_title: "已加入队列",
    queued_track_desc: "已添加到队列末尾。",
    now_playing_title: "正在播放",
    unknown_title: "未知标题",
    unknown_artist: "未知",
    artist_label: "艺术家",
    duration_label: "时长",
    from_playlist_context: "来自：{name} • {count}首",
    warn_nothing_playing: "目前没有在播放。",
    warn_negative_position: "位置不能为负数。用 0 跳过当前曲目。",
    warn_position_out_of_range: "位置超出范围。队列长度为 {length}。",
    skipped_title: "已跳过",
    skipped_current_desc: "已跳过当前曲目。",
    skipped_to_desc: "已跳到第 {position} 首。",
    skipped_desc: "已跳过。",
    paused_title: "已暂停",
    paused_desc: "播放已暂停。",
    resumed_title: "已继续",
    resumed_desc: "播放已继续。",
    queue_title: "队列",
    queue_page_title: "队列 — 第 {page}/{total} 页",
    queue_empty_desc: "队列为空。",
    queue_total_label: "队列总数",
    queue_duration_label: "总时长",
    now_playing_label: "正在播放",
    queue_empty_warn: "队列为空。",
    queue_already_empty: "队列已经为空。",
    queue_not_enough_shuffle: "队列里曲目太少，无法打乱。",
    shuffled_title: "已打乱",
    shuffled_desc: "队列已打乱。",
    queue_cleared_title: "队列已清空",
    queue_cleared_desc: "已移除所有排队曲目。",
    disconnected_title: "已断开",
    disconnected_desc: "正在退出语音频道...",
    busy_title: "繁忙",
    busy_desc: "我现在有点忙，请稍后再试。",
    unknown_command: "未知指令。",
    language_set_title: "语言已更新",
    language_set_desc: "语言已设置为 {language}。",
    language_current_title: "语言",
    language_current_desc: "当前语言：{language}。"
  },
  "zh-TW": {
    error_title: "錯誤",
    warning_title: "提醒",
    error_generic: "出了點問題，請稍後再試。",
    err_lavalink_auth: "音訊伺服器驗證失敗，請檢查密碼。",
    err_lavalink_starting: "音訊伺服器正在啟動，請稍後再試。",
    err_lavalink_node_not_ready: "音訊伺服器尚未就緒。",
    err_audio_connection_not_ready: "語音連線尚未就緒，請稍後再試。",
    err_join_voice: "請先加入語音頻道。",
    err_join_voice_commands: "請加入語音頻道後再使用指令。",
    err_join_voice_control: "請加入語音頻道以使用指令。",
    err_join_specific: "請加入 <#{channelId}> 以控制播放。",
    err_view_channel: "我看不到那個語音頻道，請檢查權限。",
    err_connect_channel: "我需要連線語音頻道的權限。",
    err_speak_channel: "我需要在語音頻道說話的權限。",
    err_already_playing: "我已在 <#{channelId}> 播放。請加入該頻道或先用 /leave。",
    load_failed_title: "載入失敗",
    load_failed_desc: "無法載入該音訊，可能被封鎖或不可用。",
    no_matches_title: "無相符",
    no_matches_desc: "沒有找到結果，請換一個連結或搜尋詞。",
    queued_playlist_title: "已加入播放清單",
    queued_playlist_desc: "{name}（{count}首）",
    queued_track_title: "已加入隊列",
    queued_track_desc: "已加入隊列最後。",
    now_playing_title: "正在播放",
    unknown_title: "未知標題",
    unknown_artist: "未知",
    artist_label: "演出者",
    duration_label: "時長",
    from_playlist_context: "來自：{name} • {count}首",
    warn_nothing_playing: "目前沒有在播放。",
    warn_negative_position: "位置不能為負數。用 0 跳過目前曲目。",
    warn_position_out_of_range: "位置超出範圍。隊列長度為 {length}。",
    skipped_title: "已跳過",
    skipped_current_desc: "已跳過目前曲目。",
    skipped_to_desc: "已跳到第 {position} 首。",
    skipped_desc: "已跳過。",
    paused_title: "已暫停",
    paused_desc: "播放已暫停。",
    resumed_title: "已繼續",
    resumed_desc: "播放已繼續。",
    queue_title: "隊列",
    queue_page_title: "隊列 — 第 {page}/{total} 頁",
    queue_empty_desc: "隊列為空。",
    queue_total_label: "隊列總數",
    queue_duration_label: "總時長",
    now_playing_label: "正在播放",
    queue_empty_warn: "隊列為空。",
    queue_already_empty: "隊列已經為空。",
    queue_not_enough_shuffle: "隊列曲目太少，無法打亂。",
    shuffled_title: "已打亂",
    shuffled_desc: "隊列已打亂。",
    queue_cleared_title: "隊列已清空",
    queue_cleared_desc: "已移除所有排隊曲目。",
    disconnected_title: "已斷開",
    disconnected_desc: "正在離開語音頻道...",
    busy_title: "繁忙",
    busy_desc: "我現在有點忙，請稍後再試。",
    unknown_command: "未知指令。",
    language_set_title: "語言已更新",
    language_set_desc: "語言已設定為 {language}。",
    language_current_title: "語言",
    language_current_desc: "目前語言：{language}。"
  },
  ja: {
    error_title: "エラー",
    warning_title: "注意",
    error_generic: "問題が発生しました。しばらくしてからもう一度お試しください。",
    err_lavalink_auth: "音声サーバーの認証に失敗しました。パスワードを確認してください。",
    err_lavalink_starting: "音声サーバーを起動中です。少し待ってから再試行してください。",
    err_lavalink_node_not_ready: "音声サーバーがまだ準備できていません。",
    err_audio_connection_not_ready: "音声接続がまだ準備できていません。少し待ってから再試行してください。",
    err_join_voice: "先にボイスチャンネルに参加してください。",
    err_join_voice_commands: "ボイスチャンネルに参加してからコマンドを使用してください。",
    err_join_voice_control: "コマンドを使用するにはボイスチャンネルに参加してください。",
    err_join_specific: "<#{channelId}> に参加して操作してください。",
    err_view_channel: "そのボイスチャンネルを見る権限がありません。権限を確認してください。",
    err_connect_channel: "そのボイスチャンネルに接続する権限が必要です。",
    err_speak_channel: "そのボイスチャンネルで話す権限が必要です。",
    err_already_playing: "すでに <#{channelId}> で再生中です。参加するか /leave を使ってください。",
    load_failed_title: "読み込み失敗",
    load_failed_desc: "トラックを読み込めませんでした。プロバイダーが利用できない可能性があります。",
    no_matches_title: "見つかりません",
    no_matches_desc: "一致する結果がありません。別のリンクか検索語を試してください。",
    queued_playlist_title: "プレイリストを追加",
    queued_playlist_desc: "{name}（{count}曲）",
    queued_track_title: "キューに追加",
    queued_track_desc: "キューの末尾に追加しました。",
    now_playing_title: "再生中",
    unknown_title: "不明なタイトル",
    unknown_artist: "不明",
    artist_label: "アーティスト",
    duration_label: "再生時間",
    from_playlist_context: "元：{name} • {count}曲",
    warn_nothing_playing: "再生中の曲がありません。",
    warn_negative_position: "位置は負の値にできません。0 で現在の曲をスキップします。",
    warn_position_out_of_range: "位置が範囲外です。キューの長さは {length} です。",
    skipped_title: "スキップ",
    skipped_current_desc: "現在の曲をスキップしました。",
    skipped_to_desc: "{position} 番目へスキップしました。",
    skipped_desc: "スキップしました。",
    paused_title: "一時停止",
    paused_desc: "再生を一時停止しました。",
    resumed_title: "再開",
    resumed_desc: "再生を再開しました。",
    queue_title: "キュー",
    queue_page_title: "キュー — {page}/{total} ページ",
    queue_empty_desc: "キューは空です。",
    queue_total_label: "キュー数",
    queue_duration_label: "合計時間",
    now_playing_label: "再生中",
    queue_empty_warn: "キューは空です。",
    queue_already_empty: "キューはすでに空です。",
    queue_not_enough_shuffle: "シャッフルするには曲数が足りません。",
    shuffled_title: "シャッフル",
    shuffled_desc: "キューをシャッフルしました。",
    queue_cleared_title: "キューをクリア",
    queue_cleared_desc: "キュー内の曲をすべて削除しました。",
    disconnected_title: "切断",
    disconnected_desc: "ボイスチャンネルから退出します...",
    busy_title: "混雑中",
    busy_desc: "ただいま混雑しています。少し待ってから再試行してください。",
    unknown_command: "不明なコマンドです。",
    language_set_title: "言語を更新しました",
    language_set_desc: "言語を {language} に設定しました。",
    language_current_title: "言語",
    language_current_desc: "現在の言語：{language}"
  },
  ko: {
    error_title: "오류",
    warning_title: "안내",
    error_generic: "문제가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    err_lavalink_auth: "오디오 서버 인증에 실패했습니다. 비밀번호를 확인해 주세요.",
    err_lavalink_starting: "오디오 서버가 시작 중입니다. 잠시 후 다시 시도해 주세요.",
    err_lavalink_node_not_ready: "오디오 서버가 아직 준비되지 않았습니다.",
    err_audio_connection_not_ready: "음성 연결이 아직 준비되지 않았습니다. 잠시 후 다시 시도해 주세요.",
    err_join_voice: "먼저 음성 채널에 들어가 주세요.",
    err_join_voice_commands: "음성 채널에 들어간 후 명령을 사용해 주세요.",
    err_join_voice_control: "명령을 사용하려면 음성 채널에 들어가 주세요.",
    err_join_specific: "<#{channelId}>에 들어가서 제어해 주세요.",
    err_view_channel: "해당 음성 채널을 볼 수 없습니다. 권한을 확인해 주세요.",
    err_connect_channel: "해당 음성 채널에 연결할 권한이 필요합니다.",
    err_speak_channel: "해당 음성 채널에서 말할 권한이 필요합니다.",
    err_already_playing: "이미 <#{channelId}>에서 재생 중입니다. 들어오거나 /leave를 사용하세요.",
    load_failed_title: "불러오기 실패",
    load_failed_desc: "트랙을 불러올 수 없습니다. 제공자가 차단되었을 수 있습니다.",
    no_matches_title: "검색 결과 없음",
    no_matches_desc: "결과를 찾지 못했습니다. 다른 링크나 검색어를 사용해 주세요.",
    queued_playlist_title: "플레이리스트 추가됨",
    queued_playlist_desc: "{name} ({count}곡)",
    queued_track_title: "큐에 추가됨",
    queued_track_desc: "큐의 마지막에 추가했습니다.",
    now_playing_title: "재생 중",
    unknown_title: "알 수 없는 제목",
    unknown_artist: "알 수 없음",
    artist_label: "아티스트",
    duration_label: "길이",
    from_playlist_context: "출처: {name} • {count}곡",
    warn_nothing_playing: "현재 재생 중인 곡이 없습니다.",
    warn_negative_position: "위치는 음수가 될 수 없습니다. 0은 현재 곡을 건너뜁니다.",
    warn_position_out_of_range: "범위를 벗어났습니다. 큐 길이는 {length}입니다.",
    skipped_title: "건너뜀",
    skipped_current_desc: "현재 곡을 건너뛰었습니다.",
    skipped_to_desc: "{position}번으로 건너뛰었습니다.",
    skipped_desc: "건너뛰었습니다.",
    paused_title: "일시정지",
    paused_desc: "재생을 일시정지했습니다.",
    resumed_title: "재생",
    resumed_desc: "재생을 다시 시작했습니다.",
    queue_title: "큐",
    queue_page_title: "큐 — {page}/{total} 페이지",
    queue_empty_desc: "큐가 비어 있습니다.",
    queue_total_label: "큐 수",
    queue_duration_label: "총 길이",
    now_playing_label: "재생 중",
    queue_empty_warn: "큐가 비어 있습니다.",
    queue_already_empty: "큐는 이미 비어 있습니다.",
    queue_not_enough_shuffle: "셔플할 곡이 충분하지 않습니다.",
    shuffled_title: "셔플됨",
    shuffled_desc: "큐를 섞었습니다.",
    queue_cleared_title: "큐 비움",
    queue_cleared_desc: "큐의 모든 곡을 제거했습니다.",
    disconnected_title: "연결 해제",
    disconnected_desc: "음성 채널에서 나가는 중...",
    busy_title: "혼잡",
    busy_desc: "현재 바쁩니다. 잠시 후 다시 시도해 주세요.",
    unknown_command: "알 수 없는 명령입니다.",
    language_set_title: "언어 업데이트됨",
    language_set_desc: "언어를 {language}(으)로 설정했습니다.",
    language_current_title: "언어",
    language_current_desc: "현재 언어: {language}"
  }
};

function iconPath(name) {
  const file = ICONS[name];
  if (!file) return null;
  const full = path.join(__dirname, "..", "assets", file);
  return fs.existsSync(full) ? full : null;
}

function loadLanguageStore() {
  if (loadLanguageStore.cache) return loadLanguageStore.cache;
  try {
    const raw = fs.readFileSync(LANGUAGE_FILE, "utf8");
    loadLanguageStore.cache = JSON.parse(raw);
  } catch {
    loadLanguageStore.cache = {};
  }
  return loadLanguageStore.cache;
}

function saveLanguageStore(store) {
  const dir = path.dirname(LANGUAGE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(LANGUAGE_FILE, JSON.stringify(store, null, 2));
}

function getGuildLanguage(guildId) {
  if (!guildId) return "en";
  const store = loadLanguageStore();
  return store[guildId] || "en";
}

function setGuildLanguage(guildId, lang) {
  const store = loadLanguageStore();
  store[guildId] = lang;
  saveLanguageStore(store);
}

function formatMessage(template, vars) {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, key) => (vars[key] !== undefined ? String(vars[key]) : ""));
}

function t(guildId, key, vars) {
  const lang = getGuildLanguage(guildId);
  const table = MESSAGES[lang] || MESSAGES.en;
  const fallback = MESSAGES.en[key] || key;
  const template = table[key] || fallback;
  return formatMessage(template, vars);
}

function buildEmbedMessage({ title, description, icon }) {
  const embed = new EmbedBuilder();
  if (icon && ICON_COLORS[icon]) {
    embed.setColor(ICON_COLORS[icon]);
  }
  const normalizeShort = (text) => (text ? text.replace(/[.!?]+$/u, "") : text);
  if (title) {
    if (icon && ICONS[icon]) {
      embed.setAuthor({ name: title, iconURL: `attachment://${ICONS[icon]}` });
    } else {
      embed.setTitle(title);
    }
  }
  if (description) {
    if (description.length <= 60) {
      const shortText = normalizeShort(description);
      if (!title) {
        embed.setTitle(shortText);
      } else if (icon && ICONS[icon]) {
        embed.setAuthor({ name: shortText, iconURL: `attachment://${ICONS[icon]}` });
      } else {
        embed.setTitle(shortText);
      }
    } else {
      embed.setDescription(description);
    }
  }
  const filePath = icon ? iconPath(icon) : null;
  const files = filePath ? [{ attachment: filePath, name: ICONS[icon] }] : [];
  return { embeds: [embed], files };
}

function toUserMessage(err, guildId) {
  const msg = String(err?.message || "").trim();
  if (!msg) return t(guildId, "error_generic");
  const rules = [
    { rx: /^Lavalink auth failed/i, key: "err_lavalink_auth" },
    { rx: /^Lavalink is starting/i, key: "err_lavalink_starting" },
    { rx: /^Lavalink node is not ready/i, key: "err_lavalink_node_not_ready" },
    { rx: /^Audio connection not ready/i, key: "err_audio_connection_not_ready" },
    { rx: /^Join a voice channel first\./i, key: "err_join_voice" },
    { rx: /^I can't see that voice channel/i, key: "err_view_channel" },
    { rx: /^I need permission to connect/i, key: "err_connect_channel" },
    { rx: /^I need permission to speak/i, key: "err_speak_channel" },
    { rx: /^I'm already playing in <#(\d+)>/i, key: "err_already_playing", capture: "channelId" }
  ];
  for (const rule of rules) {
    const match = msg.match(rule.rx);
    if (match) {
      if (rule.capture && match[1]) {
        return t(guildId, rule.key, { [rule.capture]: match[1] });
      }
      return t(guildId, rule.key);
    }
  }
  return t(guildId, "error_generic");
}

function getNodeOverloadReason() {
  const node = shoukaku.nodes.get("main");
  const stats = node?.stats;
  if (!stats) return null;
  if (typeof stats.players === "number" && stats.players <= 1) return null;
  const cpuLoad = stats.cpu?.systemLoad ?? stats.cpu?.lavalinkLoad;
  if (typeof cpuLoad === "number") {
    const normalized = cpuLoad > 1 ? cpuLoad / 100 : cpuLoad;
    if (normalized >= OVERLOAD_CPU_THRESHOLD) {
      return "High CPU load";
    }
  }
  const mem = stats.memory;
  let freeBytes = null;
  if (typeof mem?.free === "number") {
    freeBytes = mem.free;
  } else if (typeof mem?.reservable === "number" && typeof mem?.used === "number") {
    freeBytes = mem.reservable - mem.used;
  }
  if (typeof freeBytes === "number") {
    const freeMb = freeBytes / (1024 * 1024);
    if (freeMb <= OVERLOAD_MEM_FREE_MB) {
      return "Low memory";
    }
  }
  return null;
}

function trackKey(track) {
  return (
    track?.info?.identifier ||
    track?.info?.uri ||
    `${track?.info?.title || ""}|${track?.info?.author || ""}|${track?.info?.length || 0}`
  );
}

function logTrackDebug(prefix, track, extra) {
  if (!track) {
    console.log(`[track:${prefix}] none`);
    return;
  }
  const info = track.info || {};
  const payload = {
    title: info.title,
    author: info.author,
    source: info.sourceName,
    uri: info.uri,
    identifier: info.identifier,
    length: info.length,
    isrc: info.isrc,
    extra
  };
  console.log(`[track:${prefix}]`, JSON.stringify(payload));
}

async function tryEarlyEndFallback(state, guildId) {
  const track = state.now;
  if (!track || track?.info?.sourceName !== "spotify") return false;
  const expected = track?.info?.length || 0;
  if (!expected || expected < EARLY_END_MIN_MS) return false;
  if (!state.startedAt) return false;
  const playedMs = Date.now() - state.startedAt;
  if (playedMs < EARLY_END_MIN_MS) return false;
  if (playedMs >= expected * EARLY_END_TOLERANCE) return false;

  const key = trackKey(track);
  const retries = state.retryCounts[key] || 0;
  if (retries >= 1) return false;
  state.retryCounts[key] = retries + 1;

  const title = track?.info?.title || "";
  const author = track?.info?.author || "";
  const query = `${title} ${author}`.trim();
  if (!query) return false;

  const node = shoukaku.nodes.get("main");
  if (!node) return false;

  try {
    const res = await node.rest.resolve(`scsearch:${query}`);
    const result = normalizeLoadResult(res);
    const next = result.tracks?.[0];
    if (!next) return false;
    state.queue.unshift(next);
    state.playing = false;
    state.now = null;
    await playNext(guildId, true);
    return true;
  } catch (err) {
    console.error("Early-end fallback failed", err);
    return false;
  }
}

const QUEUE_PAGE_SIZE = 10;
const QUEUE_LINE_WIDTH = 36;

function buildQueuePayload(state, page, userId, iconUrl) {
  const total = state.queue.length;
  const totalPages = Math.max(1, Math.ceil(total / QUEUE_PAGE_SIZE));
  const clampedPage = Math.min(Math.max(page, 1), totalPages);
  if (total === 0) {
    const embed = new EmbedBuilder()
      .setColor(ICON_COLORS.queue)
      .setAuthor({
        name: t(state.guildId, "queue_title"),
        iconURL: iconUrl || `attachment://${ICONS.queue}`
      })
      .setDescription(t(state.guildId, "queue_empty_desc"));
    return {
      embeds: [embed],
      files: iconUrl ? [] : (iconPath("queue") ? [{ attachment: iconPath("queue"), name: ICONS.queue }] : []),
      components: []
    };
  }
  const start = (clampedPage - 1) * QUEUE_PAGE_SIZE;
  const slice = state.queue.slice(start, start + QUEUE_PAGE_SIZE);
  const wrapText = (text, width) => {
    const out = [];
    let current = text;
    while (current.length > width) {
      out.push(current.slice(0, width));
      current = current.slice(width);
    }
    out.push(current);
    return out;
  };

  const lines = [];
  slice.forEach((t, i) => {
    const dur = `(${formatDuration(t.info.length)})`;
    const prefix = `${start + i + 1}. `;
    const indent = " ".repeat(prefix.length);
    const maxBody = Math.max(QUEUE_LINE_WIDTH - prefix.length, 10);
    const title = t.info.title;
    const titleLine = `${title} ${dur}`;

    if (titleLine.length <= maxBody) {
      lines.push(`${prefix}${titleLine}`);
      return;
    }

    const wrappedTitle = wrapText(title, maxBody);
    wrappedTitle.forEach((part, idx) => {
      lines.push(`${idx === 0 ? prefix : indent}${part}`);
    });
    lines.push(`${indent}${dur}`);
  });

  while (lines.length < QUEUE_PAGE_SIZE) lines.push("");
  const padded = lines.map((l) => l.padEnd(QUEUE_LINE_WIDTH, " "));
  const embed = new EmbedBuilder()
    .setColor(ICON_COLORS.queue)
    .setAuthor({
      name: t(state.guildId, "queue_page_title", { page: clampedPage, total: totalPages }),
      iconURL: iconUrl || `attachment://${ICONS.queue}`
    })
    .setDescription(`\`\`\`\n${padded.join("\n")}\n\`\`\``)
    .addFields(
      { name: t(state.guildId, "queue_total_label"), value: String(total), inline: true },
      { name: t(state.guildId, "queue_duration_label"), value: formatDuration(sumQueueDuration(state.queue)), inline: true }
    );
  if (state.now) {
    embed.addFields({
      name: t(state.guildId, "now_playing_label"),
      value: `[${state.now.info.title}](${state.now.info.uri})`
    });
  }
  const prevDisabled = clampedPage <= 1;
  const nextDisabled = clampedPage >= totalPages;
  const firstDisabled = clampedPage <= 1;
  const lastDisabled = clampedPage >= totalPages;
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`queue:first:${clampedPage}:${userId}`)
      .setLabel("Top")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(firstDisabled),
    new ButtonBuilder()
      .setCustomId(`queue:prev:${clampedPage}:${userId}`)
      .setLabel("Previous")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(prevDisabled),
    new ButtonBuilder()
      .setCustomId(`queue:next:${clampedPage}:${userId}`)
      .setLabel("Next")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(nextDisabled),
    new ButtonBuilder()
      .setCustomId(`queue:last:${clampedPage}:${userId}`)
      .setLabel("End")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(lastDisabled)
  );
  return {
    embeds: [embed],
    files: iconUrl ? [] : (iconPath("queue") ? [{ attachment: iconPath("queue"), name: ICONS.queue }] : []),
    components: [row]
  };
}

function getLavalinkHttpUrl() {
  const host = process.env.LAVALINK_HOST || "localhost";
  const port = process.env.LAVALINK_PORT || "2333";
  return `http://${host}:${port}/v4/info`;
}

function waitForNodeReady(timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const existing = shoukaku.nodes.get("main");
    if (existing && existing.state === 1) {
      resolve();
      return;
    }
    if (existing && typeof existing.connect === "function" && existing.state !== 1) {
      try {
        existing.connect();
      } catch (err) {
        console.error("Failed to trigger Lavalink node connect", err);
      }
    }
    const onReady = (name) => {
      if (name === "main") {
        shoukaku.off("ready", onReady);
        resolve();
      }
    };
    shoukaku.on("ready", onReady);
    setTimeout(() => {
      shoukaku.off("ready", onReady);
      reject(new Error("Audio connection not ready. Try again in a moment."));
    }, timeoutMs);
  });
}

function ensureNodeReconnectLoop() {
  if (nodeReconnectTimer) return;
  nodeReconnectTimer = setInterval(() => {
    const node = shoukaku.nodes.get("main");
    if (!node) return;
    if (node.state === 1) {
      clearInterval(nodeReconnectTimer);
      nodeReconnectTimer = null;
      return;
    }
    if (typeof node.connect === "function") {
      try {
        node.connect();
      } catch (err) {
        console.error("Failed to connect Lavalink node", err);
      }
    }
  }, 5000);
}

async function waitForLavalink() {
  const password = process.env.LAVALINK_PASSWORD || "youshallnotpass";
  let delay = 1000;
  while (true) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    try {
      const res = await fetch(getLavalinkHttpUrl(), {
        method: "GET",
        headers: { Authorization: password },
        signal: controller.signal
      });
      clearTimeout(timeout);
      if (res.ok) {
        console.log("Lavalink is ready.");
        lavalinkReady = true;
        lavalinkAuthFailed = false;
        return;
      }
      if (res.status === 401) {
        lavalinkAuthFailed = true;
      }
      console.log(`Waiting for Lavalink (status ${res.status})...`);
    } catch (err) {
      clearTimeout(timeout);
      console.log("Waiting for Lavalink to become available...");
    }
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 2, 10000);
  }
}

function getState(guildId) {
  if (!queues.has(guildId)) {
    queues.set(guildId, {
      guildId,
      player: null,
      queue: [],
      now: null,
      loop: "off",
      playing: false,
      volume: 100,
      startedAt: null,
      retryCounts: {},
      idleTimer: null,
      queueMessageId: null,
      queueChannelId: null,
      queueIconUrl: null,
      queuePage: 1
    });
  }
  return queues.get(guildId);
}

function resetState(state) {
  if (state.idleTimer) {
    clearTimeout(state.idleTimer);
    state.idleTimer = null;
  }
  state.player = null;
  state.queue = [];
  state.now = null;
  state.playing = false;
}

async function updateQueueMessage(guildId) {
  const state = getState(guildId);
  if (!state.queueMessageId || !state.queueChannelId) return;
  try {
    const channel = await client.channels.fetch(state.queueChannelId);
    if (!channel || !channel.isTextBased()) return;
    const message = await channel.messages.fetch(state.queueMessageId);
    const payload = buildQueuePayload(state, state.queuePage || 1, null, state.queueIconUrl || null);
    await message.edit(payload);
  } catch (err) {
    console.error("Failed to update queue message", err);
  }
}

function formatDuration(ms) {
  if (!ms || ms === 0) return "LIVE";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${minutes}:${pad(seconds)}`;
}

function sumQueueDuration(tracks) {
  return tracks.reduce((acc, t) => acc + (t?.info?.length || 0), 0);
}

function trackTitle(track) {
  const title = track.info?.title || t(null, "unknown_title");
  const author = track.info?.author ? ` — ${track.info.author}` : "";
  return `${title}${author}`;
}

function isPlayerConnected(player) {
  if (player?.track) return true;
  const conn = player?.connection;
  if (!conn) return false;
  if (typeof conn.connected === "boolean") return conn.connected;
  if (typeof conn.ready === "boolean") return conn.ready;
  if (typeof conn.state === "string") return conn.state.toLowerCase() === "connected";
  if (typeof conn.state === "number") return conn.state === 2;
  return true;
}

function buildTrackEmbed(track, title, icon, context, guildId) {
  const info = track.info || {};
  const embed = new EmbedBuilder()
    .setColor(ICON_COLORS.nowplaying)
    .setAuthor({
      name: title,
      iconURL: `attachment://${ICONS[icon]}`
    })
    .setTitle(info.title || t(guildId, "unknown_title"))
    .setURL(info.uri || null)
    .addFields(
      { name: t(guildId, "artist_label"), value: info.author || t(guildId, "unknown_artist"), inline: true },
      { name: t(guildId, "duration_label"), value: formatDuration(info.length), inline: true }
    );
  if (context) {
    embed.setDescription(context);
  }
  if (info.artworkUrl) embed.setThumbnail(info.artworkUrl);
  return {
    embeds: [embed],
    files: [{ attachment: iconPath(icon), name: ICONS[icon] }]
  };
}

async function ensurePlayer(interaction, state) {
  if (!lavalinkReady) {
    if (lavalinkAuthFailed) {
      throw new Error("Lavalink auth failed. Please check `LAVALINK_PASSWORD`.");
    }
    throw new Error("Lavalink is starting. Try again in a moment.");
  }
  await waitForNodeReady();
  const me = interaction.guild.members.me || (await interaction.guild.members.fetchMe());
  const member = await interaction.guild.members.fetch(interaction.user.id);
  const voiceChannel = member.voice.channel;
  if (!voiceChannel) {
    throw new Error("Join a voice channel first.");
  }
  const perms = voiceChannel.permissionsFor(me);
  if (!perms?.has("ViewChannel")) {
    throw new Error("I can't see that voice channel. Please update permissions.");
  }
  if (!perms?.has("Connect")) {
    throw new Error("I need permission to connect to that voice channel.");
  }
  if (!perms?.has("Speak")) {
    throw new Error("I need permission to speak in that voice channel.");
  }

  if (!state.player) {
    const existingPlayer = shoukaku.players?.get?.(interaction.guild.id);
    if (existingPlayer) {
      state.player = existingPlayer;
    }
  }

  const existingConnection = shoukaku.connections.get(interaction.guild.id);
  if (existingConnection && existingConnection.channelId && existingConnection.channelId !== voiceChannel.id) {
    try {
      shoukaku.leaveVoiceChannel(interaction.guild.id);
    } catch (err) {
      console.error("Error leaving stale voice connection", err);
    }
  }

  if (state.player) {
    if (!isPlayerConnected(state.player)) {
      if (!state.player?.track) {
        try {
          await state.player.destroy();
        } catch (err) {
          console.error("Error destroying disconnected player", err);
        }
        state.player = null;
      }
    }
    if (state.player) {
      const currentChannelId = state.player.connection?.channelId || existingConnection?.channelId;
      if (currentChannelId && currentChannelId !== voiceChannel.id) {
        throw new Error(`I'm already playing in <#${currentChannelId}>. Join me there or use /leave first.`);
      }
      if (!currentChannelId && !state.playing && !state.now) {
        try {
          await state.player.destroy();
        } catch (err) {
          console.error("Error destroying stale player", err);
        }
        state.player = null;
      }
    }
  }

  if (!state.player) {
    try {
      state.player = await shoukaku.joinVoiceChannel({
        guildId: interaction.guild.id,
        channelId: voiceChannel.id,
        shardId: interaction.guild.shardId,
        deaf: true
      });
    } catch (err) {
      const message = err?.message || "";
      if (message.includes("existing connection")) {
        const existingPlayer = shoukaku.players?.get?.(interaction.guild.id);
        if (existingPlayer) {
          state.player = existingPlayer;
        } else {
          try {
            shoukaku.leaveVoiceChannel(interaction.guild.id);
          } catch (leaveErr) {
            console.error("Error leaving stale voice connection", leaveErr);
          }
          await new Promise((r) => setTimeout(r, 2000));
          state.player = await shoukaku.joinVoiceChannel({
            guildId: interaction.guild.id,
            channelId: voiceChannel.id,
            shardId: interaction.guild.shardId,
            deaf: true
          });
        }
      } else if (message.includes("voice connection") || message.includes("not established")) {
        try {
          shoukaku.leaveVoiceChannel(interaction.guild.id);
        } catch (leaveErr) {
          console.error("Error leaving failed voice connection", leaveErr);
        }
        await new Promise((r) => setTimeout(r, 2000));
        state.player = await shoukaku.joinVoiceChannel({
          guildId: interaction.guild.id,
          channelId: voiceChannel.id,
          shardId: interaction.guild.shardId,
          deaf: true
        });
      } else {
        throw err;
      }
    }

    state.player.on("end", (data) => {
      state.playing = false;
      const reason = data?.reason || data?.reason?.toString?.() || data?.reason;
      if (reason && String(reason).toUpperCase() === "REPLACED") {
        return;
      }
      const endedAt = Date.now();
      const playedMs = state.startedAt ? endedAt - state.startedAt : null;
      logTrackDebug("end", state.now, { reason, playedMs });
      void (async () => {
        const recovered = await tryEarlyEndFallback(state, interaction.guild.id);
        if (recovered) return;
        if (state.loop === "track" && state.now) {
          state.queue.unshift(state.now);
        } else if (state.loop === "queue" && state.now) {
          state.queue.push(state.now);
        }
        state.now = null;
        await playNext(interaction.guild.id, true);
      })();
    });

    state.player.on("stuck", () => {
      state.playing = false;
      void playNext(interaction.guild.id, true);
    });

    state.player.on("error", (err) => {
      console.error("Player error", err);
      state.playing = false;
    });

    state.player.on("closed", () => {
      resetState(state);
    });
  }

  if (state.idleTimer) {
    clearTimeout(state.idleTimer);
    state.idleTimer = null;
  }

  return { voiceChannel };
}

async function resolveTracks(query) {
  if (!lavalinkReady) {
    if (lavalinkAuthFailed) {
      throw new Error("Lavalink auth failed. Please check `LAVALINK_PASSWORD`.");
    }
    throw new Error("Lavalink is starting. Try again in a moment.");
  }
  const node = shoukaku.nodes.get("main");
  if (!node) throw new Error("Lavalink node is not ready yet.");

  const identifier = /^https?:\/\//.test(query) ? query : `scsearch:${query}`;
  return node.rest.resolve(identifier);
}

function normalizeLoadResult(res) {
  const loadType = res?.loadType || res?.loadtype || "";
  if (Array.isArray(res?.tracks)) {
    return { loadType, tracks: res.tracks, playlistInfo: res.playlistInfo };
  }
  if (res?.data) {
    if (Array.isArray(res.data)) {
      return { loadType, tracks: res.data, playlistInfo: res.playlistInfo };
    }
    if (Array.isArray(res.data?.tracks)) {
      return { loadType, tracks: res.data.tracks, playlistInfo: res.data.info };
    }
    if (res.data?.encoded) {
      return { loadType, tracks: [res.data], playlistInfo: null };
    }
  }
  return { loadType, tracks: [], playlistInfo: null };
}

async function replyError(interaction, message) {
  const payload = buildEmbedMessage({
    title: t(interaction.guild.id, "error_title"),
    description: message,
    icon: "error"
  });
  if (interaction.deferred) {
    await interaction.editReply(payload);
    return;
  }
  await interaction.reply({ ...payload, ephemeral: true });
}

async function replyWarn(interaction, message) {
  const payload = buildEmbedMessage({
    title: t(interaction.guild.id, "warning_title"),
    description: message,
    icon: "warning"
  });
  if (interaction.deferred) {
    await interaction.editReply(payload);
    return;
  }
  await interaction.reply({ ...payload, ephemeral: true });
}

async function requireSameVoiceChannel(interaction) {
  const member = await interaction.guild.members.fetch(interaction.user.id);
  const userChannel = member.voice.channel;
  const me = interaction.guild.members.me || (await interaction.guild.members.fetchMe());
  const botChannel = me.voice.channel;

  if (botChannel) {
    if (!userChannel) {
      await replyWarn(interaction, t(interaction.guild.id, "err_join_voice_control"));
      return false;
    }
    if (userChannel.id !== botChannel.id) {
      await replyWarn(interaction, t(interaction.guild.id, "err_join_specific", { channelId: botChannel.id }));
      return false;
    }
    return true;
  }

  if (!userChannel) {
    await replyWarn(interaction, t(interaction.guild.id, "err_join_voice_commands"));
    return false;
  }
  return true;
}

async function playNext(guildId, force = false) {
  const state = queues.get(guildId);
  if (!state || !state.player || state.playing) return;
  if (!force && state.player?.track) return;

  const next = state.queue.shift();
  if (!next) {
    state.now = null;
    await updateQueueMessage(guildId);
    if (state.player && !state.idleTimer) {
      state.idleTimer = setTimeout(async () => {
        try {
          await state.player.destroy();
        } catch (err) {
          console.error("Idle disconnect error", err);
        }
        state.player = null;
        state.queue = [];
        state.now = null;
        state.playing = false;
        state.idleTimer = null;
      }, 300000);
    }
    return;
  }

  state.now = next;
  state.playing = true;
  state.startedAt = Date.now();
  logTrackDebug("start", next, { startedAt: state.startedAt });
  if (state.idleTimer) {
    clearTimeout(state.idleTimer);
    state.idleTimer = null;
  }
  if (state.player.setVolume) {
    await state.player.setVolume(state.volume);
  }
  if (state.player.setPaused) {
    await state.player.setPaused(false);
  }
  await state.player.playTrack({ track: { encoded: next.encoded } });
  await updateQueueMessage(guildId);
}

client.once(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await waitForLavalink();
  ensureNodeReconnectLoop();
});

shoukaku.on("ready", (name) => {
  console.log(`Lavalink node ${name} connected.`);
  if (nodeReconnectTimer) {
    clearInterval(nodeReconnectTimer);
    nodeReconnectTimer = null;
  }
});

shoukaku.on("error", (name, error) => {
  const now = Date.now();
  const code = error?.code;
  const status = error?.status;
  if ((code === "ECONNREFUSED" || status === 401) && now - lastLavalinkHint > 5000) {
    lastLavalinkHint = now;
    console.log(
      "Lavalink not ready or auth mismatch. Waiting for it to become available..."
    );
  }
  if (code === "ECONNREFUSED") {
    ensureNodeReconnectLoop();
  }
  console.error(`Lavalink node ${name} error`, error);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isButton()) {
    const [type, action, pageStr, userId] = interaction.customId.split(":");
    if (type !== "queue") return;
    const allowed = await requireSameVoiceChannel(interaction);
    if (!allowed) return;
    const state = getState(interaction.guild.id);
    const page = Number.parseInt(pageStr, 10) || 1;
    const totalPages = Math.max(1, Math.ceil(state.queue.length / QUEUE_PAGE_SIZE));
    let nextPage = page;
    if (action === "next") nextPage = page + 1;
    if (action === "prev") nextPage = page - 1;
    if (action === "first") nextPage = 1;
    if (action === "last") nextPage = totalPages;
    const attachment = interaction.message.attachments.find((a) => a.name === ICONS.queue);
    const iconUrl = attachment ? attachment.url : null;
    state.queuePage = nextPage;
    state.queueIconUrl = iconUrl || state.queueIconUrl;
    state.queueMessageId = interaction.message.id;
    state.queueChannelId = interaction.channelId;
    await interaction.update(buildQueuePayload(state, nextPage, interaction.user.id, iconUrl));
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const isLanguageCommand = interaction.commandName === "language";
  if (!isLanguageCommand) {
    const allowed = await requireSameVoiceChannel(interaction);
    if (!allowed) return;
  }

  const state = getState(interaction.guild.id);

  try {
    switch (interaction.commandName) {
      case "language": {
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
        return;
      }
      case "play": {
        await interaction.deferReply();
        await ensurePlayer(interaction, state);

        const overloadReason = getNodeOverloadReason();
        if (overloadReason) {
          await interaction.editReply(
            buildEmbedMessage({
              title: t(interaction.guild.id, "busy_title"),
              description: t(interaction.guild.id, "busy_desc"),
              icon: "warning"
            })
          );
          return;
        }

        const query = interaction.options.getString("query", true);
        const res = await resolveTracks(query);
        const result = normalizeLoadResult(res);
        const loadType = (result.loadType || "").toUpperCase();

        if (loadType === "LOAD_FAILED") {
          await interaction.editReply(
            buildEmbedMessage({
              title: t(interaction.guild.id, "load_failed_title"),
              description: t(interaction.guild.id, "load_failed_desc"),
              icon: "warning"
            })
          );
          return;
        }
        if (loadType === "NO_MATCHES") {
          await interaction.editReply(
            buildEmbedMessage({
              title: t(interaction.guild.id, "no_matches_title"),
              description: t(interaction.guild.id, "no_matches_desc"),
              icon: "warning"
            })
          );
          return;
        }

        if (!result || result.tracks.length === 0) {
          await interaction.editReply(
            buildEmbedMessage({
              title: t(interaction.guild.id, "no_matches_title"),
              description: t(interaction.guild.id, "no_matches_desc"),
              icon: "warning"
            })
          );
          return;
        }

        const isCollection =
          /\/(playlist|album)\//.test(query) ||
          result.loadType === "PLAYLIST_LOADED" ||
          result.loadType === "playlist_loaded" ||
          Boolean(result.playlistInfo?.name);

        const isPlaying = Boolean(state.now || state.playing || state.player?.track);

        if (isCollection && result.tracks.length > 1) {
          state.queue.push(...result.tracks);
          await interaction.editReply(
            buildEmbedMessage({
              title: t(interaction.guild.id, "queued_playlist_title"),
              description: t(interaction.guild.id, "queued_playlist_desc", {
                name: result.playlistInfo?.name || t(interaction.guild.id, "unknown_title"),
                count: result.tracks.length
              }),
              icon: "queue"
            })
          );
          if (!isPlaying) {
            const first = result.tracks[0];
            const context = t(interaction.guild.id, "from_playlist_context", {
              name: result.playlistInfo?.name || t(interaction.guild.id, "unknown_title"),
              count: result.tracks.length
            });
            await interaction.followUp(buildTrackEmbed(first, t(interaction.guild.id, "now_playing_title"), "nowplaying", context, interaction.guild.id));
          }
        } else {
          const track = result.tracks[0];
          state.queue.push(track);
          if (isPlaying) {
            await interaction.editReply(
              buildTrackEmbed(
                track,
                t(interaction.guild.id, "queued_track_title"),
                "queue",
                t(interaction.guild.id, "queued_track_desc"),
                interaction.guild.id
              )
            );
          } else {
            await interaction.editReply(buildTrackEmbed(track, t(interaction.guild.id, "now_playing_title"), "nowplaying", null, interaction.guild.id));
          }
        }
        if (!isPlaying && !state.player?.track) {
          await playNext(interaction.guild.id, true);
        } else {
          await updateQueueMessage(interaction.guild.id);
        }
        return;
      }
      case "skip": {
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
            await state.player.stopTrack();
            await interaction.reply(buildEmbedMessage({
              title: t(interaction.guild.id, "skipped_title"),
              description: t(interaction.guild.id, "skipped_current_desc"),
              icon: "skip"
            }));
            await playNext(interaction.guild.id, true);
            if (state.now) {
              await interaction.followUp(buildTrackEmbed(state.now, t(interaction.guild.id, "now_playing_title"), "nowplaying", null, interaction.guild.id));
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
          await state.player.stopTrack();
          await interaction.reply(buildEmbedMessage({
            title: t(interaction.guild.id, "skipped_title"),
            description: t(interaction.guild.id, "skipped_to_desc", { position }),
            icon: "skip"
          }));
          await playNext(interaction.guild.id, true);
          if (state.now) {
            await interaction.followUp(buildTrackEmbed(state.now, t(interaction.guild.id, "now_playing_title"), "nowplaying", null, interaction.guild.id));
          }
          return;
        }
        state.playing = false;
        state.now = null;
        await state.player.stopTrack();
        await interaction.reply(buildEmbedMessage({
          title: t(interaction.guild.id, "skipped_title"),
          description: t(interaction.guild.id, "skipped_desc"),
          icon: "skip"
        }));
        await playNext(interaction.guild.id, true);
        if (state.now) {
          await interaction.followUp(buildTrackEmbed(state.now, t(interaction.guild.id, "now_playing_title"), "nowplaying", null, interaction.guild.id));
        }
        return;
      }
      case "pause": {
        if (!state.player) {
          await replyWarn(interaction, t(interaction.guild.id, "warn_nothing_playing"));
          return;
        }
        await state.player.setPaused(true);
        await interaction.reply(
          buildEmbedMessage({
            title: t(interaction.guild.id, "paused_title"),
            description: t(interaction.guild.id, "paused_desc"),
            icon: "pause"
          })
        );
        return;
      }
      case "resume": {
        if (!state.player) {
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
        return;
      }
      case "nowplaying": {
        if (!state.now) {
          await replyWarn(interaction, t(interaction.guild.id, "warn_nothing_playing"));
          return;
        }
        const track = state.now;
        await interaction.reply(buildTrackEmbed(track, t(interaction.guild.id, "now_playing_title"), "nowplaying", null, interaction.guild.id));
        return;
      }
      case "queue": {
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
        state.queuePage = 1;
        state.queueIconUrl = attachment ? attachment.url : null;
        return;
      }
      case "shuffle": {
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
        return;
      }
      case "clear": {
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
        return;
      }
      case "leave": {
        if (state.player) {
          await state.player.destroy();
          state.player = null;
          state.queue = [];
          state.now = null;
          state.playing = false;
        }
        try {
          shoukaku.leaveVoiceChannel(interaction.guild.id);
        } catch (err) {
          console.error("Error leaving voice channel", err);
        }
        await interaction.reply(
          buildEmbedMessage({
            title: t(interaction.guild.id, "disconnected_title"),
            description: t(interaction.guild.id, "disconnected_desc"),
            icon: "leave"
          })
        );
        await updateQueueMessage(interaction.guild.id);
        return;
      }
      default:
        await replyWarn(interaction, t(interaction.guild.id, "unknown_command"));
    }
  } catch (err) {
    console.error(err);
    const message = toUserMessage(err, interaction.guild.id);
    await replyError(interaction, message);
  }
});

client.on(Events.VoiceStateUpdate, (oldState, newState) => {
  const me = newState.guild.members.me;
  if (!me || newState.id !== me.id) return;
  if (oldState.channelId && !newState.channelId) {
    const state = getState(newState.guild.id);
    resetState(state);
    try {
      shoukaku.leaveVoiceChannel(newState.guild.id);
    } catch (err) {
      console.error("Error leaving voice channel on disconnect", err);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
