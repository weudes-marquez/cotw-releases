import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { Overlay } from './components/Overlay';
import { UserGuide } from './components/UserGuide';
import { NeedZonesPanel } from './components/NeedZonesPanel';
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

    return (
      <div style={{
        width: '100%',
        height: '100vh',
        backgroundColor: '#111827',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontSize: '24px',
        margin: 0,
        padding: 0,
        overflow: 'hidden'
      }}>
        Loading authentication...
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
        <Route path="/" element={<Navigate to={user ? "/dashboard" : "/login"} />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
