// notify.js — sends a Telegram message to the store owner when an order is placed.
// Coded by khalid_dev. No interactivity — pure notify-on-purchase.
const https = require('https');

const BOT_TOKEN = process.env.STORE_BOT_TOKEN || '8966561171:AAFkAoVXyln1vhe5offIo7gTBZaCKzh22AE';
const OWNER_ID = 8333953794;

function sendTelegram(text) {
  const payload = JSON.stringify({ chat_id: OWNER_ID, text, parse_mode: 'HTML' });
  const req = https.request({
    hostname: 'api.telegram.org',
    path: `/bot${BOT_TOKEN}/sendMessage`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
  }, (r) => { r.resume(); });
  req.on('error', (e) => console.error('[notify] telegram error:', e.message));
  req.write(payload);
  req.end();
}

function notifyOrder(order) {
  const amt = (order.amount / 100).toLocaleString('en-NG', { style: 'currency', currency: 'NGN' });
  const msg =
    `🔔 <b>NAIJADIMHUB — NEW ORDER</b>\n` +
    `🧾 Code: <code>${order.code}</code>\n` +
    `🎮 Item: ${order.item}\n` +
    `💰 Amount: ${amt}\n` +
    `👤 Name: ${order.name}\n` +
    `📱 WhatsApp: ${order.whatsapp}\n` +
    `✉️ Email: ${order.email}\n` +
    `🆔 Game UID: ${order.uid || '-'}\n` +
    `📝 Note: ${order.note || '-'}`;
  sendTelegram(msg);
}

module.exports = { notifyOrder };
