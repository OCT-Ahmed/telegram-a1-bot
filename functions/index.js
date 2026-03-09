
const express = require("express");
const TelegramBot = require("node-telegram-bot-api");

// Ensure the bot token is provided
if (!process.env.BOT_TOKEN) {
  console.error("ERROR: BOT_TOKEN environment variable is not set.");
  process.exit(1);
}
const token = process.env.BOT_TOKEN;

// When deploying, Render sets the WEBHOOK_URL environment variable
// We'll use polling if it's not set (for local development)
const options = process.env.RENDER_EXTERNAL_URL
  ? { webHook: { port: process.env.PORT || 3000 } }
  : { polling: true };

const bot = new TelegramBot(token, options);

// If we're using a webhook, set it up
if (options.webHook) {
  const webhookUrl = `${process.env.RENDER_EXTERNAL_URL}/bot${token}`;
  bot.setWebHook(webhookUrl);
  console.log(`Webhook set to ${webhookUrl}`);
}


const app = express();
app.use(express.json());

// We are receiving updates at the route below!
app.post(`/bot${token}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Bot message listeners
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

// Start the server if not in a serverless environment
if (!options.webHook) {
    app.listen(3000, () => {
        console.log(`Server is listening on port 3000`);
    });
}
