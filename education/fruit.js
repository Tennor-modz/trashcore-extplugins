// ============================================================
//  TRASHCORE ULTRA — External Plugin
//  education/fruit.js  |  Fruit Info Plugin
// ============================================================

const fruit = {
  command:  ['fruit', 'fruitinfo'],
  desc:     'Get information about a fruit',
  category: 'education',

  run: async ({ trashcore, m, args, text, xreply }) => {
    const query = args.join(' ').trim();

    if (!query) {
      return xreply(
        `🍎 *Fruit Info*\n\n` +
        `Usage: *.fruit <fruit name>*\n` +
        `Example: *.fruit lemon*`
      );
    }

    await xreply('🍏 Fetching fruit data...');

    try {
      const url = `https://apiskeith.top/education/fruit?q=${encodeURIComponent(query)}`;
      const { data } = await axios.get(url);

      if (!data.status || !data.result) {
        return xreply('❌ Fruit not found.');
      }

      const f = data.result;

      const caption =
        `🍎 *Fruit Information*\n` +
        `${'─'.repeat(30)}\n\n` +
        `📌 *Name:* ${f.name}\n` +
        `🌿 *Family:* ${f.family}\n` +
        `🧬 *Genus:* ${f.genus}\n` +
        `📚 *Order:* ${f.order}\n\n` +
        `🥗 *Nutrition (per 100g):*\n` +
        `🔥 Calories: ${f.nutritions.calories}\n` +
        `🧈 Fat: ${f.nutritions.fat}g\n` +
        `🍬 Sugar: ${f.nutritions.sugar}g\n` +
        `🍞 Carbs: ${f.nutritions.carbohydrates}g\n` +
        `💪 Protein: ${f.nutritions.protein}g\n\n` +
        `${'─'.repeat(30)}\n` +
        `🕒 ${new Date(f.timestamp).toLocaleString()}`;

      return xreply(caption);

    } catch (e) {
      return xreply(`❌ Error: ${e.message}`);
    }
  }
};

module.exports = [fruit];
