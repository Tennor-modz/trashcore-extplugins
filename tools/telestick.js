// ============================================================
//  TRASHCORE ULTRA — External Plugin
//  tools/telestick.js  |  Telegram Sticker Pack Downloader
//
//  Usage: .telestick https://t.me/addstickers/PackName
//  Sends all stickers from a Telegram sticker pack to WhatsApp
// ============================================================

const axios = require('axios');

const telestick = {
  command:  ['telestick', 'tgsticker', 'tgstick'],
  desc:     'Download & send all stickers from a Telegram sticker pack',
  category: 'Tools',

  run: async ({ trashcore, m, args, text, xreply }) => {
    const input = args[0]?.trim();

    if (!input) {
      return xreply(
        `🎭 *Telegram Sticker Pack*\n\n` +
        `Usage: *.telestick <t.me/addstickers/PackName>*\n` +
        `Example: *.telestick https://t.me/addstickers/Beluga887*`
      );
    }

    const packUrl = input.startsWith('http')
      ? input
      : `https://t.me/addstickers/${input}`;

    await xreply('⏳ Fetching sticker pack...');

    let result;
    try {
      const apiUrl = `https://api.nexray.web.id/tools/telegram-sticker?url=${encodeURIComponent(packUrl)}`;
      const { data } = await axios.get(apiUrl, { timeout: 30000 });

      if (!data.status || !data.result) {
        return xreply('❌ Failed to fetch sticker pack. Check the link and try again.');
      }
      result = data.result;
    } catch (e) {
      return xreply(`❌ API error: ${e.message}`);
    }

    const stickers = result.sticker || [];
    if (!stickers.length) return xreply('❌ No stickers found in this pack.');

    const staticStickers = stickers.filter(s => !s.url.endsWith('.webm'));
    const skipped = stickers.length - staticStickers.length;

    await xreply(
      `📦 *${result.title}* \`(${result.name})\`\n` +
      `🎭 Type: ${result.sticker_type}\n` +
      `📊 Total: ${stickers.length} stickers` +
      (skipped > 0 ? ` (${skipped} animated skipped)` : '') +
      `\n\n⏳ Sending ${staticStickers.length} stickers...`
    );

    let sent = 0;
    let failed = 0;

    for (const sticker of staticStickers) {
      try {
        const response = await axios.get(sticker.url, {
          responseType: 'arraybuffer',
          timeout: 15000
        });

        const buffer = Buffer.from(response.data);

        await trashcore.sendMessage(m.key.remoteJid, {
          sticker: buffer
        });

        sent++;
        await new Promise(r => setTimeout(r, 400));

      } catch (e) {
        failed++;
      }
    }

    return xreply(
      `✅ Done!\n` +
      `📤 Sent: ${sent} stickers\n` +
      (failed > 0 ? `❌ Failed: ${failed}\n` : '') +
      (skipped > 0 ? `⏭️ Skipped (animated): ${skipped}` : '')
    );
  }
};

module.exports = [telestick];
