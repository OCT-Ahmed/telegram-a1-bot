
/**
 * @file src/ui/messages.js
 * @description Contains all message templates sent by the bot.
 *
 * Input: Data such as user details, course information, or bank details.
 * Output: Formatted message strings ready to be sent to the user.
 */

import { escapeHTML } from '../utils.js';
import * as C from '../config.js';

export const welcome = `
👋 أهلاً بك في بوت دورة اللغة الإنجليزية!

هذا البوت هو مساعدك الشخصي. من خلاله يمكنك:
- 📝 التسجيل في الدورة
- 📚 تحميل الكتاب التعليمي
- 💰 إرسال إثبات الدفع`;

export const selectLevel = `
${C.OFFER_NAME}

يرجى اختيار المستوى الذي ترغب بالتسجيل فيه:
`;

export function paymentDetails(course) {
  if (!course || !course.price) {
      return 'حدث خطأ. يرجى اختيار المستوى أولاً من خلال أمر /register.';
  }
  
  let bankDetailsParts = [];
  if (C.BANK_ACCOUNT_HOLDER) bankDetailsParts.push(`<b>اسم صاحب الحساب:</b> ${escapeHTML(C.BANK_ACCOUNT_HOLDER)}`);
  if (C.BANK_ACCOUNT_NUMBER) bankDetailsParts.push(`<b>رقم الحساب:</b> ${escapeHTML(C.BANK_ACCOUNT_NUMBER)}`);
  if (C.BANK_ACCOUNT_IBAN) bankDetailsParts.push(`<b>IBAN:</b> ${escapeHTML(C.BANK_ACCOUNT_IBAN)}`);
  const bankDetailsText = bankDetailsParts.length > 0 ? bankDetailsParts.join('\n') : 'تفاصيل الحساب غير متوفرة. تواصل مع المشرف.';

  return `
${C.OFFER_NAME} - ${escapeHTML(course.name)}

🏦 <b>تفاصيل الدفع</b>
<b>السعر الأصلي:</b> <s>${C.ORIGINAL_PRICE}</s>
<b>سعر العرض:</b> <strong>${course.price}</strong>
<b>مدة الدورة:</b> ${escapeHTML(course.duration)}

<b>طريقة الدفع:</b> تحويل بنكي
${bankDetailsText}
---
الرجاء إرسال صورة أو ملف (PDF) لإيصال الدفع للمتابعة.
`;
}

export function registrationNotification(userData, from) {
  const level = userData.level ? C.COURSES[userData.level].name : 'غير محدد';
  return `🆕 <b>طلب تسجيل جديد</b>\n\n<b>المستوى:</b> ${escapeHTML(level)}\n<b>الاسم:</b> ${escapeHTML(userData.name)}\n<b>الهاتف:</b> ${escapeHTML(userData.phone)}\n<b>الدولة:</b> ${escapeHTML(userData.country)}\n<b>المستخدم:</b> @${escapeHTML(from.username) || 'N/A'}\n<b>المعرّف:</b> <code>${from.id}</code>`;
}

export function paymentNotification(userData, from) {
  const level = userData.level ? C.COURSES[userData.level].name : 'غير محدد';
  return `🧾 <b>إيصال دفع جديد</b>\n\n<b>المستوى:</b> ${escapeHTML(level)}\n<b>الاسم:</b> ${escapeHTML(userData.name)}\n<b>الهاتف:</b> ${escapeHTML(userData.phone)}\n<b>الدولة:</b> ${escapeHTML(userData.country)}\n<b>المستخدم:</b> @${escapeHTML(from.username) || 'N/A'}\n<b>المعرّف:</b> <code>${from.id}</code>`;
}
