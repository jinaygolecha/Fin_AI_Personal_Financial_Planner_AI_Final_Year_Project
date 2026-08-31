const newsService = require('../services/newsService');

// GET /api/v1/news
const getNews = async (req, res, next) => {
  try {
    const { search = '', category = 'general', symbols = '', limit = 10 } = req.query;
    const newsData = await newsService.getFinancialNews({
      search,
      category,
      symbols,
      limit: parseInt(limit, 10) || 10,
    });

    return res.status(200).json({
      success: true,
      data: newsData,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getNews,
};
