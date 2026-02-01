
import { useState, useEffect, useCallback, useRef } from 'react';
import { auth } from '../firebase'; // Keep auth for now if still using Firebase Auth
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { useGrindSession, getSpecies, getFurTypes, authenticateWithFirebase, upsertUserProfile, getUserHistoricalStats, deleteAllUserStats, getActiveSessions, trackUserActivity } from '../supabase_integration';
import { syncManager } from '../sync_manager';
import { HamburgerMenu, AboutModal, useFontSizeControl, ConfirmationModal } from './MenuComponents';
import { NeedZonesModal } from './NeedZonesModal';
import { NeedZonesPanel } from './NeedZonesPanel';
import { MigrationModal } from './MigrationModal';
import { db } from '../db_local';

interface Animal {
    id: string; // UUID from Supabase
    name_enus: string;
    name_ptbr: string;
}

interface FurType {
    id: string;
    name: string;
    imageURL: string;
}

// Helper to normalize text (remove accents) for search
const normalizeText = (text: string): string => {
    return text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
};

export const Dashboard = () => {
    const [animals, setAnimals] = useState<Animal[]>([]);
    const [selectedAnimal, setSelectedAnimal] = useState<Animal | null>(null);
    const [loading, setLoading] = useState(true);
    const [historicalStats, setHistoricalStats] = useState<any[]>([]);
    const [showStats, setShowStats] = useState(false);
    const [showNeedZones, setShowNeedZones] = useState(false);
    const [furTypes, setFurTypes] = useState<FurType[]>([]);
    const [showFurTypes, setShowFurTypes] = useState(false);

    // Advanced Stats State
    const [showDetailedMode, setShowDetailedMode] = useState(false);
    const [showKillDetailsModal, setShowKillDetailsModal] = useState(false);
    const [pendingKillData, setPendingKillData] = useState<{
        isDiamond: boolean;
        isGreatOne: boolean;
        isTroll: boolean;
        furTypeId?: string;
        furTypeName?: string;
    } | null>(null);
    const [killDetails, setKillDetails] = useState<{
        weight: string;
        trophyScore: string;
        difficultyLevel: string;
    }>({ weight: '', trophyScore: '', difficultyLevel: '' });

    // HUD Settings State
    const [hudEditable, setHudEditable] = useState(false);
    const [hudScale, setHudScale] = useState(1.0);

    const [isAnimalDropdownOpen, setIsAnimalDropdownOpen] = useState(false);
    const [furTypeSearch, setFurTypeSearch] = useState('');
    const [selectedAnimalForStats, setSelectedAnimalForStats] = useState<string | null>(null);
    const [statsSearch, setStatsSearch] = useState('');
    const [animalSearch, setAnimalSearch] = useState('');
    const [showGrandTotal, setShowGrandTotal] = useState(false);
    const [showCurrentSession, setShowCurrentSession] = useState(false);
    const [activeSessions, setActiveSessions] = useState<any[]>([]);
    const [hotkeys, setHotkeys] = useState<Record<string, string>>({
        increment: 'numadd',
        decrement: 'numsub',
        stats: 'Alt+Shift+S',
        tray: 'Alt+Shift+G',
        overlay: 'Alt+Shift+H',
        detailedStats: 'Alt+Shift+]',
        needZones: 'Alt+Shift+['
    });
    const [showHotkeysModal, setShowHotkeysModal] = useState(false);
    const [isCooldown, setIsCooldown] = useState(false);

    const [showMenu, setShowMenu] = useState(false);
    const [showAbout, setShowAbout] = useState(false);
    const [showNeedZonesPanel, setShowNeedZonesPanel] = useState(false);
    // const [showMigration, setShowMigration] = useState(false); // REMOVED


    // Confirmation Modal State
    const [confirmModal, setConfirmModal] = useState<{
        show: boolean;
        title: string;
        message: string;
        confirmText?: string;
        confirmColor?: 'red' | 'yellow' | 'blue';
        onConfirm: () => void;
    }>({
        show: false,
        title: '',
        message: '',
        onConfirm: () => { }
    });
    const [fontSize, setFontSize] = useState(1.0);
    const [grindActive, setGrindActive] = useState(false);
    const [animalSessionIds, setAnimalSessionIds] = useState<Record<string, string>>({}); // Map of animalId -> sessionId
    const [sessionKillsMap, setSessionKillsMap] = useState<Record<string, number>>({}); // Map of local session kills per animal ID
    const [_selectedFurType, _setSelectedFurType] = useState<FurType | null>(null);
    const [startDate] = useState(new Date().toLocaleDateString('pt-BR'));
    const [isRetracted, setIsRetracted] = useState(false);
    const [showNeonEffect, setShowNeonEffect] = useState(false);
    const navigate = useNavigate();

    const [user, setUser] = useState(auth.currentUser);

    // Resize window to compact mode (360x520) when Dashboard loads
    useEffect(() => {
        if ((window as any).ipcRenderer) {
            (window as any).ipcRenderer.send('resize-window', 360, 520);
        }
    }, []);

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (u) => {
            setUser(u);
            if (u) {
                // Inicializa o SyncManager
                syncManager.setUserId(u.uid);
                syncManager.startAutoSync(10000); // Sincroniza a cada 10 segundos (Batching)
                try {
                    // 1. Tentar autenticação segura no Supabase PRIMEIRO
                    // Isso garante que temos um auth.uid() válido para o RLS
                    const token = await u.getIdToken();
                    const success = await authenticateWithFirebase(token);

                    if (!success) {
                        console.warn('⚠️ Autenticação Supabase falhou (RLS pode bloquear operações)');
                    } else {
                        console.log('✅ Autenticado com segurança no Supabase');
                    }

                    // 2. Criar perfil do usuário DEPOIS de autenticar
                    await upsertUserProfile(
                        u.uid,
                        u.email || '',
                        u.displayName || u.email || 'Usuário'
                    );
                    console.log('✅ Perfil de usuário criado/atualizado');
                } catch (err) {
                    console.error('Erro ao configurar usuário:', err);
                }
            }
        });
        return () => unsubscribe();
    }, []);

    // Hook de persistência (só cria sessão quando grindActive=true)
    const {
        session,
        stats,
        globalTotal,
        loading: sessionLoading,
        isSyncing,
        addKill: addKillBase,
        removeLastKill: removeLastKillBase,
        finishCurrentSession,
        reload: reloadSession
    } = useGrindSession(
        user?.uid,
        selectedAnimal ? String(selectedAnimal.id) : '',
        selectedAnimal?.name_ptbr || '',
        grindActive,  // Só cria sessão quando grind está ativo
        selectedAnimal ? animalSessionIds[String(selectedAnimal.id)] : null // Passa o ID vinculado se existir
    );

    // Sincroniza o ID da sessão quando ela é carregada/criada
    useEffect(() => {
        if (session?.id && selectedAnimal) {
            const animalId = String(selectedAnimal.id);
            // SEGURANÇA: Só vincula se a sessão realmente pertencer a este animal
            if (session.animal_id === animalId) {
                if (animalSessionIds[animalId] !== session.id) {
                    setAnimalSessionIds(prev => ({
                        ...prev,
                        [animalId]: session.id
                    }));
                }
            }
        }
    }, [session?.id, session?.animal_id, selectedAnimal]);


    // Wrapper para addKill
    const addKill = useCallback(async (
        isDiamond = false,
        isGreatOne = false,
        furTypeId?: string,
        furTypeName?: string,
        isTroll = false,
        weight: number | null = null,
        trophyScore: number | null = null,
        difficultyLevel: number | null = null
    ) => {
        console.log('🔵 addKill CALLED', { isDiamond, isGreatOne, furTypeId, isTroll });

        // Trigger celebration if Great One
        if (isGreatOne) {
            triggerGreatOneCelebration();
        }

        await addKillBase(isDiamond, isGreatOne, furTypeId, furTypeName, isTroll, weight, trophyScore, difficultyLevel);

        // Refresh historical stats if panel is open to show new kill immediately
        if (showStats && user) {
            getUserHistoricalStats(user.uid).then(setHistoricalStats).catch(console.error);
        }
    }, [addKillBase, showStats, user]);

    // Handler for kill clicks (checks detailed mode)
    const handleKillClick = useCallback(async (
        type: 'normal' | 'diamond' | 'greatOne' | 'troll' | 'rare',
        furTypeId?: string,
        furTypeName?: string
    ) => {
        const killData = {
            isDiamond: type === 'diamond',
            isGreatOne: type === 'greatOne',
            isTroll: type === 'troll',
            furTypeId,
            furTypeName
        };

        if (showDetailedMode) {
            setPendingKillData(killData);
            setKillDetails({ weight: '', trophyScore: '', difficultyLevel: '' }); // Reset form
            setShowKillDetailsModal(true);
        } else {
            // Fast mode - register immediately
            await addKill(killData.isDiamond, killData.isGreatOne, killData.furTypeId, killData.furTypeName, killData.isTroll);
        }
    }, [showDetailedMode, addKill]);

    // Wrapper para removeLastKill
    const removeLastKill = useCallback(async () => {
        console.log('🔴 removeLastKill CALLED');

        await removeLastKillBase();
    }, [removeLastKillBase]);

    const currentKillCount = session?.total_kills || 0;

    // Voice Commands Integration - DISABLED (causing crashes)
    // const { isListening } = useVoiceCommands(voiceEnabled && grindActive, {
    //     onIncrement: () => updateCounter(1),
    //     onDecrement: () => updateCounter(-1),
    //     onDiamond: () => {
    //         if (confirm('Confirmar registro de DIAMANTE via voz?')) {
    //             addKill(true);
    //         }
    //     },
    //     onDiamondRare: async () => {
    //         try {
    //             const furTypesData = await getFurTypes(selectedAnimal?.id?.toString() || '');
    //             setFurTypes(furTypesData);
    //             setShowFurTypes(true);
    //             (window as any).__isDiamondRare = true;
    //         } catch (error) {
    //             console.error('Erro ao buscar fur types:', error);
    //         }
    //     },
    //     onGreatOne: () => {
    //         if (confirm('🏆 Confirmar captura do GREAT ONE via voz?')) {
    //             addKill(false, true);
    //         }
    //     }
    // });

    // Resize window for dashboard
    useEffect(() => {
        if ((window as any).ipcRenderer) {
            (window as any).ipcRenderer.send('resize-window', 360, 520);
        }
    }, []);

    // Tray state listener
    useEffect(() => {
        const handleTrayStateChanged = (_event: any, retracted: boolean) => {

            setIsRetracted(retracted);
            if (!retracted) {
                // Trigger neon effect when expanding

                setShowNeonEffect(true);
                setTimeout(() => setShowNeonEffect(false), 1500);
            }
        };

        (window as any).ipcRenderer?.on('tray-state-changed', handleTrayStateChanged);

        return () => {
            (window as any).ipcRenderer?.off('tray-state-changed', handleTrayStateChanged);
        };
    }, []);

    // Toggle tray function
    const toggleTray = () => {

        (window as any).ipcRenderer?.send('toggle-tray');
    };

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const savedHotkeys = await db.settings.toArray();
                if (savedHotkeys.length > 0) {
                    const hotkeyMap: Record<string, string> = {};
                    savedHotkeys.forEach(s => {
                        if (s.key.startsWith('hotkey_')) {
                            hotkeyMap[s.key.replace('hotkey_', '')] = s.value;
                        }
                    });
                    if (Object.keys(hotkeyMap).length > 0) {
                        setHotkeys(prev => ({ ...prev, ...hotkeyMap }));
                        window.ipcRenderer.send('update-hotkeys', hotkeyMap);
                    }
                }

                // Load HUD settings
                const hudScaleSetting = await db.settings.get('hud_scale');
                if (hudScaleSetting) {
                    setHudScale(parseFloat(hudScaleSetting.value));
                }
            } catch (err) {
                console.error('❌ Error loading hotkeys/settings:', err);
            }
        };

        const fetchAnimals = async () => {
            try {
                const data = await getSpecies();
                const animalList: Animal[] = (data || []).map((a: any) => ({
                    id: a.id,
                    name_enus: a.name_enus,
                    name_ptbr: a.name_ptbr
                }));

                const uniqueAnimals = animalList.filter((animal, index, self) =>
                    index === self.findIndex((a) => a.name_ptbr === animal.name_ptbr)
                );

                setAnimals(uniqueAnimals);
            } catch (error) {
                console.error('❌ Error fetching animals:', error);
            } finally {
                setLoading(false);
            }
        };

        loadSettings();
        fetchAnimals();
    }, []);

    const handleAnimalSelect = useCallback((animal: Animal) => {
        console.log('🐾 handleAnimalSelect: Selecting', animal);

        // Se já existe um grind aberto na tela, pede confirmação para sair da visualização
        if (selectedAnimal && grindActive) {
            if (!window.confirm('Você está saindo da visualização do grind atual. O progresso continuará salvo no banco, mas você voltará para a tela inicial deste animal. Continuar?')) {
                return;
            }
        }

        if (!animal || !animal.id) {
            console.error('❌ Erro: Tentativa de selecionar animal sem ID:', animal);
            return;
        }

        setSelectedAnimal(animal);
        setGrindActive(false); // SEMPRE volta para o botão "Iniciar Grind"
        setShowMenu(false);    // Fecha o menu ao selecionar
    }, [selectedAnimal, grindActive]);

    // Track user activity on mount
    useEffect(() => {
        if (user && user.email) {
            // Pega a versão do package.json (ou hardcoded por enquanto)
            const appVersion = '1.0.0';
            trackUserActivity(user.uid, user.email, appVersion);
        }
    }, [user]);

    // Refresh active sessions and historical stats when session updates (with debounce)
    useEffect(() => {
        if (!user) return;

        // Refresh stats immediately on mount or when session kills change
        getActiveSessions(user.uid).then(setActiveSessions);
        getUserHistoricalStats(user.uid).then(setHistoricalStats);

        // Also set up a periodic refresh but much faster than 2s
        const timer = setInterval(() => {
            getActiveSessions(user.uid).then(setActiveSessions);
            getUserHistoricalStats(user.uid).then(setHistoricalStats);
        }, 5000);

        return () => clearInterval(timer);
    }, [user, session?.total_kills]);


    const updateCounter = useCallback((change: number) => {
        if (isCooldown) {
            console.log('⏳ Cooldown active, ignoring click');
            return;
        }

        setIsCooldown(true);
        setTimeout(() => setIsCooldown(false), 300); // 300ms delay

        console.log('⚡ updateCounter CALLED with change:', change);

        if (change > 0) {
            // Adicionar abate - database handles both counters
            handleKillClick('normal');
        } else {
            // Remover abate
            if (session) {
                removeLastKill();
            } else {
                console.warn('⚠️ Cannot decrement: no active session');
            }
        }
    }, [session, removeLastKill, handleKillClick, isCooldown]);

    const resetCurrentSession = useCallback(async () => {
        if (!session) return;

        if (!window.confirm('Deseja realmente ENCERRAR A SESSÃO? O contador Laranja (X) voltará a zero, mas o Total do Grind (Y) será mantido.')) {
            return;
        }

        try {
            await finishCurrentSession(false);
            setGrindActive(false); // Volta para a tela de "Iniciar Grind"
        } catch (error) {
            console.error('Error resetting session:', error);
            alert('Erro ao encerrar sessão no banco.');
        }
    }, [session, finishCurrentSession]);

    const resetGrind = useCallback(async () => {
        if (!session) return;

        if (!window.confirm('⚠️ ATENÇÃO: Deseja realmente FINALIZAR ESTE GRIND? Ele será marcado como concluído e sairá das sessões ativas. Para continuar, você terá que iniciar um novo Grind 0/0.')) {
            return;
        }

        try {
            await finishCurrentSession(true);

            // Limpa o ID da sessão local para que não tente reabrir este grind finalizado
            if (selectedAnimal) {
                setAnimalSessionIds(prev => {
                    const next = { ...prev };
                    delete next[selectedAnimal.id];
                    return next;
                });
            }

            setGrindActive(false);
            setSelectedAnimal(null); // Volta para a seleção de animais
        } catch (error) {
            console.error('Error resetting grind:', error);
            alert('Erro ao finalizar grind no banco.');
        }
    }, [session, finishCurrentSession, selectedAnimal]);

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

    const handleFurTypeSelect = async (furType: FurType) => {
        const isDiamondRare = (window as any).__isDiamondRare || false;

        // Limpa o flag
        (window as any).__isDiamondRare = false;

        if (showDetailedMode) {
            setPendingKillData({
                isDiamond: isDiamondRare,
                isGreatOne: false,
                isTroll: false,
                furTypeId: furType.id,
                furTypeName: furType.name
            });
            setKillDetails({ weight: '', trophyScore: '', difficultyLevel: '' });
            setShowKillDetailsModal(true);
        } else {
            // Se é diamante raro, registra como diamante + raro
            if (isDiamondRare) {
                await addKill(true, false, furType.id, furType.name);
            } else {
                // Pelagem rara normal (sem diamante)
                await addKill(false, false, furType.id, furType.name);
            }
        }

        setShowFurTypes(false);
    };

    const filteredFurTypes = furTypes.filter(furType =>
        furTypeSearch === '' ||
        normalizeText(furType.name).includes(normalizeText(furTypeSearch))
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

    // Auto-refresh stats when session changes (if stats panel is open)
    useEffect(() => {
        if (showStats && user) {
            getUserHistoricalStats(user.uid).then(setHistoricalStats).catch(console.error);
        }
    }, [session?.total_kills, showStats, user]);

    // Auto-refresh active sessions when session changes
    useEffect(() => {
        if (user) {
            getActiveSessions(user.uid)
                .then(setActiveSessions)
                .catch(error => {
                    console.error('Erro ao carregar sessões ativas:', error);
                    setActiveSessions([]);
                });
        }
    }, [session?.total_kills, user, session?.id]); // Atualizar quando kills ou sessão mudar

    // Font size control
    const { updateFontSize } = useFontSizeControl(fontSize, setFontSize);

    const handleResetStats = async () => {
        if (!user) return;
        setShowMenu(false); // Close menu before showing confirm
        if (window.confirm('⚠️ ATENÇÃO: Isso vai DELETAR TODAS as suas estatísticas (sessões e abates). Tem certeza?')) {
            try {
                await deleteAllUserStats(user.uid);
                alert('✅ Estatísticas resetadas com sucesso!');
                window.location.reload();
            } catch (error) {
                console.error('Erro ao resetar estatísticas:', error);
                alert('❌ Erro ao resetar estatísticas. Veja o console.');
            }
        }
    };


    // Listen for global hotkeys from Electron
    useEffect(() => {
        if (!window.ipcRenderer) return;

        const handleIncrement = () => updateCounterRef.current(1);
        const handleDecrement = () => updateCounterRef.current(-1);
        const handleStats = () => handleToggleStatsRef.current();
        const handleTray = () => toggleTrayRef.current();
        const handleOverlay = () => toggleOverlayRef.current();
        const handleNeedZones = () => {
            console.log('📨 IPC: Need Zones event received');
            window.ipcRenderer.send('open-need-zones');
        };

        // Clean any potential duplicate listeners
        window.ipcRenderer.removeAllListeners('hotkey-increment');
        window.ipcRenderer.removeAllListeners('hotkey-decrement');
        window.ipcRenderer.removeAllListeners('hotkey-stats');
        window.ipcRenderer.removeAllListeners('hotkey-tray');
        window.ipcRenderer.removeAllListeners('hotkey-overlay');
        window.ipcRenderer.removeAllListeners('hotkey-need-zones');

        window.ipcRenderer.on('hotkey-increment', handleIncrement);
        window.ipcRenderer.on('hotkey-decrement', handleDecrement);
        window.ipcRenderer.on('hotkey-stats', handleStats);
        window.ipcRenderer.on('hotkey-tray', handleTray);
        window.ipcRenderer.on('hotkey-overlay', handleOverlay);
        window.ipcRenderer.on('hotkey-need-zones', handleNeedZones);

        const handleSettings = (_event: any, settings: any) => {
            if (settings.fontSize !== undefined) updateFontSizeRef.current(settings.fontSize);
            if (settings.showDetailedMode !== undefined) setShowDetailedModeRef.current(settings.showDetailedMode);
        };

        const handleResetTrigger = () => {
            handleResetStats();
        };

        window.ipcRenderer.on('sync-settings', handleSettings);
        window.ipcRenderer.on('trigger-reset-stats', handleResetTrigger);

        return () => {
            window.ipcRenderer.off('hotkey-increment', handleIncrement);
            window.ipcRenderer.off('hotkey-decrement', handleDecrement);
            window.ipcRenderer.off('hotkey-stats', handleStats);
            window.ipcRenderer.off('hotkey-tray', handleTray);
            window.ipcRenderer.off('hotkey-overlay', handleOverlay);
            window.ipcRenderer.off('hotkey-need-zones', handleNeedZones);
            window.ipcRenderer.off('sync-settings', handleSettings);
            window.ipcRenderer.off('trigger-reset-stats', handleResetTrigger);
        };
    }, []);

    // Use refs to always have the latest functions without recreating window handlers
    const updateCounterRef = useRef(updateCounter);
    const handleToggleStatsRef = useRef(handleToggleStats);
    const toggleTrayRef = useRef(toggleTray);
    const toggleOverlayRef = useRef(() => window.ipcRenderer.invoke('toggle-overlay'));
    const updateFontSizeRef = useRef(updateFontSize);
    const setShowDetailedModeRef = useRef(setShowDetailedMode);


    // Keep refs updated
    useEffect(() => {
        updateCounterRef.current = updateCounter;
        handleToggleStatsRef.current = handleToggleStats;
        toggleTrayRef.current = toggleTray;
        updateFontSizeRef.current = updateFontSize;
        setShowDetailedModeRef.current = setShowDetailedMode;
    }, [updateCounter, handleToggleStats, toggleTray, updateFontSize, setShowDetailedMode]);

    // Expose stable handlers to window for hotkeys (only set once)
    useEffect(() => {
        console.log('🔧 Setting up window hotkey handlers (ONCE)');
        (window as any).__hotkeyAddKill = () => {
            console.log('🎯 __hotkeyAddKill EXECUTED');
            updateCounterRef.current(1);
        };
        (window as any).__hotkeyRemoveKill = () => {
            console.log('🎯 __hotkeyRemoveKill EXECUTED');
            updateCounterRef.current(-1);
        };
        (window as any).__hotkeyToggleStats = () => handleToggleStatsRef.current();
        (window as any).__hotkeyToggleTray = () => toggleTrayRef.current();
        (window as any).__hotkeyToggleOverlay = () => toggleOverlayRef.current();
    }, []); // ONLY ONCE - handlers use refs to always get latest functions

    // Hotkey saving logic
    const applyHotkeys = async () => {
        // This is now handled in the separate HotkeySettings window
    };

    // Great One Celebration
    const triggerGreatOneCelebration = () => {
        window.ipcRenderer.send('trigger-greatone-celebration');
    };


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
        // Background color removed (was bg-stone-950) to show image
        <div className="w-full h-screen overflow-hidden text-gray-100 font-sans relative" style={{ margin: 0, padding: 0 }}>
            {/* Background Layers */}
            <div className="absolute inset-0 w-full h-full overflow-hidden z-0 pointer-events-none">
                {/* Gradient Background */}
                <div className="absolute inset-0 bg-gradient-to-br from-stone-800 via-stone-950 to-black"></div>
                {/* Vignette */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-transparent via-black/20 to-black/80"></div>
            </div>

            {/* Animation Container for Great One Effects */}
            <div id="animation-container" className="fixed inset-0 pointer-events-none z-[9999]" style={{ overflow: 'hidden' }}></div>

            {/* Clickable Border When Retracted */}
            {isRetracted && (
                <div
                    className="absolute left-0 top-0 w-6 h-full cursor-default z-[100] group"
                    onMouseDown={(e) => {
                        if (!isRetracted) return;

                        const startTime = Date.now();
                        const startY = e.screenY;
                        const offsetTop = e.clientY;
                        let hasMoved = false;

                        window.ipcRenderer.send('tray-drag-start', offsetTop);

                        const onMouseMove = (moveEvent: MouseEvent) => {
                            if (Math.abs(moveEvent.screenY - startY) > 3) {
                                hasMoved = true;
                            }
                        };

                        const onMouseUp = () => {
                            window.ipcRenderer.send('tray-drag-stop');
                            window.removeEventListener('mousemove', onMouseMove);
                            window.removeEventListener('mouseup', onMouseUp);

                            // ONLY toggle tray if the mouse didn't move (it was a click)
                            if (!hasMoved) {
                                toggleTray();
                            }
                        };

                        window.addEventListener('mousemove', onMouseMove);
                        window.addEventListener('mouseup', onMouseUp);
                    }}
                    title="Arraste para mover ou clique para expandir"
                >
                    <div className="absolute left-0 top-0 w-1 h-full bg-hunter-orange/80 group-hover:bg-hunter-orange group-hover:w-1.5  shadow-[0_0_10px_rgba(217,93,30,0.8)]" />
                </div>
            )}

            {/* Main Container */}
            <div className="relative z-10 flex items-center justify-center h-full">
                {/* MAIN CARD CONTAINER */}
                <div className={`w-full h-full max-w-md glass-panel shadow-2xl relative overflow-hidden flex flex-col ${isRetracted ? 'opacity-0 pointer-events-none' : 'opacity-100'} ${showNeonEffect ? 'neon-border-active' : ''} `}>
                    {/* Decorative Top Line */}
                    <div className="absolute top-0 left-0 w-full h-1 bg-hunter-orange shadow-[0_0_10px_rgba(217,93,30,0.5)] z-20"></div>

                    {/* Hero Section (Draggable) */}
                    <div
                        className="relative h-8 w-full shrink-0 overflow-hidden border-b border-hunter-orange/50 bg-gradient-to-r from-hunter-orange/90 to-orange-600/80 flex items-center justify-between px-2"
                        style={{ WebkitAppRegion: 'drag' } as any}
                    >
                        {/* Settings Button (No Drag) */}
                        <button
                            onClick={() => window.ipcRenderer.send('open-hotkey-settings')}
                            className="w-6 h-6 flex items-center justify-center text-stone-950 hover:bg-stone-950/20 rounded "
                            title="Configurações (Atalhos, HUD, Geral)"
                            style={{ WebkitAppRegion: 'no-drag' } as any}
                        >
                            <i className="fa-solid fa-cog text-sm"></i>
                        </button>

                        {/* Title (Centered) */}
                        <span className="text-[10px] font-bold text-stone-950 uppercase tracking-widest pointer-events-none select-none">
                            Grind Counter
                        </span>

                        {/* Right Controls (Stats + Close) */}
                        <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' } as any}>
                            {/* Stats Button */}
                            <button
                                onClick={() => setShowStats(!showStats)}
                                title="Estatísticas (Ctrl+Shift+S)"
                                className="w-6 h-6 rounded-full bg-black/20 border border-stone-950/10 text-stone-950 hover:text-white hover:bg-stone-950  flex items-center justify-center"
                            >
                                <i className="fa-solid fa-chart-column text-xs"></i>
                            </button>

                            {/* Need Zones Button */}
                            <button
                                onClick={() => window.ipcRenderer.send('open-need-zones')}
                                title="Horários de Necessidades"
                                className="w-6 h-6 rounded-full bg-green-600/80 border border-green-500/50 text-white hover:bg-green-700 flex items-center justify-center"
                            >
                                <i className="fa-solid fa-clock text-xs"></i>
                            </button>

                            {/* Overlay Button */}
                            <button
                                onClick={() => window.ipcRenderer.invoke('toggle-overlay')}
                                title={`Toggle Overlay HUD (${hotkeys.overlay})`}
                                className="w-6 h-6 rounded-full bg-cyan-600/80 border border-cyan-500/50 text-white hover:bg-cyan-700 flex items-center justify-center"
                            >
                                <i className="fa-solid fa-layer-group text-xs"></i>
                            </button>


                            {/* Botão de Toggle Bandeja */}
                            <button
                                onClick={toggleTray}
                                className="w-6 h-6 rounded-full bg-black/20 border border-stone-950/10 text-stone-950 hover:text-white hover:bg-stone-950  flex items-center justify-center"
                                title={isRetracted ? 'Expandir bandeja' : 'Retrair bandeja'}
                            >
                                <i className={`fa-solid ${isRetracted ? 'fa-angles-left' : 'fa-angles-right'} text-xs`}></i>
                            </button>

                            {/* Close App Button */}
                            <button
                                onClick={() => window.close()}
                                title="Fechar Aplicativo"
                                className="w-6 h-6 rounded hover:bg-red-500 hover:text-white text-stone-950  flex items-center justify-center"
                            >
                                <i className="fa-solid fa-xmark text-sm"></i>
                            </button>
                        </div>
                    </div>

                    {/* Scrollable Content Area */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-3 flex flex-col">
                        <div className="flex-1 space-y-3">
                            {/* Animal Selector Menu */}
                            <div className="relative group">
                                {/* Label + Search inline */}
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-[10px] uppercase tracking-widest text-stone-500 font-bold">
                                        Animal
                                    </label>
                                    <div className="relative flex-1 ml-2">
                                        <input
                                            type="text"
                                            value={animalSearch}
                                            onChange={(e) => {
                                                setAnimalSearch(e.target.value);
                                                // Auto-open dropdown when user starts typing
                                                if (e.target.value.length > 0 && !isAnimalDropdownOpen) {
                                                    setIsAnimalDropdownOpen(true);
                                                }
                                            }}
                                            placeholder="Buscar..."
                                            className="w-full bg-stone-800/50 border border-stone-600 hover:border-hunter-orange text-white py-0.5 px-2 pr-6 rounded-none focus:outline-none focus:ring-1 focus:ring-hunter-orange transition-colors text-xs"
                                        />
                                        {animalSearch && (
                                            <button
                                                onClick={() => {
                                                    setAnimalSearch('');
                                                    setIsAnimalDropdownOpen(false);
                                                }}
                                                className="absolute inset-y-0 right-0 flex items-center px-1.5 text-stone-400 hover:text-white"
                                            >
                                                <i className="fa-solid fa-xmark text-xs"></i>
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Hotkeys Modal removed - now opens in new window */}
                                {/* Custom Dropdown */}
                                <div className="relative">
                                    <button
                                        onClick={() => setIsAnimalDropdownOpen(!isAnimalDropdownOpen)}
                                        className="w-full bg-gradient-to-br from-stone-800 via-stone-950 to-black border border-stone-600 hover:border-hunter-orange text-white py-1.5 px-2 pr-8 rounded-none focus:outline-none focus:ring-1 focus:ring-hunter-orange transition-colors font-serif text-xs text-left flex items-center justify-between"
                                        title="Selecione o animal que está caçando"
                                    >
                                        <span className="truncate">
                                            {selectedAnimal ? selectedAnimal.name_ptbr : 'Selecione um animal...'}
                                        </span>
                                        <i className={`fa-solid fa-caret-down text-hunter-orange ${isAnimalDropdownOpen ? 'rotate-180' : ''} `}></i>
                                    </button>

                                    {/* Dropdown Menu */}
                                    {isAnimalDropdownOpen && (
                                        <>
                                            {/* Backdrop to close on click outside */}
                                            <div className="fixed inset-0 z-40" onClick={() => setIsAnimalDropdownOpen(false)}></div>

                                            <div className="absolute top-full left-0 w-full z-50 mt-1 max-h-60 overflow-y-auto bg-stone-900 border border-hunter-orange/50 shadow-xl custom-scrollbar">
                                                {animals
                                                    .filter(animal => {
                                                        if (animalSearch === '') return true;
                                                        const normalizedSearch = normalizeText(animalSearch);
                                                        return normalizeText(animal.name_ptbr).includes(normalizedSearch) ||
                                                            normalizeText(animal.name_enus).includes(normalizedSearch);
                                                    })
                                                    .map((animal) => (
                                                        <div
                                                            key={animal.id}
                                                            onClick={() => {
                                                                handleAnimalSelect(animal);
                                                                setIsAnimalDropdownOpen(false);
                                                            }}
                                                            className={`px-3 py-2 text-xs cursor-pointer hover:bg-hunter-orange hover:text-white transition-colors border-b border-stone-800 last:border-0 ${selectedAnimal?.id === animal.id ? 'bg-hunter-orange/20 text-hunter-orange font-bold' : 'text-stone-300'} `}
                                                        >
                                                            {animal.name_ptbr}
                                                        </div>
                                                    ))
                                                }
                                                {animals.filter(a => {
                                                    if (animalSearch === '') return true;
                                                    const normalizedSearch = normalizeText(animalSearch);
                                                    return normalizeText(a.name_ptbr).includes(normalizedSearch) ||
                                                        normalizeText(a.name_enus).includes(normalizedSearch);
                                                }).length === 0 && (
                                                        <div className="px-3 py-4 text-center text-stone-500 text-xs italic">
                                                            Nenhum animal encontrado
                                                        </div>
                                                    )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            {!grindActive ? (
                                /* Initial View: Start Grind Button */
                                <div className="bg-stone-800/30 border border-white/5 p-6 rounded-sm relative overflow-hidden">
                                    <div className="flex flex-col items-center justify-center py-8">
                                        <button
                                            onClick={() => {
                                                // ONLY start grind if user has explicitly selected an animal
                                                if (selectedAnimal) {
                                                    setGrindActive(true);
                                                    // Sync from database session if needed
                                                    if (session) {
                                                        // session.total_kills is already used in the UI
                                                    }
                                                    // Do NOT reset X - it persists per animal unless End Session was clicked
                                                }
                                            }}
                                            disabled={!selectedAnimal}
                                            title={selectedAnimal ? "Iniciar sessão de grind" : "Selecione um animal primeiro"}
                                            className={`w-full py-3 px-4 text-sm font-bold border transition-colors rounded-sm flex items-center justify-center gap-2 active:scale-[0.98] ${selectedAnimal
                                                ? 'border-hunter-orange bg-gradient-to-r from-hunter-orange/90 to-orange-600/80 text-white hover:shadow-[0_0_20px_rgba(217,93,30,0.4)]'
                                                : 'border-stone-700 bg-stone-800/50 text-stone-600 cursor-not-allowed'
                                                }`}
                                        >
                                            <i className="fa-solid fa-play"></i>
                                            <span className="uppercase tracking-wide">Iniciar Grind</span>
                                        </button>

                                        {!selectedAnimal && animals.filter(animal => {
                                            if (animalSearch === '') return true;
                                            const normalizedSearch = normalizeText(animalSearch);
                                            return normalizeText(animal.name_ptbr).includes(normalizedSearch) ||
                                                normalizeText(animal.name_enus).includes(normalizedSearch);
                                        }).length === 0 && (
                                                <p className="text-stone-500 text-xs mt-3">
                                                    Selecione um animal para começar
                                                </p>
                                            )}
                                    </div>
                                </div>
                            ) : (
                                /* Active Grind View: Counter + Action Buttons */
                                <>
                                    {/* The Grind Counter */}
                                    <div className="bg-stone-800/30 border border-white/5 p-3 rounded-sm relative overflow-hidden">
                                        {/* Background hunting image */}
                                        <div
                                            className="absolute inset-0 opacity-5 pointer-events-none bg-cover bg-center"
                                            style={{ backgroundImage: 'url(/hunting-bg.png)' }}
                                        ></div>

                                        <div className="flex items-center justify-between mb-3 relative z-10">
                                            <button
                                                onClick={() => updateCounter(-1)}
                                                disabled={sessionLoading || isCooldown || !session}
                                                title="Decrementar contador (Ctrl+Shift+-)"
                                                className={`w-7 h-7 rounded-sm border flex items-center justify-center text-xs transition-colors ${sessionLoading || isCooldown || !session
                                                    ? 'border-stone-700 text-stone-700 cursor-wait opacity-50'
                                                    : 'border-stone-600 text-stone-400 hover:border-red-500 hover:text-red-500 hover:bg-red-500/10 active:scale-95'
                                                    }`}
                                            >
                                                <i className="fa-solid fa-minus"></i>
                                            </button>

                                            <div className="text-center min-w-[100px]">
                                                {sessionLoading ? (
                                                    <div className="flex flex-col items-center justify-center animate-pulse">
                                                        <span className="text-hunter-orange text-xs font-bold mb-1">CARREGANDO</span>
                                                        <div className="h-8 w-16 bg-white/10 rounded"></div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="flex items-end justify-center gap-1">
                                                            {/* Current Session Count (Small Orange) - Now from database */}
                                                            <span className="text-hunter-orange font-bold text-xs leading-none pb-0.5 flex items-center gap-1" title="Abates nesta sessão">
                                                                {session?.current_session_kills || 0}
                                                                {isSyncing && (
                                                                    <i className="fa-solid fa-sync fa-spin text-[8px] opacity-70"></i>
                                                                )}
                                                            </span>

                                                            {/* Total Grind Count (Large White) - Use stats from hook for optimistic sync */}
                                                            <span
                                                                className="text-4xl font-sans font-bold text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.2)] leading-none"
                                                                title="Total Global de abates (Histórico)"
                                                            >
                                                                {globalTotal || 0}
                                                            </span>
                                                        </div>
                                                        <span className="text-[10px] uppercase tracking-[0.3em] text-stone-500">Abates</span>
                                                    </>
                                                )}
                                            </div>

                                            <button
                                                onClick={() => updateCounter(1)}
                                                disabled={sessionLoading || isCooldown || !session}
                                                title="Incrementar contador (Ctrl+Shift+=)"
                                                className={`w-7 h-7 rounded-sm border flex items-center justify-center text-xs transition-colors ${sessionLoading || isCooldown || !session
                                                    ? 'border-stone-700 text-stone-700 cursor-wait opacity-50'
                                                    : 'border-stone-700 text-stone-400 hover:border-hunter-orange hover:text-hunter-orange active:bg-hunter-orange/10'
                                                    }`}
                                            >
                                                <i className="fa-solid fa-plus"></i>
                                            </button>
                                        </div>

                                        {/* Extra Toggles & GREAT ONE */}
                                        <div className="space-y-2 relative z-10">
                                            {/* Row 1: Diamond + Troll */}
                                            <div className="grid grid-cols-2 gap-2">
                                                <button
                                                    onClick={() => handleKillClick('diamond')}
                                                    title="Registrar diamante (diamante comum)"
                                                    className="py-1.5 px-2 text-[9px] font-bold border border-blue-600/50 bg-gradient-to-r from-blue-900/20 via-blue-800/10 to-blue-900/20 text-blue-300 hover:bg-blue-500 hover:text-white hover:border-blue-400 hover:shadow-[0_0_15px_rgba(59,130,246,0.4)] transition-colors rounded-sm flex items-center justify-center gap-1 active:scale-[0.98]"
                                                >
                                                    <i className="fa-regular fa-gem text-sm"></i> DIAMANTE
                                                </button>
                                                <button
                                                    onClick={() => handleKillClick('troll')}
                                                    title="Registrar Troll (nível máximo mas sem diamante)"
                                                    className="py-1.5 px-2 text-[9px] font-bold border border-orange-600/50 bg-gradient-to-r from-orange-900/20 via-orange-800/10 to-orange-900/20 text-orange-400 hover:bg-orange-600 hover:text-white hover:border-orange-400 hover:shadow-[0_0_15px_rgba(249,115,22,0.4)] transition-colors rounded-sm flex items-center justify-center gap-1 active:scale-[0.98]"
                                                >
                                                    <i className="fa-solid fa-face-frown-open text-sm"></i> TROLL
                                                </button>
                                            </div>

                                            {/* Row 2: Rare + Diamond Rare */}
                                            <div className="grid grid-cols-2 gap-2">
                                                <button
                                                    onClick={fetchFurTypes}
                                                    title="Registrar pelagem rara"
                                                    className="py-1.5 px-2 text-[9px] font-bold border border-purple-600/50 bg-gradient-to-r from-purple-900/20 via-purple-800/10 to-purple-900/20 text-purple-300 hover:bg-purple-500 hover:text-white hover:border-purple-400 hover:shadow-[0_0_15px_rgba(168,85,247,0.4)] transition-colors rounded-sm flex items-center justify-center gap-1 active:scale-[0.98]"
                                                >
                                                    <i className="fa-solid fa-star text-sm"></i> RARO
                                                </button>
                                                <button
                                                    onClick={async () => {
                                                        try {
                                                            const furTypesData = await getFurTypes();
                                                            setFurTypes(furTypesData);
                                                            setShowFurTypes(true);
                                                            (window as any).__isDiamondRare = true;
                                                        } catch (error) {
                                                            console.error('Erro ao buscar fur types:', error);
                                                        }
                                                    }}
                                                    title="Registrar Diamante Raro (diamante + pelagem rara)"
                                                    className="py-1.5 px-2 text-[9px] font-bold border border-cyan-600/50 bg-gradient-to-r from-cyan-900/20 via-blue-900/10 to-purple-900/20 text-cyan-300 hover:bg-gradient-to-r hover:from-cyan-600 hover:via-blue-500 hover:to-purple-600 hover:text-white hover:border-cyan-400 hover:shadow-[0_0_20px_rgba(34,211,238,0.4)] transition-colors rounded-sm flex items-center justify-center gap-1 active:scale-[0.98]"
                                                >
                                                    <i className="fa-regular fa-gem text-sm"></i>
                                                    <i className="fa-solid fa-star text-xs"></i>
                                                    <span className="tracking-tighter">DIAMANTE RARO</span>
                                                </button>
                                            </div>

                                            {/* Row 3: GREAT ONE (Full Width) */}
                                            <button
                                                onClick={() => handleKillClick('greatOne')}
                                                title="Registrar Great One! (o troféu máximo)"
                                                className="w-full py-2 px-2 text-[10px] font-bold border border-yellow-600/50 bg-gradient-to-r from-yellow-900/20 via-yellow-800/10 to-yellow-900/20 text-go-gold hover:bg-gradient-to-r hover:from-yellow-600 hover:via-yellow-500 hover:to-yellow-600 hover:text-white hover:border-go-gold hover:shadow-[0_0_20px_rgba(251,191,36,0.4)] transition-colors rounded-sm flex items-center justify-center gap-2 group animate-pulse-gold active:scale-[0.98]"
                                            >
                                                <i className="fa-solid fa-crown text-sm group-hover:animate-bounce"></i>
                                                <span className="tracking-[0.2em] text-sm">GREAT ONE</span>
                                            </button>


                                            {/* Session Date with Two Buttons */}
                                            <div className="mt-2 pt-2 border-t border-white/10">
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <p className="text-[9px] uppercase text-stone-500 tracking-wider">
                                                        Início: <span className="text-stone-300 font-mono">{startDate}</span>
                                                    </p>
                                                </div>

                                                {/* Two Buttons: Encerrar Sessão | Encerrar Grind */}
                                                <div className="grid grid-cols-2 gap-1.5">
                                                    {/* Encerrar Sessão (zera apenas contador atual) */}
                                                    <button
                                                        onClick={() => {
                                                            setConfirmModal({
                                                                show: true,
                                                                title: 'Encerrar Sessão',
                                                                message: 'Deseja encerrar a sessão atual? O contador será zerado, mas o grind continua ativo.',
                                                                confirmText: 'Encerrar Sessão',
                                                                confirmColor: 'yellow',
                                                                onConfirm: async () => {
                                                                    await resetCurrentSession();
                                                                    // Force refresh active sessions
                                                                    if (user) {
                                                                        getActiveSessions(user.uid).then(setActiveSessions);
                                                                    }
                                                                }
                                                            });
                                                        }}
                                                        title="Encerrar apenas a sessão atual"
                                                        disabled={!session || (session.current_session_kills || 0) === 0}
                                                        className={`w-full py-2 px-3 text-xs font-bold border rounded-sm flex items-center justify-center gap-2 transition-colors ${(!session || (session.current_session_kills || 0) === 0)
                                                            ? 'border-stone-700 text-stone-600 cursor-not-allowed bg-stone-800/30'
                                                            : 'border-yellow-600/50 text-yellow-500 hover:bg-yellow-900/20 hover:text-yellow-400'
                                                            } `}
                                                    >
                                                        <i className="fa-solid fa-rotate-left"></i>
                                                        <span className="uppercase tracking-wide">Sessão</span>
                                                    </button>

                                                    {/* Encerrar Grind (encerra tudo) */}
                                                    <button
                                                        onClick={() => {
                                                            setConfirmModal({
                                                                show: true,
                                                                title: 'Encerrar Grind',
                                                                message: 'Deseja encerrar TODO o grind? Isso finalizará a sessão atual e voltará para a seleção de animal.',
                                                                confirmText: 'Encerrar Grind',
                                                                confirmColor: 'red',
                                                                onConfirm: async () => {
                                                                    await resetGrind();
                                                                    setGrindActive(false);
                                                                    // Force refresh active sessions
                                                                    if (user) {
                                                                        getActiveSessions(user.uid).then(setActiveSessions);
                                                                    }
                                                                }
                                                            });
                                                        }}
                                                        title="Encerrar todo o grind"
                                                        className="py-1 px-2 text-[9px] font-bold border border-red-600 bg-red-900/20 text-red-400 hover:bg-red-600 hover:text-white  rounded-sm flex items-center justify-center gap-1 active:scale-95"
                                                    >
                                                        <i className="fa-solid fa-xmark"></i>
                                                        <span className="uppercase tracking-wide">Grind</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Bottom buttons */}
                            <div className="border-t border-white/10 pt-1.5 mt-1.5 space-y-1">

                                <button
                                    onClick={() => {
                                        setConfirmModal({
                                            show: true,
                                            title: 'Sair',
                                            message: 'Deseja realmente sair do aplicativo?',
                                            confirmText: 'Sair',
                                            confirmColor: 'red',
                                            onConfirm: handleLogout
                                        });
                                    }}
                                    title="Sair do aplicativo"
                                    className="w-full py-1.5 px-2 text-xs font-bold border border-red-600 bg-red-900/20 text-red-500 hover:bg-red-600 hover:text-white  rounded-sm flex items-center justify-center gap-1 active:scale-95"
                                >
                                    <i className="fa-solid fa-power-off"></i>
                                    <span className="uppercase tracking-wide">Sair</span>
                                </button>
                            </div>
                        </div>


                        {/* Promo Footer - Fixed at bottom */}
                        <div className="mt-auto pt-3 border-t border-white/10 text-center pb-0 shrink-0">
                            <p className="text-[11px] text-stone-400 mb-0">
                                Gerencie suas zonas de caça e grind no{' '}
                                <span
                                    onClick={() => (window as any).electron?.openExternal('https://cotwpinplanner.app')}
                                    className="text-hunter-orange hover:text-yellow-400 transition-colors font-bold tracking-wide cursor-pointer"
                                >
                                    Pin Planner →
                                </span>
                            </p>
                        </div>

                        {/* STATS MODAL */}
                        {showStats && (
                            <div className="absolute top-8 bottom-0 left-0 right-0 z-50 bg-stone-950/95 backdrop-blur-md flex flex-col animate-in slide-in-from-bottom-2 duration-200">
                                <div className="p-2 border-b border-white/10 flex justify-between items-center bg-stone-900 shadow-lg">
                                    <div className="flex items-center gap-4">
                                        <h3 className="font-serif text-white uppercase tracking-wider text-xs">
                                            <i className="fa-solid fa-chart-pie text-hunter-orange mr-2"></i> Estatísticas
                                        </h3>
                                        <button
                                            onClick={() => window.ipcRenderer.invoke('open-detailed-stats')}
                                            className="bg-hunter-orange/20 hover:bg-hunter-orange/30 text-white text-[10px] px-2 py-1 rounded border border-hunter-orange/30 transition-all flex items-center gap-1"
                                        >
                                            <i className="fa-solid fa-magnifying-glass-chart"></i> Ver Detalhes
                                        </button>
                                    </div>
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
                                                <div className="px-3 pb-3">
                                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                                        {(() => {
                                                            const totalKills = historicalStats.reduce((sum, animal) => sum + (animal.total_kills || 0), 0);
                                                            const totalDiamonds = historicalStats.reduce((sum, animal) => sum + (animal.total_diamonds || 0), 0);
                                                            const totalGreatOnes = historicalStats.reduce((sum, animal) => sum + (animal.total_great_ones || 0), 0);
                                                            const totalRares = historicalStats.reduce((sum, animal) => sum + (animal.total_rares || 0), 0);
                                                            const totalSuperRares = historicalStats.reduce((sum, animal) => sum + (animal.super_rares || 0), 0);
                                                            const speciesCount = historicalStats.filter(animal => (animal.total_kills || 0) > 0).length;

                                                            const avgDiamonds = totalDiamonds > 0 ? (totalKills / totalDiamonds).toFixed(1) : '0';
                                                            const avgGreatOnes = totalGreatOnes > 0 ? (totalKills / totalGreatOnes).toFixed(1) : '0';
                                                            const avgRares = totalRares > 0 ? (totalKills / totalRares).toFixed(1) : '0';
                                                            const avgSuperRares = totalSuperRares > 0 ? (totalKills / totalSuperRares).toFixed(1) : '0';

                                                            return (
                                                                <>
                                                                    <div className="bg-black/30 p-2 rounded">
                                                                        <span className="text-stone-400 text-[10px] uppercase block flex items-center gap-1">
                                                                            <i className="fa-solid fa-crosshairs"></i> Total de Abates
                                                                        </span>
                                                                        <span className="text-white text-2xl font-bold">
                                                                            {totalKills}
                                                                        </span>
                                                                    </div>
                                                                    <div className="bg-black/30 p-2 rounded">
                                                                        <span className="text-stone-400 text-[10px] uppercase block flex items-center gap-1">
                                                                            <i className="fa-solid fa-paw"></i> Espécies Caçadas
                                                                        </span>
                                                                        <span className="text-hunter-orange text-2xl font-bold">
                                                                            {speciesCount}
                                                                        </span>
                                                                    </div>
                                                                    <div className="bg-black/30 p-2 rounded">
                                                                        <span className="text-stone-400 text-[10px] uppercase block flex items-center gap-1">
                                                                            <i className="fa-regular fa-gem"></i> Diamantes
                                                                        </span>
                                                                        <div className="flex items-baseline gap-2">
                                                                            <span className="text-blue-400 text-xl font-bold">{totalDiamonds}</span>
                                                                            {totalDiamonds > 0 && (
                                                                                <span className="text-yellow-400 text-sm">({avgDiamonds})</span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    <div className="bg-black/30 p-2 rounded">
                                                                        <span className="text-stone-400 text-[10px] uppercase block flex items-center gap-1">
                                                                            <i className="fa-solid fa-crown"></i> Great Ones
                                                                        </span>
                                                                        <div className="flex items-baseline gap-2">
                                                                            <span className="text-go-gold text-xl font-bold">{totalGreatOnes}</span>
                                                                            {totalGreatOnes > 0 && (
                                                                                <span className="text-yellow-400 text-sm">({avgGreatOnes})</span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    <div className="bg-black/30 p-2 rounded">
                                                                        <span className="text-stone-400 text-[10px] uppercase block flex items-center gap-1">
                                                                            <i className="fa-solid fa-star"></i> Raros
                                                                        </span>
                                                                        <div className="flex items-baseline gap-2">
                                                                            <span className="text-purple-400 text-xl font-bold">{totalRares}</span>
                                                                            {totalRares > 0 && (
                                                                                <span className="text-yellow-400 text-sm">({avgRares})</span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    <div className="bg-black/30 p-2 rounded">
                                                                        <span className="text-stone-400 text-[10px] uppercase block flex items-center gap-1">
                                                                            <i className="fa-solid fa-medal"></i> Super Raros
                                                                        </span>
                                                                        <div className="flex items-baseline gap-2">
                                                                            <span className="text-pink-400 text-xl font-bold">{totalSuperRares}</span>
                                                                            {totalSuperRares > 0 && (
                                                                                <span className="text-yellow-400 text-sm">({avgSuperRares})</span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </>
                                                            );
                                                        })()}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Overall Statistics Card */}
                                    {activeSessions.length > 0 && (
                                        <div className="bg-hunter-orange/10 border border-hunter-orange/30 rounded-sm overflow-hidden">
                                            <div
                                                className="p-3 cursor-pointer hover:bg-hunter-orange/5 transition-colors flex justify-between items-center"
                                                onClick={() => setShowCurrentSession(!showCurrentSession)}
                                            >
                                                <h4 className="text-hunter-orange uppercase text-xs font-bold flex items-center gap-2">
                                                    <i className="fa-solid fa-chart-line"></i> Sessões Ativas ({activeSessions.length})
                                                </h4>
                                                <i className={`fa-solid fa-chevron-${showCurrentSession ? 'up' : 'down'} text-hunter-orange text-xs`}></i>
                                            </div>

                                            {showCurrentSession && (
                                                <div className="px-3 pb-3 space-y-3">
                                                    {activeSessions.map((activeSession, index) => (
                                                        <div
                                                            key={activeSession.session_id}
                                                            className={`${index > 0 ? 'pt-3 border-t border-hunter-orange/20' : ''} `}
                                                        >
                                                            <h5 className="text-hunter-orange font-bold text-[11px] uppercase mb-2 flex items-center gap-2">
                                                                <i className="fa-solid fa-paw"></i>
                                                                {activeSession.animal_name}
                                                            </h5>
                                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                                                <div>
                                                                    <span className="text-stone-500 text-[10px] uppercase block">Abates</span>
                                                                    <span className="text-white font-bold">{activeSession.total_kills || 0}</span>
                                                                </div>
                                                                <div>
                                                                    <span className="text-stone-500 text-[10px] uppercase block">Diamantes</span>
                                                                    <span className="text-blue-400 font-bold">{activeSession.total_diamonds || 0}</span>
                                                                </div>
                                                                <div>
                                                                    <span className="text-stone-500 text-[10px] uppercase block">Great Ones</span>
                                                                    <span className="text-go-gold font-bold">{activeSession.total_great_ones || 0}</span>
                                                                </div>
                                                                <div>
                                                                    <span className="text-stone-500 text-[10px] uppercase block">Raros</span>
                                                                    <span className="text-purple-400 font-bold">{activeSession.total_rare_furs || 0}</span>
                                                                </div>
                                                                <div>
                                                                    <span className="text-stone-500 text-[10px] uppercase block">Trolls</span>
                                                                    <span className="text-red-500 font-bold">{activeSession.total_trolls || 0}</span>
                                                                </div>
                                                            </div>

                                                            {/* Averages - Only if there are kills */}
                                                            {activeSession.total_kills > 0 && (
                                                                <div className="mt-2 pt-2 border-t border-hunter-orange/10">
                                                                    <div className="space-y-1 text-[10px]">
                                                                        {activeSession.total_diamonds > 0 && (
                                                                            <div className="flex justify-between">
                                                                                <span className="text-stone-500">Abates/Diamante:</span>
                                                                                <span className="text-blue-300 font-bold">
                                                                                    {(activeSession.total_kills / activeSession.total_diamonds).toFixed(1)}
                                                                                </span>
                                                                            </div>
                                                                        )}
                                                                        {activeSession.total_great_ones > 0 && (
                                                                            <div className="flex justify-between">
                                                                                <span className="text-stone-500">Abates/GO:</span>
                                                                                <span className="text-go-gold font-bold">
                                                                                    {(activeSession.total_kills / activeSession.total_great_ones).toFixed(1)}
                                                                                </span>
                                                                            </div>
                                                                        )}
                                                                        {activeSession.total_rare_furs > 0 && (
                                                                            <div className="flex justify-between">
                                                                                <span className="text-stone-500">Abates/Raro:</span>
                                                                                <span className="text-purple-300 font-bold">
                                                                                    {(activeSession.total_kills / activeSession.total_rare_furs).toFixed(1)}
                                                                                </span>
                                                                            </div>
                                                                        )}
                                                                        {activeSession.total_trolls > 0 && (
                                                                            <div className="flex justify-between">
                                                                                <span className="text-stone-500">Abates/Troll:</span>
                                                                                <span className="text-red-300 font-bold">
                                                                                    {(activeSession.total_kills / activeSession.total_trolls).toFixed(1)}
                                                                                </span>
                                                                            </div>
                                                                        )}
                                                                    </div>

                                                                    {/* Rare fur types in active session */}
                                                                    {activeSession.rare_furs && activeSession.rare_furs.length > 0 && (
                                                                        <div className="mt-2 bg-stone-950/30 p-1.5 rounded border border-purple-500/10">
                                                                            <span className="text-purple-400 block text-[8px] mb-1 font-bold uppercase">Pelagens Raras</span>
                                                                            <span className="text-purple-300 text-[9px]">{activeSession.rare_furs.join(', ')}</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
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
                                                <div className="relative flex-1 max-w-[140px] z-10">
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
                                                    // Removed isTopAnimal logic as requested by user
                                                    const isTopAnimal = false;

                                                    return (
                                                        <div
                                                            key={animalStat.animal_id}
                                                            className={`bg-stone-900 border p-2 rounded-sm  cursor-pointer ${animalStat.total_great_ones > 0 ? 'great-one-glow' : ''
                                                                } ${animalStat.has_active_session ? 'border-hunter-orange/50' :
                                                                    isExpanded ? 'border-hunter-orange' : 'border-white/5 hover:border-hunter-orange/30'
                                                                } `}
                                                            onClick={() => setSelectedAnimalForStats(
                                                                isExpanded ? null : animalStat.animal_id
                                                            )}
                                                        >
                                                            <div className="flex justify-between items-center mb-1">
                                                                <span className={`font-serif text-xs font-bold flex items-center gap-1 ${isTopAnimal ? 'text-hunter-orange' : 'text-stone-400'
                                                                    } `}>
                                                                    {animalStat.animal_name}
                                                                    <span className="ml-2 text-[11px] text-stone-400 bg-stone-950/80 px-2 py-0.5 rounded border border-stone-700 font-normal shadow-sm" title="Total de sessões de caça realizadas para este animal">
                                                                        <i className="fa-solid fa-clock-rotate-left mr-1.5 text-hunter-orange"></i>
                                                                        {animalStat.total_sessions}
                                                                    </span>
                                                                    <i className={`fa-solid fa-chevron-${isExpanded ? 'up' : 'down'} text-[8px] ml-1`}></i>
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
                                                                <span className="flex items-center gap-1 text-red-500">
                                                                    <i className="fa-solid fa-skull"></i> {animalStat.total_trolls || 0}
                                                                </span>
                                                            </div>

                                                            <div className="w-full h-1 bg-stone-800 rounded-full overflow-hidden">
                                                                <div
                                                                    className={`h-full rounded-full ${isTopAnimal ? 'bg-hunter-orange' : 'bg-stone-600'
                                                                        } `}
                                                                    style={{ width: `${progressPercent}% ` }}
                                                                ></div>
                                                            </div>

                                                            {/* Expanded Details */}
                                                            {isExpanded && (
                                                                <div className="mt-2 pt-2 border-t border-stone-700 space-y-2">
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
                                                                            <span className="text-stone-500 block text-[8px]">Raros</span>
                                                                            <span className="text-purple-400 font-bold">{animalStat.total_rares || 0}</span>
                                                                        </div>
                                                                        <div className="bg-stone-950/50 p-1.5 rounded">
                                                                            <span className="text-stone-500 block text-[8px]">Trolls</span>
                                                                            <span className="text-red-500 font-bold">{animalStat.total_trolls || 0}</span>
                                                                        </div>
                                                                    </div>

                                                                    {/* Rare fur types */}
                                                                    {animalStat.rare_types && animalStat.rare_types.length > 0 && (
                                                                        <div className="bg-stone-950/50 p-1.5 rounded mt-2 border border-purple-500/10">
                                                                            <span className="text-purple-400 block text-[8px] mb-1 font-bold uppercase tracking-wider">
                                                                                <i className="fa-solid fa-star mr-1"></i> Pelagens Raras
                                                                            </span>
                                                                            <div className="flex flex-wrap gap-1">
                                                                                {animalStat.rare_types.map((type: string, idx: number) => (
                                                                                    <span key={idx} className="bg-purple-500/10 text-purple-300 text-[9px] px-1.5 py-0.5 rounded border border-purple-500/20">
                                                                                        {type}
                                                                                    </span>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    )}

                                                                    {/* Super Rare List */}
                                                                    {animalStat.super_rare_list && animalStat.super_rare_list.length > 0 && (
                                                                        <div className="bg-stone-950/50 p-1.5 rounded mt-2 border border-pink-500/20">
                                                                            <span className="text-pink-400 block text-[8px] mb-1 font-bold uppercase tracking-wider">
                                                                                <i className="fa-solid fa-medal mr-1"></i> Super Raros
                                                                            </span>
                                                                            <div className="space-y-1">
                                                                                {animalStat.super_rare_list.map((sr: any, idx: number) => (
                                                                                    <div key={idx} className="flex justify-between items-center text-[9px] border-b border-white/5 last:border-0 pb-0.5 last:pb-0">
                                                                                        <span className="text-stone-300">{sr.fur_type || 'Desconhecido'}</span>
                                                                                        <span className="text-stone-500 font-mono text-[8px]">
                                                                                            {new Date(sr.date).toLocaleDateString('pt-BR')}
                                                                                        </span>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    )}

                                                                    <div className="grid grid-cols-2 gap-2 text-[10px] mt-2">
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
                                                                            {animalStat.total_rares > 0 && (
                                                                                <div className="flex justify-between">
                                                                                    <span className="text-stone-500">Abat./Raro:</span>
                                                                                    <span className="text-purple-300 font-bold">
                                                                                        {(animalStat.total_kills / animalStat.total_rares).toFixed(1)}
                                                                                    </span>
                                                                                </div>
                                                                            )}
                                                                            {animalStat.total_trolls > 0 && (
                                                                                <div className="flex justify-between">
                                                                                    <span className="text-stone-500">Abat./Troll:</span>
                                                                                    <span className="text-red-300 font-bold">
                                                                                        {(animalStat.total_kills / animalStat.total_trolls).toFixed(1)}
                                                                                    </span>
                                                                                </div>
                                                                            )}

                                                                            {/* Super Raros */}
                                                                            {animalStat.super_rares > 0 && (
                                                                                <div className="flex justify-between">
                                                                                    <span className="text-stone-500">Abat./💎⭐:</span>
                                                                                    <span className="text-cyan-300 font-bold">
                                                                                        {(animalStat.total_kills / animalStat.super_rares).toFixed(1)}
                                                                                    </span>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}

                                                                    {/* Super Raros capturados */}
                                                                    {animalStat.super_rare_types && animalStat.super_rare_types.length > 0 && (
                                                                        <div className="mt-2 pt-2 border-t border-stone-700">
                                                                            <h6 className="text-stone-500 uppercase text-[8px] font-bold mb-1">Super Raros (💎 + ⭐)</h6>
                                                                            <div className="text-[9px] text-stone-400 space-y-0.5">
                                                                                {animalStat.super_rare_types.map((type: string, idx: number) => (
                                                                                    <div key={idx} className="flex items-start gap-1">
                                                                                        <span className="text-cyan-400">💎⭐</span>
                                                                                        <span>{type}</span>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
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
                            <div className="absolute inset-0 z-50 bg-stone-950/95 backdrop-blur-md flex flex-col ">
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
            </div>

            {/* Modals & Overlays */}

            <ConfirmationModal
                show={confirmModal.show}
                title={confirmModal.title}
                message={confirmModal.message}
                confirmText={confirmModal.confirmText}
                confirmColor={confirmModal.confirmColor}
                onConfirm={() => {
                    confirmModal.onConfirm();
                    setConfirmModal(prev => ({ ...prev, show: false }));
                }}
                onCancel={() => setConfirmModal(prev => ({ ...prev, show: false }))}
            />

            <NeedZonesModal show={showNeedZones} onClose={() => setShowNeedZones(false)} />
            <AboutModal
                show={showAbout}
                onClose={() => setShowAbout(false)}
            />

            {/* Kill Details Modal */}
            {showKillDetailsModal && pendingKillData && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-stone-900 border border-stone-700 rounded-lg shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-4 border-b border-stone-800 flex justify-between items-center bg-stone-950/50">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                <i className="fa-solid fa-clipboard-list text-green-500"></i>
                                Detalhes do Abate
                            </h3>
                            <button
                                onClick={() => setShowKillDetailsModal(false)}
                                className="text-stone-500 hover:text-white transition-colors"
                            >
                                <i className="fa-solid fa-times"></i>
                            </button>
                        </div>

                        <div className="p-4 space-y-4">
                            {/* Info do Tipo */}
                            <div className="flex gap-2 flex-wrap">
                                {pendingKillData.isDiamond && <span className="px-2 py-1 bg-cyan-900/30 text-cyan-400 text-[10px] rounded border border-cyan-800">DIAMANTE</span>}
                                {pendingKillData.isGreatOne && <span className="px-2 py-1 bg-yellow-900/30 text-yellow-400 text-[10px] rounded border border-yellow-800">GREAT ONE</span>}
                                {pendingKillData.isTroll && <span className="px-2 py-1 bg-orange-900/30 text-orange-400 text-[10px] rounded border border-orange-800">TROLL</span>}
                                {pendingKillData.furTypeName && <span className="px-2 py-1 bg-pink-900/30 text-pink-400 text-[10px] rounded border border-pink-800">{pendingKillData.furTypeName}</span>}
                                {!pendingKillData.isDiamond && !pendingKillData.isGreatOne && !pendingKillData.isTroll && !pendingKillData.furTypeName && <span className="px-2 py-1 bg-stone-800 text-stone-400 text-[10px] rounded border border-stone-700">ABATE NORMAL</span>}
                            </div>

                            {/* Peso */}
                            <div>
                                <label className="block text-[10px] uppercase text-stone-500 font-bold mb-1">Peso (kg)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={killDetails.weight}
                                    onChange={(e) => setKillDetails(prev => ({ ...prev, weight: e.target.value }))}
                                    className="w-full bg-stone-950 border border-stone-800 rounded px-3 py-2 text-sm text-white focus:border-green-600 focus:outline-none transition-colors"
                                    placeholder="Ex: 120.5"
                                />
                            </div>

                            {/* Score */}
                            <div>
                                <label className="block text-[10px] uppercase text-stone-500 font-bold mb-1">Score do Troféu</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    value={killDetails.trophyScore}
                                    onChange={(e) => setKillDetails(prev => ({ ...prev, trophyScore: e.target.value }))}
                                    className="w-full bg-stone-950 border border-stone-800 rounded px-3 py-2 text-sm text-white focus:border-green-600 focus:outline-none transition-colors"
                                    placeholder="Ex: 250.0"
                                />
                            </div>

                            {/* Dificuldade */}
                            <div>
                                <label className="block text-[10px] uppercase text-stone-500 font-bold mb-1">Dificuldade (1-10)</label>
                                <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar">
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(level => (
                                        <button
                                            key={level}
                                            onClick={() => setKillDetails(prev => ({ ...prev, difficultyLevel: String(level) }))}
                                            className={`
                                                w-8 h-8 shrink-0 rounded flex items-center justify-center text-xs font-bold border transition-all
                                                ${killDetails.difficultyLevel === String(level)
                                                    ? 'bg-green-600 border-green-500 text-white shadow-[0_0_10px_rgba(22,163,74,0.4)]'
                                                    : 'bg-stone-800 border-stone-700 text-stone-400 hover:bg-stone-700 hover:text-white'}
                                            `}
                                        >
                                            {level}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="p-4 border-t border-stone-800 bg-stone-950/30 flex gap-2">
                            <button
                                onClick={() => setShowKillDetailsModal(false)}
                                className="flex-1 py-2 text-xs font-bold text-stone-400 hover:text-white transition-colors"
                            >
                                CANCELAR
                            </button>
                            <button
                                onClick={async () => {
                                    await addKill(
                                        pendingKillData.isDiamond,
                                        pendingKillData.isGreatOne,
                                        pendingKillData.furTypeId,
                                        pendingKillData.furTypeName,
                                        pendingKillData.isTroll,
                                        killDetails.weight ? parseFloat(killDetails.weight) : null,
                                        killDetails.trophyScore ? parseFloat(killDetails.trophyScore) : null,
                                        killDetails.difficultyLevel ? parseInt(killDetails.difficultyLevel) : null
                                    );
                                    setShowKillDetailsModal(false);
                                }}
                                className="flex-1 py-2 bg-green-700 hover:bg-green-600 text-white text-xs font-bold rounded shadow-[0_0_15px_rgba(21,128,61,0.4)] transition-all"
                            >
                                CONFIRMAR
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                    .glass-panel {
                        background: rgba(26, 26, 26, 0.4);
                        backdrop-filter: blur(3px);
                        -webkit-backdrop-filter: blur(3px);
                        border: 1px solid rgba(255, 255, 255, 0.1);
                    }

                    @keyframes neonBorder {
                        0% {
                            box-shadow: 
                                0 0 5px rgba(217, 93, 30, 0.5),
                                inset 0 0 5px rgba(217, 93, 30, 0.2);
                        }
                        25% {
                            box-shadow: 
                                0 0 20px rgba(217, 93, 30, 0.8),
                                0 0 40px rgba(217, 93, 30, 0.6),
                                inset 0 0 20px rgba(217, 93, 30, 0.4);
                        }
                        50% {
                            box-shadow: 
                                0 0 30px rgba(217, 93, 30, 1),
                                0 0 60px rgba(217, 93, 30, 0.8),
                                inset 0 0 30px rgba(217, 93, 30, 0.6);
                        }
                        75% {
                            box-shadow: 
                                0 0 20px rgba(217, 93, 30, 0.8),
                                0 0 40px rgba(217, 93, 30, 0.6),
                                inset 0 0 20px rgba(217, 93, 30, 0.4);
                        }
                        100% {
                            box-shadow: 
                                0 0 5px rgba(217, 93, 30, 0.5),
                                inset 0 0 5px rgba(217, 93, 30, 0.2);
                        }
                    }
                    .neon-border-active {
                        animation: neonBorder 1.5s ease-in-out;
                        border-color: rgba(217, 93, 30, 0.8) !important;
                    }
                    @keyframes greatOneGlow {
                        0%, 100% {
                            box-shadow: 
                                0 0 10px rgba(255, 215, 0, 0.3),
                                0 0 20px rgba(255, 215, 0, 0.2),
                                inset 0 0 10px rgba(255, 215, 0, 0.1);
                            border-color: rgba(255, 215, 0, 0.4);
                        }
                        50% {
                            box-shadow: 
                                0 0 20px rgba(255, 215, 0, 0.6),
                                0 0 40px rgba(255, 215, 0, 0.4),
                                0 0 60px rgba(255, 215, 0, 0.2),
                                inset 0 0 20px rgba(255, 215, 0, 0.2);
                            border-color: rgba(255, 215, 0, 0.8);
                        }
                    }
                    .great-one-glow {
                        animation: greatOneGlow 2s ease-in-out infinite;
                        border-width: 2px;
                        position: relative;
                    }
                `}</style>
            {/* Side Panel - Slides from right */}
            {/* Side Panel - Slides from right */}
            <NeedZonesPanel show={showNeedZonesPanel} onClose={() => setShowNeedZonesPanel(false)} />
        </div>
    );
};
