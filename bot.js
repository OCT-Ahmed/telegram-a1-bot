
import { Telegraf, Markup } from 'telegraf';
import { message } from 'telegraf/filters';
import http from 'http';

// =================================================================================================
// --- البيئة والمتغيرات الأساسية (Environment Variables) ---
// =================================================================================================

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID; // Your numeric Telegram User ID

// --- معرفات المجموعات (Group IDs) ---
const REGISTRATION_GROUP_ID = process.env.REGISTRATION_GROUP_ID; // مجموعة طلبات التسجيل
const PAYMENT_GROUP_ID = process.env.PAYMENT_GROUP_ID;       // مجموعة إيصالات الدفع

const PORT = process.env.PORT || 3000;

// --- ثوابت الدورة والروابط (Constants and Links) ---
const ORIGINAL_PRICE = '960 SAR';
const DISCOUNT_PRICE = '30 SAR';
const OFFER_NAME = '✨ عرض رمضان المميز ✨';
const BANK_DETAILS = `
Bank: Al-Rajhi Bank
Account Number: 12345678901234
Account Holder: Ahmed Al-Khayr
`;
const ADMIN_USERNAME = 'ahmed_khyr'; // Your Telegram username for contact
const GROUP_LINK = 'https://t.me/+AgZ-nk1D5-84MTBk';
const CHANNEL_LINK = 'https://t.me/+9znDAa3NsKNhZjlk';

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

const userRegistration = new Map(); // لتخزين بيانات التسجيل { name, phone, country }
const userState = new Map(); // لتتبع حالة المستخدم الحالية (مثلاً: ينتظر إدخال الاسم)

// =================================================================================================
// --- إعداد البوت (Bot Initialization) ---
// =================================================================================================

const bot = new Telegraf(BOT_TOKEN);

// --- تسجيل الأوامر الرسمية للبوت ---
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

// --- معالج البدء الرئيسي (start) ---
bot.use((ctx, next) => {
  // تجاهل أي أمر في مجموعة ما عدا getgroupid
  if (ctx.chat.type !== 'private' && ctx.message && ctx.message.text && !ctx.message.text.startsWith('/getgroupid')) {
    return;
  }
  return next();
});

bot.start((ctx) => {
  console.log(`User started: @${ctx.from.username} (${ctx.from.id})`);
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

// --- ربط الأوامر والأزرار بالوظائف الخاصة بها ---
bot.command('register', handleRegistration);
bot.action('REGISTER', handleRegistration);

bot.command('book', handleGetBook);
bot.action('GET_BOOK', handleGetBook);

bot.command('pay', handlePayment);
bot.action('SEND_PAYMENT', handlePayment);


// =================================================================================================
// --- الوظائف المنطقية (Logic Functions) ---
// =================================================================================================

// --- عرض القائمة الرئيسية بالأزرار ---
function showMainMenu(ctx) {
  ctx.reply(
    'الرجاء اختيار أحد الخيارات:',
    Markup.inlineKeyboard([
      [Markup.button.callback('📝 التسجيل في الدورة', 'REGISTER')],
      [Markup.button.callback('📚 الحصول على الكتاب', 'GET_BOOK')],
      [Markup.button.callback('💰 دفع الرسوم', 'SEND_PAYMENT')],
      [Markup.button.url('🔗 رابط المجموعة', GROUP_LINK)],
      [Markup.button.url('🔗 رابط القناة', CHANNEL_LINK)],
      [Markup.button.url('📞 التواصل مع المشرف', `https://t.me/${ADMIN_USERNAME}`)]
    ])
  );
}

// --- بدء عملية التسجيل ---
function handleRegistration(ctx) {
  console.log(`Registration initiated by: @${ctx.from.username}`);
  userState.set(ctx.from.id, 'awaiting_name');
  if (ctx.callbackQuery) ctx.answerCbQuery();
  ctx.reply('لبدء التسجيل، الرجاء إدخال اسمك الكامل:');
}

// --- الحصول على الكتاب ---
async function handleGetBook(ctx) {
  console.log(`Book request by: @${ctx.from.username}`);
  if (ctx.callbackQuery) ctx.answerCbQuery();
  try {
    await ctx.reply('جاري تحضير الكتاب...');
    await ctx.replyWithDocument({ source: 'Headway-Beginner-Students-Book-5th-edition-2019-146p.pdf' });
  } catch (error) {
    console.error("Error sending book:", error);
    ctx.reply('عذراً، حدث خطأ أثناء إرسال الكتاب. تأكد من وجود الملف أو تواصل مع المشرف.');
  }
}

// --- بدء عملية الدفع (متاحة للجميع) ---
function handlePayment(ctx) {
  console.log(`Payment initiated by: @${ctx.from.username}`);
  if (ctx.callbackQuery) ctx.answerCbQuery();
  
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
  userState.set(ctx.from.id, 'awaiting_payment_receipt');
}


// =================================================================================================
// --- معالجات الرسائل المدخلة (Message Input Handlers) ---
// =================================================================================================

// --- معالج إدخال النصوص (للتسجيل) ---
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
        const regDetails = `🆕 **طلب تسجيل جديد**\n\n**الاسم:** ${userData.name}\n**الهاتف:** ${userData.phone}\n**الدولة:** ${userData.country}\n**المستخدم:** @${ctx.from.username || 'N/A'}\n**المعرّف:** \`${userId}\``;
        try {
          await bot.telegram.sendMessage(REGISTRATION_GROUP_ID, regDetails, {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [[Markup.button.callback('✅ قبول التسجيل', `approve_reg_${userId}`)]] }
          });
        } catch (e) { console.error('Failed to send registration to group:', e); }
      } else { console.warn('REGISTRATION_GROUP_ID is not set.'); }
      break;
  }
});

// --- معالج إيصالات الدفع (صور ومستندات) ---
bot.on([message('photo'), message('document')], async (ctx) => {
  const userId = ctx.from.id;
  if (userState.get(userId) !== 'awaiting_payment_receipt') return;
  
  console.log(`Payment receipt received from: @${ctx.from.username}`);
  
  // جلب بيانات المستخدم المسجلة، أو إنشاء بيانات مؤقتة إذا لم يكن مسجلاً
  let userData = userRegistration.get(userId);
  if (!userData) {
    userData = {
      name: `${ctx.from.first_name}${ctx.from.last_name ? ' ' + ctx.from.last_name : ''}`,
      phone: 'غير مسجل',
      country: 'غير مسجل'
    };
  }

  const adminCaption = `\n🧾 **إيصال دفع جديد**\n\n**الاسم:** ${userData.name}\n**الهاتف:** ${userData.phone}\n**الدولة:** ${userData.country}\n**المستخدم:** @${ctx.from.username || 'N/A'}\n**المعرّف:** \`${userId}\``;
  
  const adminReplyMarkup = { inline_keyboard: [[ Markup.button.callback('✅ قبول', `approve_pay_${userId}`), Markup.button.callback('❌ رفض', `reject_pay_${userId}`) ]] };

  if (PAYMENT_GROUP_ID) {
    try {
      const fileId = ctx.message.photo ? ctx.message.photo[ctx.message.photo.length - 1].file_id : ctx.message.document.file_id;
      const sendMethod = ctx.message.photo ? 'sendPhoto' : 'sendDocument';
      await bot.telegram[sendMethod](PAYMENT_GROUP_ID, fileId, { caption: adminCaption, parse_mode: 'Markdown', reply_markup: adminReplyMarkup });
      ctx.reply('✅ تم استلام إيصال الدفع، وسيتم مراجعته وتأكيده قريبًا.');
    } catch(error) {
        console.error('Error forwarding receipt to admin group:', error);
        ctx.reply('عذراً، حدث خطأ أثناء إرسال الإيصال للمشرف.');
    }
  } else {
    console.warn("PAYMENT_GROUP_ID is not set.");
    ctx.reply("عذراً، خدمة استقبال الدفع غير متاحة حالياً. تواصل مع المشرف.");
  }
  userState.delete(userId);
});


// =================================================================================================
// --- أدوات المشرف وقراراته (Admin Tools and Decisions) ---
// =================================================================================================

// --- أمر جلب ID المجموعة (خاص بالمشرف) ---
bot.command('getgroupid', (ctx) => {
  if (ctx.chat.type === 'private') {
    return ctx.reply('يجب استخدام هذا الأمر داخل مجموعة للحصول على معرّفها.');
  }
  if (ADMIN_ID && ctx.from.id.toString() !== ADMIN_ID.toString()) {
    return;
  }
  const groupInfo = `\n🏢 **تفاصيل المجموعة**\n**اسم المجموعة:** ${ctx.chat.title}\n**معرّف المجموعة (Group ID):** \`${ctx.chat.id}\``;
  const adminInfo = `\n\n---\n🔑 **معرّف المشرف (Admin ID)**\n**معرّفك الشخصي هو:** \`${ctx.from.id}\``;
  ctx.replyWithMarkdown(groupInfo + (!ADMIN_ID ? adminInfo : ''));
});

// --- التحقق من هوية المشرف للأزرار ---
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

// --- قبول التسجيل ---
bot.action(/approve_reg_(\d+)/, async (ctx) => {
  if (!isAdmin(ctx)) return;
  const userId = ctx.match[1];
  try {
    await bot.telegram.sendMessage(userId, '🎉 تهانينا! تم قبول تسجيلك. يمكنك الآن المتابعة لدفع الرسوم عبر الأمر /pay أو من القائمة الرئيسية.');
    await ctx.editMessageText(`✅ تم قبول التسجيل بواسطة ${ctx.from.first_name}.`);
    ctx.answerCbQuery('تم إعلام المستخدم بقبول التسجيل.');
  } catch (e) {
    console.error('Failed to approve registration:', e);
    ctx.answerCbQuery('فشل الإجراء. ربما حظر المستخدم البوت.', { show_alert: true });
  }
});

// --- قبول الدفع ---
bot.action(/approve_pay_(\d+)/, async (ctx) => {
  if (!isAdmin(ctx)) return;
  const userId = ctx.match[1];
  try {
    await bot.telegram.sendMessage(userId, '🎉 تهانينا! تم تأكيد دفعك بنجاح. أهلاً بك في الدورة.');
    await ctx.editMessageCaption(`✅ تم تأكيد الدفع بنجاح بواسطة ${ctx.from.first_name}.`);
    ctx.answerCbQuery('تم إرسال التأكيد للمستخدم بنجاح.');
  } catch (e) {
    console.error('Failed to approve payment:', e);
    ctx.answerCbQuery('فشل الإجراء. ربما حظر المستخدم البوت.', { show_alert: true });
  }
});

// --- رفض الدفع ---
bot.action(/reject_pay_(\d+)/, async (ctx) => {
  if (!isAdmin(ctx)) return;
  const userId = ctx.match[1];
  try {
    await bot.telegram.sendMessage(userId, `عذراً، تم رفض إيصال الدفع الخاص بك. يرجى التواصل مع المشرف لمعرفة السبب: @${ADMIN_USERNAME}`);
    await ctx.editMessageCaption(`❌ تم رفض الطلب بواسطة ${ctx.from.first_name}.`);
    ctx.answerCbQuery('تم إعلام المستخدم بالرفض.');
  } catch (e) {
    console.error('Failed to reject payment:', e);
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

bot.launch(() => console.log('Bot is up and running with the classic layout and open payment system!'));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
