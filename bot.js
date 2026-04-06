
import { Telegraf, Markup } from 'telegraf';
import { message } from 'telegraf/filters';
import http from 'http';

import * as C from './src/config.js';
import * as M from './src/ui/messages.js';

// =================================================================================================
// --- البيئة والمتغيرات الأساسية (Environment Variables) ---
// =================================================================================================

const BOT_TOKEN = C.BOT_TOKEN;
const ADMIN_ID = C.ADMIN_ID;
const REGISTRATION_GROUP_ID = C.REGISTRATION_GROUP_ID;
const PAYMENT_GROUP_ID = C.PAYMENT_GROUP_ID;
const PORT = C.PORT;

// --- التحقق من المتغيرات الأساسية ---
if (!BOT_TOKEN) {
  console.error('CRITICAL: BOT_TOKEN is not set. The bot cannot start.');
  process.exit(1);
}
if (!ADMIN_ID) {
    console.warn('WARNING: ADMIN_ID is not set. Admin features will be disabled.');
}

// =================================================================================================
// --- التخزين المؤقت (In-Memory Storage) ---
// =================================================================================================

const userRegistration = new Map(); // { level, name, phone, country }
const userState = new Map(); // لتتبع حالة المستخدم الحالية

// =================================================================================================
// --- إعداد البوت (Bot Initialization) ---
// =================================================================================================

const bot = new Telegraf(BOT_TOKEN);

bot.telegram.setMyCommands([
  { command: 'start', description: '▶️ بدء وعرض القائمة الرئيسية' },
  { command: 'register', description: '📝 التسجيل في الدورة' },
  { command: 'book', description: '📚 الحصول على الكتاب' },
  { command: 'pay', description: '💰 دفع الرسوم' },
  { command: 'getgroupid', description: '🔑 [للمشرف] جلب ID المجموعة' },
]);

// =================================================================================================
// --- معالجات الأوامر والأزرار (Command and Action Handlers) ---
// =================================================================================================

bot.use((ctx, next) => {
  if (ctx.callbackQuery && ctx.chat.type !== 'private') return next();
  if (ctx.message && ctx.message.text && ctx.message.text.startsWith('/getgroupid') && ctx.chat.type !== 'private') return next();
  if (ctx.chat.type !== 'private') return;
  return next();
});

bot.start((ctx) => {
  console.log(`User started: @${ctx.from.username} (${ctx.from.id})`);
  ctx.reply(M.welcome,
    Markup.inlineKeyboard([
        [Markup.button.callback('📝 التسجيل في الدورة', 'REGISTER')],
        [Markup.button.callback('📚 الحصول على الكتاب', 'GET_BOOK')],
        [Markup.button.callback('💰 دفع الرسوم', 'SEND_PAYMENT')],
        [Markup.button.url('🔗 رابط المجموعة', C.GROUP_LINK)],
        [Markup.button.url('🔗 رابط القناة', C.CHANNEL_LINK)],
        [Markup.button.url('📞 التواصل مع المشرف', `https://t.me/${C.ADMIN_USERNAME}`)]
      ])
  );
});

bot.command('register', handleRegistration);
bot.action('REGISTER', handleRegistration);

bot.command('book', handleGetBook);
bot.action('GET_BOOK', handleGetBook);

bot.command('pay', handlePayment);
bot.action('SEND_PAYMENT', handlePayment);

// =================================================================================================
// --- الوظائف المنطقية (Logic Functions) ---
// =================================================================================================

function handleRegistration(ctx) {
  console.log(`Registration initiated by: @${ctx.from.username}`);
  if (ctx.callbackQuery) ctx.answerCbQuery();

  const levelKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback(C.COURSES.BEGINNER.name, `SELECT_LEVEL_${C.COURSES.BEGINNER.key}`)],
    [Markup.button.callback(C.COURSES.OTHER.name, `SELECT_LEVEL_${C.COURSES.OTHER.key}`)]
  ]);

  ctx.reply(M.selectLevel, levelKeyboard);
}

bot.action(/SELECT_LEVEL_(.+)/, (ctx) => {
  const levelKey = ctx.match[1];
  if (!C.COURSES[levelKey]) {
    ctx.answerCbQuery('خيار غير صالح. الرجاء المحاولة مرة أخرى.', { show_alert: true });
    return;
  }
  
  const userData = userRegistration.get(ctx.from.id) || {};
  userData.level = levelKey;
  userRegistration.set(ctx.from.id, userData);
  
  userState.set(ctx.from.id, 'awaiting_name');
  ctx.answerCbQuery(`تم اختيار: ${C.COURSES[levelKey].name}`);
  ctx.reply('لبدء التسجيل، الرجاء إدخال اسمك الكامل:');
});


async function handleGetBook(ctx) {
  console.log(`Book request by: @${ctx.from.username}`);
  if (ctx.callbackQuery) ctx.answerCbQuery();
  try {
    await ctx.reply('جاري تحضير الكتاب...');
    await ctx.replyWithDocument({ source: 'Headway-Beginner-Students-Book-5th-edition-2019-146p.pdf' });
  } catch (error) {
    console.error("Error sending book:", error);
    ctx.reply('عذراً، حدث خطأ أثناء إرسال الكتاب.');
  }
}

function handlePayment(ctx) {
  console.log(`Payment initiated by: @${ctx.from.username}`);
  if (ctx.callbackQuery) ctx.answerCbQuery();

  const userData = userRegistration.get(ctx.from.id);
  const course = userData ? C.COURSES[userData.level] : null;

  if (!course) {
    ctx.reply('يرجى التسجيل في الدورة أولاً عبر الأمر /register لتحديد المستوى ثم يمكنك المتابعة للدفع.');
    return;
  }

  const paymentMessage = M.paymentDetails(course);
  ctx.replyWithHTML(paymentMessage);
  userState.set(ctx.from.id, 'awaiting_payment_receipt');
}

// =================================================================================================
// --- معالجات الرسائل المدخلة (Message Input Handlers) ---
// =================================================================================================

bot.on(message('text'), async (ctx) => {
  const userId = ctx.from.id;
  const currentState = userState.get(userId);
  if (!currentState || !currentState.startsWith('awaiting_')) return;

  const userData = userRegistration.get(userId) || {};
  switch (currentState) {
    case 'awaiting_name':
      userData.name = ctx.message.text;
      userRegistration.set(userId, userData);
      userState.set(userId, 'awaiting_phone');
      ctx.reply('شكرًا لك. الآن الرجاء إدخال رقم هاتفك (مع رمز الدولة):');
      break;
    case 'awaiting_phone':
      userData.phone = ctx.message.text;
      userRegistration.set(userId, userData);
      userState.set(userId, 'awaiting_country');
      ctx.reply('ممتاز. أخيرًا، الرجاء إدخال بلدك:');
      break;
    case 'awaiting_country':
      userData.country = ctx.message.text;
      userRegistration.set(userId, userData);
      userState.delete(userId);
      
      ctx.reply('✅ تم استلام طلب تسجيلك! سيتم مراجعته من قبل المشرف وسيصلك إشعار بالقبول.');
      console.log(`New registration submitted: ${JSON.stringify(userData)}`);

      if (REGISTRATION_GROUP_ID) {
        const regDetails = M.registrationNotification(userData, ctx.from);
        try {
          await bot.telegram.sendMessage(REGISTRATION_GROUP_ID, regDetails, {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: [[Markup.button.callback('✅ قبول التسجيل', `approve_reg_${userId}`)]] }
          });
        } catch (e) { console.error('Failed to send registration to group:', e); }
      } else { console.warn('REGISTRATION_GROUP_ID is not set.'); }
      break;
  }
});

bot.on([message('photo'), message('document')], async (ctx) => {
    const userId = ctx.from.id;
    if (userState.get(userId) !== 'awaiting_payment_receipt') {
        const userData = userRegistration.get(userId);
        if (userData && userData.level) {
             ctx.reply('الرجاء استخدام زر "💰 دفع الرسوم" أولاً قبل إرسال الإيصال.');
        } else {
             ctx.reply('لم يتم تحديد دورة للدفع. يرجى التسجيل أولاً عبر /register.');
        }
        return;
    }

    console.log(`Payment receipt received from: @${ctx.from.username} (${userId})`);
    userState.delete(userId);

    let userData = userRegistration.get(userId) || {
        name: `${ctx.from.first_name}${ctx.from.last_name ? ' ' + ctx.from.last_name : ''}`,
        phone: 'غير مسجل',
        country: 'غير مسجل',
        level: null
    };

    const caption = M.paymentNotification(userData, ctx.from);

    const adminReplyMarkup = {
        inline_keyboard: [[
            Markup.button.callback('✅ قبول', `approve_pay_${userId}`),
            Markup.button.callback('❌ رفض', `reject_pay_${userId}`)
        ]]
    };

    if (PAYMENT_GROUP_ID) {
        try {
            const fileId = ctx.message.photo ? ctx.message.photo[ctx.message.photo.length - 1].file_id : ctx.message.document.file_id;
            const sendMethod = ctx.message.photo ? 'sendPhoto' : 'sendDocument';
            await bot.telegram[sendMethod](PAYMENT_GROUP_ID, fileId, { caption: caption, parse_mode: 'HTML', reply_markup: adminReplyMarkup });
            ctx.reply('✅ تم استلام إيصال الدفع، وسيتم مراجعته وتأكيده قريبًا.');
        } catch (error) {
            console.error('Error forwarding receipt to admin group:', error);
            ctx.reply('عذراً، حدث خطأ أثناء إرسال الإيصال للمشرف.');
        }
    } else {
        console.warn("PAYMENT_GROUP_ID is not set. Cannot forward receipt.");
        ctx.reply("عذراً، خدمة استقبال الدفع غير متاحة حالياً. تواصل مع المشرف.");
    }
});


// =================================================================================================
// --- أدوات المشرف وقراراته (Admin Tools and Decisions) ---
// =================================================================================================

function isAdmin(ctx) {
    if (!ADMIN_ID) {
        ctx.answerCbQuery('خطأ: معرّف المشرف (ADMIN_ID) غير معين في الخادم.', { show_alert: true });
        return false;
    }
    if (ctx.from.id.toString() !== ADMIN_ID.toString()) {
        ctx.answerCbQuery('خاص بالمشرف فقط.', { show_alert: true });
        return false;
    }
    return true;
}

bot.action(/approve_reg_(\d+)/, async (ctx) => {
  if (!isAdmin(ctx)) return;
  const userId = ctx.match[1];
  try {
    await bot.telegram.sendMessage(userId, '🎉 تهانينا! تم قبول تسجيلك. يمكنك الآن المتابعة لدفع الرسوم عبر الأمر /pay أو من القائمة الرئيسية.');
    const originalMessage = ctx.callbackQuery.message.text || ctx.callbackQuery.message.caption;
    await ctx.editMessageText(`${originalMessage}\n\n---\n✅ تم قبول التسجيل بواسطة ${ctx.from.first_name}.`);
    ctx.answerCbQuery('تم إعلام المستخدم بقبول التسجيل.');
  } catch (e) { console.error('Failed to approve registration:', e); ctx.answerCbQuery('فشل الإجراء. ربما حظر المستخدم البوت.', { show_alert: true }); }
});

bot.action(/approve_pay_(\d+)/, async (ctx) => {
  if (!isAdmin(ctx)) return;
  const userId = ctx.match[1];
  try {
    await bot.telegram.sendMessage(userId, '🎉 تهانينا! تم تأكيد دفعك بنجاح. أهلاً بك في الدورة.');
    const originalCaption = ctx.callbackQuery.message.caption || '';
    await ctx.editMessageCaption(`${originalCaption}\n\n---\n✅ تم تأكيد الدفع بنجاح بواسطة ${ctx.from.first_name}.`);
    ctx.answerCbQuery('تم إرسال التأكيد للمستخدم بنجاح.');
  } catch (e) { console.error('Failed to approve payment:', e); ctx.answerCbQuery('فشل الإجراء. ربما حظر المستخدم البوت.', { show_alert: true }); }
});

bot.action(/reject_pay_(\d+)/, async (ctx) => {
  if (!isAdmin(ctx)) return;
  const userId = ctx.match[1];
  try {
    await bot.telegram.sendMessage(userId, `عذراً، تم رفض إيصال الدفع الخاص بك. يرجى التواصل مع المشرف لمعرفة السبب: @${C.ADMIN_USERNAME}`);
    const originalCaption = ctx.callbackQuery.message.caption || '';
    await ctx.editMessageCaption(`${originalCaption}\n\n---\n❌ تم رفض الطلب بواسطة ${ctx.from.first_name}.`);
    ctx.answerCbQuery('تم إعلام المستخدم بالرفض.');
  } catch (e) { console.error('Failed to reject payment:', e); ctx.answerCbQuery('فشل الإجراء. ربما حظر المستخدم البوت.', { show_alert: true }); }
});

bot.command('getgroupid', (ctx) => {
  if (ctx.chat.type === 'private') {
    return ctx.reply('يجب استخدام هذا الأمر داخل مجموعة للحصول على معرّفها.');
  }
  if (ADMIN_ID && ctx.from.id.toString() !== ADMIN_ID.toString()) {
    return;
  }
  ctx.reply(`*ID المجموعة:* \`${ctx.chat.id}\``, { parse_mode: 'MarkdownV2' });
});

// =================================================================================================
// --- تشغيل الخادم والبوت (Server and Bot Launch) ---
// =================================================================================================

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot server is running.');
});

server.listen(PORT, () => console.log(`Server is listening on port ${PORT}`));

bot.launch(() => console.log('Bot is up, stable, and running with all fixes.')).catch(e => console.error('ERROR on launch:', e));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
