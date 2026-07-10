import { useMemo, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

/*
 * The shared data-table pattern (plan/08-design-guidelines.md): sticky header,
 * column sort, a global filter box, client-side pagination, and explicit
 * empty/loading states. Built once and reused everywhere a list of
 * students/batches/tests appears — 1,000+ row rosters are the most-used surface.
 */

export interface Column<T> {
  key: string;
  header: string;
  /** Cell renderer. */
  render: (row: T) => ReactNode;
  /** Value used for sorting/filtering; enables sort when provided. */
  sortValue?: (row: T) => string | number;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[] | undefined;
  isLoading?: boolean;
  getRowKey: (row: T) => string | number;
  onRowClick?: (row: T) => void;
  /** Placeholder for the global filter input; filtering hides the box if absent. */
  filterPlaceholder?: string;
  emptyMessage?: string;
  pageSize?: number;
}

export function DataTable<T>({
  columns,
  rows,
  isLoading,
  getRowKey,
  onRowClick,
  filterPlaceholder,
  emptyMessage = 'Nothing here yet.',
  pageSize = 25,
}: DataTableProps<T>) {
  const [filter, setFilter] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);

  const processed = useMemo(() => {
    let data = rows ?? [];
    if (filter.trim()) {
      const q = filter.toLowerCase();
      data = data.filter((row) =>
        columns.some((c) => {
          const v = c.sortValue ? c.sortValue(row) : undefined;
          return v !== undefined && String(v).toLowerCase().includes(q);
        })
      );
    }
    if (sortKey) {
      const col = columns.find((c) => c.key === sortKey);
      if (col?.sortValue) {
        data = [...data].sort((a, b) => {
          const av = col.sortValue!(a);
          const bv = col.sortValue!(b);
          const cmp = av < bv ? -1 : av > bv ? 1 : 0;
          return sortDir === 'asc' ? cmp : -cmp;
        });
      }
    }
    return data;
  }, [rows, filter, sortKey, sortDir, columns]);

  const pageCount = Math.max(1, Math.ceil(processed.length / pageSize));
  const clampedPage = Math.min(page, pageCount - 1);
  const pageRows = processed.slice(clampedPage * pageSize, clampedPage * pageSize + pageSize);

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {filterPlaceholder && (
        <div className="flex items-center justify-between gap-3">
          <Input
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(0);
            }}
            placeholder={filterPlaceholder}
            className="max-w-xs"
          />
          <span className="text-sm text-muted">{processed.length} results</span>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-bg">
            <tr className="border-b border-border text-left text-muted">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cn('px-4 py-2.5 font-medium', c.sortValue && 'cursor-pointer select-none', c.className)}
                  onClick={() => c.sortValue && toggleSort(c.key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {c.header}
                    {sortKey === c.key && <span aria-hidden>{sortDir === 'asc' ? '↑' : '↓'}</span>}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <SkeletonRows cols={columns.length} />
            ) : pageRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-muted">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              pageRows.map((row) => (
                <tr
                  key={getRowKey(row)}
                  onClick={() => onRowClick?.(row)}
                  className={cn(
                    'border-b border-border last:border-0',
                    onRowClick && 'cursor-pointer hover:bg-bg'
                  )}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={cn('px-4 py-2.5 text-ink', c.className)}>
                      {c.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <button
            className="rounded-md border border-border px-2 py-1 disabled:opacity-40"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={clampedPage === 0}
          >
            Prev
          </button>
          <span className="text-muted">
            Page {clampedPage + 1} of {pageCount}
          </span>
          <button
            className="rounded-md border border-border px-2 py-1 disabled:opacity-40"
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={clampedPage >= pageCount - 1}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

function SkeletonRows({ cols }: { cols: number }) {
  return (
    <>
      {Array.from({ length: 5 }).map((_, r) => (
        <tr key={r} className="border-b border-border last:border-0">
          {Array.from({ length: cols }).map((__, c) => (
            <td key={c} className="px-4 py-3">
              <div className="h-4 w-3/4 animate-pulse rounded bg-border" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
