// ============================================================
//  TRASHCORE ULTRA — External Plugin
//  tools/telestick.js  |  Telegram → WhatsApp Sticker Pack
//
//  Usage: .telestick <t.me/addstickers/PackName>
//  Sends sticker packs in the native WhatsApp sticker pack
//  card format (with thumbnail, title, count, "View sticker
//  pack" button). Auto-splits at 30 stickers (WA limit).
//
//  Requires: axios, adm-zip (both already in bot)
// ============================================================


const AdmZip = require('adm-zip');

// Download URL as buffer
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

// Build one .wastickers ZIP from sticker buffers
function buildWastickers(stickerBuffers, trayBuffer, title, author) {
  const zip = new AdmZip();
  for (let i = 0; i < stickerBuffers.length; i++) {
    zip.addFile(`${Date.now() + i}.webp`, stickerBuffers[i]);
  }
  if (trayBuffer) zip.addFile('cover.png', trayBuffer);
  zip.addFile('title.txt',  Buffer.from(title,  'utf8'));
  zip.addFile('author.txt', Buffer.from(author, 'utf8'));
  return zip.toBuffer();
}

// ─── Plugin ───────────────────────────────────────────────────

const telestick = {
  command:  ['telestick', 'tgsticker', 'tgstick'],
  desc:     'Convert a Telegram sticker pack into installable WhatsApp sticker pack(s)',
  category: 'Tools',

  run: async ({ trashcore, m, args, xreply }) => {
    const input = args[0]?.trim();

    if (!input) {
      return xreply(
        `🎭 *Telegram → WhatsApp Sticker Pack*\n\n` +
        `Usage: *.telestick <t.me/addstickers/PackName>*\n` +
        `Example: *.telestick https://t.me/addstickers/Beluga887*\n\n` +
        `_Sends installable sticker pack(s) — tap "View sticker pack" to add directly to WhatsApp!_`
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
    const skipped = allStickers.length - staticStickers.length;

    const packTitle  = result.title || 'Sticker Pack';
    const packAuthor = result.name  || 'TrashcoreBot';
    const safeTitle  = packTitle.replace(/[^a-zA-Z0-9_\- ]/g, '').trim() || 'StickerPack';

    const PACK_SIZE  = 30;
    const totalPacks = Math.ceil(staticStickers.length / PACK_SIZE);

    await xreply(
      `📦 *${packTitle}*\n` +
      `👤 ${packAuthor}\n` +
      `📊 ${allStickers.length} stickers` +
      (skipped    > 0 ? ` | ⏭ ${skipped} animated skipped`        : '') +
      (totalPacks > 1 ? ` | 📂 Splitting into ${totalPacks} packs` : '') +
      `\n\n⬇️ Downloading ${staticStickers.length} stickers...`
    );

    // ── Download all stickers ────────────────────────────────
    const downloaded = [];
    let failed = 0;

    for (let i = 0; i < staticStickers.length; i++) {
      try {
        const buffer = await fetchBuffer(staticStickers[i].url);
        downloaded.push(buffer);
      } catch (e) {
        failed++;
      }
    }

    if (downloaded.length < 3) {
      return xreply(`❌ Only downloaded ${downloaded.length} stickers (need at least 3).\nFailed: ${failed}`);
    }

    await xreply(`🔨 Building pack${totalPacks > 1 ? 's' : ''}...`);

    // ── Split into chunks of 30 & send each pack ─────────────
    let sentPacks = 0;

    for (let p = 0; p < totalPacks; p++) {
      const chunk = downloaded.slice(p * PACK_SIZE, (p + 1) * PACK_SIZE);
      if (chunk.length < 1) continue;

      const chunkTitle = totalPacks > 1
        ? (p === 0 ? packTitle : `${packTitle} ${p + 1}`)
        : packTitle;

      const trayBuffer       = chunk[0]; // First sticker used as tray/cover icon
      const wastickersBuffer = buildWastickers(chunk, trayBuffer, chunkTitle, packAuthor);

      const filename = totalPacks > 1
        ? `${safeTitle}_${p + 1}.wastickers`
        : `${safeTitle}.wastickers`;

      try {
        // ── Send as native WhatsApp sticker pack card ────────
        // This produces the "View sticker pack" card UI seen in
        // the screenshot — same format WhatsApp itself uses when
        // someone shares a sticker pack link inside the app.
        await trashcore.sendMessage(m.key.remoteJid, {
          document:       wastickersBuffer,
          fileName:       filename,
          // This exact mimetype triggers the sticker-pack card UI
          // (thumbnail grid preview + "View sticker pack" button)
          mimetype:       'image/webp',
          // jpegThumbnail shows the 2×2 preview grid on the card
          jpegThumbnail:  trayBuffer,
          // contextInfo lets us embed the pack name + sticker count
          // as the card subtitle, matching the screenshot layout
          contextInfo: {
            externalAdReply: {
              title:           chunkTitle,
              body:            `${chunk.length} stickers` + (totalPacks > 1 ? ` (Part ${p + 1}/${totalPacks})` : ''),
              thumbnailUrl:    '',
              thumbnail:       trayBuffer,
              mediaType:       1,
              renderLargerThumbnail: false,
              showAdAttribution:     false,
            }
          }
        }, { quoted: m });

        sentPacks++;
        if (p < totalPacks - 1) await new Promise(r => setTimeout(r, 1000));
      } catch (e) {
        // fallback: send as plain document if card send fails
        try {
          await trashcore.sendMessage(m.key.remoteJid, {
            document: wastickersBuffer,
            fileName: filename,
            mimetype: 'application/vnd.ms-windows.stickers',
            caption:
              `🎭 *${chunkTitle}*\n` +
              `📦 ${chunk.length} stickers` +
              (totalPacks > 1 ? ` (Part ${p + 1}/${totalPacks})` : '') +
              `\n\n_Tap → "Add to WhatsApp" to install!_`
          }, { quoted: m });
          sentPacks++;
        } catch (_) {
          // silently skip failed pack
        }
      }
    }

    return xreply(
      `✅ *Done!*\n` +
      `📂 ${sentPacks} pack${sentPacks !== 1 ? 's' : ''} sent\n` +
      `🎭 ${downloaded.length} stickers total\n` +
      (failed  > 0 ? `❌ ${failed} failed to download\n`          : '') +
      (skipped > 0 ? `⏭ ${skipped} animated stickers skipped\n`  : '') +
      `\n_Tap "View sticker pack" on each card to install!_`
    );
  }
};

module.exports = [telestick];
