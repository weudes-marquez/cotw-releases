import { useState, useEffect } from 'react';
import { auth } from '../firebase'; // Keep auth for now if still using Firebase Auth
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { sanitizeText, sanitizeId } from '../utils/sanitize';
import { useGrindSession, getSpecies, getFurTypes, authenticateWithFirebase, upsertUserProfile, getUserHistoricalStats } from '../supabase_integration';

interface Animal {
    id: string;
    Name: string;
}

interface FurType {
    id: string;
    name: string;
    imageURL: string;
}

export const Dashboard = () => {
    const [animals, setAnimals] = useState<Animal[]>([]);
    const [selectedAnimal, setSelectedAnimal] = useState<Animal | null>(null);
    const [loading, setLoading] = useState(true);
    const [historicalStats, setHistoricalStats] = useState<any[]>([]);
    const [showStats, setShowStats] = useState(false);
    const [furTypes, setFurTypes] = useState<FurType[]>([]);
    const [showFurTypes, setShowFurTypes] = useState(false);
    const [furTypeSearch, setFurTypeSearch] = useState('');
    const [selectedAnimalForStats, setSelectedAnimalForStats] = useState<string | null>(null);
    const [statsSearch, setStatsSearch] = useState('');
    const [showGrandTotal, setShowGrandTotal] = useState(false);
    const [showCurrentSession, setShowCurrentSession] = useState(false);
    const [_selectedFurType, setSelectedFurType] = useState<FurType | null>(null);
    const [startDate] = useState(new Date().toLocaleDateString('pt-BR'));
    const navigate = useNavigate();

    const [user, setUser] = useState(auth.currentUser);

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (u) => {
            setUser(u);
            if (u) {
                try {
                    // 1. Criar perfil do usuário primeiro (CRITICAL)
                    await upsertUserProfile(
                        u.uid,
                        u.email || '',
                        u.displayName || u.email || 'Usuário'
                    );
                    console.log('✅ Perfil de usuário criado/atualizado');

                    // 2. Tentar autenticação segura (opcional, pode falhar)
                    const token = await u.getIdToken();
                    const success = await authenticateWithFirebase(token);
                    if (!success) {
                        console.warn('⚠️ Autenticação Edge Function falhou (RLS pode bloquear)');
                    } else {
                        console.log('✅ Autenticado com segurança no Supabase');
                    }
                } catch (err) {
                    console.error('Erro ao configurar usuário:', err);
                }
            }
        });
        return () => unsubscribe();
    }, []);

    // Hook de persistência
    const { session, stats, loading: sessionLoading, addKill, removeLastKill, finishCurrentSession } = useGrindSession(
        user?.uid,
        selectedAnimal?.id || '',
        selectedAnimal?.Name || ''
    );

    const currentKillCount = session?.total_kills || 0;

    useEffect(() => {
        const fetchAnimals = async () => {
            try {
                console.log('🦌 Fetching animals from Supabase...');
                const data = await getSpecies();

                const animalList: Animal[] = (data || []).map((a: any) => ({
                    id: a.id,
                    Name: a.name // Já está em PT-BR na tabela
                }));

                setAnimals(animalList);

                if (animalList.length > 0) {
                    setSelectedAnimal(animalList[0]);
                }
            } catch (error) {
                console.error('❌ Error fetching animals:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchAnimals();
    }, []);

    const handleAnimalSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const animalId = sanitizeId(e.target.value);
        const animal = animals.find((a) => a.id === animalId);
        if (animal) {
            setSelectedAnimal(animal);
        }
    };

    const updateCounter = (change: number) => {
        if (change > 0) {
            addKill();
        } else {
            removeLastKill();
        }
    };

    const resetGrind = async () => {
        if (window.confirm(`Deseja encerrar a contagem atual para ${selectedAnimal?.Name}?`)) {
            await finishCurrentSession();
        }
    };

    const fetchFurTypes = async () => {
        try {
            console.log('🎨 Fetching fur types from Supabase...');
            const data = await getFurTypes();

            const furTypesList: FurType[] = (data || []).map((f: any) => ({
                id: f.id,
                name: f.name,
                imageURL: f.image_url || ''
            }));

            setFurTypes(furTypesList);
            setShowFurTypes(true);
            setFurTypeSearch('');
        } catch (error) {
            console.error('❌ Error fetching fur types:', error);
        }
    };

    const handleFurTypeSelect = (furType: FurType) => {
        // Sanitizar dados da pelagem antes de salvar
        const sanitizedFurType = {
            ...furType,
            id: sanitizeId(furType.id),
            name: sanitizeText(furType.name, 100),
            imageURL: furType.imageURL
        };
        setSelectedFurType(sanitizedFurType);

        // Registrar abate com pelagem rara
        addKill(false, false, sanitizedFurType.id, sanitizedFurType.name);

        setShowFurTypes(false);
    };

    const filteredFurTypes = furTypes.filter(furType =>
        furType.name.toLowerCase().includes(furTypeSearch.toLowerCase())
    );

    const handleLogout = async () => {
        try {
            await signOut(auth);
            navigate('/');
        } catch (error) {
            console.error('Error logging out:', error);
        }
    };

    const handleToggleStats = async () => {
        if (!showStats && user) {
            // Carregar estatísticas quando abre o modal
            try {
                const stats = await getUserHistoricalStats(user.uid);
                setHistoricalStats(stats);
            } catch (error) {
                console.error('Erro ao carregar estatísticas:', error);
            }
        }
        setShowStats(!showStats);
    };

    // Listen for global hotkeys from Electron (after all functions are defined)
    useEffect(() => {
        if (!window.ipcRenderer) return;

        const handleIncrement = () => {
            console.log('📩 Hotkey received: +1');
            updateCounter(1);
        };

        const handleDecrement = () => {
            console.log('📩 Hotkey received: -1');
            updateCounter(-1);
        };

        const handleStats = () => {
            console.log('📩 Hotkey received: Open stats');
            handleToggleStats();
        };

        window.ipcRenderer.on('hotkey-increment', handleIncrement);
        window.ipcRenderer.on('hotkey-decrement', handleDecrement);
        window.ipcRenderer.on('hotkey-stats', handleStats);

        return () => {
            window.ipcRenderer.off('hotkey-increment', handleIncrement);
            window.ipcRenderer.off('hotkey-decrement', handleDecrement);
            window.ipcRenderer.off('hotkey-stats', handleStats);
        };
    }, []); // Empty deps - functions are stable

    if (loading) {
        return (
            <div className="w-full h-screen overflow-hidden bg-stone-950 text-gray-100 font-sans relative flex items-center justify-center" style={{ margin: 0, padding: 0 }}>
                <div className="text-center">
                    <i className="fa-solid fa-circle-notch fa-spin text-hunter-orange text-4xl mb-4"></i>
                    <p className="text-stone-400 uppercase tracking-wider text-sm">Carregando...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-screen overflow-hidden bg-stone-950 text-gray-100 font-sans relative" style={{ margin: 0, padding: 0 }}>
            {/* Background Layers */}
            <div className="absolute inset-0 w-full h-full overflow-hidden z-0 pointer-events-none">
                <div
                    className="absolute inset-0 animate-ken-burns"
                    style={{
                        backgroundImage: 'url(https://images.unsplash.com/photo-1519331379826-f9686293dea8?q=80&w=2560&auto=format&fit=crop)',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center'
                    }}
                ></div>
                <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-stone-900/70 to-black/95"></div>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-transparent to-black opacity-80"></div>
            </div>

            {/* Main Container */}
            <div className="relative z-10 flex items-center justify-center h-full">
                {/* MAIN CARD CONTAINER */}
                <div className="w-full h-full max-w-md glass-panel shadow-2xl relative overflow-hidden flex flex-col">
                    {/* Decorative Top Line */}
                    <div className="absolute top-0 left-0 w-full h-1 bg-hunter-orange shadow-[0_0_10px_rgba(217,93,30,0.5)] z-20"></div>

                    {/* Stats Button (Top Right Overlay) */}
                    <div className="absolute top-3 right-3 z-30">
                        <button
                            onClick={handleToggleStats}
                            className="w-8 h-8 rounded-full bg-black/60 border border-white/20 text-stone-300 hover:text-hunter-orange hover:border-hunter-orange transition-all flex items-center justify-center backdrop-blur-md shadow-lg"
                        >
                            <i className="fa-solid fa-chart-column text-sm"></i>
                        </button>
                    </div>

                    {/* Hero Section */}
                    <div className="relative h-12 w-full shrink-0 overflow-hidden border-b border-hunter-orange/50">
                        <img
                            src="https://images.unsplash.com/photo-1474511320723-9a56873867b5?q=80&w=2072&auto=format&fit=crop"
                            alt="Target Animal"
                            className="w-full h-full object-cover opacity-80 transition-opacity duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-stone-900 via-transparent to-black/40"></div>

                        {/* Title Overlay */}
                        <div className="absolute bottom-0.5 left-2 text-white">
                            <h2 className="font-serif text-xs font-bold leading-tight text-shadow">Pin Planner Grind Counter</h2>
                        </div>
                    </div>

                    {/* Scrollable Content Area */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gradient-to-b from-stone-900 to-stone-950">
                        {/* Animal Selector Menu */}
                        <div className="relative group">
                            <label className="block text-[8px] uppercase tracking-widest text-stone-500 mb-1 font-bold">
                                Alvo da Caçada
                            </label>
                            <div className="relative">
                                <select
                                    value={selectedAnimal?.id || ''}
                                    onChange={handleAnimalSelect}
                                    className="appearance-none w-full bg-stone-800 border border-stone-600 hover:border-hunter-orange text-white py-1 px-2 pr-6 rounded-none focus:outline-none focus:ring-1 focus:ring-hunter-orange transition-colors font-serif text-xs cursor-pointer"
                                >
                                    {animals.map((animal) => (
                                        <option key={animal.id} value={animal.id}>
                                            {animal.Name}
                                        </option>
                                    ))}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-hunter-orange">
                                    <i className="fa-solid fa-caret-down text-xs"></i>
                                </div>
                            </div>
                        </div>

                        {/* The Grind Counter */}
                        <div className="bg-stone-800/30 border border-white/5 p-3 rounded-sm relative overflow-hidden">
                            {/* Background texture */}
                            <div className="absolute top-1 right-1 p-0 opacity-10 pointer-events-none">
                                <i className="fa-solid fa-crosshairs text-3xl"></i>
                            </div>

                            <div className="flex items-center justify-between mb-3 relative z-10">
                                <button
                                    onClick={() => updateCounter(-1)}
                                    className="w-7 h-7 rounded-sm border border-stone-600 text-stone-400 hover:border-red-500 hover:text-red-500 hover:bg-red-500/10 transition-all active:scale-95 flex items-center justify-center text-xs"
                                >
                                    <i className="fa-solid fa-minus"></i>
                                </button>

                                <div className="text-center">
                                    <span
                                        className="block text-4xl font-sans font-bold text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.2)] transition-transform duration-100"
                                    >
                                        {sessionLoading ? (
                                            <i className="fa-solid fa-circle-notch fa-spin text-sm text-stone-500"></i>
                                        ) : (
                                            currentKillCount
                                        )}
                                    </span>
                                    <span className="text-[10px] uppercase tracking-[0.3em] text-stone-500">Abates</span>
                                </div>

                                <button
                                    onClick={() => updateCounter(1)}
                                    className="w-7 h-7 rounded-sm border border-stone-600 text-stone-400 hover:border-hunter-orange hover:text-hunter-orange hover:bg-hunter-orange/10 transition-all active:scale-95 flex items-center justify-center text-xs"
                                >
                                    <i className="fa-solid fa-plus"></i>
                                </button>
                            </div>

                            {/* Extra Toggles & GREAT ONE */}
                            <div className="space-y-2 relative z-10">
                                {/* Row 1: Standard Rares */}
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => addKill(true)}
                                        className="py-1 px-2 text-[8px] font-bold border border-stone-600 bg-stone-900/50 text-stone-400 hover:text-blue-300 hover:border-blue-400 transition-colors rounded-sm flex items-center justify-center gap-1 active:bg-blue-900/20"
                                    >
                                        <i className="fa-regular fa-gem"></i> DIAMANTE
                                    </button>
                                    <button
                                        onClick={fetchFurTypes}
                                        className="py-1 px-2 text-[8px] font-bold border border-stone-600 bg-stone-900/50 text-stone-400 hover:text-purple-300 hover:border-purple-400 transition-colors rounded-sm flex items-center justify-center gap-1 active:bg-purple-900/20"
                                    >
                                        <i className="fa-solid fa-star"></i> RARO
                                    </button>
                                </div>

                                {/* Row 2: THE GREAT ONE */}
                                <button
                                    onClick={() => addKill(false, true)}
                                    className="w-full py-1.5 px-2 text-[9px] font-bold border border-yellow-600/50 bg-gradient-to-r from-yellow-900/20 via-yellow-800/10 to-yellow-900/20 text-go-gold hover:bg-go-gold hover:text-black hover:border-go-gold hover:shadow-[0_0_20px_rgba(251,191,36,0.4)] transition-all duration-300 rounded-sm flex items-center justify-center gap-1 group animate-pulse-gold active:scale-[0.98]"
                                >
                                    <i className="fa-solid fa-crown text-xs group-hover:animate-bounce"></i>
                                    <span className="tracking-[0.15em]">GREAT ONE</span>
                                    <i className="fa-solid fa-crown text-xs group-hover:animate-bounce"></i>
                                </button>

                                {/* Session Date */}
                                <div className="mt-2 pt-2 border-t border-white/10 text-center">
                                    <p className="text-[7px] uppercase text-stone-500 tracking-wider">Início do Grind</p>
                                    <p className="text-stone-300 font-mono text-[9px]">{startDate}</p>
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="grid grid-cols-2 gap-1.5 border-t border-white/10 pt-1.5">
                            <button
                                onClick={resetGrind}
                                className="py-0.5 px-1.5 text-[7px] font-bold border border-red-600 bg-red-900/20 text-red-400 hover:bg-red-600 hover:text-white transition-all rounded-sm flex items-center justify-center gap-0.5 active:scale-95"
                            >
                                <i className="fa-solid fa-xmark text-xs"></i>
                                <span className="uppercase tracking-wide">Encerrar</span>
                            </button>
                            <button
                                onClick={handleLogout}
                                className="py-0.5 px-1.5 text-[7px] font-bold border border-stone-600 bg-stone-900/50 text-stone-400 hover:bg-hunter-orange hover:text-white hover:border-hunter-orange transition-all rounded-sm flex items-center justify-center gap-0.5 active:scale-95"
                            >
                                <i className="fa-solid fa-power-off text-xs"></i>
                                <span className="uppercase tracking-wide">Sair</span>
                            </button>
                        </div>

                        {/* Promo Footer */}
                        <div className="mt-1.5 pt-1.5 border-t border-white/10 text-center">
                            <p className="text-[9px] text-stone-500 mb-0.5">Conheça nosso outro app</p>
                            <a
                                href="https://cotwpinplanner.app"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-hunter-orange hover:text-yellow-400 transition-colors text-[9px] font-bold tracking-wide"
                            >
                                COTW Pin Planner →
                            </a>
                        </div>
                    </div>

                    {/* STATS MODAL */}
                    {showStats && (
                        <div className="absolute inset-0 z-50 bg-stone-950/95 backdrop-blur-md flex flex-col animate-fade-in">
                            <div className="p-2 border-b border-white/10 flex justify-between items-center bg-stone-900 shadow-lg">
                                <h3 className="font-serif text-white uppercase tracking-wider text-xs">
                                    <i className="fa-solid fa-chart-pie text-hunter-orange mr-2"></i> Estatísticas
                                </h3>
                                <button
                                    onClick={() => setShowStats(false)}
                                    className="text-stone-400 hover:text-white transition-colors w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/10"
                                >
                                    <i className="fa-solid fa-xmark text-base"></i>
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-3 space-y-3">
                                {/* Grand Total Statistics - All Species Combined */}
                                {historicalStats.length > 0 && (
                                    <div className="bg-gradient-to-r from-stone-900 to-stone-800 border-2 border-hunter-orange/50 rounded-sm overflow-hidden">
                                        <div
                                            className="p-3 cursor-pointer hover:bg-hunter-orange/5 transition-colors flex justify-between items-center"
                                            onClick={() => setShowGrandTotal(!showGrandTotal)}
                                        >
                                            <h4 className="text-white uppercase text-sm font-bold flex items-center gap-2">
                                                <i className="fa-solid fa-globe"></i> Total Geral
                                            </h4>
                                            <i className={`fa-solid fa-chevron-${showGrandTotal ? 'up' : 'down'} text-stone-400 text-xs`}></i>
                                        </div>

                                        {showGrandTotal && (
                                            <div className="px-3 pb-3 animate-fade-in">
                                                <div className="grid grid-cols-2 gap-2 text-xs">
                                                    <div className="bg-black/30 p-2 rounded">
                                                        <span className="text-stone-400 text-[10px] uppercase block">Total de Abates</span>
                                                        <span className="text-white text-2xl font-bold">
                                                            {historicalStats.reduce((sum, animal) => sum + animal.total_kills, 0)}
                                                        </span>
                                                    </div>
                                                    <div className="bg-black/30 p-2 rounded">
                                                        <span className="text-stone-400 text-[10px] uppercase block">Espécies Caçadas</span>
                                                        <span className="text-hunter-orange text-2xl font-bold">
                                                            {historicalStats.length}
                                                        </span>
                                                    </div>
                                                    <div className="bg-black/30 p-2 rounded">
                                                        <span className="text-stone-400 text-[10px] uppercase block">Diamantes</span>
                                                        <span className="text-blue-400 text-lg font-bold">
                                                            {historicalStats.reduce((sum, animal) => sum + animal.total_diamonds, 0)}
                                                        </span>
                                                    </div>
                                                    <div className="bg-black/30 p-2 rounded">
                                                        <span className="text-stone-400 text-[10px] uppercase block">Great Ones</span>
                                                        <span className="text-go-gold text-lg font-bold">
                                                            {historicalStats.reduce((sum, animal) => sum + animal.total_great_ones, 0)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Overall Statistics Card */}
                                {stats && session && (
                                    <div className="bg-hunter-orange/10 border border-hunter-orange/30 rounded-sm overflow-hidden">
                                        <div
                                            className="p-3 cursor-pointer hover:bg-hunter-orange/5 transition-colors flex justify-between items-center"
                                            onClick={() => setShowCurrentSession(!showCurrentSession)}
                                        >
                                            <h4 className="text-hunter-orange uppercase text-xs font-bold flex items-center gap-2">
                                                <i className="fa-solid fa-chart-line"></i> Sessão Atual
                                            </h4>
                                            <i className={`fa-solid fa-chevron-${showCurrentSession ? 'up' : 'down'} text-hunter-orange text-xs`}></i>
                                        </div>

                                        {showCurrentSession && (
                                            <div className="px-3 pb-3 animate-fade-in">
                                                <div className="grid grid-cols-2 gap-2 text-xs">
                                                    <div>
                                                        <span className="text-stone-500 text-[10px] uppercase block">Abates</span>
                                                        <span className="text-white font-bold">{stats.total_kills || 0}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-stone-500 text-[10px] uppercase block">Diamantes</span>
                                                        <span className="text-blue-400 font-bold">{stats.total_diamonds || 0}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-stone-500 text-[10px] uppercase block">Great Ones</span>
                                                        <span className="text-go-gold font-bold">{stats.total_great_ones || 0}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-stone-500 text-[10px] uppercase block">Raros</span>
                                                        <span className="text-purple-400 font-bold">{stats.total_rare_furs || 0}</span>
                                                    </div>
                                                </div>

                                                {/* Averages - Only if there are kills */}
                                                {stats.total_kills > 0 && (
                                                    <div className="mt-3 pt-3 border-t border-hunter-orange/20">
                                                        <h5 className="text-stone-400 uppercase text-[10px] font-bold mb-2">Médias</h5>
                                                        <div className="space-y-1 text-[11px]">
                                                            {stats.total_diamonds > 0 && (
                                                                <div className="flex justify-between">
                                                                    <span className="text-stone-500">Abates/Diamante:</span>
                                                                    <span className="text-blue-300 font-bold">
                                                                        {(stats.total_kills / stats.total_diamonds).toFixed(1)}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            {stats.total_great_ones > 0 && (
                                                                <div className="flex justify-between">
                                                                    <span className="text-stone-500">Abates/GO:</span>
                                                                    <span className="text-go-gold font-bold">
                                                                        {(stats.total_kills / stats.total_great_ones).toFixed(1)}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            {stats.total_rare_furs > 0 && (
                                                                <div className="flex justify-between">
                                                                    <span className="text-stone-500">Abates/Raro:</span>
                                                                    <span className="text-purple-300 font-bold">
                                                                        {(stats.total_kills / stats.total_rare_furs).toFixed(1)}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Historical Stats by Animal */}
                                {historicalStats.length > 0 ? (
                                    <>
                                        <div className="flex items-center justify-between gap-2 pt-2">
                                            <h4 className="text-stone-400 uppercase text-sm font-bold flex items-center gap-2">
                                                <i className="fa-solid fa-trophy"></i> Histórico
                                            </h4>
                                            {/* Search Bar */}
                                            <div className="relative flex-1 max-w-[140px]">
                                                <input
                                                    type="text"
                                                    placeholder="Buscar..."
                                                    value={statsSearch}
                                                    onChange={(e) => setStatsSearch(e.target.value)}
                                                    className="w-full px-2 py-1 pr-6 bg-stone-900 border border-stone-700 text-white text-[11px] focus:outline-none focus:border-hunter-orange rounded-sm"
                                                />
                                                <i className="fa-solid fa-search absolute right-2 top-1/2 -translate-y-1/2 text-stone-500 text-[10px]"></i>
                                            </div>
                                        </div>

                                        {historicalStats
                                            .filter(animal =>
                                                animal.animal_name.toLowerCase().includes(statsSearch.toLowerCase())
                                            )
                                            .map((animalStat, index) => {
                                                const maxKills = Math.max(...historicalStats.map(s => s.total_kills), 1);
                                                const progressPercent = (animalStat.total_kills / maxKills) * 100;
                                                const lastDate = new Date(animalStat.last_session_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                                                const isExpanded = selectedAnimalForStats === animalStat.animal_id;
                                                const isTopAnimal = index === 0 && statsSearch === '';

                                                return (
                                                    <div
                                                        key={animalStat.animal_id}
                                                        className={`bg-stone-900 border p-2 rounded-sm transition-all cursor-pointer ${animalStat.has_active_session ? 'border-hunter-orange/50' :
                                                            isExpanded ? 'border-hunter-orange' : 'border-white/5 hover:border-hunter-orange/30'
                                                            }`}
                                                        onClick={() => setSelectedAnimalForStats(
                                                            isExpanded ? null : animalStat.animal_id
                                                        )}
                                                    >
                                                        <div className="flex justify-between items-center mb-1">
                                                            <span className={`font-serif text-xs font-bold flex items-center gap-1 ${isTopAnimal ? 'text-hunter-orange' : 'text-stone-400'
                                                                }`}>
                                                                {animalStat.animal_name}
                                                                <i className={`fa-solid fa-chevron-${isExpanded ? 'up' : 'down'} text-[8px]`}></i>
                                                            </span>
                                                            <span className="text-[9px] text-stone-500">
                                                                {animalStat.has_active_session ? 'Ativa' : lastDate}
                                                            </span>
                                                        </div>

                                                        <div className="flex gap-2 text-[9px] text-stone-400 mb-1">
                                                            <span className="flex items-center gap-1">
                                                                Total: <strong className="text-white">{animalStat.total_kills}</strong>
                                                            </span>
                                                            <span className="flex items-center gap-1 text-blue-400">
                                                                <i className="fa-regular fa-gem"></i> {animalStat.total_diamonds}
                                                            </span>
                                                            <span className="flex items-center gap-1 text-go-gold">
                                                                <i className="fa-solid fa-crown"></i> {animalStat.total_great_ones}
                                                            </span>
                                                        </div>

                                                        <div className="w-full h-1 bg-stone-800 rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full ${isTopAnimal ? 'bg-hunter-orange' : 'bg-stone-600'
                                                                    }`}
                                                                style={{ width: `${progressPercent}%` }}
                                                            ></div>
                                                        </div>

                                                        {/* Expanded Details */}
                                                        {isExpanded && (
                                                            <div className="mt-2 pt-2 border-t border-stone-700 space-y-2 animate-fade-in">
                                                                <h5 className="text-stone-400 uppercase text-[9px] font-bold">Estatísticas Detalhadas</h5>

                                                                <div className="grid grid-cols-2 gap-2 text-[10px]">
                                                                    <div className="bg-stone-950/50 p-1.5 rounded">
                                                                        <span className="text-stone-500 block text-[8px]">Total Abates</span>
                                                                        <span className="text-white font-bold">{animalStat.total_kills}</span>
                                                                    </div>
                                                                    <div className="bg-stone-950/50 p-1.5 rounded">
                                                                        <span className="text-stone-500 block text-[8px]">Diamantes</span>
                                                                        <span className="text-blue-400 font-bold">{animalStat.total_diamonds}</span>
                                                                    </div>
                                                                    <div className="bg-stone-950/50 p-1.5 rounded">
                                                                        <span className="text-stone-500 block text-[8px]">Great Ones</span>
                                                                        <span className="text-go-gold font-bold">{animalStat.total_great_ones}</span>
                                                                    </div>
                                                                    <div className="bg-stone-950/50 p-1.5 rounded">
                                                                        <span className="text-stone-500 block text-[8px]">Última Sessão</span>
                                                                        <span className="text-stone-300 font-mono text-[9px]">{lastDate}</span>
                                                                    </div>
                                                                </div>

                                                                {/* Averages for this animal */}
                                                                {animalStat.total_kills > 0 && (
                                                                    <div className="space-y-1 text-[10px]">
                                                                        <h6 className="text-stone-500 uppercase text-[8px] font-bold">Médias</h6>
                                                                        {animalStat.total_diamonds > 0 && (
                                                                            <div className="flex justify-between">
                                                                                <span className="text-stone-500">Abat./Diam.:</span>
                                                                                <span className="text-blue-300 font-bold">
                                                                                    {(animalStat.total_kills / animalStat.total_diamonds).toFixed(1)}
                                                                                </span>
                                                                            </div>
                                                                        )}
                                                                        {animalStat.total_great_ones > 0 && (
                                                                            <div className="flex justify-between">
                                                                                <span className="text-stone-500">Abat./GO:</span>
                                                                                <span className="text-go-gold font-bold">
                                                                                    {(animalStat.total_kills / animalStat.total_great_ones).toFixed(1)}
                                                                                </span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}

                                        {historicalStats.filter(a =>
                                            a.animal_name.toLowerCase().includes(statsSearch.toLowerCase())
                                        ).length === 0 && (
                                                <div className="text-center text-stone-500 py-4 text-xs">
                                                    <i className="fa-solid fa-search text-2xl mb-2 opacity-30"></i>
                                                    <p>Nenhum animal encontrado</p>
                                                </div>
                                            )}
                                    </>
                                ) : !session ? (
                                    <div className="text-center text-stone-500 py-8">
                                        <i className="fa-solid fa-chart-line text-4xl mb-4 opacity-30"></i>
                                        <p className="text-sm">Nenhuma sessão encontrada</p>
                                        <p className="text-xs mt-2">Comece uma caçada para ver suas estatísticas</p>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    )}

                    {/* FUR TYPES MODAL */}
                    {showFurTypes && (
                        <div className="absolute inset-0 z-50 bg-stone-950/95 backdrop-blur-md flex flex-col animate-fade-in">
                            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-stone-900 shadow-lg">
                                <h3 className="font-serif text-white uppercase tracking-wider text-sm">
                                    <i className="fa-solid fa-star text-purple-400 mr-2"></i> Pelagem
                                </h3>
                                <button
                                    onClick={() => setShowFurTypes(false)}
                                    className="text-stone-400 hover:text-white transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10"
                                >
                                    <i className="fa-solid fa-xmark text-lg"></i>
                                </button>
                            </div>

                            {/* Search Input */}
                            <div className="p-3 border-b border-white/10">
                                <div className="relative">
                                    <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-stone-500 text-xs"></i>
                                    <input
                                        type="text"
                                        placeholder="Buscar pelagem..."
                                        value={furTypeSearch}
                                        onChange={(e) => setFurTypeSearch(e.target.value)}
                                        className="w-full bg-stone-800 border border-stone-700 rounded pl-9 pr-3 py-2 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-purple-500 transition-colors"
                                    />
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4">
                                {furTypes.length === 0 ? (
                                    <div className="text-center text-stone-500 py-8">
                                        <i className="fa-solid fa-circle-notch fa-spin text-4xl mb-4 opacity-30"></i>
                                        <p className="text-sm">Carregando tipos de pelagem...</p>
                                    </div>
                                ) : filteredFurTypes.length === 0 ? (
                                    <div className="text-center text-stone-500 py-8">
                                        <i className="fa-solid fa-search text-4xl mb-4 opacity-30"></i>
                                        <p className="text-sm">Nenhuma pelagem encontrada</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {filteredFurTypes.map((furType) => (
                                            <div
                                                key={furType.id}
                                                onClick={() => handleFurTypeSelect(furType)}
                                                className="bg-stone-800/50 border border-stone-700 p-2 rounded-sm hover:border-purple-500 hover:bg-purple-900/20 transition-colors cursor-pointer"
                                            >
                                                <p className="text-white font-bold text-xs flex items-center gap-2">
                                                    <i className="fa-solid fa-star text-purple-400"></i>
                                                    {furType.name}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Decorative elements */}
                <div className="absolute bottom-8 left-8 hidden md:block text-stone-500/50 text-[10px] font-mono tracking-widest">
                    STATUS: ONLINE<br />
                    SERVER: HIRSCHFELDEN-01
                </div>
            </div>

            <style>{`
        .glass-panel {
          background: rgba(26, 26, 26, 0.85);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
      `}</style>
        </div>
    );
};
