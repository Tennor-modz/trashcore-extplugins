
// ============================================================
//  TRASHCORE ULTRA — External Plugin
//  Get profile picture of a user
// ============================================================

const getpp = {
  command:  ['getpp'],
  desc:     'Get profile picture of a user',
  category: 'Utility',
  usage:    '.getpp <number> or reply a message',

  run: async ({ trashcore, m, text, xreply, chat }) => {
    let target;

    if (m.quoted) {
      target = m.quoted.sender;
    } else if (text && text.length >= 6) {
      target = text.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
    } else {
      return xreply('Please provide a valid number or reply a message.\nExample: `.getpp +6287862115557`');
    }

    let ppUrl;
    try {
      ppUrl = await trashcore.profilePictureUrl(target, 'image');
    } catch {
      ppUrl = 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png';
    }

    await trashcore.sendMessage(chat, { image: { url: ppUrl } }, { quoted: m });
  }
};

module.exports = [getpp];
