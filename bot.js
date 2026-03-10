
import { Telegraf, Markup } from 'telegraf';
import { message } from 'telegraf/filters';
import http from 'http';

// =================================================================================================
// --- البيئة والمتغيرات الأساسية (Environment Variables) ---
// =================================================================================================

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID; // Your numeric Telegram User ID

// --- معرفات المجموعات (Group IDs) ---
// يمكنك الحصول عليها باستخدام الأمر /getgroupid داخل المجموعات المطلوبة
const REGISTRATION_GROUP_ID = process.env.REGISTRATION_GROUP_ID; // مجموعة طلبات التسجيل
const PAYMENT_GROUP_ID = process.env.PAYMENT_GROUP_ID;       // مجموعة إيصالات الدفع

const PORT = process.env.PORT || 3000;

// --- ثوابت الدورة (Course Constants) ---
const ORIGINAL_PRICE = '960 SAR';
const DISCOUNT_PRICE = '30 SAR';
const OFFER_NAME = '✨ عرض رمضان المميز ✨';
const BANK_DETAILS = `
Bank: Al-Rajhi Bank
Account Number: 12345678901234
Account Holder: Ahmed Al-Khayr
`;
const ADMIN_USERNAME = 'ahmed_khyr'; // Your Telegram username for contact

// --- التحقق من المتغيرات الأساسية ---
if (!BOT_TOKEN || !ADMIN_ID) {
  console.error('BOT_TOKEN and ADMIN_ID must be set in environment variables.');
  process.exit(1);
}

// =================================================================================================
// --- التخزين المؤقت (In-Memory Storage) ---
// =================================================================================================

const userRegistration = new Map(); // لتخزين بيانات التسجيل { name, phone, country }
const userState = new Map(); // لتتبع حالة المستخدم الحالية (مثلاً: ينتظر إدخال الاسم)

// =================================================================================================
// --- إعداد البوت (Bot Initialization) ---
// =================================================================================================

const bot = new Telegraf(BOT_TOKEN);

// --- تسجيل الأوامر الرسمية للبوت في قائمة تليجرام ---
bot.telegram.setMyCommands([
  { command: 'start', description: '▶️ بدء استخدام البوت' },
  { command: 'register', description: '📝 التسجيل في الدورة' },
  { command: 'book', description: '📚 الحصول على الكتاب' },
  { command: 'pay', description: '💰 دفع الرسوم' },
  { command: 'contact', description: `📞 التواصل مع المشرف` },
  { command: 'getgroupid', description: '🔑 [للمشرف] جلب ID المجموعة' },
]);

// =================================================================================================
// --- معالجات الأوامر الرئيسية (Command Handlers) ---
// =================================================================================================

// --- الأمر /start ---
bot.start((ctx) => {
  if (ctx.chat.type !== 'private') return; // تجاهل الأمر في المجموعات
  console.log(`New user started: ${ctx.from.username} (${ctx.from.id})`);
  const welcomeMessage = `
👋 أهلاً بك في بوت دورة اللغة الإنجليزية!

هذا البوت هو مساعدك الشخصي للتسجيل في دورتنا. من خلاله يمكنك:
  - 📝 التسجيل في الدورة
  - 📚 تحميل الكتاب التعليمي
  - 💰 إرسال إثبات الدفع

اضغط على أحد الخيارات في الأسفل للبدء.
  `;
  ctx.reply(welcomeMessage);
  showMainMenu(ctx);
});

// --- أوامر أخرى ---
bot.command('register', (ctx) => handleRegistration(ctx));
bot.command('book', (ctx) => handleGetBook(ctx));
bot.command('pay', (ctx) => handlePayment(ctx));
bot.command('contact', (ctx) => handleContactAdmin(ctx));

// --- أمر جلب ID المجموعة (خاص بالمشرف) ---
bot.command('getgroupid', (ctx) => {
  if (ctx.from.id.toString() !== ADMIN_ID.toString()) {
    return; // تجاهل الأمر من غير المشرفين
  }
  if (ctx.chat.type === 'private') {
    return ctx.reply('يجب استخدام هذا الأمر داخل مجموعة للحصول على معرّفها.');
  }
  const groupTitle = ctx.chat.title;
  const groupId = ctx.chat.id;
  ctx.reply(`🏢 **تفاصيل المجموعة**

**اسم المجموعة:** ${groupTitle}
**معرّف المجموعة (ID):** \`${groupId}\`

الرجاء نسخ هذا المعرّف واستخدامه في متغيرات البيئة (Environment Variables) للمشروع.`);
});

// =================================================================================================
// --- معالجات الأزرار (Action Handlers) ---
// =================================================================================================

bot.action('REGISTER', (ctx) => handleRegistration(ctx));
bot.action('GET_BOOK', (ctx) => handleGetBook(ctx));
bot.action('SEND_PAYMENT', (ctx) => handlePayment(ctx));
bot.action('CONTACT_ADMIN', (ctx) => handleContactAdmin(ctx));

// =================================================================================================
// --- الوظائف المنطقية (Logic Functions) ---
// =================================================================================================

function showMainMenu(ctx) {
  ctx.reply('الرجاء اختيار أحد الخيارات:', Markup.inlineKeyboard([
    [Markup.button.callback('📝 التسجيل في الدورة', 'REGISTER')],
    [Markup.button.callback('📚 الحصول على الكتاب', 'GET_BOOK')],
    [Markup.button.callback('💰 دفع الرسوم', 'SEND_PAYMENT')],
    [Markup.button.callback('📞 التواصل مع المشرف', 'CONTACT_ADMIN')],
  ]));
}

function handleRegistration(ctx) {
  if (ctx.chat.type !== 'private') return;
  console.log(`Registration initiated by: ${ctx.from.username} (${ctx.from.id})`);
  userState.set(ctx.from.id, 'awaiting_name');
  if (ctx.callbackQuery) ctx.answerCbQuery();
  ctx.reply('لبدء التسجيل، الرجاء إدخال اسمك الكامل:');
}

async function handleGetBook(ctx) {
  if (ctx.chat.type !== 'private') return;
  console.log(`Book request by: ${ctx.from.username} (${ctx.from.id})`);
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
  if (ctx.chat.type !== 'private') return;
  console.log(`Payment initiated by: ${ctx.from.username} (${ctx.from.id})`);
  const userId = ctx.from.id;
  if (ctx.callbackQuery) ctx.answerCbQuery();
  if (!userRegistration.has(userId)) {
    return ctx.reply('يجب عليك التسجيل أولاً وقبول طلبك. استخدم الأمر /register للتسجيل.');
  }
  const paymentMessage = `
${OFFER_NAME}

🏦 **تفاصيل الدفع**

**السعر الأصلي:** <s>${ORIGINAL_PRICE}</s>
**سعر العرض:** <strong>${DISCOUNT_PRICE}</strong>

**طريقة الدفع:** تحويل بنكي
${BANK_DETAILS}
---
الرجاء إرسال صورة أو ملف (PDF) لإيصال الدفع للمتابعة.
`;
  ctx.replyWithHTML(paymentMessage);
  userState.set(userId, 'awaiting_payment_receipt');
}

function handleContactAdmin(ctx) {
  if (ctx.callbackQuery) ctx.answerCbQuery();
  ctx.reply(`يمكنك التواصل مع المشرف مباشرة عبر هذا المعرف: @${ADMIN_USERNAME}`);
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
        const registrationDetails = `
🆕 **طلب تسجيل جديد**

**الاسم:** ${userData.name}
**الهاتف:** ${userData.phone}
**الدولة:** ${userData.country}
**المستخدم:** @${ctx.from.username || 'N/A'}
**المعرّف:** \`${userId}\`
        `;
        try {
          await bot.telegram.sendMessage(REGISTRATION_GROUP_ID, registrationDetails, {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [[Markup.button.callback('✅ قبول التسجيل', `approve_reg_${userId}`)]] }
          });
        } catch (e) { console.error('Failed to send registration to group:', e); }
      } else { console.warn('REGISTRATION_GROUP_ID is not set.'); }
      break;
  }
});

bot.on([message('photo'), message('document')], async (ctx) => {
  const userId = ctx.from.id;
  if (userState.get(userId) !== 'awaiting_payment_receipt') return;
  
  console.log(`Payment receipt received from: ${ctx.from.username} (${userId})`);
  const userData = userRegistration.get(userId);
  if (!userData) {
      return ctx.reply('حدث خطأ، لم أجد بيانات التسجيل الخاصة بك. الرجاء التواصل مع المشرف.');
  }

  const adminCaption = `
🧾 **إيصال دفع جديد**

**الاسم:** ${userData.name}
**الهاتف:** ${userData.phone}
**الدولة:** ${userData.country}
**المستخدم:** @${ctx.from.username || 'N/A'}
**المعرّف:** \`${userId}\`
`;
  
  const adminReplyMarkup = { inline_keyboard: [[ Markup.button.callback('✅ قبول', `approve_pay_${userId}`), Markup.button.callback('❌ رفض', `reject_pay_${userId}`) ]] };

  if (PAYMENT_GROUP_ID) {
    try {
      const fileId = ctx.message.photo ? ctx.message.photo[ctx.message.photo.length - 1].file_id : ctx.message.document.file_id;
      const sendMethod = ctx.message.photo ? 'sendPhoto' : 'sendDocument';
      await bot.telegram[sendMethod](PAYMENT_GROUP_ID, fileId, {
          caption: adminCaption, parse_mode: 'Markdown', reply_markup: adminReplyMarkup
      });
      ctx.reply('✅ تم استلام إيصال الدفع، وسيتم مراجعته وتأكيده قريبًا.');
    } catch(error) {
        console.error('Error forwarding receipt to admin group:', error);
        ctx.reply('عذراً، حدث خطأ أثناء إرسال الإيصال للمشرف.');
    }
  } else {
    console.warn("PAYMENT_GROUP_ID is not set.");
    ctx.reply("عذراً، خدمة استقبال الدفع غير متاحة حالياً.");
  }
  userState.delete(userId);
});

// =================================================================================================
// --- معالجات قرارات المشرف (Admin Decision Handlers) ---
// =================================================================================================

// --- قبول التسجيل ---
bot.action(/approve_reg_(\d+)/, async (ctx) => {
  if (ctx.from.id.toString() !== ADMIN_ID.toString()) {
    return ctx.answerCbQuery('خاص بالمشرف فقط.', { show_alert: true });
  }
  const userId = ctx.match[1];
  const adminName = ctx.from.first_name;
  try {
    await bot.telegram.sendMessage(userId, '🎉 تهانينا! تم قبول تسجيلك. يمكنك الآن المتابعة لدفع الرسوم عبر الأمر /pay');
    await ctx.editMessageText(`✅ تم قبول التسجيل بواسطة ${adminName}.`);
    ctx.answerCbQuery('تم إعلام المستخدم بقبول التسجيل.');
  } catch (error) {
    console.error('Failed to approve registration:', error);
    ctx.answerCbQuery('فشل الإجراء. ربما حظر المستخدم البوت.', { show_alert: true });
  }
});

// --- قبول الدفع ---
bot.action(/approve_pay_(\d+)/, async (ctx) => {
  if (ctx.from.id.toString() !== ADMIN_ID.toString()) {
    return ctx.answerCbQuery('خاص بالمشرف فقط.', { show_alert: true });
  }
  const userId = ctx.match[1];
  const adminName = ctx.from.first_name;
  try {
    await bot.telegram.sendMessage(userId, '🎉 تهانينا! تم تأكيد دفعك بنجاح. أهلاً بك في الدورة.');
    await ctx.editMessageCaption(`✅ تم تأكيد الدفع بنجاح بواسطة ${adminName}.`);
    ctx.answerCbQuery('تم إرسال التأكيد للمستخدم بنجاح.');
  } catch (error) {
    console.error('Failed to approve payment:', error);
    ctx.answerCbQuery('فشل الإجراء. ربما حظر المستخدم البوت.', { show_alert: true });
  }
});

// --- رفض الدفع ---
bot.action(/reject_pay_(\d+)/, async (ctx) => {
  if (ctx.from.id.toString() !== ADMIN_ID.toString()) {
    return ctx.answerCbQuery('خاص بالمشرف فقط.', { show_alert: true });
  }
  const userId = ctx.match[1];
  const adminName = ctx.from.first_name;
  try {
    await bot.telegram.sendMessage(userId, `عذراً، تم رفض إيصال الدفع الخاص بك. يرجى التواصل مع المشرف لمعرفة السبب: @${ADMIN_USERNAME}`);
    await ctx.editMessageCaption(`❌ تم رفض الطلب بواسطة ${adminName}.`);
    ctx.answerCbQuery('تم إعلام المستخدم بالرفض.');
  } catch (error) {
    console.error('Failed to reject payment:', error);
    ctx.answerCbQuery('فشل الإجراء. ربما حظر المستخدم البوت.', { show_alert: true });
  }
});

// =================================================================================================
// --- تشغيل الخادم والبوت (Server and Bot Launch) ---
// =================================================================================================

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot server is running.');
});

server.listen(PORT, () => console.log(`Server is listening on port ${PORT}`));

bot.launch(() => console.log('Bot is up and running with all new features!'));

process.once('SIGINT', () => { bot.stop('SIGINT'); server.close(); });
process.once('SIGTERM', () => { bot.stop('SIGTERM'); server.close(); });
