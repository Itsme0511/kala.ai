import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import type { Artisan, Product } from '../types';
import { ProductCard } from '../components/ProductCard';

type AuthFormState = {
  email: string;
  password: string;
};

const tabConfig = [
  { id: 'profile', label: 'Profile' },
  { id: 'products', label: 'My Products' },
  { id: 'create', label: 'Create Product' },
];

export function AccountPage() {
  const navigate = useNavigate();
  const { token, artisan, login, register, logout, loading, refreshProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [myProducts, setMyProducts] = useState<Product[]>([]);
  const [productsVersion, setProductsVersion] = useState(0);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState<string | null>(null);

  useEffect(() => {
    if (token && activeTab === 'products') {
      loadMyProducts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, activeTab, productsVersion]);

  async function loadMyProducts() {
    if (!token) return;
    setProductsLoading(true);
    setProductsError(null);
    try {
      const { products } = await apiRequest<{ products: Product[] }>('/api/products/mine', { token });
      setMyProducts(products);
    } catch (err: any) {
      setProductsError(err.message || 'Failed to load products');
    } finally {
      setProductsLoading(false);
    }
  }

  function triggerProductsRefresh() {
    setProductsVersion((prev) => prev + 1);
  }

  if (!token) {
    return (
      <section className="page account-page">
        <header className="page__header">
          <div>
            <p className="eyebrow">Manage your artisan business</p>
            <h1>Account</h1>
            <p>Sign in or create an account to manage your profile and products.</p>
          </div>
        </header>
        <AuthForms onLogin={login} onRegister={register} loading={loading} />
      </section>
    );
  }

  return (
    <section className="page account-page">
      <header className="page__header">
        <div>
          <p className="eyebrow">Welcome back</p>
          <h1>Account</h1>
          <p>Update your profile, manage inventory, and publish to the marketplace.</p>
        </div>
        <button type="button" className="link" onClick={logout}>
          Logout
        </button>
      </header>

      <nav className="tabs">
        {tabConfig.map((tab) => (
          <button
            key={tab.id}
            className={tab.id === activeTab ? 'active' : ''}
            onClick={() => setActiveTab(tab.id)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === 'profile' && (
        <ProfileTab
          artisan={artisan}
          token={token}
          onUpdated={() => {
            refreshProfile();
          }}
        />
      )}

      {activeTab === 'products' && (
        <MyProductsTab
          products={myProducts}
          loading={productsLoading}
          error={productsError}
          token={token}
          onRefresh={triggerProductsRefresh}
        />
      )}

      {activeTab === 'create' && (
        <CreateProductTab
          token={token}
          onCreated={(redirectToMarketplace) => {
            triggerProductsRefresh();
            if (redirectToMarketplace) {
              navigate('/marketplace');
            }
          }}
        />
      )}
    </section>
  );
}

function AuthForms({
  onLogin,
  onRegister,
  loading,
}: {
  onLogin: (payload: AuthFormState) => Promise<void>;
  onRegister: (payload: { name: string; email: string; password: string; location?: string }) => Promise<void>;
  loading: boolean;
}) {
  const [loginState, setLoginState] = useState<AuthFormState>({ email: '', password: '' });
  const [registerState, setRegisterState] = useState({ name: '', email: '', password: '', location: '' });
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    try {
      await onLogin(loginState);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    }
  }

  async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    try {
      await onRegister(registerState);
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    }
  }

  return (
    <div className="auth-panels">
      <form onSubmit={handleLogin}>
        <h2>Sign in</h2>
        <label>
          Email
          <input
            type="email"
            value={loginState.email}
            onChange={(e) => setLoginState({ ...loginState, email: e.target.value })}
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={loginState.password}
            onChange={(e) => setLoginState({ ...loginState, password: e.target.value })}
            required
          />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <form onSubmit={handleRegister}>
        <h2>Create artisan account</h2>
        <label>
          Name
          <input
            type="text"
            value={registerState.name}
            onChange={(e) => setRegisterState({ ...registerState, name: e.target.value })}
            required
          />
        </label>
        <label>
          Location
          <input
            type="text"
            value={registerState.location}
            onChange={(e) => setRegisterState({ ...registerState, location: e.target.value })}
          />
        </label>
        <label>
          Email
          <input
            type="email"
            value={registerState.email}
            onChange={(e) => setRegisterState({ ...registerState, email: e.target.value })}
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={registerState.password}
            onChange={(e) => setRegisterState({ ...registerState, password: e.target.value })}
            required
          />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? 'Creating…' : 'Register'}
        </button>
      </form>

      {error && <p className="error">{error}</p>}
    </div>
  );
}

function ProfileTab({
  artisan,
  token,
  onUpdated,
}: {
  artisan: Artisan | null;
  token: string;
  onUpdated: () => void;
}) {
  const [form, setForm] = useState({
    name: artisan?.name || '',
    location: artisan?.location || '',
    bio: artisan?.bio || '',
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm({
      name: artisan?.name || '',
      location: artisan?.location || '',
      bio: artisan?.bio || '',
    });
  }, [artisan]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await apiRequest('/api/account/profile', {
        method: 'PUT',
        body: form,
        token,
      });
      setMessage('Profile updated');
      onUpdated();
    } catch (err: any) {
      setError(err.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel">
      <form onSubmit={handleSubmit} className="stack">
        <label>
          Name
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </label>
        <label>
          Location
          <input
            type="text"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
          />
        </label>
        <label>
          Bio
          <textarea
            rows={4}
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
          />
        </label>
        <button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save profile'}
        </button>
        {message && <p className="success">{message}</p>}
        {error && <p className="error">{error}</p>}
      </form>
    </div>
  );
}

function MyProductsTab({
  products,
  loading,
  error,
  token,
  onRefresh,
}: {
  products: Product[];
  loading: boolean;
  error: string | null;
  token: string;
  onRefresh: () => void;
}) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  async function toggleStatus(product: Product) {
    setActionLoading(product._id);
    try {
      await apiRequest(`/api/products/${product._id}`, {
        method: 'PUT',
        token,
        body: { status: product.status === 'published' ? 'draft' : 'published' },
      });
      onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) return <p className="muted">Loading your products…</p>;
  if (error) return <p className="error">{error}</p>;

  return (
    <div className="my-products">
      {!products.length && <p className="muted">You haven’t created any products yet.</p>}
      <div className="grid">
        {products.map((product) => (
          <div key={product._id} className="product-manage-card">
            <ProductCard product={product} showStatus />
            <button
              type="button"
              onClick={() => toggleStatus(product)}
              disabled={actionLoading === product._id}
            >
              {actionLoading === product._id
                ? 'Updating…'
                : product.status === 'published'
                  ? 'Move to draft'
                  : 'Publish'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

const defaultForm = {
  title: '',
  description: '',
  price: '',
  category: 'Textiles',
  stock: '0',
  images: '',
  status: 'draft',
};

function CreateProductTab({
  token,
  onCreated,
}: {
  token: string;
  onCreated: (redirectToMarketplace: boolean) => void;
}) {
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const imageList = useMemo(
    () =>
      form.images
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    [form.images]
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const payload = {
        title: form.title,
        description: form.description,
        price: Number(form.price || 0),
        category: form.category,
        stock: Number(form.stock || 0),
        images: imageList,
        status: form.status,
      };

      await apiRequest('/api/products', {
        method: 'POST',
        token,
        body: payload,
      });

      const published = form.status === 'published';
      setMessage(published ? 'Product published!' : 'Product saved to drafts.');
      onCreated(published);
      setForm({ ...defaultForm });
    } catch (err: any) {
      setError(err.message || 'Failed to save product');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="panel stack">
      <label>
        Title
        <input
          type="text"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          required
        />
      </label>
      <label>
        Description
        <textarea
          rows={5}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          required
        />
      </label>
      <label>
        Price (₹)
        <input
          type="number"
          min="0"
          value={form.price}
          onChange={(e) => setForm({ ...form, price: e.target.value })}
          required
        />
      </label>
      <label>
        Category
        <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
          <option value="Textiles">Textiles</option>
          <option value="Pottery">Pottery</option>
          <option value="Jewelry">Jewelry</option>
          <option value="Lighting">Lighting</option>
          <option value="Woodwork">Woodwork</option>
          <option value="Metalwork">Metalwork</option>
        </select>
      </label>
      <label>
        Stock
        <input
          type="number"
          min="0"
          value={form.stock}
          onChange={(e) => setForm({ ...form, stock: e.target.value })}
        />
      </label>
      <label>
        Image URLs (one per line)
        <textarea
          rows={4}
          value={form.images}
          onChange={(e) => setForm({ ...form, images: e.target.value })}
          placeholder="https://example.com/photo.jpg"
        />
      </label>
      <label>
        Status
        <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
          <option value="draft">Draft</option>
          <option value="published">Publish now</option>
        </select>
      </label>
      <button type="submit" disabled={saving}>
        {saving ? 'Saving…' : 'Save product'}
      </button>
      {message && <p className="success">{message}</p>}
      {error && <p className="error">{error}</p>}
    </form>
  );
}

