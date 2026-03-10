
import { Telegraf, Markup } from 'telegraf';
import { message } from 'telegraf/filters';
import http from 'http';

// =================================================================================================
// --- البيئة والمتغيرات الأساسية (Environment Variables) ---
// =================================================================================================

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID; // Your numeric Telegram User ID

// --- معرفات المجموعات (Group IDs) ---
//هام: يجب أن يبدأ المعرف بـ -100. احصل عليه بإضافة البوت للمجموعة ثم زيارة الرابط:
// https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates
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

// ملاحظة: هذا التخزين مؤقت وسيتم مسحه عند إعادة تشغيل البوت.
// في المشاريع الحقيقية، استخدم قاعدة بيانات مثل Redis أو PostgreSQL.
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
]);


// =================================================================================================
// --- معالجات الأوامر الرئيسية (Command Handlers) ---
// =================================================================================================

// --- الأمر /start ---
bot.start((ctx) => {
  // تجاهل الأمر إذا تم استخدامه داخل مجموعة
  if (ctx.chat.type !== 'private') {
    return;
  }

  console.log(`New user started: ${ctx.from.username} (${ctx.from.id})`);

  // رسالة ترحيبية شاملة عند أول استخدام للبوت
  const welcomeMessage = `
👋 أهلاً بك في بوت دورة اللغة الإنجليزية!

هذا البوت هو مساعدك الشخصي للتسجيل في دورتنا. من خلاله يمكنك:
  - 📝 التسجيل في الدورة
  - 📚 تحميل الكتاب التعليمي
  - 💰 إرسال إثبات الدفع

اضغط على أحد الخيارات في الأسفل للبدء.
  `;
  ctx.reply(welcomeMessage);

  // عرض القائمة الرئيسية بعد الرسالة الترحيبية
  showMainMenu(ctx);
});

// --- أوامر أخرى ---
bot.command('register', (ctx) => handleRegistration(ctx));
bot.command('book', (ctx) => handleGetBook(ctx));
bot.command('pay', (ctx) => handlePayment(ctx));
bot.command('contact', (ctx) => handleContactAdmin(ctx));


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

// --- عرض القائمة الرئيسية ---
function showMainMenu(ctx) {
  ctx.reply(
    'الرجاء اختيار أحد الخيارات:',
    Markup.inlineKeyboard([
      [Markup.button.callback('📝 التسجيل في الدورة', 'REGISTER')],
      [Markup.button.callback('📚 الحصول على الكتاب', 'GET_BOOK')],
      [Markup.button.url('🔗 رابط المجموعة', 'https://t.me/+AgZ-nk1D5-84MTBk')],
      [Markup.button.url('🔗 رابط القناة', 'https://t.me/+9znDAa3NsKNhZjlk')],
      [Markup.button.callback('💰 دفع الرسوم', 'SEND_PAYMENT')],
      [Markup.button.callback('📞 التواصل مع المشرف', 'CONTACT_ADMIN')],
    ])
  );
}

// --- بدء عملية التسجيل ---
function handleRegistration(ctx) {
  console.log(`Registration initiated by: ${ctx.from.username} (${ctx.from.id})`);
  userState.set(ctx.from.id, 'awaiting_name');
  // نستخدم answerCbQuery() إذا كان المصدر زرًا، لإيقاف علامة التحميل
  if (ctx.callbackQuery) ctx.answerCbQuery();
  ctx.reply('لبدء التسجيل، الرجاء إدخال اسمك الكامل:');
}

// --- الحصول على الكتاب ---
async function handleGetBook(ctx) {
  console.log(`Book request by: ${ctx.from.username} (${ctx.from.id})`);
  if (ctx.callbackQuery) ctx.answerCbQuery();
  try {
    await ctx.reply('جاري تحضير الكتاب...');
    // تأكد من وجود الملف بالاسم الصحيح في نفس مجلد المشروع
    await ctx.replyWithDocument({ source: 'Headway-Beginner-Students-Book-5th-edition-2019-146p.pdf' });
  } catch (error) {
    console.error("Error sending book:", error);
    ctx.reply('عذراً، حدث خطأ أثناء إرسال الكتاب. تأكد من وجود الملف أو تواصل مع المشرف.');
  }
}

// --- بدء عملية الدفع ---
function handlePayment(ctx) {
  console.log(`Payment initiated by: ${ctx.from.username} (${ctx.from.id})`);
  const userId = ctx.from.id;
  if (ctx.callbackQuery) ctx.answerCbQuery();

  // يجب أن يكون المستخدم مسجلاً أولاً
  if (!userRegistration.has(userId)) {
    ctx.reply('يجب عليك التسجيل أولاً. استخدم الأمر /register للتسجيل.');
    return;
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
  // تحديد حالة المستخدم بأنه سيرسل إيصال الدفع
  userState.set(userId, 'awaiting_payment_receipt');
}

// --- التواصل مع المشرف ---
function handleContactAdmin(ctx) {
  if (ctx.callbackQuery) ctx.answerCbQuery();
  ctx.reply(`يمكنك التواصل مع المشرف مباشرة عبر هذا المعرف: @${ADMIN_USERNAME}`);
}


// =================================================================================================
// --- معالجات الرسائل المدخلة (Message Input Handlers) ---
// =================================================================================================

// --- معالج إدخال النصوص (للتسجيل) ---
bot.on(message('text'), async (ctx) => {
  const userId = ctx.from.id;
  const currentState = userState.get(userId);

  // تجاهل أي نص إذا لم يكن المستخدم في حالة التسجيل
  if (!currentState || !currentState.startsWith('awaiting_')) {
    return;
  }

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
      userState.delete(userId); // إنهاء حالة التسجيل
      
      ctx.reply('✅ اكتمل التسجيل بنجاح! شكرًا لك.');
      console.log(`New registration completed: ${JSON.stringify(userData)}`);

      // إرسال تفاصيل التسجيل إلى مجموعة التسجيل الخاصة
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
          await bot.telegram.sendMessage(REGISTRATION_GROUP_ID, registrationDetails, { parse_mode: 'Markdown' });
        } catch (e) {
          console.error('Failed to send registration to group:', e);
        }
      } else {
        console.warn('REGISTRATION_GROUP_ID is not set. Skipping notification.');
      }
      break;
  }
});


// --- معالج إيصالات الدفع (صور ومستندات) ---
bot.on([message('photo'), message('document')], async (ctx) => {
  const userId = ctx.from.id;

  // التأكد من أن المستخدم في حالة إرسال الإيصال
  if (userState.get(userId) !== 'awaiting_payment_receipt') {
    return; 
  }
  
  console.log(`Payment receipt received from: ${ctx.from.username} (${userId})`);

  const userData = userRegistration.get(userId);
  if (!userData) {
      console.error('Could not find user registration data for payment receipt.');
      ctx.reply('حدث خطأ، لم أجد بيانات التسجيل الخاصة بك. الرجاء التواصل مع المشرف.');
      return;
  }

  // إعداد الرسالة التي سترسل للمشرفين في مجموعة الدفع
  const adminCaption = `
🧾 **إيصال دفع جديد**

**الاسم:** ${userData.name}
**الهاتف:** ${userData.phone}
**الدولة:** ${userData.country}
**المستخدم:** @${ctx.from.username || 'N/A'}
**المعرّف:** \`${userId}\`
`;
  
  // أزرار القبول والرفض للمشرف
  const adminReplyMarkup = {
    inline_keyboard: [
      [
        Markup.button.callback('✅ قبول', `approve_${userId}`),
        Markup.button.callback('❌ رفض', `reject_${userId}`)
      ]
    ]
  };

  // إرسال الإيصال إلى مجموعة الدفع
  if (PAYMENT_GROUP_ID) {
    try {
      const fileType = ctx.message.photo ? 'photo' : 'document';
      const fileId = fileType === 'photo' 
        ? ctx.message.photo[ctx.message.photo.length - 1].file_id 
        : ctx.message.document.file_id;

      if (fileType === 'photo') {
        await bot.telegram.sendPhoto(PAYMENT_GROUP_ID, fileId, {
            caption: adminCaption, parse_mode: 'Markdown', reply_markup: adminReplyMarkup
        });
      } else {
        await bot.telegram.sendDocument(PAYMENT_GROUP_ID, fileId, {
            caption: adminCaption, parse_mode: 'Markdown', reply_markup: adminReplyMarkup
        });
      }

      ctx.reply('✅ تم استلام إيصال الدفع الخاص بك، وسيتم مراجعته وتأكيده من قبل المشرف قريبًا.');
    
    } catch(error) {
        console.error('Error forwarding receipt to admin group:', error);
        ctx.reply('عذراً، حدث خطأ أثناء إرسال الإيصال للمشرف.');
    }
  } else {
    console.warn("PAYMENT_GROUP_ID is not set. Skipping notification.");
    ctx.reply("عذراً، خدمة استقبال الدفع غير متاحة حالياً. يرجى التواصل مع المشرف.");
  }

  userState.delete(userId); // إنهاء حالة انتظار الإيصال
});


// =================================================================================================
// --- معالجات قرارات المشرف (Admin Decision Handlers) ---
// =================================================================================================

// --- معالج زر القبول ---
bot.action(/approve_(\d+)/, async (ctx) => {
  // التأكد من أن المستخدم هو المشرف المحدد
  if (ctx.from.id.toString() !== ADMIN_ID.toString()) {
    return ctx.answerCbQuery('خاص بالمشرف فقط.', { show_alert: true });
  }

  const userIdToApprove = ctx.match[1];
  const adminName = ctx.from.first_name;

  console.log(`Admin ${adminName} approved payment for user ${userIdToApprove}`);

  try {
    // إعلام المستخدم بالموافقة
    await bot.telegram.sendMessage(userIdToApprove, '🎉 تهانينا! تم تأكيد دفعك بنجاح. أهلاً بك في الدورة.');

    // تحديث الرسالة في مجموعة الدفع لتأكيد القبول
    await ctx.editMessageCaption(`✅ تم تأكيد الدفع بنجاح بواسطة ${adminName}.`);

    ctx.answerCbQuery('تم إرسال التأكيد للمستخدم بنجاح.');

  } catch (error) {
    console.error('Failed to notify user or edit message:', error);
    ctx.answerCbQuery('حدث خطأ. ربما قام المستخدم بحظر البوت.', { show_alert: true });
  }
});

// --- معالج زر الرفض ---
bot.action(/reject_(\d+)/, async (ctx) => {
  // التأكد من أن المستخدم هو المشرف المحدد
  if (ctx.from.id.toString() !== ADMIN_ID.toString()) {
    return ctx.answerCbQuery('خاص بالمشرف فقط.', { show_alert: true });
  }

  const userIdToReject = ctx.match[1];
  const adminName = ctx.from.first_name;

  console.log(`Admin ${adminName} rejected payment for user ${userIdToReject}`);

  try {
    // إعلام المستخدم بالرفض
    await bot.telegram.sendMessage(userIdToReject, `عذراً، تم رفض إيصال الدفع الخاص بك. يرجى التواصل مع المشرف لمعرفة السبب: @${ADMIN_USERNAME}`);

    // تحديث الرسالة في مجموعة الدفع لتأكيد الرفض
    await ctx.editMessageCaption(`❌ تم رفض الطلب بواسطة ${adminName}.`);

    ctx.answerCbQuery('تم إعلام المستخدم بالرفض.');

  } catch (error) {
    console.error('Failed to notify user about rejection:', error);
    ctx.answerCbQuery('حدث خطأ. ربما قام المستخدم بحظر البوت.', { show_alert: true });
  }
});


// =================================================================================================
// --- تشغيل الخادم والبوت (Server and Bot Launch) ---
// =================================================================================================

// --- خادم ويب بسيط لإبقاء البوت فعالاً على منصات مثل Render ---
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot server is running.');
});

server.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});

// --- تشغيل البوت ---
bot.launch(() => {
  console.log('Bot is up and running with all new features!');
});

// --- معالجة إيقاف البوت بأمان ---
process.once('SIGINT', () => { bot.stop('SIGINT'); server.close(); });
process.once('SIGTERM', () => { bot.stop('SIGTERM'); server.close(); });
