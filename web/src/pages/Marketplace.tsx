import { useEffect, useState } from 'react';
import { apiRequest } from '../lib/api';
import type { MarketplaceResponse, Product } from '../types';
import { ProductCard } from '../components/ProductCard';
import { Pagination } from '../components/Pagination';

const categories = ['all', 'Textiles', 'Pottery', 'Jewelry', 'Lighting', 'Woodwork', 'Metalwork'];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_desc', label: 'Price: High → Low' },
  { value: 'price_asc', label: 'Price: Low → High' },
];

export function MarketplacePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState('newest');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: '12',
          sort,
        });
        if (activeSearch.trim()) params.append('q', activeSearch.trim());
        if (category !== 'all') params.append('category', category);

        const data = await apiRequest<MarketplaceResponse>(`/api/marketplace?${params.toString()}`);
        if (!cancelled) {
          setProducts(data.products);
          setTotalPages(data.pagination.totalPages || 1);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || 'Failed to load marketplace');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [page, activeSearch, category, sort]);

  function handleSearchSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPage(1);
    setActiveSearch(search);
  }

  function handleFiltersChange(nextCategory: string, nextSort: string) {
    setCategory(nextCategory);
    setSort(nextSort);
    setPage(1);
  }

  return (
    <section className="page marketplace-page">
      <header className="page__header">
        <div>
          <p className="eyebrow">Discover handmade originals</p>
          <h1>Marketplace</h1>
        </div>
        <div className="filters">
          <form onSubmit={handleSearchSubmit}>
            <input
              type="search"
              placeholder="Search by title"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button type="submit">Search</button>
          </form>
          <div className="filter-row">
            <label>
              Category
              <select value={category} onChange={(e) => handleFiltersChange(e.target.value, sort)}>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat === 'all' ? 'All categories' : cat}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Sort
              <select value={sort} onChange={(e) => handleFiltersChange(category, e.target.value)}>
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </header>

      {loading && <p className="muted">Loading marketplace...</p>}
      {error && <p className="error">{error}</p>}
      {!loading && !products.length && <p className="muted">No products found.</p>}

      <div className="grid">
        {products.map((product) => (
          <ProductCard key={product._id} product={product} />
        ))}
      </div>

      <Pagination page={page} totalPages={totalPages} onChange={setPage} />
    </section>
  );
}

