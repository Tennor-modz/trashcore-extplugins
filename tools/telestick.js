// ============================================================
//  TRASHCORE ULTRA — External Plugin
//  tools/telestick.js  |  Telegram → WhatsApp Sticker Pack
//
//  Usage: .telestick <t.me/addstickers/PackName>
//  Downloads a Telegram sticker pack and sends each sticker
//  one by one as individual WhatsApp stickers.
//
//  Requires: axios
// ============================================================



async function fetchBuffer(url) {
  const res = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 20000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      'Accept': '*/*'
    }
  });
  return Buffer.from(res.data);
}

// ─── Plugin ───────────────────────────────────────────────────

const telestick = {
  command:  ['telestick', 'tgsticker', 'tgstick'],
  desc:     'Convert a Telegram sticker pack and send each sticker individually',
  category: 'Tools',

  run: async ({ trashcore, m, args, xreply }) => {
    const input = args[0]?.trim();

    if (!input) {
      return xreply(
        `🎭 *Telegram → WhatsApp Stickers*\n\n` +
        `Usage: *.telestick <t.me/addstickers/PackName>*\n` +
        `Example: *.telestick https://t.me/addstickers/Beluga887*\n\n` +
        `_Sends each sticker from the pack one by one!_`
      );
    }

    const packUrl = input.startsWith('http')
      ? input
      : `https://t.me/addstickers/${input}`;

    await xreply('⏳ Fetching sticker pack info...');

    // ── Fetch pack metadata ──────────────────────────────────
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

    const allStickers = result.sticker || [];
    if (!allStickers.length) return xreply('❌ No stickers found in this pack.');

    // Filter out animated/video stickers (.webm)
    const staticStickers = allStickers.filter(s => !s.url.endsWith('.webm'));
    const skipped        = allStickers.length - staticStickers.length;

    const packTitle  = result.title || 'Sticker Pack';
    const packAuthor = result.name  || 'TrashcoreBot';

    await xreply(
      `📦 *${packTitle}*\n` +
      `👤 ${packAuthor}\n` +
      `📊 ${staticStickers.length} stickers` +
      (skipped > 0 ? ` | ⏭ ${skipped} animated skipped` : '') +
      `\n\n⬇️ Sending stickers one by one...`
    );

    // ── Download & send each sticker individually ────────────
    let sent   = 0;
    let failed = 0;

    for (let i = 0; i < staticStickers.length; i++) {
      try {
        const buffer = await fetchBuffer(staticStickers[i].url);

        await trashcore.sendMessage(m.key.remoteJid, {
          sticker: buffer
        }, { quoted: m });

        sent++;

        // Small delay to avoid flooding / rate limits
        await new Promise(r => setTimeout(r, 500));
      } catch (e) {
        failed++;
      }
    }

    return xreply(
      `✅ *Done!*\n` +
      `🎭 ${sent} sticker${sent !== 1 ? 's' : ''} sent\n` +
      (failed  > 0 ? `❌ ${failed} failed\n`                     : '') +
      (skipped > 0 ? `⏭ ${skipped} animated stickers skipped\n` : '')
    );
  }
};

module.exports = [telestick];
