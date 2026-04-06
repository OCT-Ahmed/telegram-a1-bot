
/**
 * @file src/utils.js
 * @description Utility functions for text sanitization and other helpers.
 * 
 * Input: Raw strings.
 * Output: Sanitized strings safe for use in Telegram API calls.
 */

/**
 * Escapes characters for Telegram's HTML mode.
 * This is crucial to prevent formatting errors when user-provided text
 * contains special characters like <, >, or &.
 * @param {string} text The text to escape.
 * @returns {string} The escaped text.
 */
export function escapeHTML(text) {
  if (text === null || typeof text === 'undefined') {
    return '';
  }
  return text.toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
