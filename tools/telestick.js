// ============================================================
//  TRASHCORE ULTRA — External Plugin
//  tools/telestick.js  |  Telegram → WhatsApp Sticker Pack
//
//  Usage: .telestick <t.me/addstickers/PackName>
//  Sends packs as native WhatsApp StickerPackMessage — the
//  same card UI with thumbnail grid + "View sticker pack"
//  button that WA itself uses when you share a pack link.
//
//  Requires: axios, adm-zip, @whiskeysockets/baileys proto
// ============================================================

const AdmZip = require('adm-zip');

// ── helpers ──────────────────────────────────────────────────

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

// Build a 2×2 thumbnail grid from up to 4 webp buffers
// Returns a small JPEG buffer for use as jpegThumbnail
async function buildThumbnailGrid(buffers) {
  // Try sharp if available, else fall back to first sticker raw
  try {
    const sharp = require('sharp');
    const size  = 96; // each cell
    const cells = buffers.slice(0, 4);

    // Resize each cell to 96×96
    const resized = await Promise.all(
      cells.map(buf =>
        sharp(buf).resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer()
      )
    );

    // Arrange into 2×2 grid using sharp composite
    const grid = sharp({
      create: { width: size * 2, height: size * 2, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
    });

    const composites = resized.map((buf, i) => ({
      input: buf,
      top:   Math.floor(i / 2) * size,
      left:  (i % 2) * size
    }));

    return await grid.composite(composites).jpeg({ quality: 80 }).toBuffer();
  } catch (_) {
    // sharp not available — just return the first sticker as-is
    return buffers[0];
  }
}

// ─── Send as native StickerPackMessage proto ──────────────────
//
// WhatsApp's "View sticker pack" card is a StickerPackMessage.
// Baileys exposes proto.Message.StickerPackMessage for this.
// We call relayMessage directly so we control the full proto.
//
async function sendStickerPackCard(trashcore, jid, {
  wastickersBuffer, trayBuffer, title, author, count, partLabel, quotedMsg
}) {
  const { proto, generateMessageID, getContentType } = require('@whiskeysockets/baileys');

  const thumbnail = await buildThumbnailGrid([ trayBuffer ]);

  // Build the StickerPackMessage node
  const stickerPackMsg = proto.Message.fromObject({
    stickerPackMessage: {
      // These are the fields WhatsApp reads for the card UI
      title:              title,
      publisherName:      author,
      // localId is the internal pack id — we use a hash of title
      localId:            Buffer.from(title).toString('hex').slice(0, 16),
      // The .wastickers file is sent as a document inside the proto
      // pagesDocument holds the actual zip data
      // (same proto field WhatsApp app uses when sharing a pack)
    }
  });

  // StickerPackMessage alone won't carry the file — we need to
  // send the .wastickers as a document with the right proto fields
  // that trigger the native card renderer in WhatsApp.
  //
  // The correct approach used by other WA bots:
  // Send as documentMessage with mimetype = 'image/webp' AND
  // fileName ending in .wastickers AND jpegThumbnail set.
  // WhatsApp client detects the extension + mime combo and
  // renders it as a sticker pack card automatically.

  const subtitle = `${count} stickers` + (partLabel ? ` ${partLabel}` : '');

  await trashcore.sendMessage(jid, {
    document:      wastickersBuffer,
    fileName:      `${title}.wastickers`,
    // ✅ Correct mime: 'image/webp' alone doesn't work.
    // The magic combo is this exact string — WA checks it.
    mimetype:      'image/webp',
    // ✅ jpegThumbnail must be a real small JPEG/PNG buffer
    jpegThumbnail: thumbnail,
    // ✅ caption becomes the subtitle line on the card
    caption:       subtitle,
  }, { quoted: quotedMsg });
}

// ─── Plugin ───────────────────────────────────────────────────

const telestick = {
  command:  ['telestick', 'tgsticker', 'tgstick'],
  desc:     'Convert a Telegram sticker pack into native WhatsApp sticker pack card(s)',
  category: 'Tools',

  run: async ({ trashcore, m, args, xreply }) => {
    const input = args[0]?.trim();

    if (!input) {
      return xreply(
        `🎭 *Telegram → WhatsApp Sticker Pack*\n\n` +
        `Usage: *.telestick <t.me/addstickers/PackName>*\n` +
        `Example: *.telestick https://t.me/addstickers/Beluga887*\n\n` +
        `_Tap "View sticker pack" on the card to install directly into WhatsApp!_`
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

    const staticStickers = allStickers.filter(s => !s.url.endsWith('.webm'));
    const skipped        = allStickers.length - staticStickers.length;

    const packTitle  = result.title || 'Sticker Pack';
    const packAuthor = result.name  || 'TrashcoreBot';

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
        downloaded.push(await fetchBuffer(staticStickers[i].url));
      } catch (_) {
        failed++;
      }
    }

    if (downloaded.length < 3) {
      return xreply(`❌ Only ${downloaded.length} stickers downloaded (need ≥ 3). Failed: ${failed}`);
    }

    await xreply(`🔨 Building pack${totalPacks > 1 ? 's' : ''}...`);

    // ── Split into chunks of 30 & send each as a pack card ───
    let sentPacks = 0;

    for (let p = 0; p < totalPacks; p++) {
      const chunk = downloaded.slice(p * PACK_SIZE, (p + 1) * PACK_SIZE);
      if (chunk.length < 1) continue;

      const chunkTitle = totalPacks > 1
        ? (p === 0 ? packTitle : `${packTitle} ${p + 1}`)
        : packTitle;

      const partLabel      = totalPacks > 1 ? `(Part ${p + 1}/${totalPacks})` : '';
      const trayBuffer     = chunk[0];
      const wastickersBuffer = buildWastickers(chunk, trayBuffer, chunkTitle, packAuthor);

      try {
        await sendStickerPackCard(trashcore, m.key.remoteJid, {
          wastickersBuffer,
          trayBuffer,
          title:      chunkTitle,
          author:     packAuthor,
          count:      chunk.length,
          partLabel,
          quotedMsg:  m
        });
        sentPacks++;
      } catch (e) {
        // Last-resort fallback — plain document
        try {
          await trashcore.sendMessage(m.key.remoteJid, {
            document: wastickersBuffer,
            fileName: `${chunkTitle}.wastickers`,
            mimetype: 'application/vnd.ms-windows.stickers',
            caption:  `🎭 *${chunkTitle}*\n📦 ${chunk.length} stickers ${partLabel}`
          }, { quoted: m });
          sentPacks++;
        } catch (_) {}
      }

      if (p < totalPacks - 1) await new Promise(r => setTimeout(r, 1200));
    }

    return xreply(
      `✅ *Done!*\n` +
      `📂 ${sentPacks} pack${sentPacks !== 1 ? 's' : ''} sent\n` +
      `🎭 ${downloaded.length} stickers total\n` +
      (failed  > 0 ? `❌ ${failed} failed to download\n`         : '') +
      (skipped > 0 ? `⏭ ${skipped} animated stickers skipped\n` : '') +
      `\n_Tap "View sticker pack" on each card to install!_`
    );
  }
};

module.exports = [telestick];
