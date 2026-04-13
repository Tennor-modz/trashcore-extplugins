// ============================================================
//  TRASHCORE ULTRA — External Plugin
//  tools/telestick.js  |  Telegram → WhatsApp Sticker Pack
//
//  Usage: .telestick <t.me/addstickers/PackName>
//  Builds proper .wastickers files the recipient can install
//  directly into WhatsApp. Auto-splits into multiple packs
//  if the pack has more than 30 stickers (WA limit).
//
//  Requires: axios, adm-zip, jimp
//  Install:  npm install jimp
// ============================================================


const AdmZip = require('adm-zip');
const Jimp   = require('jimp');

// ─── Helpers ─────────────────────────────────────────────────

// Resize buffer to 512x512 for stickers
async function resizeSticker(buffer) {
  const img = await Jimp.read(buffer);
  return img
    .resize(512, 512)
    .getBufferAsync(Jimp.MIME_PNG);
}

// Resize buffer to 96x96 for tray icon
async function resizeTray(buffer) {
  const img = await Jimp.read(buffer);
  return img
    .resize(96, 96)
    .getBufferAsync(Jimp.MIME_PNG);
}

// Download URL as buffer
async function fetchBuffer(url) {
  const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000 });
  return Buffer.from(res.data);
}

// Build one .wastickers ZIP from processed sticker buffers
function buildWastickers(stickerBuffers, trayBuffer, title, author) {
  const zip = new AdmZip();

  for (let i = 0; i < stickerBuffers.length; i++) {
    // .wastickers spec uses timestamp-style filenames, no subdirs
    zip.addFile(`${Date.now() + i}.png`, stickerBuffers[i]);
  }

  if (trayBuffer) zip.addFile('cover.png', trayBuffer);
  zip.addFile('title.txt',  Buffer.from(title,  'utf8'));
  zip.addFile('author.txt', Buffer.from(author, 'utf8'));

  return zip.toBuffer();
}

// ─── Plugin ───────────────────────────────────────────────────

const telestick = {
  command:  ['telestick', 'tgsticker', 'tgstick'],
  desc:     'Convert a Telegram sticker pack into installable WhatsApp .wastickers pack(s)',
  category: 'Tools',

  run: async ({ trashcore, m, args, xreply }) => {
    const input = args[0]?.trim();

    if (!input) {
      return xreply(
        `🎭 *Telegram → WhatsApp Sticker Pack*\n\n` +
        `Usage: *.telestick <t.me/addstickers/PackName>*\n` +
        `Example: *.telestick https://t.me/addstickers/Beluga887*\n\n` +
        `_Sends installable .wastickers file(s) — tap to add directly to WhatsApp!_`
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

    // How many packs needed (30 stickers max per pack)
    const PACK_SIZE  = 30;
    const totalPacks = Math.ceil(staticStickers.length / PACK_SIZE);

    await xreply(
      `📦 *${packTitle}*\n` +
      `👤 ${packAuthor}\n` +
      `📊 ${allStickers.length} stickers` +
      (skipped    > 0 ? ` | ⏭ ${skipped} animated skipped`       : '') +
      (totalPacks > 1 ? ` | 📂 Splitting into ${totalPacks} packs` : '') +
      `\n\n🔨 Building pack${totalPacks > 1 ? 's' : ''}...`
    );

    // ── Download & process all stickers ─────────────────────
    const processed = [];
    let failed = 0;

    for (let i = 0; i < staticStickers.length; i++) {
      try {
        const raw     = await fetchBuffer(staticStickers[i].url);
        const resized = await resizeSticker(raw);

        // Generate tray icon from first sticker of each pack chunk
        let tray = null;
        if (i % PACK_SIZE === 0) {
          tray = await resizeTray(raw);
        }

        processed.push({ buffer: resized, tray });
      } catch (e) {
        failed++;
      }
    }

    if (processed.length < 3) {
      return xreply(`❌ Only got ${processed.length} stickers (need at least 3). Try another pack.`);
    }

    // ── Split into chunks of 30 & send each pack ─────────────
    let sentPacks = 0;

    for (let p = 0; p < totalPacks; p++) {
      const chunk = processed.slice(p * PACK_SIZE, (p + 1) * PACK_SIZE);
      if (chunk.length < 1) continue;

      // Name: "PackName" for part 1, "PackName 2", "PackName 3" etc.
      const chunkTitle = totalPacks > 1
        ? (p === 0 ? packTitle : `${packTitle} ${p + 1}`)
        : packTitle;

      const trayBuffer = chunk.find(c => c.tray)?.tray || null;
      const buffers    = chunk.map(c => c.buffer);

      const wastickersBuffer = buildWastickers(buffers, trayBuffer, chunkTitle, packAuthor);
      const filename = totalPacks > 1
        ? `${safeTitle}_${p + 1}.wastickers`
        : `${safeTitle}.wastickers`;

      try {
        await trashcore.sendMessage(m.key.remoteJid, {
          document: wastickersBuffer,
          fileName: filename,
          mimetype: 'application/octet-stream',
          caption:
            `🎭 *${chunkTitle}*\n` +
            `📦 ${chunk.length} stickers` +
            (totalPacks > 1 ? ` (Part ${p + 1}/${totalPacks})` : '') +
            `\n\n_Tap → "Add to WhatsApp" to install!_`
        }, { quoted: m });

        sentPacks++;

        // Small delay between packs to avoid flooding
        if (p < totalPacks - 1) {
          await new Promise(r => setTimeout(r, 1000));
        }
      } catch (e) {
        // continue to next pack
      }
    }

    // ── Final summary ────────────────────────────────────────
    return xreply(
      `✅ *Done!*\n` +
      `📂 ${sentPacks} pack${sentPacks !== 1 ? 's' : ''} sent\n` +
      `🎭 ${processed.length} stickers total\n` +
      (failed  > 0 ? `❌ ${failed} failed to process\n`           : '') +
      (skipped > 0 ? `⏭ ${skipped} animated stickers skipped\n`  : '') +
      `\n_Tap each file to install!_`
    );
  }
};

module.exports = [telestick];
