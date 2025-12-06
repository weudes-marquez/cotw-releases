import { auth, db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';

export const SimpleDashboard = () => {
    console.log('📊 SimpleDashboard rendering...');
    console.log('👤 Current user:', auth.currentUser?.email);

    const navigate = useNavigate();
    const [collections, setCollections] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchCollections = async () => {
            console.log('🔍 Starting to fetch collections...');
            try {
                // Tentar ler a coleção 'species'
                console.log('📚 Fetching species collection...');
                const speciesRef = collection(db, 'species');
                const speciesSnapshot = await getDocs(speciesRef);

                console.log('✅ Species snapshot received. Size:', speciesSnapshot.size);

                const speciesData = speciesSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                console.log('📊 Species data:', speciesData);
                setCollections(speciesData);
                setLoading(false);
            } catch (err: any) {
                console.error('❌ Error fetching collections:', err);
                console.error('Error code:', err.code);
                console.error('Error message:', err.message);
                setError(err.message);
                setLoading(false);
            }
        };

        fetchCollections();
    }, []);

    const handleLogout = async () => {
        try {
            await auth.signOut();
            console.log('✅ Logged out successfully');
            navigate('/login');
        } catch (error) {
            console.error('❌ Logout error:', error);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            backgroundColor: '#111827',
            padding: '40px',
            color: 'white'
        }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                <header style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '40px'
                }}>
                    <div>
                        <h1 style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '8px' }}>
                            Dashboard - Firestore Debug
                        </h1>
                        <p style={{ color: '#9ca3af', fontSize: '14px' }}>
                            Logged in as: {auth.currentUser?.email}
                        </p>
                    </div>
                    <button
                        onClick={handleLogout}
                        style={{
                            backgroundColor: '#dc2626',
                            color: 'white',
                            padding: '12px 24px',
                            borderRadius: '8px',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '16px',
                            fontWeight: 'bold'
                        }}
                    >
                        Logout
                    </button>
                </header>

                <div style={{
                    backgroundColor: '#1f2937',
                    padding: '40px',
                    borderRadius: '12px'
                }}>
                    <h2 style={{ fontSize: '24px', marginBottom: '20px' }}>
                        🔍 Testando leitura do Firestore
                    </h2>

                    {loading && (
                        <p style={{ fontSize: '18px', color: '#9ca3af' }}>
                            ⏳ Carregando dados da coleção 'species'...
                        </p>
                    )}

                    {error && (
                        <div style={{
                            backgroundColor: '#7f1d1d',
                            padding: '20px',
                            borderRadius: '8px',
                            marginTop: '20px'
                        }}>
                            <h3 style={{ fontSize: '18px', marginBottom: '10px', color: '#fca5a5' }}>
                                ❌ Erro ao ler Firestore:
                            </h3>
                            <p style={{ fontSize: '14px', color: '#fecaca' }}>{error}</p>
                        </div>
                    )}

                    {!loading && !error && (
                        <div style={{
                            backgroundColor: '#111827',
                            padding: '20px',
                            borderRadius: '8px',
                            marginTop: '20px'
                        }}>
                            <h3 style={{ fontSize: '18px', marginBottom: '10px' }}>
                                ✅ Coleção 'species' ({collections.length} documentos):
                            </h3>
                            {collections.length === 0 ? (
                                <p style={{ color: '#9ca3af' }}>Nenhum documento encontrado na coleção.</p>
                            ) : (
                                <ul style={{
                                    listStyle: 'none',
                                    padding: 0,
                                    fontSize: '14px',
                                    lineHeight: '1.8',
                                    textAlign: 'left'
                                }}>
                                    {collections.map((item, index) => (
                                        <li key={item.id} style={{
                                            marginBottom: '10px',
                                            padding: '10px',
                                            backgroundColor: '#1f2937',
                                            borderRadius: '4px'
                                        }}>
                                            <strong>#{index + 1} - ID:</strong> {item.id}<br />
                                            <strong>Dados:</strong> {JSON.stringify(item, null, 2)}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
