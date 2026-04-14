// ============================================================
//  TRASHCORE ULTRA — External Plugin
//  Block/Ban a user
// ============================================================

const block = {
  command:  ['block', 'ban'],
  desc:     'Block a user from messaging the bot',
  category: 'Admin',
  owner:    true,

  run: async ({ trashcore, m, args, text, xreply, isOwner }) => {
    if (!isOwner) return;

    const target =
      m.mentionedJid?.[0] ||
      (m.quoted ? m.quoted.sender : null) ||
      (text.replace(/[^0-9]/g, '') + '@s.whatsapp.net');

    if (!target || target === '@s.whatsapp.net') {
      return xreply('❌ Mention, reply, or provide a number to block.');
    }

    await trashcore.updateBlockStatus(target, 'block');
    await trashcore.sendMessage(m.key.remoteJid, {
      react: { text: '🔴', key: m.key }
    });
  }
};

module.exports = [block];
