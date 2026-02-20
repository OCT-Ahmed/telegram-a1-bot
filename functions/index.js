// calling Telegram Library
// require means import something from a library 
const TelegramBot = require('node-telegram-bot-api');

const express = require('express');

// ========= The Server ========
// we'll make it to replay with any simple response
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send("Bot is running!");
});

app.listen(PORT, () => {
    console.log("Server started on port 3000");
});

// ========= The Bot ========
// put the token
const token = process.env.BOT_TOKEN;

// create a bot and tell him to lesten for messages
// polling means checking for new messages
const bot = new TelegramBot(token, {polling: true});

// Welcoming message when user sends /start
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, "Hi, I'm A1 course bot 👋");
});

// sending a question when writing /quiz
bot.onText(/\/quiz/, (msg) => {
    bot.sendPoll(
        msg.chat.id,
        `What is "أنا" in Arabic`,
        ["You", "I", "He", "She"],
        {
            type: "quiz",
            correct_option_id: 1, // The correct answer
            explanation: "Explanation",
            is_anonymous: false
        }
    );
});