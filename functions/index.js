const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

// Environment variables
const token = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;
const PRICE = process.env.PRICE;
const GROUP_LINK = process.env.GROUP_LINK;
const CHANNEL_LINK = process.env.CHANNEL_LINK;
const COURSE_LINK = process.env.COURSE_LINK;
const PAYMENT_PROVIDER_TOKEN = process.env.PAYMENT_PROVIDER_TOKEN;

// Basic validation for environment variables
if (!token || !ADMIN_ID || !PRICE || !GROUP_LINK || !CHANNEL_LINK || !COURSE_LINK || !PAYMENT_PROVIDER_TOKEN) {
    console.error('One or more environment variables are missing. Please check your configuration.');
    process.exit(1);
}

let bot;

// --- BOT INITIALIZATION ---
// Use webhook for production on Render, and polling for local development
if (process.env.RENDER_EXTERNAL_URL) {
    bot = new TelegramBot(token);
    const webhookUrl = `${process.env.RENDER_EXTERNAL_URL}/bot${token}`;
    bot.setWebHook(webhookUrl).then(() => console.log(`Webhook set to ${webhookUrl}`));
} else {
    bot = new TelegramBot(token, { polling: true });
    console.log('Bot is running with polling for local development');
}

// --- LOGGING MIDDLEWARE ---
bot.on('message', (msg) => {
    if (msg.from) {
        console.log(`Received message from: ${msg.from.first_name || ''} ${msg.from.last_name || ''} (ID: ${msg.from.id})`);
    }
});

// --- COMMANDS AND MESSAGE HANDLING ---

// /start command
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const welcomeMessage = `
أهلاً بك في بوت التواصل!

بوت بسيط للتواصل مع الأدمن وشراء كتابنا.

يمكنك إرسال رسالتك وسيتم تحويلها مباشرةً للأدمن للرد عليك.
`;

    const opts = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: 'قناة التليجرام', url: CHANNEL_LINK },
                    { text: 'جروب التليجرام', url: GROUP_LINK }
                ],
                [
                    { text: '💰 شراء الكتاب', callback_data: 'buy_book' }
                ]
            ]
        }
    };

    bot.sendMessage(chatId, welcomeMessage, opts);
});

// /course command
bot.onText(/\/course/, (msg) => {
    const chatId = msg.chat.id;
    const courseMessage = `
اتبع هذا الرابط للوصول إلى الدورة:
${COURSE_LINK}
`;
    bot.sendMessage(chatId, courseMessage);
});


// --- CALLBACK QUERY HANDLING (BUTTONS) ---
bot.on('callback_query', (callbackQuery) => {
    const msg = callbackQuery.message;
    const data = callbackQuery.data;
    const chatId = msg.chat.id;

    if (data === 'buy_book') {
        const invoice = {
            title: 'شراء الكتاب',
            description: 'كتابنا التعليمي الشامل',
            payload: 'Custom-Payload-Book-Purchase',
            provider_token: PAYMENT_PROVIDER_TOKEN,
            start_parameter: 'buy-book-parameter',
            currency: 'USD',
            prices: [{ label: 'سعر الكتاب', amount: PRICE * 100 }] // Price is in cents
        };

        bot.sendInvoice(
            chatId,
            invoice.title,
            invoice.description,
            invoice.payload,
            invoice.provider_token,
            invoice.start_parameter,
            invoice.currency,
            invoice.prices
        ).catch((error) => {
            console.error('Error sending invoice:', error.response.body);
            bot.sendMessage(chatId, 'عذراً، حدث خطأ أثناء محاولة إنشاء فاتورة الدفع. يرجى المحاولة مرة أخرى لاحقاً.');
        });
    }
});

// --- PAYMENT HANDLING ---

// Handle pre-checkout queries (required for payments)
bot.on('pre_checkout_query', (preCheckoutQuery) => {
    bot.answerPreCheckoutQuery(preCheckoutQuery.id, true)
        .catch((error) => {
            console.error('Error answering pre-checkout query:', error);
        });
});

// Handle successful payments
bot.on('successful_payment', (msg) => {
    const chatId = msg.chat.id;
    console.log(`Successful payment from ${msg.from.first_name}:`, msg.successful_payment);
    bot.sendMessage(chatId, 'شكراً لك على عملية الشراء! لقد تم الدفع بنجاح. سيتم ارسال الكتاب لك.');

    // Notify admin about the successful payment
    const adminMessage = `
🎉 دفعة ناجحة!

المستخدم: ${msg.from.first_name || ''} ${msg.from.last_name || ''} (ID: ${msg.from.id})
المبلغ: ${msg.successful_payment.total_amount / 100} ${msg.successful_payment.currency}
    `;
    bot.sendMessage(ADMIN_ID, adminMessage);
});


// --- MESSAGE FORWARDING ---

// Forward user messages to admin
bot.on('message', (msg) => {
    const chatId = msg.chat.id;

    // Ignore commands, forwarded messages, and messages from the admin to themself
    if (msg.text && msg.text.startsWith('/') || msg.forward_from || chatId.toString() === ADMIN_ID) {
        return;
    }

    // Forward any other message to the admin
    bot.forwardMessage(ADMIN_ID, chatId, msg.message_id).catch((error) => {
        console.error('Failed to forward message:', error);
    });
    bot.sendMessage(chatId, 'تم إرسال رسالتك إلى الأدمن. سيتم الرد عليك قريباً.');
});

// Forward admin's reply to the user
bot.on('message', (msg) => {
    const chatId = msg.chat.id;

    if (chatId.toString() === ADMIN_ID && msg.reply_to_message && msg.reply_to_message.forward_from) {
        const originalSenderId = msg.reply_to_message.forward_from.id;
        // Send the admin's message text as a new message to the original user
        bot.sendMessage(originalSenderId, msg.text).then(() => {
            bot.sendMessage(ADMIN_ID, '✅ تم إرسال ردك إلى المستخدم.');
        }).catch((error) => {
            console.error('Failed to send reply:', error);
            bot.sendMessage(ADMIN_ID, '⚠️ فشل إرسال الرد. قد يكون المستخدم قد حظر البوت.');
        });
    }
});


// --- EXPRESS SERVER FOR WEBHOOK ---
if (process.env.RENDER_EXTERNAL_URL) {
    const app = express();
    app.use(express.json());

    // We are receiving updates at the route below!
    app.post(`/bot${token}`, (req, res) => {
        bot.processUpdate(req.body);
        res.sendStatus(200);
    });

    const port = process.env.PORT || 3000;
    app.listen(port, () => {
        console.log(`Express server is listening on port ${port}`);
    });
}
