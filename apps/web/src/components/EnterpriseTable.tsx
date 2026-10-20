import React, { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  Search,
  Download,
  Eye,
  SlidersHorizontal
} from 'lucide-react';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
}

interface EnterpriseTableProps<T> {
  columns: Column<T>[];
  data: T[];
  title?: string;
  searchPlaceholder?: string;
  onExportCsv?: () => void;
  isLoading?: boolean;
}

export function EnterpriseTable<T extends Record<string, any>>({
  columns,
  data,
  title,
  searchPlaceholder = 'Search records...',
  onExportCsv,
  isLoading = false
}: EnterpriseTableProps<T>) {
  const [searchTerm, setSearchTerm] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() =>
    columns.reduce((acc, col) => ({ ...acc, [col.key]: true }), {})
  );
  const [showColMenu, setShowColMenu] = useState(false);

  // Filter
  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) return data;
    const lower = searchTerm.toLowerCase();
    return data.filter((row) =>
      Object.values(row).some((val) =>
        String(val ?? '').toLowerCase().includes(lower)
      )
    );
  }, [data, searchTerm]);

  // Sort
  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;
    return [...filteredData].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return sortOrder === 'asc'
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  }, [filteredData, sortKey, sortOrder]);

  // Pagination
  const totalRecords = sortedData.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const validCurrentPage = Math.min(currentPage, totalPages);
  const paginatedData = useMemo(() => {
    const start = (validCurrentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, validCurrentPage, pageSize]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const handleExportCsv = () => {
    if (onExportCsv) {
      onExportCsv();
      return;
    }
    // Default CSV exporter
    const activeCols = columns.filter((c) => visibleColumns[c.key]);
    const headers = activeCols.map((c) => `"${c.header}"`).join(',');
    const rows = sortedData.map((row) =>
      activeCols.map((c) => `"${String(row[c.key] ?? '').replace(/"/g, '""')}"`).join(',')
    );
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${title || 'export'}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const displayedCols = columns.filter((col) => visibleColumns[col.key]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
      {/* Controls Header */}
      <div className="p-4 border-b border-slate-800 flex flex-wrap gap-3 items-center justify-between bg-slate-900/80">
        <div className="flex items-center gap-3">
          {title && <h3 className="font-semibold text-lg text-slate-100">{title}</h3>}
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
            {totalRecords} records
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder={searchPlaceholder}
              className="pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 w-48 sm:w-64"
            />
          </div>

          {/* Column Visibility Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowColMenu(!showColMenu)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-lg transition"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
              Columns
            </button>
            {showColMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-slate-950 border border-slate-800 rounded-lg shadow-2xl p-2 z-30">
                <p className="text-xs font-semibold text-slate-400 px-2 py-1 uppercase tracking-wider">
                  Toggle Columns
                </p>
                {columns.map((col) => (
                  <label
                    key={col.key}
                    className="flex items-center gap-2 px-2 py-1 text-sm text-slate-300 hover:bg-slate-900 rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={visibleColumns[col.key] ?? true}
                      onChange={(e) =>
                        setVisibleColumns((prev) => ({
                          ...prev,
                          [col.key]: e.target.checked
                        }))
                      }
                      className="rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-0"
                    />
                    <span className="truncate">{col.header}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Export CSV Button */}
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-lg transition"
            title="Export filtered records to CSV"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-slate-950/60 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
            <tr>
              {displayedCols.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-3 font-semibold select-none cursor-pointer hover:text-slate-100 transition"
                  onClick={() => (col.sortable !== false ? handleSort(col.key) : null)}
                >
                  <div className="flex items-center gap-1.5">
                    <span>{col.header}</span>
                    {col.sortable !== false && (
                      <ArrowUpDown
                        className={`w-3 h-3 ${
                          sortKey === col.key ? 'text-amber-400' : 'text-slate-600'
                        }`}
                      />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {isLoading ? (
              <tr>
                <td colSpan={displayedCols.length} className="px-4 py-12 text-center text-slate-500">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-amber-500 border-t-transparent mb-2"></div>
                  <p>Loading records...</p>
                </td>
              </tr>
            ) : paginatedData.length === 0 ? (
              <tr>
                <td colSpan={displayedCols.length} className="px-4 py-12 text-center text-slate-500">
                  <p className="text-base font-medium text-slate-400">No records found</p>
                  <p className="text-xs text-slate-600 mt-1">Try adjusting your search criteria or filters</p>
                </td>
              </tr>
            ) : (
              paginatedData.map((row, index) => (
                <tr key={row.id || index} className="hover:bg-slate-800/40 transition">
                  {displayedCols.map((col) => (
                    <td key={col.key} className="px-4 py-3.5 whitespace-nowrap">
                      {col.render ? col.render(row) : String(row[col.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="p-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4 bg-slate-950/40">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>Rows per page:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span className="hidden sm:inline">
            Showing {(validCurrentPage - 1) * pageSize + 1} -{' '}
            {Math.min(validCurrentPage * pageSize, totalRecords)} of {totalRecords}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setCurrentPage(1)}
            disabled={validCurrentPage <= 1}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
            title="First Page"
          >
            <ChevronsLeft className="w-4 h-4 text-slate-300" />
          </button>
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={validCurrentPage <= 1}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
            title="Previous Page"
          >
            <ChevronLeft className="w-4 h-4 text-slate-300" />
          </button>

          <span className="px-3 py-1 text-xs font-mono font-medium text-slate-300 bg-slate-900 rounded-md border border-slate-800">
            Page {validCurrentPage} of {totalPages}
          </span>

          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={validCurrentPage >= totalPages}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
            title="Next Page"
          >
            <ChevronRight className="w-4 h-4 text-slate-300" />
          </button>
          <button
            onClick={() => setCurrentPage(totalPages)}
            disabled={validCurrentPage >= totalPages}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
            title="Last Page"
          >
            <ChevronsRight className="w-4 h-4 text-slate-300" />
          </button>
        </div>
      </div>
    </div>
  );
}
