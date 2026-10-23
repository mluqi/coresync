/**
 * paginationHelper.js
 * Utility to extract and normalize pagination/search/sort params from req.query
 *
 * Usage:
 *   const { pageNum, limitNum, offset, search, safeSortBy, safeSortDir } =
 *     getPaginationParams(req.query, { allowedSortCols: ['name','createdAt'] });
 */

const { Op } = require('sequelize');

/**
 * @param {Object} query         - req.query object
 * @param {Object} options
 * @param {string[]} options.allowedSortCols  - Whitelist of sortable columns (prevents SQL injection)
 * @param {string}   options.defaultSortBy    - Default sort column
 * @param {string}   options.defaultSortDir   - 'ASC' | 'DESC'
 * @param {number}   options.defaultLimit
 * @param {number}   options.maxLimit
 */
const getPaginationParams = (query = {}, options = {}) => {
  const {
    allowedSortCols = ['createdAt', 'id'],
    defaultSortBy = 'createdAt',
    defaultSortDir = 'DESC',
    defaultLimit = 20,
    maxLimit = 100
  } = options;

  const page = Math.max(1, parseInt(query.page) || 1);
  const isAll = query.limit === 'all';
  const parsedLimit = parseInt(query.limit);
  const effectiveMaxLimit = (isAll || parsedLimit > maxLimit) ? Math.max(maxLimit, Math.min(50000, parsedLimit || 50000)) : maxLimit;
  const limit = isAll ? effectiveMaxLimit : Math.min(effectiveMaxLimit, Math.max(1, parsedLimit || defaultLimit));
  const offset = (page - 1) * limit;
  const search = (query.search || '').trim();
  const sortBy = allowedSortCols.includes(query.sortBy) ? query.sortBy : defaultSortBy;
  const sortDir = (query.sortDir || '').toUpperCase() === 'DESC' ? 'DESC' : defaultSortDir;

  return { page, limit, offset, search, sortBy, sortDir };
};

/**
 * Build a Sequelize Op.or LIKE clause for search across multiple columns.
 * @param {string}   search  - Search term (already trimmed)
 * @param {string[]} cols    - Column names to search
 */
const buildSearchWhere = (search, cols = []) => {
  if (!search || !cols.length) return {};
  return {
    [Op.or]: cols.map(col => ({
      [col]: { [Op.like]: `%${search}%` }
    }))
  };
};

/**
 * Build pagination meta object for API response.
 */
const buildPaginationMeta = (total, page, limit) => ({
  total,
  page,
  limit,
  totalPages: Math.ceil(total / limit)
});

module.exports = { getPaginationParams, buildSearchWhere, buildPaginationMeta };
