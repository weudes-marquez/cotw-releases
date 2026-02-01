import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { Overlay } from './components/Overlay';
import { UserGuide } from './components/UserGuide';
import { NeedZonesPanel } from './components/NeedZonesPanel';
import { DetailedStats } from './components/DetailedStats';
import { GeneralSettings } from './components/GeneralSettings';
import { useEffect, useState } from 'react';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';

function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) {
    const isOverlay = window.location.hash.includes('overlay');
    const isDetailedStats = window.location.hash.includes('detailed-stats');
    const isTransparent = isOverlay || isDetailedStats;

    return (
      <div style={{
        width: '100%',
        height: '100vh',
        backgroundColor: isTransparent ? 'transparent' : '#1c1917', // stone-900
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: isTransparent ? 'transparent' : '#a8a29e', // stone-400
        fontSize: '14px',
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        margin: 0,
        padding: 0,
        overflow: 'hidden',
        fontFamily: 'Inter, system-ui, sans-serif'
      }}>
        {!isTransparent && (
          <>
            <div className="animate-pulse mb-4">
              <i className="fa-solid fa-circle-notch fa-spin text-hunter-orange text-2xl"></i>
            </div>
            Autenticando...
          </>
        )}
      </div>
    );
  }

  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/dashboard" />} />
        <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/login" />} />
        <Route path="/overlay" element={<Overlay />} />
        <Route path="/guide" element={<UserGuide />} />
        <Route path="/need-zones/:position" element={<NeedZonesPanel show={true} onClose={() => window.close()} />} />
        <Route path="/detailed-stats" element={<DetailedStats />} />
        <Route path="/settings" element={<GeneralSettings />} />
        <Route path="/" element={<Navigate to={user ? "/dashboard" : "/login"} />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
