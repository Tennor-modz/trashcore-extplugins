
// ============================================================
//  TRASHCORE ULTRA — External Plugin
//  downloads/lyrics2.js  |  Lyrics Plugin (Keith API)
// ============================================================



const lyrics2 = {
  command:  ['lyrics2', 'lyric2', 'songlyrics'],
  desc:     'Search song lyrics (Keith API)',
  category: 'Downloader',

  run: async ({ trashcore, m, args, text, xreply }) => {
    const query = args.join(' ').trim();

    if (!query) {
      return xreply(
        `🎵 *Lyrics Search*\n\n` +
        `Usage: *.lyrics2 <song name>*\n` +
        `Example: *.lyrics2 faded*`
      );
    }

    await xreply('🔍 Searching lyrics...');

    try {
      const url = `https://apiskeith.top/search/lyrics2?query=${encodeURIComponent(query)}`;
      const { data } = await axios.get(url);

      if (!data.status || !data.result) {
        return xreply('❌ Lyrics not found.');
      }

      let lyricsText = data.result;

      // Prevent overflow
      if (lyricsText.length > 3000) {
        lyricsText = lyricsText.slice(0, 3000) + '\n\n_...lyrics truncated_';
      }

      const caption =
        `🎵 *Lyrics Result*\n` +
        `🔎 Query: ${query}\n` +
        `${'─'.repeat(30)}\n\n` +
        lyricsText + '\n\n' +
        `${'─'.repeat(30)}\n` +
        `⚡ Powered by Keith API`;

      return xreply(caption);

    } catch (e) {
      return xreply(`❌ Error: ${e.message}`);
    }
  }
};

module.exports = [lyrics2];
