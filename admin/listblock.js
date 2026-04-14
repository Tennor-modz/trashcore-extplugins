// ============================================================
//  TRASHCORE ULTRA — External Plugin
//  List blocked/banned users
// ============================================================

const listblock = {
  command:  ['listblock', 'listban'],
  desc:     'Show total number of blocked users',
  category: 'Admin',
  owner:    true,

  run: async ({ trashcore, m, xreply, isOwner }) => {
    if (!isOwner) return;

    const blocked = await trashcore.fetchBlocklist();
    xreply(`Total Blocked: ${blocked.length}`);
  }
};

module.exports = [listblock];
