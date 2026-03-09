
const functions = require("firebase-functions");
const express = require("express");
const TelegramBot = require("node-telegram-bot-api");

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token);

const app = express();

app.use(express.json());

app.post("/", (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

exports.bot = functions.https.onRequest(app);

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "مرحبا بك");
});

bot.onText(/\/quiz/, (msg) => {
  bot.sendPoll(
    msg.chat.id,
    "What is \"أنا\" in Arabic",
    ["You", "I", "He", "She"],
    {
      type: "quiz",
      correct_option_id: 1,
      explanation: "Explanation",
      is_anonymous: false
    }
  );
});

// Set the webhook
const webhookUrl = `https://us-central1-${process.env.GCLOUD_PROJECT}.cloudfunctions.net/bot`;
bot.setWebHook(webhookUrl);
