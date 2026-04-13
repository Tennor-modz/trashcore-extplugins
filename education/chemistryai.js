// ============================================================
//  TRASHCORE ULTRA — External Plugin
//  education/chemistryai.js  |  Chemistry/Physics AI Plugin
// ============================================================

const chemistryai = {
  command:  ['chemistryai', 'chemai', 'scienceai'],
  desc:     'Ask chemistry or physics questions',
  category: 'Education',

  run: async ({ trashcore, m, args, text, xreply }) => {
    const query = args.join(' ').trim();

    if (!query) {
      return xreply(
        `🧪 *Science AI*\n\n` +
        `Usage: *.chemistryai <question>*\n` +
        `Example: *.chemistryai What is Newton's law of motion?*`
      );
    }

    await xreply('🧠 Thinking...');

    try {
      const url = `https://apiskeith.top/education/physics?q=${encodeURIComponent(query)}`;
      const { data } = await axios.get(url);

      if (!data.status || !data.result) {
        return xreply('❌ No answer found.');
      }

      let result = data.result;

      // Limit long responses (WhatsApp safe)
      if (result.length > 3000) {
        result = result.slice(0, 3000) + '\n\n_...response truncated_';
      }

      const caption =
        `🧪 *Science AI Answer*\n` +
        `${'─'.repeat(30)}\n\n` +
        result + '\n\n' +
        `${'─'.repeat(30)}\n` +
        `⚡ Powered by Keith API`;

      return xreply(caption);

    } catch (e) {
      return xreply(`❌ Error: ${e.message}`);
    }
  }
};

module.exports = [chemistryai];
