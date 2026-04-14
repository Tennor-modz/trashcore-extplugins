// ============================================================
//  TRASHCORE ULTRA — External Plugin
//  Unblock/Unban a user
// ============================================================

const unblock = {
  command:  ['unblock', 'unban'],
  desc:     'Unblock a previously blocked user',
  category: 'Admin',
  owner:    true,

  run: async ({ trashcore, m, text, xreply, isOwner }) => {
    if (!isOwner) return;

    const target =
      m.mentionedJid?.[0] ||
      (m.quoted ? m.quoted.sender : null) ||
      (text.replace(/[^0-9]/g, '') + '@s.whatsapp.net');

    if (!target || target === '@s.whatsapp.net') {
      return xreply('❌ Mention, reply, or provide a number to unblock.');
    }

    await trashcore.updateBlockStatus(target, 'unblock');
    await trashcore.sendMessage(m.key.remoteJid, {
      react: { text: '🟢', key: m.key }
    });
  }
};

module.exports = [unblock];
