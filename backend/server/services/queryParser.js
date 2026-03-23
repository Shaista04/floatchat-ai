class QueryParser {
  static parse(query) {
    const yearMatch = query.match(/\b(20\d{2})\b/);
    const floatMatch = query.match(/\b(\d{7})\b/);
    const monthMatch = query.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i);

    return {
      year: yearMatch ? yearMatch[1] : null,
      float: floatMatch ? floatMatch[1] : null,
      month: monthMatch ? monthMatch[1] : null,
      isBgc: query.toLowerCase().includes('bgc') || query.toLowerCase().includes('oxygen') || query.toLowerCase().includes('nitrate')
    };
  }
}

module.exports = QueryParser;
