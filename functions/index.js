import express from 'express';
import { Telegraf, Markup } from 'telegraf';
import { ADMIN_ID, PRICE, GROUP_LINK, CHANNEL_LINK } from './env.js';

// Ensure the bot token is provided
if (!process.env.BOT_TOKEN) {
  console.error('ERROR: BOT_TOKEN environment variable is not set.');
  process.exit(1);
}
const token = process.env.BOT_TOKEN;

const bot = new Telegraf(token);

// Middleware to log user info
bot.use((ctx, next) => {
  if (ctx.from) {
    console.log(`User: ${ctx.from.first_name} ${ctx.from.last_name || ''} (${ctx.from.id})`);
  }
  return next();
});

bot.start((ctx) => {
  const message = `
أهلاً بك في بوت التواصل!

بوت بسيط للتواصل مع الأدمن.
يمكنك إرسال رسالتك وسيتم تحويلها مباشرةً.
`;
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.url('القناة', CHANNEL_LINK), Markup.button.url('المجموعة', GROUP_LINK)],
  ]);

  ctx.reply(message, keyboard);
});


// Forward messages to admin
bot.on('text', (ctx) => {
  if (ctx.message.text.startsWith('/')) {
    // Ignore commands
    return;
  }
  ctx.forwardMessage(ADMIN_ID, ctx.from.id, ctx.message.id);
  ctx.reply('تم إرسال رسالتك إلى الأدمن. سيتم الرد عليك قريباً.');
});

// Handle replies from admin
bot.on('message', (ctx) => {
  if (ctx.message.reply_to_message && ctx.from.id.toString() === ADMIN_ID) {
    const repliedTo = ctx.message.reply_to_message.forward_from;
    if (repliedTo) {
      ctx.telegram.sendMessage(repliedTo.id, ctx.message.text);
      ctx.reply('تم إرسال ردك إلى المستخدم.');
    }
  }
});


// When deploying, Render sets the WEBHOOK_URL environment variable
// We'll use polling if it's not set (for local development)
if (process.env.RENDER_EXTERNAL_URL) {
  const app = express();
  app.use(express.json());

  const webhookUrl = `${process.env.RENDER_EXTERNAL_URL}/bot${token}`;
  bot.telegram.setWebhook(webhookUrl);
  console.log(`Webhook set to ${webhookUrl}`);

  // We are receiving updates at the route below!
  app.post(`/bot${token}`, (req, res) => {
    bot.handleUpdate(req.body, res); 
  });

  app.listen(process.env.PORT || 3000, () => {
    console.log(`Server is listening on port ${process.env.PORT || 3000}`);
  });
} else {
  // Use polling for local development
  bot.launch();
  console.log('Bot is running with polling');
}
