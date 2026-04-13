// ============================================================
//  TRASHCORE ULTRA — External Plugin
//  tools/mathgpt.js  |  MathGPT Plugin
// ============================================================

const axios = require('axios');

const mathgpt = {
  command:  ['mathgpt', 'mathai'],
  desc:     'Solve math problems using AI',
  category: 'tools',

  run: async ({ trashcore, m, args, text, xreply }) => {
    const query = args.join(' ').trim();

    if (!query) {
      return xreply(
        `🧠 *MathGPT AI*\n\n` +
        `Usage: *.mathgpt <math question>*\n` +
        `Example: *.mathgpt Solve 2x + 5 = 15*`
      );
    }

    await xreply('🧠 Solving your math problem...');

    try {
      const url = `https://api.nexray.web.id/ai/mathgpt?text=${encodeURIComponent(query)}`;

      const { data } = await axios.get(url);

      if (!data.status) {
        return xreply('❌ Failed to get a valid response.');
      }

      const result = data.result || 'No response from AI.';

      const caption =
        `🧠 *MathGPT Result*\n` +
        `${'─'.repeat(30)}\n\n` +
        result + '\n\n' +
        `${'─'.repeat(30)}\n` +
        `⚡ Response Time: ${data.response_time || 'N/A'}`;

      return xreply(caption);

    } catch (e) {
      return xreply(`❌ Error: ${e.message}`);
    }
  }
};

module.exports = [mathgpt];
