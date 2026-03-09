
import { Telegraf, Markup } from 'telegraf';
import { message } from 'telegraf/filters';
import http from 'http';

// --- Environment Variables ---
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;
const PORT = process.env.PORT || 3000; // Port for Render

if (!BOT_TOKEN) {
  console.error('BOT_TOKEN is not set in environment variables.');
  process.exit(1);
}

// --- In-Memory Storage ---
const userRegistration = new Map();
const userPayments = new Map();

// --- Bot Initialization ---
const bot = new Telegraf(BOT_TOKEN);

// --- Welcome Message and Main Menu ---
bot.start((ctx) => {
  console.log(`New user started the bot: ${ctx.from.username} (${ctx.from.id})`);
  ctx.reply(
    'مرحبًا بك في البوت! الرجاء اختيار أحد الخيارات:',
    Markup.inlineKeyboard([
      [Markup.button.callback('📚 الحصول على الكتاب', 'GET_BOOK')],
      [Markup.button.callback('📝 تسجيل', 'REGISTER')],
      [Markup.button.callback('💰 إرسال دفعة', 'SEND_PAYMENT')],
      [Markup.button.callback('📞 التواصل مع المشرف', 'CONTACT_ADMIN')],
      [Markup.button.url('🔗 رابط المجموعة', 'YOUR_GROUP_LINK')],
      [Markup.button.url('🔗 رابط القناة', 'YOUR_CHANNEL_LINK')],
    ])
  );
});

// --- Bot Actions ---
bot.action('GET_BOOK', (ctx) => {
  console.log(`Button pressed: GET_BOOK by ${ctx.from.username}`);
  ctx.reply('هذا هو رابط الكتاب: [Your Google Drive Link]');
});

bot.action('REGISTER', (ctx) => {
  console.log(`Button pressed: REGISTER by ${ctx.from.username}`);
  if (userRegistration.has(ctx.from.id)) {
    ctx.reply('أنت مسجل بالفعل.');
  } else {
    userRegistration.set(ctx.from.id, {});
    ctx.reply('الرجاء إدخال اسمك الكامل:');
  }
});

bot.action('SEND_PAYMENT', (ctx) => {
  console.log(`Button pressed: SEND_PAYMENT by ${ctx.from.username}`);
  ctx.reply('الرجاء تحميل لقطة شاشة للدفع.');
});

bot.action('CONTACT_ADMIN', (ctx) => {
  console.log(`Button pressed: CONTACT_ADMIN by ${ctx.from.username}`);
  ctx.reply(`يمكنك التواصل مع المشرف هنا: t.me/your_admin_username`);
});

// --- Message Handlers ---
bot.on(message('text'), (ctx) => {
  const text = ctx.message.text;
  const userId = ctx.from.id;

  if (userRegistration.has(userId)) {
    const userData = userRegistration.get(userId);
    if (!userData.name) {
      userData.name = text;
      ctx.reply('شكرًا لك. الآن الرجاء إدخال رقم هاتفك.');
    } else if (!userData.phone) {
      userData.phone = text;
      ctx.reply('أخيرًا، الرجاء إدخال بلدك.');
    } else if (!userData.country) {
      userData.country = text;
      ctx.reply('اكتمل التسجيل! شكرًا لك.');
      console.log(`New registration: ${JSON.stringify(userData)}`);
    }
  }
});

bot.on(message('photo'), (ctx) => {
  const photo = ctx.message.photo[ctx.message.photo.length - 1];
  userPayments.set(ctx.from.id, photo.file_id);

  console.log(`Payment received from: ${ctx.from.username} (${ctx.from.id})`);

  if (ADMIN_ID) {
    ctx.telegram.sendPhoto(ADMIN_ID, photo.file_id, {
      caption: `دفعة جديدة من ${ctx.from.first_name} ${ctx.from.last_name || ''} (@${ctx.from.username})`,
    });
  }

  ctx.reply('شكرًا لك على الدفع. سنراجعه قريبًا.');
});

// --- Start the Bot ---
bot.launch(() => {
  console.log('Bot is up and running!');
});

// --- Web Server for Render Health Checks ---
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is running.');
});

server.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});

// --- Graceful Shutdown ---
process.once('SIGINT', () => {
  bot.stop('SIGINT');
  server.close();
});
process.once('SIGTERM', () => {
  bot.stop('SIGTERM');
  server.close();
});
