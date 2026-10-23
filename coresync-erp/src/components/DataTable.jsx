import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Loader2, ArrowUp, ArrowDown, ChevronsUpDown } from 'lucide-react';
import Loading from './Loading';

/**
 * Reusable DataTable component with pagination
 *
 * @param {Array}    columns      - Array of { key, label, sortable?, sortKey?, render?, className?, headerClassName? }
 * @param {Array}    data         - Array of row objects
 * @param {boolean}  loading      - Show skeleton while loading
 * @param {string}   emptyText    - Message when data is empty
 * @param {Object}   pagination   - { total, page, limit, totalPages }
 * @param {Function} onPageChange - Called with new page number
 * @param {string}   sortBy       - Currently active sort column key
 * @param {string}   sortDir      - 'ASC' | 'DESC'
 * @param {Function} onSort       - Called with (sortKey, nextSortDir)
 * @param {string}   rowKey       - Key for unique row id (default 'id')
 */
const DataTable = ({
  columns = [],
  data = [],
  loading = false,
  emptyText = 'Tidak ada data.',
  emptyIcon = null,
  pagination = null,
  onPageChange,
  sortBy = '',
  sortDir = 'ASC',
  onSort,
  rowKey = 'id',
  onRowClick,
  rowClassName,
  maxHeight = 'max-h-[calc(100vh-17.5rem)]'
}) => {
  const skeletonRows = pagination?.limit || 10;

  // Compute pagination display values
  const pag = pagination || {};
  const { total = 0, page = 1, limit = 20, totalPages = 1 } = pag;
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  // Page window: show up to 5 page numbers
  const getPageNumbers = () => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const delta = 2;
    const range = [];
    const rangeWithDots = [];
    for (
      let i = Math.max(2, page - delta);
      i <= Math.min(totalPages - 1, page + delta);
      i++
    ) {
      range.push(i);
    }
    if (range[0] - 1 === 2) {
      range.unshift(2);
    } else if (range[0] - 1 > 1) {
      rangeWithDots.push(1, '...');
    } else {
      rangeWithDots.push(1);
    }
    rangeWithDots.push(...range);
    if (totalPages - range[range.length - 1] === 2) {
      rangeWithDots.push(totalPages - 1, totalPages);
    } else if (totalPages - range[range.length - 1] > 1) {
      rangeWithDots.push('...', totalPages);
    } else {
      rangeWithDots.push(totalPages);
    }
    return rangeWithDots;
  };

  return (
    <div className="bg-white border border-zinc-200/80 rounded-xl shadow-card overflow-hidden flex flex-col">
      {/* Table scroll wrapper */}
      <div className={`overflow-x-auto overflow-y-auto flex-1 ${maxHeight}`}>
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 z-10 bg-zinc-50/95 backdrop-blur-xs shadow-2xs">
            <tr className="border-b border-zinc-200/80 text-zinc-500 text-[11px] font-bold uppercase tracking-wider">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 whitespace-nowrap ${col.headerClassName || ''}`}
                >
                  {(col.sortable || col.sortKey) ? (
                    <button
                      type="button"
                      onClick={() => {
                        const sKey = col.sortKey || col.key;
                        const nextDir = (sortBy === sKey && sortDir === 'ASC') ? 'DESC' : 'ASC';
                        if (onSort) onSort(sKey, nextDir);
                      }}
                      className="inline-flex items-center space-x-1 group hover:text-theme transition-colors font-bold uppercase tracking-wider cursor-pointer"
                    >
                      <span>{col.label}</span>
                      {sortBy === (col.sortKey || col.key) ? (
                        sortDir === 'ASC' ? (
                          <ArrowUp size={12} className="text-theme font-bold" />
                        ) : (
                          <ArrowDown size={12} className="text-theme font-bold" />
                        )
                      ) : (
                        <ChevronsUpDown size={12} className="text-zinc-300 group-hover:text-zinc-500 transition-colors" />
                      )}
                    </button>
                  ) : (
                    col.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100/90 text-xs text-zinc-700 font-medium">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center">
                  <Loading text="Memuat data..." size="md" />
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-14 text-center">
                  <div className="flex flex-col items-center space-y-2 text-zinc-400">
                    {emptyIcon && (
                      <div className="mb-1 opacity-40">
                        {React.isValidElement(emptyIcon)
                          ? emptyIcon
                          : typeof emptyIcon === 'function' || (typeof emptyIcon === 'object' && emptyIcon !== null)
                          ? React.createElement(emptyIcon, { size: 36 })
                          : emptyIcon}
                      </div>
                    )}
                    <p className="text-xs font-semibold text-zinc-500">{emptyText}</p>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((row, rowIndex) => {
                const customRowClass = typeof rowClassName === 'function' ? rowClassName(row, rowIndex) : (rowClassName || '');
                return (
                  <tr
                    key={row[rowKey]}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={`transition-colors duration-100 ${customRowClass || 'hover:bg-zinc-50/80'} ${onRowClick ? 'cursor-pointer' : ''}`}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={`px-4 py-2.5 sm:py-3 ${col.className || ''}`}
                      >
                        {col.render
                          ? col.render(row[col.key], row, rowIndex)
                          : (row[col.key] ?? <span className="text-zinc-300">—</span>)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination footer */}
      {pagination && !loading && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-6 py-3 border-t border-zinc-200/80 bg-zinc-50/90 backdrop-blur-xs shrink-0 sticky bottom-0 z-10 text-xs">
          {/* Record info */}
          <p className="text-xs text-zinc-500 shrink-0">
            {total === 0 ? (
              'Tidak ada data'
            ) : (
              <>Menampilkan <span className="font-semibold text-zinc-700">{from}–{to}</span> dari <span className="font-semibold text-zinc-700">{total.toLocaleString('id-ID')}</span> data</>
            )}
          </p>

          {/* Page controls */}
          {totalPages > 1 && (
            <div className="flex items-center space-x-1">
              {/* First page */}
              <button
                onClick={() => onPageChange(1)}
                disabled={page <= 1}
                className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-200/70 hover:text-zinc-800 disabled:opacity-25 disabled:cursor-not-allowed transition-colors cursor-pointer"
                title="Halaman pertama"
              >
                <ChevronsLeft size={14} />
              </button>
              {/* Prev page */}
              <button
                onClick={() => onPageChange(page - 1)}
                disabled={page <= 1}
                className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-200/70 hover:text-zinc-800 disabled:opacity-25 disabled:cursor-not-allowed transition-colors cursor-pointer"
                title="Halaman sebelumnya"
              >
                <ChevronLeft size={14} />
              </button>

              {/* Page numbers */}
              <div className="flex items-center space-x-1 mx-1">
                {getPageNumbers().map((p, idx) =>
                  p === '...' ? (
                    <span key={`dot-${idx}`} className="px-1.5 text-zinc-400 text-xs select-none">…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => onPageChange(p)}
                      className={`min-w-[28px] h-7 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        p === page
                          ? 'bg-theme text-white font-bold shadow-xs'
                          : 'text-zinc-600 hover:bg-zinc-200/80 hover:text-zinc-950'
                      }`}
                    >
                      {p}
                    </button>
                  )
                )}
              </div>

              {/* Next page */}
              <button
                onClick={() => onPageChange(page + 1)}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-200/70 hover:text-zinc-800 disabled:opacity-25 disabled:cursor-not-allowed transition-colors cursor-pointer"
                title="Halaman berikutnya"
              >
                <ChevronRight size={14} />
              </button>
              {/* Last page */}
              <button
                onClick={() => onPageChange(totalPages)}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-200/70 hover:text-zinc-800 disabled:opacity-25 disabled:cursor-not-allowed transition-colors cursor-pointer"
                title="Halaman terakhir"
              >
                <ChevronsRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DataTable;
