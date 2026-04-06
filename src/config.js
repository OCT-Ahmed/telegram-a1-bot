
/**
 * @file src/config.js
 * @description Central configuration file for the bot.
 * 
 * Input: Reads environment variables from the server/platform (e.g., Render).
 * Output: Exports configuration constants to be used across the application.
 * 
 * This file consolidates all environment-dependent variables and fixed constants,
 * making it easy to manage and update bot settings from one place.
 */

// Load environment variables
import { config } from 'dotenv';
config();

// --- Core Bot Settings ---
export const BOT_TOKEN = process.env.BOT_TOKEN;
export const ADMIN_ID = process.env.ADMIN_ID;
export const PORT = process.env.PORT || 3000;

// --- Group IDs ---
export const REGISTRATION_GROUP_ID = process.env.REGISTRATION_GROUP_ID;
export const PAYMENT_GROUP_ID = process.env.PAYMENT_GROUP_ID;

// --- Bank Account Details ---
export const BANK_ACCOUNT_HOLDER = process.env.BANK_ACCOUNT_HOLDER;
export const BANK_ACCOUNT_NUMBER = process.env.BANK_ACCOUNT_NUMBER;
export const BANK_ACCOUNT_IBAN = process.env.BANK_ACCOUNT_IBAN;

// --- Course & Offer Details ---
export const ORIGINAL_PRICE = '960 SAR';
export const OFFER_NAME = '✨ عرض شهر أبريل ✨';

export const COURSES = {
  BEGINNER: {
    key: 'BEGINNER',
    name: 'مستوى المبتدئين (Beginners)',
    price: '450 SAR',
    duration: 'شهر ونصف إلى شهرين ونصف',
  },
  OTHER: {
    key: 'OTHER',
    name: 'المستويات الأخرى',
    price: '750 SAR',
    duration: 'شهرين',
  }
};


// --- Contact & Links ---
export const ADMIN_USERNAME = 'ahmed_khyr';
export const GROUP_LINK = 'https://t.me/+AgZ-nk1D5-84MTBk';
export const CHANNEL_LINK = 'https://t.me/+9znDAa3NsKNhZjlk';
