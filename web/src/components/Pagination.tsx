type Props = {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
};

export function Pagination({ page, totalPages, onChange }: Props) {
  if (totalPages <= 1) return null;

  const pages = [];
  for (let i = 1; i <= totalPages; i += 1) {
    pages.push(i);
  }

  return (
    <div className="pagination">
      <button
        type="button"
        disabled={page === 1}
        onClick={() => onChange(page - 1)}
      >
        Prev
      </button>
      {pages.map((p) => (
        <button
          key={p}
          type="button"
          className={p === page ? 'active' : ''}
          onClick={() => onChange(p)}
        >
          {p}
        </button>
      ))}
      <button
        type="button"
        disabled={page === totalPages}
        onClick={() => onChange(page + 1)}
      >
        Next
      </button>
    </div>
  );
}

