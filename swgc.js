// ============================================================
//  TRASHCORE ULTRA — External Plugin
//  Send media as group status to a selected group
// ============================================================

const { downloadMediaMessage } = require('@trashcore/baileys');
const fs                       = require('fs');
const path                     = require('path');
const os                       = require('os');

// ─── In-memory store per sender ──────────────────────────────
const swgcStore = {};  // { senderJid: { filePath, isVideo } }

// ─── Helper: download media to temp file ─────────────────────
async function downloadToTmp(trashcore, m, isVideo) {
  const buffer  = await downloadMediaMessage(
    m,
    'buffer',
    {},
    { logger: console, reuploadRequest: trashcore.updateMediaMessage }
  );
  const ext     = isVideo ? 'mp4' : 'jpg';
  const tmpPath = path.join(os.tmpdir(), `swgc_${Date.now()}.${ext}`);
  fs.writeFileSync(tmpPath, buffer);
  return tmpPath;
}

// ─── Command 1: swgc ─────────────────────────────────────────
const swgc = {
  command:  ['swgc'],
  desc:     'Send media as group status to a selected group',
  category: 'Admin',
  owner:    true,

  run: async ({ trashcore, m, xreply, chat, isOwner, senderJid }) => {
    if (!isOwner) return;

    const isVideo = !!m.message?.videoMessage;
    const isImage = !!m.message?.imageMessage;

    if (!isImage && !isVideo) {
      return xreply('❌ *Send an image or video!*\nExample: send media with caption `.swgc`');
    }

    // Fetch all groups bot is in
    const meta = await trashcore.groupFetchAllParticipating();
    const rows = Object.keys(meta).map(id => ({
      title:       meta[id].subject,
      id:          `.sendswgc ${id}`,
      description: `${meta[id].participants.length} Members`
    }));

    if (!rows.length) return xreply('❌ Bot is not in any group.');

    // Download and cache media
    const tmpPath = await downloadToTmp(trashcore, m, isVideo);
    swgcStore[senderJid] = { filePath: tmpPath, isVideo };

    // Send group selection list
    await trashcore.sendMessage(chat, {
      buttons: [{
        buttonId: 'action',
        buttonText: { displayText: 'Choose Target Group' },
        type: 4,
        nativeFlowInfo: {
          name: 'single_select',
          paramsJson: JSON.stringify({
            title: 'Select Group',
            sections: [{
              title: 'Group Chat List',
              rows
            }]
          })
        }
      }],
      footer:     '© TrashCore Ultra - 2026',
      headerType: 1,
      viewOnce:   true,
      text:       '*Select a group to post the status to!*',
      contextInfo: {
        isForwarded:  true,
        mentionedJid: [senderJid],
      },
    }, { quoted: m });
  }
};

// ─── Command 2: sendswgc ─────────────────────────────────────
const sendswgc = {
  command:  ['sendswgc'],
  desc:     'Post stored media as group status (auto-triggered by swgc list)',
  category: 'Admin',
  owner:    true,

  run: async ({ trashcore, m, args, xreply, chat, isOwner, senderJid }) => {
    if (!isOwner) return;

    const stored = swgcStore[senderJid];
    if (!stored) return xreply('❌ No media stored. Send media with `.swgc` first.');

    const { filePath, isVideo } = stored;

    // Cleanup helper
    function cleanup() {
      try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch {}
      delete swgcStore[senderJid];
    }

    try {
      const buffer = fs.readFileSync(filePath);

      if (isVideo) {
        await trashcore.sendMessage(chat, {
          groupStatusMessage: { video: buffer }
        });
      } else {
        await trashcore.sendMessage(chat, {
          groupStatusMessage: { image: buffer }
        });
      }

      await trashcore.sendMessage(chat, {
        text: '✅ *Successfully posted status to target group!*'
      }, { quoted: null });

      cleanup();

    } catch (err) {
      console.error('❌ sendswgc error:', err.message);
      await trashcore.sendMessage(chat, {
        text: '❌ *Failed to post group status!*'
      }, { quoted: null });
      cleanup();
    }
  }
};

module.exports = [swgc, sendswgc];
