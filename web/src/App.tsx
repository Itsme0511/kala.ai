import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { MarketplacePage } from './pages/Marketplace';
import { AccountPage } from './pages/Account';

function App() {
  const location = useLocation();

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="logo">
          <span role="img" aria-label="kala">
            🪔
          </span>
          <strong>Kala.ai</strong>
        </div>
        <nav>
          <Link to="/marketplace" className={location.pathname === '/marketplace' ? 'active' : ''}>
            Marketplace
          </Link>
          <Link to="/account" className={location.pathname === '/account' ? 'active' : ''}>
            Account
          </Link>
        </nav>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<Navigate to="/marketplace" replace />} />
          <Route path="/marketplace" element={<MarketplacePage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="*" element={<Navigate to="/marketplace" replace />} />
        </Routes>
      </main>

      <footer className="site-footer">
        <p>© {new Date().getFullYear()} Kala.ai · Empowering artisans with AI.</p>
      </footer>
    </div>
  );
}

export default App;

