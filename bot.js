
import { Telegraf, Markup } from 'telegraf';
import { message } from 'telegraf/filters';
import http from 'http';

// --- Environment Variables ---
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = 7796750723; // Your Telegram Admin ID
const PORT = process.env.PORT || 3000;

// --- Constants for Pricing and Bank Details ---
const ORIGINAL_PRICE = '960 SAR';
const DISCOUNT_PRICE = '30 SAR';
const OFFER_NAME = '✨ عرض رمضان المميز ✨';
const BANK_DETAILS = `
Bank: Al-Rajhi Bank
Account Number: 12345678901234
Account Holder: Ahmed Al-Khayr
`;

if (!BOT_TOKEN) {
  console.error('BOT_TOKEN is not set in environment variables.');
  process.exit(1);
}

// --- In-Memory Storage ---
const userRegistration = new Map(); // Stores { name, phone, country }
const userState = new Map(); // Tracks user's current action, e.g., 'awaiting_payment_receipt'

// --- Bot Initialization ---
const bot = new Telegraf(BOT_TOKEN);

// --- Welcome Message and Main Menu ---
bot.start((ctx) => {
  console.log(`New user started the bot: ${ctx.from.username} (${ctx.from.id})`);
  ctx.reply(
    'مرحبًا بك في البوت! الرجاء اختيار أحد الخيارات:',
    Markup.inlineKeyboard([
      [Markup.button.callback('📝 التسجيل في الدورة', 'REGISTER')],
      [Markup.button.callback('📚 الحصول على الكتاب', 'GET_BOOK')],
      [Markup.button.url('🔗 رابط المجموعة', 'https://t.me/+AgZ-nk1D5-84MTBk')],
      [Markup.button.url('🔗 رابط القناة', 'https://t.me/+9znDAa3NsKNhZjlk')],
      [Markup.button.callback('💰 دفع الرسوم', 'SEND_PAYMENT')],
      [Markup.button.callback('📞 التواصل مع المشرف', 'CONTACT_ADMIN')],
    ])
  );
});

// --- Registration Action (Now Disabled) ---
bot.action('REGISTER', (ctx) => {
  console.log(`Button pressed: REGISTER by ${ctx.from.username}`);
  ctx.reply('التسجيل مغلق حاليًا. يرجى التواصل مع المشرف للاستفسار: t.me/ahmed_khyr');
});

// --- Get Book Action ---
bot.action('GET_BOOK', async (ctx) => {
    console.log(`Button pressed: GET_BOOK by ${ctx.from.username}`);
    try {
      await ctx.reply('جاري تحضير الكتاب...');
      await ctx.replyWithDocument({ source: 'Headway-Beginner-Students-Book-5th-edition-2019-146p.pdf' });
    } catch (error) {
      console.error("Error sending book:", error);
      ctx.reply('عذراً، حدث خطأ أثناء إرسال الكتاب. تأكد من وجود الملف أو تواصل مع المشرف.');
    }
});

// --- Payment Flow Action ---
bot.action('SEND_PAYMENT', (ctx) => {
  console.log(`Button pressed: SEND_PAYMENT by ${ctx.from.username}`);
  const userId = ctx.from.id;

  // Mock user registration data for testing
  if (!userRegistration.has(userId)) {
      userRegistration.set(userId, { name: 'Ahmed Khayr', phone: '+966500000000', country: 'Saudi Arabia' });
  }

  if (!userRegistration.has(userId)) {
    ctx.reply('يجب عليك التسجيل أولاً. التسجيل مغلق حاليًا, يرجى التواصل مع المشرف: t.me/ahmed_khyr');
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
  userState.set(userId, 'awaiting_payment_receipt');
});

// --- Contact Admin Action ---
bot.action('CONTACT_ADMIN', (ctx) => {
  console.log(`Button pressed: CONTACT_ADMIN by ${ctx.from.username}`);
  ctx.reply('يمكنك التواصل مع المشرف هنا: t.me/ahmed_khyr');
});

// --- Photo & Document Message Handler (for Payment Receipts) ---
bot.on([message('photo'), message('document')], async (ctx) => {
  const userId = ctx.from.id;

  if (userState.get(userId) !== 'awaiting_payment_receipt') {
    return; // Ignore unexpected files
  }
  
  console.log(`Payment receipt received from: ${ctx.from.username} (${userId})`);

  const userData = userRegistration.get(userId);
  if(!userData){
      console.error('Could not find user registration data for payment receipt.');
      ctx.reply('حدث خطأ، لم أجد بيانات التسجيل الخاصة بك. الرجاء التواصل مع المشرف.');
      return;
  }

  const adminCaption = `
🧾 **إيصال دفع جديد**

**الاسم:** ${userData.name}
**الدولة:** ${userData.country}
**رقم الهاتف:** ${userData.phone}
**معرّف المستخدم:** \`${userId}\`
`;
  
  const adminReplyMarkup = {
    inline_keyboard: [
      [Markup.button.callback('✅ قبول وتأكيد', `approve_${userId}`)]
    ]
  };

  try {
    // Forward photo or document to admin with user details
    if (ctx.message.photo) {
        const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
        await ctx.telegram.sendPhoto(ADMIN_ID, fileId, {
            caption: adminCaption,
            parse_mode: 'Markdown',
            reply_markup: adminReplyMarkup
        });
    } else if (ctx.message.document) {
        const fileId = ctx.message.document.file_id;
        await ctx.telegram.sendDocument(ADMIN_ID, fileId, {
            caption: adminCaption,
            parse_mode: 'Markdown',
            reply_markup: adminReplyMarkup
        });
    }

    ctx.reply('✅ تم استلام إيصال الدفع الخاص بك، وسيتم مراجعته وتأكيده من قبل المشرف قريبًا.');
  
  } catch(error) {
      console.error('Error forwarding receipt to admin:', error);
      ctx.reply('عذراً، حدث خطأ أثناء إرسال الإيصال للمشرف.');
  } finally {
      userState.delete(userId); // Clear user state after processing
  }
});

// --- Admin Approval Action ---
bot.action(/approve_(\d+)/, async (ctx) => {
  if (ctx.from.id.toString() !== ADMIN_ID.toString()) {
    return ctx.answerCbQuery('خاص بالمشرف فقط.');
  }

  const userIdToApprove = ctx.match[1];
  console.log(`Admin ${ctx.from.id} approved payment for user ${userIdToApprove}`);

  try {
    // Notify the user about the approval
    await ctx.telegram.sendMessage(userIdToApprove, '🎉 تهانينا! تم تأكيد دفعك بنجاح. أهلاً بك في الدورة.');

    // Update the admin's message to show confirmation
    await ctx.editMessageCaption('✅ تم تأكيد الدفع بنجاح.');

    ctx.answerCbQuery('تم إرسال التأكيد للمستخدم بنجاح.');

  } catch (error) {
    console.error('Failed to notify user or edit message:', error);
    ctx.answerCbQuery('حدث خطأ. ربما قام المستخدم بحظر البوت.');
  }
});


// --- Text Message Handler (for registration flow, currently inactive) ---
bot.on(message('text'), (ctx) => {
  const userId = ctx.from.id;
  if (userRegistration.has(userId) && !userRegistration.get(userId).country) {
      const text = ctx.message.text;
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

// --- Start the Bot & Web Server ---
bot.launch(() => {
  console.log('Bot is up and running!');
});

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot server is running to keep the service alive.');
});

server.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});

// --- Graceful Shutdown ---
process.once('SIGINT', () => { bot.stop('SIGINT'); server.close(); });
process.once('SIGTERM', () => { bot.stop('SIGTERM'); server.close(); });
