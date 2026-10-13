// Image posts for Xiaohongshu (zh_CN, 1080×1440) and Threads (en, ru, yue, zh_TW, 1080×1350):
//   quotes   things Beepo actually says (lines from data/i18n/<lang>.json)
//   closet   outfits + the Halloween look
//   evolve   what a 3/7/14-day streak does to him
//   moods    sticker sheet of every face
//   android  the Android app (screenshots from dist/play/raw/<lang>/, see docs/PLAY.md)
// Out: dist/social/xhs/<set>/ and dist/social/threads/<lang>/<set>/, each 1.png… + post.txt.
// Usage: npm run posts [-- quotes moods zh_CN en]   (sets and/or languages; default all)
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { root, render, png, esc, launch } from "./capture.js";

const SETS = ["quotes", "closet", "evolve", "moods", "android"];
const LANGS = ["zh_CN", "en", "ru", "yue", "zh_TW"];
const args = process.argv.slice(2);
const sets = args.filter((a) => SETS.includes(a));
const langs = args.filter((a) => LANGS.includes(a));

const MONO = `ui-monospace, Menlo, monospace`;
const FONTS = {
  zh_CN: `"PingFang SC", "Hiragino Sans GB", sans-serif`,
  zh_TW: `"PingFang TC", sans-serif`,
  yue: `"PingFang HK", "PingFang TC", sans-serif`,
};
const BG = `background:repeating-linear-gradient(0deg,#0000 0 23px,#1b1b2f08 23px 24px),#f4f1e8`;
const INK = "#1b1b2f";
const lines = (s) => esc(s).replace(/\n/g, "<br>");

// Lines Beepo says, by message key and index, with sample values for {vars}.
const QUOTES = [
  ["statusNight", 1, { time: "1:47" }],
  ["snooze3", 2, { n: 3 }],
  ["scroll", 1],
  ["limit100", 2],
  ["night", 1],
  ["snooze1", 2],
];
const LOOKS = [
  { color: "color-blue", hat: "hat-party", accessory: "acc-scarf", pet: "pet-cat" },
  { color: "color-pink", hat: "hat-crown", accessory: "acc-shades", pet: "pet-slime" },
  { color: "color-mint", hat: "hat-cap", accessory: "acc-scarf", pet: "pet-cat" },
  { color: "color-purple", hat: "hat-top", antenna: "antenna-star", pet: "pet-ghost" },
  { color: "color-gold", antenna: "antenna-heart", accessory: "acc-shades" },
  {},
];
const HALLOWEEN = { color: "color-purple", hat: "hat-witch", pet: "pet-bat" };
const MOODS = ["happy", "proud", "party", "blink", "neutral", "bored", "worried", "angry", "sad", "sleepy", "lookLeft", "lookRight"];
const STAGES = [[], ["cheeks"], ["cheeks", "grow"], ["cheeks", "grow", "collar"]];
const STREAKS = [0, 3, 7, 14];
const SHOTS = ["1-stop", "2-limits", "3-shop", "4-streaks"];

// On-image copy, written per language. `day` and `n` are templates.
const COPY = {
  zh_CN: {
    quotes: {
      title: "我的像素机器人\n说过最戳我的 6 句话",
      sub: "都是真的，它真的会这么说",
      ctx: ["凌晨还在刷视频", "第 3 次点「再玩 5 分钟」", "手指刷得飞快的时候", "限额到了的那一刻", "过了午夜还没睡", "第 1 次求它再给 5 分钟"],
    },
    closet: {
      title: "给我的像素机器人\n搭了 6 套衣服",
      sub: "你最喜欢第几套？",
      grid: "日常穿搭合集",
      looks: ["派对围巾", "大小姐出街", "运动少年", "神秘魔术师", "土豪金", "素颜出镜"],
      halloween: "万圣节限定\n女巫帽 + 蝙蝠",
      halloweenSub: "只在 10 月出现在商店里",
    },
    evolve: {
      title: "连续 14 天没刷超时\n我的机器人变成了这样",
      sub: "每守住一天，它就悄悄变一点",
      day: "第 {n} 天",
      start: "刚领养的时候",
      unlock: "解锁：",
    },
    moods: {
      title: "像素机器人\n表情包 12 连",
      sub: "长按保存，随便用",
      labels: ["开心", "骄傲", "庆祝", "眨眼", "无语", "好无聊", "担心", "生气", "难过", "困了", "偷看", "斜眼"],
    },
    android: {
      title: "手机版 Beepo\n来了📱",
      sub: "电脑上管网页，手机上管 App",
      caps: ["时间到，它会举牌\n然后帮你关掉 App", "每个 App 单独设限额", "守住限额攒星星\n给它买帽子", "连续打卡，它会慢慢长大"],
    },
  },
  en: {
    quotes: {
      title: "things my tiny robot\nhas said to me",
      sub: "(he really says these)",
      ctx: ["1:47 am, still watching videos", "hitting \"5 more min\" for the 3rd time", "scrolling way too fast", "the second my limit runs out", "past midnight, still up", "asking for 5 more minutes"],
    },
    closet: {
      title: "I gave my pixel robot\na wardrobe",
      sub: "which fit is the best? be honest",
      grid: "the everyday rotation",
      looks: ["party mode", "main character", "sporty", "magician", "gold era", "no makeup"],
      halloween: "the Halloween look\nwitch hat + a bat",
      halloweenSub: "only in the shop in October",
    },
    evolve: {
      title: "what 14 days of keeping\nmy screen time limits\ndid to my robot",
      sub: "he changes a little every streak",
      day: "day {n}",
      start: "day 1",
      unlock: "unlocked: ",
    },
    moods: {
      title: "every mood\nmy robot has",
      sub: "save them, they're yours now",
      labels: ["happy", "proud", "party", "blink", "meh", "bored", "worried", "mad", "sad", "sleepy", "peeking", "side-eye"],
    },
    android: {
      title: "Beepo is on\nAndroid now",
      sub: "websites on your laptop, apps on your phone",
      caps: ["when time's up,\nhe holds up the sign\nand closes the app", "a limit for each app", "keep them, earn stars,\nbuy him hats", "keep a streak going\nand he grows"],
    },
  },
  ru: {
    quotes: {
      title: "Что мне говорит\nмой пиксельный робот",
      sub: "Он правда так говорит",
      ctx: ["1:47 ночи, всё ещё видосики", "третий раз жму «ещё 5 минут»", "листаю ленту слишком быстро", "в секунду, когда лимит кончился", "за полночь, а я не сплю", "прошу ещё 5 минут"],
    },
    closet: {
      title: "Собрала гардероб\nсвоему роботу",
      sub: "Какой образ лучший? Пишите номер",
      grid: "На каждый день",
      looks: ["вечеринка", "главная героиня", "спорт", "фокусник", "золото", "без всего"],
      halloween: "Образ на Хеллоуин:\nшляпа ведьмы + летучая мышь",
      halloweenSub: "В магазине только в октябре",
    },
    evolve: {
      title: "14 дней держу лимиты.\nВот что стало\nс моим роботом",
      sub: "С каждой серией он немного меняется",
      day: "День {n}",
      start: "День 1",
      unlock: "Открыто: ",
    },
    moods: {
      title: "Все настроения\nмоего робота",
      sub: "Сохраняйте, теперь они ваши",
      labels: ["рад", "гордый", "праздник", "моргнул", "ну такое", "скучно", "волнуется", "злой", "грустный", "сонный", "подглядывает", "косится"],
    },
    android: {
      title: "Beepo теперь\nна Android",
      sub: "На ноутбуке — сайты, на телефоне — приложения",
      caps: ["Время вышло —\nпоказывает СТОП\nи закрывает приложение", "Свой лимит для каждого\nприложения", "Держишь лимиты — звёзды.\nНа звёзды — шляпы", "Держишь серию —\nон растёт"],
    },
  },
  yue: {
    quotes: {
      title: "我隻像素機械人\n講過最戳心嘅 6 句",
      sub: "全部都係真㗎，佢真係會咁講",
      ctx: ["凌晨仲喺度睇片", "第 3 次㩒「再玩 5 分鐘」", "碌得太快嘅時候", "夠鐘嗰一刻", "過咗十二點仲未瞓", "求佢再俾多 5 分鐘"],
    },
    closet: {
      title: "幫我隻像素機械人\n襯咗 6 套衫",
      sub: "你最鍾意邊套？",
      grid: "日常造型",
      looks: ["派對頸巾", "大小姐", "運動仔", "魔術師", "土豪金", "素顏"],
      halloween: "萬聖節限定\n巫師帽 + 蝙蝠",
      halloweenSub: "淨係 10 月先喺商店出現",
    },
    evolve: {
      title: "連續 14 日冇碌過龍\n我隻機械人變成咗咁",
      sub: "每守住一日，佢就靜靜雞變少少",
      day: "第 {n} 日",
      start: "啱啱領養",
      unlock: "解鎖：",
    },
    moods: {
      title: "像素機械人\n表情包 12 個",
      sub: "長㩒儲起，隨便用",
      labels: ["開心", "得意", "慶祝", "眨眼", "無言", "好悶", "擔心", "嬲", "唔開心", "眼瞓", "偷望", "斜眼"],
    },
    android: {
      title: "手機版 Beepo\n嚟咗📱",
      sub: "電腦管網頁，手機管 App",
      caps: ["夠鐘佢會舉牌\n仲幫你閂咗個 App", "每個 App 自己定限制", "守到限制儲星星\n買帽俾佢", "連續守住，佢會慢慢大"],
    },
  },
  zh_TW: {
    quotes: {
      title: "我的像素機器人\n說過最戳我的 6 句話",
      sub: "都是真的，它真的會這樣說",
      ctx: ["凌晨還在滑影片", "第 3 次按「再 5 分鐘」", "手指滑太快的時候", "限制到的那一刻", "過了午夜還沒睡", "求它再給 5 分鐘"],
    },
    closet: {
      title: "幫我的像素機器人\n搭了 6 套衣服",
      sub: "你最喜歡第幾套？",
      grid: "日常穿搭",
      looks: ["派對圍巾", "大小姐出門", "運動少年", "神祕魔術師", "土豪金", "素顏"],
      halloween: "萬聖節限定\n女巫帽 + 蝙蝠",
      halloweenSub: "只在 10 月出現在商店",
    },
    evolve: {
      title: "連續 14 天沒有滑超過\n我的機器人變成這樣",
      sub: "每守住一天，它就偷偷變一點",
      day: "第 {n} 天",
      start: "剛領養的時候",
      unlock: "解鎖：",
    },
    moods: {
      title: "像素機器人\n貼圖 12 連發",
      sub: "長按儲存，隨便用",
      labels: ["開心", "驕傲", "慶祝", "眨眼", "無言", "好無聊", "擔心", "生氣", "難過", "想睡", "偷看", "斜眼"],
    },
    android: {
      title: "手機版 Beepo\n來了📱",
      sub: "電腦管網頁，手機管 App",
      caps: ["時間到它會舉牌\n還幫你關掉 App", "每個 App 各自設限制", "守住限制存星星\n幫它買帽子", "連續打卡，它會慢慢長大"],
    },
  },
};

// Captions to paste, per platform.
const XHS_TAGS = "#像素风 #自律 #戒手机 #效率工具 #浏览器插件 #独立开发";
const STORES_ZH = "Chrome / Edge / Firefox 扩展商店、Google Play 搜「Beepo」，免费";
const POSTS = {
  zh_CN: {
    quotes: `标题：
我的像素机器人说话也太会了吧🥹

正文：
做了个浏览器插件，一只叫 Beepo 的像素小机器人蹲在网页右下角，帮我盯着别刷太久
本来以为就是个计时器，结果它说的话一句比一句戳我😭
最破防的是第 3 张，点了 3 次「再玩 5 分钟」之后它说：要不把限额改得诚实一点？
……好的我改

它从来不骂人，就是很温柔地提醒你，所以我反而听得进去

${STORES_ZH}

你们最想被它说哪一句？评论区告诉我👇

${XHS_TAGS} #治愈系 #文字控`,
    closet: `标题：
给我的像素机器人搭了 6 套衣服，选一套👗

正文：
Beepo 是我做的一个防沉迷小插件，守住每天的限额就能攒星星⭐
星星只能拿来给它买衣服：颜色、帽子、天线、墨镜围巾，还能领养小宠物跟着它走
（小猫麻薯、小幽灵、史莱姆……）

第 3 张是万圣节限定的女巫帽 + 小蝙蝠，只有 10 月能买到🎃

${STORES_ZH}

评论区报数字，看看哪套票最多👇

${XHS_TAGS} #穿搭 #万圣节`,
    evolve: `标题：
连续 14 天没刷超时，我的机器人长大了🥹

正文：
Beepo 会记录你连续守住限额的天数🔥
第 3 天：脸蛋红扑扑
第 7 天：长高一圈
第 14 天：戴上金色项圈

就……很像养电子宠物，为了不让它停止长大，我真的少刷了很多
断了也不会扣星星、不会骂你，重新开始就好

${STORES_ZH}

你们现在连续几天了？评论区打卡👇

${XHS_TAGS} #打卡 #电子宠物`,
    moods: `标题：
像素机器人表情包 12 连，免费拿去用👾

正文：
这是我做的防沉迷小插件 Beepo 的全部表情
刷太久它会担心，到点了会生气，半夜会困，守住限额会开心到庆祝🎉
最喜欢「斜眼」，每次看到都觉得在被它审视😂

长按保存，聊天随便用～
想知道它在什么时候会露出这些表情：${STORES_ZH}

你最像今天的哪一个？👇

${XHS_TAGS} #表情包 #像素画`,
    android: `标题：
手机版也做出来了！这下刷短视频也有人管了📱

正文：
之前做了浏览器版，现在安卓也能用了
· 每个 App 单独设每日时间
· 时间到 Beepo 举「停」牌，直接帮你关掉 App
· 守住限额攒星星，给它买帽子换颜色
· 连续打卡它会慢慢长大
不用注册，只统计使用时长，数据都留在手机里

Google Play 搜「Beepo」

${XHS_TAGS} #安卓 #安卓软件 #手机控`,
  },
  en: {
    quotes: `things my tiny pixel robot has said to me while I was doomscrolling

slide 3 is the one that got me. 3 snoozes in and he goes "maybe the limit should be honest?" 🥲

he's a little browser buddy I made. he lives at the bottom of websites and nudges you, never shames you

---
reply (optional):
free for Chrome, Edge, Firefox and Android. no account, nothing leaves your device
alt text: Speech bubbles from a pixel robot, each with when he says it, like "1:47 am: YouTube can wait, sleep can't."`,
    closet: `I gave my pixel robot a wardrobe and now I can't stop dressing him

you buy everything with stars, and you only get stars by sticking to your screen time limits. so technically this is productivity

which fit (1–6)? the witch hat is October only 🎃

---
alt text: Six outfits on a pixel robot (party hat, crown and shades, cap, top hat, gold, none), then a purple robot in a witch hat with a pixel bat.`,
    evolve: `my screen time robot evolves if you keep your limits

day 3: rosy cheeks
day 7: growth spurt
day 14: golden collar

breaking the streak doesn't take anything away, he just waits for you to start again. kind of a tamagotchi, kind of a mirror

---
alt text: The same pixel robot on day 1, 3, 7 and 14 of a streak: plain, then rosy cheeks, then a bit taller, then a gold collar.`,
    moods: `every mood my pixel robot has. take them, they're free

he's worried when you scroll too fast, mad when the limit runs out, sleepy after midnight

which one are you today?

---
alt text: A sticker sheet of twelve faces of a small pixel robot: happy, proud, party, blink, meh, bored, worried, mad, sad, sleepy, peeking, side-eye.`,
    android: `Beepo is on Android now 📱

same little robot, but for apps: set a daily time per app, and when it's up he holds up a STOP sign and closes it. keep your limits, earn stars, buy him hats

no account, it only counts time, and it all stays on your phone. free on Google Play

---
alt text: Android screenshots: a STOP sign over an app, the list of app limits, the hat shop, and a streak calendar.`,
  },
  ru: {
    quotes: `Что мне говорит мой пиксельный робот, пока я залипаю в ленту

Третья картинка — прямо в сердце. После третьей отсрочки: «может, честнее поменять лимит?» 🥲

Это Beepo, маленький помощник для браузера, который я сделала. Живёт внизу сайтов и мягко напоминает о времени. Никогда не стыдит

---
ответ (по желанию):
Бесплатно для Chrome, Edge, Firefox и Android. Без аккаунта, данные никуда не уходят
alt: Реплики пиксельного робота с подписями, когда он их говорит.`,
    closet: `Собрала гардероб своему пиксельному роботу и не могу остановиться

Всё покупается за звёзды, а звёзды дают только за соблюдённые лимиты экранного времени. Так что это, по сути, продуктивность

Какой образ лучший (1–6)? Шляпа ведьмы есть только в октябре 🎃

---
alt: Шесть образов пиксельного робота, затем фиолетовый робот в шляпе ведьмы с летучей мышью.`,
    evolve: `Мой робот для экранного времени растёт, если держать лимиты

3 дня — румяные щёчки
7 дней — подрос
14 дней — золотой воротник

Если серия прервалась, ничего не отнимается. Он просто ждёт, когда начнёшь заново

---
alt: Один и тот же пиксельный робот на 1, 3, 7 и 14 день серии.`,
    moods: `Все настроения моего пиксельного робота. Забирайте, бесплатно

Волнуется, когда листаешь слишком быстро, злится, когда лимит кончился, засыпает после полуночи

Вы сегодня какой?

---
alt: Двенадцать выражений лица маленького пиксельного робота.`,
    android: `Beepo теперь на Android 📱

Тот же робот, только для приложений: лимит на каждое приложение, а когда время вышло, он показывает СТОП и закрывает его. Держишь лимиты — получаешь звёзды и покупаешь ему шляпы

Без аккаунта, считает только время, всё остаётся на телефоне. Бесплатно в Google Play

---
alt: Скриншоты Android-приложения: табличка СТОП, список лимитов, магазин шляп и календарь серии.`,
  },
  yue: {
    quotes: `我隻像素機械人喺我碌手機嗰陣講過嘅嘢

第 3 張真係中晒。延長咗 3 次之後佢話：或者個限制應該定得老實啲？🥲

佢叫 Beepo，我自己整嘅瀏覽器小幫手，住喺網頁底，會溫柔咁提你，從來唔會鬧你

---
回覆（可選）：
Chrome、Edge、Firefox 同 Android 都有，免費，唔使註冊，資料唔會離開你部機
alt：像素機械人嘅對話框，每句都寫住佢幾時會講。`,
    closet: `幫我隻像素機械人襯咗 6 套衫，停唔到手

全部用星星買，而星星淨係守住每日限制先有。所以呢個其實係自律

你揀邊套（1–6）？巫師帽淨係 10 月有🎃

---
alt：像素機械人嘅六套造型，之後係戴巫師帽、帶住蝙蝠嘅紫色機械人。`,
    evolve: `連續守住限制，我隻機械人會進化

第 3 日：紅粉粉面珠
第 7 日：生高咗
第 14 日：金色頸圈

斷咗都唔會扣星星，佢會等你重新開始

---
alt：同一隻像素機械人喺連續第 1、3、7、14 日嘅樣。`,
    moods: `像素機械人表情包 12 個，免費攞去用

碌得太快佢會擔心，夠鐘會嬲，過咗十二點會眼瞓

你今日似邊個？

---
alt：細細隻像素機械人嘅十二個表情。`,
    android: `手機版 Beepo 嚟咗 📱

同一隻機械人，今次管 App：每個 App 自己定時間，夠鐘佢會舉「停」牌，仲幫你閂咗個 App。守到限制儲星星，買帽俾佢

唔使註冊，淨係計時間，資料留喺手機。Google Play 免費

---
alt：Android 截圖：停牌、App 限制清單、帽商店同連續打卡日曆。`,
  },
  zh_TW: {
    quotes: `我的像素機器人在我滑手機時說過的話

第 3 張最戳。延長 3 次之後它說：也許限制該設得誠實一點？🥲

它叫 Beepo，是我自己做的瀏覽器小幫手，住在網頁底部，會溫柔提醒你，從來不罵人

---
回覆（選用）：
Chrome、Edge、Firefox 和 Android 都能用，免費，不用註冊，資料不會離開你的裝置
alt：像素機器人的對話框，每句都標註它什麼時候會說。`,
    closet: `幫我的像素機器人搭了 6 套衣服，停不下來

全部用星星買，而星星只有守住每日限制才拿得到。所以這其實是自律

你選哪套（1–6）？女巫帽只有 10 月有🎃

---
alt：像素機器人的六套造型，接著是戴女巫帽、帶著蝙蝠的紫色機器人。`,
    evolve: `連續守住限制，我的機器人會進化

第 3 天：紅通通臉頰
第 7 天：長高高
第 14 天：金色項圈

中斷了也不會扣星星，它會等你重新開始

---
alt：同一隻像素機器人在連續第 1、3、7、14 天的樣子。`,
    moods: `像素機器人貼圖 12 連發，免費拿去用

滑太快它會擔心，時間到會生氣，過了午夜會想睡

你今天像哪一個？

---
alt：小小像素機器人的十二個表情。`,
    android: `手機版 Beepo 來了 📱

同一隻機器人，這次管 App：每個 App 各自設時間，時間到它會舉「停」牌，還會幫你關掉 App。守住限制存星星，幫它買帽子

不用註冊，只計算時間，資料都留在手機。Google Play 免費

---
alt：Android 截圖：停牌、App 限制清單、帽子商店和連續打卡日曆。`,
  },
};

// ---------- layout ----------

const i18n = Object.fromEntries(LANGS.map((l) => [l, JSON.parse(readFileSync(`${root}extension/data/i18n/${l}.json`, "utf8"))]));
const fill = (s, vars = {}) => s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));

function page(w, h, font, inner, beepo = [], gap = 56) {
  return {
    w, h, beepo,
    html: `<div style="height:${h}px;${BG};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${gap}px;padding:0 70px;text-align:center;font-family:${font}">${inner}</div>`,
  };
}
const title = (s, font, size = 72) =>
  `<div style="font-size:${font === MONO ? Math.round(size * 0.8) : size}px;font-weight:800;line-height:1.25">${lines(s)}</div>`;
const sub = (s) => `<div style="font-size:38px;line-height:1.4;opacity:.75">${lines(s)}</div>`;
const tag = (s, bg = "#ffd84a") =>
  `<div style="display:inline-block;background:${bg};border:4px solid ${INK};box-shadow:6px 6px 0 ${INK};padding:10px 26px;font-size:36px;font-weight:700">${esc(s)}</div>`;
// Beepo (`b<i>`) with an optional pet (`p<i>`) to his left.
const pair = (i, pet) => `<div style="display:flex;align-items:flex-end;gap:16px">${pet ? `<canvas id="p${i}"></canvas>` : ""}<canvas id="b${i}"></canvas></div>`;
const bot = (i, { mood = "happy", look = {}, scale = 20, evolve } = {}) => [
  { id: `b${i}`, mood, equipped: look, scale, evolve },
  ...(look.pet ? [{ id: `p${i}`, pet: look.pet, scale: Math.round(scale * 0.62) }] : []),
];

function cover(w, h, font, c, row, beepo) {
  return page(w, h, font, `${title(c.title, font, 76)}${row}${sub(c.sub)}`, beepo);
}

const SETUP = {
  quotes(w, h, font, c, lang) {
    const m = i18n[lang].messages;
    const look = { color: "color-blue", accessory: "acc-scarf", pet: "pet-cat" };
    const out = [cover(w, h, font, c, pair(0, true), bot(0, { look, scale: 22 }))];
    QUOTES.forEach(([key, idx, vars], i) => {
      const bubble = `<div style="position:relative;background:#fff;border:5px solid ${INK};box-shadow:12px 12px 0 ${INK};padding:56px 60px;max-width:880px;font-size:${font === MONO ? 56 : 66}px;font-weight:700;line-height:1.4">${esc(fill(m[key].lines[idx], vars))}
        <div style="position:absolute;left:50%;bottom:-34px;margin-left:-20px;width:40px;height:40px;background:#fff;border-right:5px solid ${INK};border-bottom:5px solid ${INK};transform:rotate(45deg)"></div></div>`;
      out.push(page(w, h, font, `${tag(c.ctx[i])}${bubble}${pair(0, false)}`, bot(0, { mood: m[key].mood, look: { ...look, pet: null }, scale: 28 })));
    });
    return out;
  },

  closet(w, h, font, c) {
    const row = `<div style="display:flex;align-items:flex-end;gap:40px">${pair(0, true)}${pair(1, true)}</div>`;
    const out = [cover(w, h, font, c, row, [...bot(0, { look: LOOKS[1], scale: 16 }), ...bot(1, { look: HALLOWEEN, scale: 16, mood: "party" })])];
    const cells = LOOKS.map((look, i) =>
      `<div style="display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:14px;height:${(h - 360) / 3}px">
        ${pair(i, !!look.pet)}<div style="font-size:32px;font-weight:700">${i + 1}. ${esc(c.looks[i])}</div></div>`
    ).join("");
    out.push(page(w, h, font,
      `${tag(c.grid)}<div style="display:grid;grid-template-columns:1fr 1fr;column-gap:60px;width:100%">${cells}</div>`,
      LOOKS.flatMap((look, i) => bot(i, { look, scale: 10, mood: ["party", "proud", "happy", "lookLeft", "proud", "blink"][i] }))));
    out.push(page(w, h, font, `${title(c.halloween, font, 64)}${pair(0, true)}${sub(c.halloweenSub)}`, bot(0, { look: HALLOWEEN, scale: 24, mood: "party" })));
    return out;
  },

  evolve(w, h, font, c, lang) {
    const names = i18n[lang].evolve;
    const row = `<div style="display:flex;align-items:flex-end;gap:30px">${STAGES.map((_, i) => pair(i, false)).join("")}</div>`;
    const out = [cover(w, h, font, c, row, STAGES.flatMap((evolve, i) => bot(i, { evolve, scale: evolve.includes("grow") ? 11 : 10, mood: i ? "proud" : "happy" })))];
    STAGES.forEach((evolve, i) => {
      const head = i ? `🔥 ${fill(c.day, { n: STREAKS[i] })}` : c.start;
      const got = i ? tag(c.unlock + names[evolve[evolve.length - 1]]) : "";
      out.push(page(w, h, font, `${title(head, font, 84)}${pair(0, false)}${got}`,
        bot(0, { evolve, scale: evolve.includes("grow") ? 27 : 24, mood: ["happy", "happy", "proud", "party"][i] })));
    });
    return out;
  },

  moods(w, h, font, c) {
    const look = { color: "color-blue" };
    const row = `<div style="display:flex;align-items:flex-end;gap:30px">${pair(0, false)}${pair(1, false)}${pair(2, false)}</div>`;
    const out = [cover(w, h, font, c, row, ["happy", "angry", "sleepy"].flatMap((mood, i) => bot(i, { mood, look, scale: 14 })))];
    const cells = MOODS.map((_, i) =>
      `<div style="display:flex;flex-direction:column;align-items:center;gap:12px">${pair(i, false)}<div style="font-size:30px;font-weight:700">${esc(c.labels[i])}</div></div>`
    ).join("");
    out.push(page(w, h, font, `<div style="display:grid;grid-template-columns:repeat(3,1fr);row-gap:${h > 1400 ? 56 : 40}px;width:100%">${cells}</div>`,
      MOODS.flatMap((mood, i) => bot(i, { mood, look, scale: 11 }))));
    return out;
  },

  android(w, h, font, c, lang) {
    const dir = `${root}dist/play/raw/${lang}/`;
    if (!existsSync(`${dir}${SHOTS[0]}.png`)) throw new Error(`missing ${dir} (see docs/PLAY.md)`);
    const look = { color: "color-blue", hat: "hat-party", accessory: "acc-scarf", pet: "pet-cat" };
    const out = [cover(w, h, font, c, pair(0, true), bot(0, { look, scale: 22 }))];
    SHOTS.forEach((file, i) => {
      const cap = c.caps[i];
      const capH = cap.split("\n").length * (font === MONO ? 56 : 66);
      // The stop shot is cropped from the top: Beepo sits at the bottom of the screen.
      const img = `<div class="shot" style="border-radius:28px;overflow:hidden;max-height:${h - capH - 200}px;display:flex;flex-direction:column;justify-content:${i ? "flex-start" : "flex-end"}"><img src="${png(readFileSync(`${dir}${file}.png`))}" style="width:${h > 1400 ? 560 : 520}px;display:block"></div>`;
      out.push(page(w, h, font, `${title(cap, font, 52)}${img}`, [], 40));
    });
    return out;
  },
};

// ---------- run ----------

const { ctx, composer } = await launch();

for (const lang of langs.length ? langs : LANGS) {
  const xhs = lang === "zh_CN";
  const [w, h] = xhs ? [1080, 1440] : [1080, 1350];
  const font = FONTS[lang] || MONO;
  for (const set of sets.length ? sets : SETS) {
    const dir = xhs ? `${root}dist/social/xhs/${set}/` : `${root}dist/social/threads/${lang}/${set}/`;
    mkdirSync(dir, { recursive: true });
    const cards = SETUP[set](w, h, font, COPY[lang][set], lang);
    for (const [i, card] of cards.entries()) writeFileSync(`${dir}${i + 1}.png`, await render(composer, card));
    writeFileSync(`${dir}post.txt`, POSTS[lang][set] + `\n\n---\nimages: 1.png–${cards.length}.png\n`);
    console.log(`${dir.slice(root.length)} (${cards.length})`);
  }
}

await ctx.close();
