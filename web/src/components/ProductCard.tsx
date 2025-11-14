import type { Product } from '../types';

const PLACEHOLDER =
  'https://images.unsplash.com/photo-1503602642458-232111445657?auto=format&fit=crop&w=800&q=60';

type Props = {
  product: Product;
  showStatus?: boolean;
};

export function ProductCard({ product, showStatus = false }: Props) {
  const cover = product.images?.[0] || PLACEHOLDER;
  const formatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  });

  return (
    <article className="product-card">
      <div className="product-card__media">
        <img src={cover} alt={product.title} loading="lazy" />
        {showStatus && <span className={`status-pill status-${product.status}`}>{product.status}</span>}
      </div>
      <div className="product-card__body">
        <h3>{product.title}</h3>
        <p className="product-card__price">{formatter.format(product.price)}</p>
        <p className="product-card__description">{product.description}</p>
        <div className="product-card__meta">
          <span>{product.category}</span>
          {product.artisanId?.name && <span>By {product.artisanId.name}</span>}
        </div>
      </div>
    </article>
  );
}

