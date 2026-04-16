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

// ─── Single plugin — handles both swgc2 and sendswgc ─────────
const swgc2 = {
  command:  ['swgc2', 'sendswgc'],   // both registered under one plugin
  desc:     'Send media as group status to a selected group',
  category: 'Group',
  owner:    true,

  run: async ({ trashcore, m, args, command, xreply, chat, isOwner, senderJid }) => {
    if (!isOwner) return;

    // ── Branch: sendswgc (triggered by list selection) ────────
    if (command === 'sendswgc') {
      const stored = swgcStore[senderJid];
      if (!stored) return xreply('❌ No media stored. Send media with `.swgc2` first.');

      const targetGroupId = args[0];
      if (!targetGroupId || !targetGroupId.endsWith('@g.us')) {
        return xreply('❌ Invalid group ID. Please select again using `.swgc2`.');
      }

      const { filePath, isVideo } = stored;

      function cleanup() {
        try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch {}
        delete swgcStore[senderJid];
      }

      try {
        const buffer = fs.readFileSync(filePath);

        if (isVideo) {
          await trashcore.sendMessage(targetGroupId, {
            groupStatusMessage: { video: buffer }
          });
        } else {
          await trashcore.sendMessage(targetGroupId, {
            groupStatusMessage: { image: buffer }
          });
        }

        await xreply('✅ *Successfully posted status to target group!*');
        cleanup();

      } catch (err) {
        console.error('❌ sendswgc error:', err.message);
        await xreply('❌ *Failed to post group status!*');
        cleanup();
      }

      return;
    }

    // ── Branch: swgc2 (initial media + list prompt) ───────────
    const isVideo = !!m.message?.videoMessage;
    const isImage = !!m.message?.imageMessage;

    if (!isImage && !isVideo) {
      return xreply('❌ *Send an image or video!*\nExample: send media with caption `.swgc2`');
    }

    const meta = await trashcore.groupFetchAllParticipating();
    const rows = Object.keys(meta).map(id => ({
      title:       meta[id].subject,
      id:          `.sendswgc ${id}`,
      description: `${meta[id].participants.length} Members`
    }));

    if (!rows.length) return xreply('❌ Bot is not in any group.');

    const tmpPath = await downloadToTmp(trashcore, m, isVideo);
    swgcStore[senderJid] = { filePath: tmpPath, isVideo };

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
      text:       '*Select a group to post the status to!*',
      contextInfo: {
        isForwarded:  true,
        mentionedJid: [senderJid],
      },
    }, { quoted: m });
  }
};

module.exports = swgc2;
