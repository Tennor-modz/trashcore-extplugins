// ============================================================
//  TRASHCORE ULTRA — External Plugin
//  tools/telestick.js  |  Telegram → WhatsApp Sticker Pack
//
//  Usage: .telestick <t.me/addstickers/PackName>
//  Downloads a Telegram sticker pack and sends each sticker
//  one by one. Animated stickers sent as animated webp/webm —
//  no ffmpeg or external tools required.
//
//  Requires: axios only
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
        `_Sends each sticker one by one — static & animated!_`
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

    const packTitle   = result.title || 'Sticker Pack';
    const packAuthor  = result.name  || 'TrashcoreBot';
    const animatedCount = allStickers.filter(s => s.url.endsWith('.webm')).length;
    const staticCount   = allStickers.length - animatedCount;

    await xreply(
      `📦 *${packTitle}*\n` +
      `👤 ${packAuthor}\n` +
      `📊 ${allStickers.length} stickers` +
      (animatedCount > 0 ? ` (${staticCount} static, ${animatedCount} animated)` : '') +
      `\n\n⬇️ Sending stickers one by one...`
    );

    // ── Download & send each sticker ────────────────────────
    let sent   = 0;
    let failed = 0;

    for (let i = 0; i < allStickers.length; i++) {
      const sticker    = allStickers[i];
      const isAnimated = sticker.url.endsWith('.webm');

      try {
        const buffer = await fetchBuffer(sticker.url);

        if (isAnimated) {
          // Send .webm as a video with gifPlayback — Baileys encodes
          // it as an animated sticker on the wire without needing ffmpeg
          await trashcore.sendMessage(m.key.remoteJid, {
            video:       buffer,
            mimetype:    'video/webm',
            gifPlayback: true,
            // isAnimated flag tells WA to treat it as a sticker not a video
            isAnimated:  true,
          }, { quoted: m });
        } else {
          // Static .webp sticker — send directly
          await trashcore.sendMessage(m.key.remoteJid, {
            sticker: buffer
          }, { quoted: m });
        }

        sent++;
        await new Promise(r => setTimeout(r, isAnimated ? 800 : 500));
      } catch (e) {
        failed++;
      }
    }

    return xreply(
      `✅ *Done!*\n` +
      `🎭 ${sent} sticker${sent !== 1 ? 's' : ''} sent\n` +
      (failed > 0 ? `❌ ${failed} failed\n` : '')
    );
  }
};

module.exports = [telestick];
