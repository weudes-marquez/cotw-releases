import { useState, useEffect } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { sanitizeLoginCredentials, rateLimiter } from '../utils/sanitize';
import { securityLogger } from '../utils/securityLogger';

export const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const getErrorMessage = (error: any): string => {
        const errorCode = error.code;

        switch (errorCode) {
            case 'auth/invalid-credential':
                return 'Email ou senha incorretos. Verifique suas credenciais.';
            case 'auth/user-not-found':
                return 'Usuário não encontrado. Verifique seu email.';
            case 'auth/wrong-password':
                return 'Senha incorreta. Tente novamente.';
            case 'auth/invalid-email':
                return 'Email inválido. Verifique o formato do email.';
            case 'auth/user-disabled':
                return 'Esta conta foi desativada. Entre em contato com o suporte.';
            case 'auth/too-many-requests':
                return 'Muitas tentativas de login. Tente novamente mais tarde.';
            case 'auth/network-request-failed':
                return 'Erro de conexão. Verifique sua internet.';
            default:
                return error.message || 'Erro ao fazer login. Tente novamente.';
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        // Sanitizar e validar credenciais
        const sanitized = sanitizeLoginCredentials(email, password);

        if (!sanitized.isValid) {
            setError(sanitized.errors.join('. '));
            securityLogger.logLoginFailure(email, 'Invalid credentials format');
            return;
        }

        // Rate limiting - máximo 5 tentativas por minuto
        if (!rateLimiter.canProceed(sanitized.email, 5, 60000)) {
            setError('Muitas tentativas de login. Aguarde 1 minuto e tente novamente.');
            securityLogger.logSuspiciousActivity(undefined, `Rate limit exceeded for ${sanitized.email}`);
            return;
        }

        setLoading(true);

        try {


            // Step 1: Authenticate with Firebase (client-side) usando credenciais sanitizadas
            const userCredential = await signInWithEmailAndPassword(auth, sanitized.email, sanitized.password);
            const user = userCredential.user;


            // Log successful login
            securityLogger.logLoginSuccess(user.uid, sanitized.email);

            // Resetar rate limiter após sucesso
            rateLimiter.reset(sanitized.email);

            // Step 2: Get the idToken

            const idToken = await user.getIdToken(true); // Force refresh


            // Step 3: Send idToken to backend API to create session

            const response = await fetch('https://cotwpinplanner.app/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ idToken }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Falha ao criar a sessão no servidor.');
            }

            const responseData = await response.json();


            // Navigate to dashboard
            navigate('/dashboard');
        } catch (err: any) {
            console.error('❌ Login error:', err);
            const errorMessage = getErrorMessage(err);
            setError(errorMessage);
            securityLogger.logLoginFailure(sanitized.email, err.message || 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    // Resize window for login screen
    useEffect(() => {
        if ((window as any).ipcRenderer) {
            (window as any).ipcRenderer.send('resize-window', 480, 640);
        }
    }, []);

    return (
        <div className="h-screen w-full overflow-hidden bg-stone-dark text-gray-100 font-sans relative flex items-center justify-center p-4">
            {/* Background Layers */}
            {/* Background Layers */}
            <div className="absolute inset-0 w-full h-full overflow-hidden z-0 pointer-events-none">
                {/* Image Background */}
                <div
                    className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-100"
                    style={{ backgroundImage: "url('cotw-nature-05.webp')" }}
                ></div>
                {/* Gradient Overlay - Reduced opacity for better visibility */}
                <div className="absolute inset-0 bg-gradient-to-br from-stone-900/70 via-stone-950/60 to-black/80"></div>
            </div>

            {/* Close Button - Top Right */}
            <button
                onClick={() => window.close()}
                className="absolute top-4 right-4 z-50 w-8 h-8 rounded-full bg-red-600/80 hover:bg-red-500 text-white  flex items-center justify-center shadow-lg hover:shadow-red-500/50 active:scale-95"
                title="Fechar aplicativo"
            >
                <i className="fa-solid fa-xmark text-lg"></i>
            </button>

            {/* Main Container - Centered with fixed width for padding effect */}
            <div className="relative z-10 w-80 space-y-3">
                {/* Important Notices */}
                <div className="bg-yellow-900/30 backdrop-blur-sm border border-yellow-600/50 rounded-sm p-3 shadow-lg">
                    <h3 className="text-yellow-400 font-bold uppercase text-[10px] tracking-wider mb-2 flex items-center gap-2">
                        <i className="fa-solid fa-triangle-exclamation"></i> Avisos Importantes
                    </h3>
                    <ul className="space-y-1.5 text-[10px] text-stone-300">
                        <li className="flex gap-2">
                            <i className="fa-solid fa-shield-halved text-yellow-500 mt-0.5 shrink-0"></i>
                            <span>Antivírus pode detectar como malicioso (falso positivo). Marque como seguro se necessário.</span>
                        </li>
                        <li className="flex gap-2">
                            <i className="fa-solid fa-gamepad text-yellow-500 mt-0.5 shrink-0"></i>
                            <span><strong>No jogo:</strong> Pressione <kbd className="px-1 py-0.5 bg-stone-800 border border-stone-600 rounded text-[9px] font-mono">ALT + Enter</kbd> para ativar modo janela sem borda.</span>
                        </li>
                    </ul>
                </div>

                {/* Login Card */}
                <div className="w-full bg-stone-900/80 backdrop-blur-sm border border-white/10 p-5 shadow-2xl rounded-sm relative overflow-hidden group">
                    {/* Decorative Top Line (Hunter Orange) */}
                    <div className="absolute top-0 left-0 w-full h-1 bg-hunter-orange shadow-[0_0_10px_rgba(217,93,30,0.5)]"></div>

                    {/* Window Drag Handle */}
                    <div className="absolute top-0 left-0 w-full h-8 z-50 drag-region" />

                    {/* Header */}
                    <div className="mb-3 space-y-1">
                        {/* Logo + Title (Aligned Left) */}
                        <div className="flex items-center gap-3">
                            <img
                                src="/build/icon.png"
                                alt="Logo"
                                className="w-10 h-10 object-contain"
                                onError={(e) => {
                                    // Fallback if icon not found
                                    (e.target as HTMLImageElement).style.display = 'none';
                                }}
                            />
                            <h1 className="font-serif text-lg font-bold tracking-widest text-white uppercase shadow-black drop-shadow-lg">
                                COTW Pin Planner
                            </h1>
                        </div>
                        <p className="text-stone-400 text-[10px] tracking-[0.2em] uppercase">Grind Counter</p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-2.5">
                        {/* Email Input */}
                        <div className="group/input">
                            <label
                                htmlFor="email"
                                className="block text-[10px] uppercase tracking-wider text-stone-400 mb-1 group-focus-within/input:text-hunter-orange transition-colors"
                            >
                                Usuário Pin Planner
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <i className="fa-regular fa-envelope text-stone-500 group-focus-within/input:text-white transition-colors"></i>
                                </div>
                                <input
                                    type="email"
                                    id="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="block w-full pl-10 pr-3 py-2 bg-stone-800/50 border border-stone-600 text-stone-100 placeholder-stone-600 focus:outline-none focus:border-hunter-orange focus:bg-stone-800   rounded-none text-sm"
                                    placeholder="seu@email.com"
                                />
                            </div>
                        </div>

                        {/* Password Input */}
                        <div className="group/input">
                            <label
                                htmlFor="password"
                                className="block text-[10px] uppercase tracking-wider text-stone-400 mb-1 group-focus-within/input:text-hunter-orange transition-colors"
                            >
                                Senha de Acesso
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <i className="fa-solid fa-lock text-stone-500 group-focus-within/input:text-white transition-colors"></i>
                                </div>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    id="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="block w-full pl-10 pr-12 py-2 bg-stone-800/50 border border-stone-600 text-stone-100 placeholder-stone-600 focus:outline-none focus:border-hunter-orange focus:bg-stone-800   rounded-none text-sm"
                                    placeholder="••••••••"
                                />
                                {/* Toggle Password Visibility */}
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-stone-500 hover:text-hunter-orange transition-colors cursor-pointer focus:outline-none"
                                >
                                    <i className={`fa-regular ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                                </button>
                            </div>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="bg-red-900/30 border border-red-500/50 text-red-200 px-3 py-2 rounded-sm text-xs">
                                <i className="fa-solid fa-exclamation-triangle mr-2"></i>
                                {error}
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="relative w-full bg-hunter-orange hover:bg-hunter-orange/90 text-white font-bold py-2.5 px-4   uppercase tracking-[0.15em] text-xs shadow-lg hover:shadow-hunter-orange/50 disabled:opacity-50 disabled:cursor-not-allowed group overflow-hidden active:scale-[0.98]"
                        >
                            {loading ? (
                                <i className="fa-solid fa-circle-notch fa-spin text-white"></i>
                            ) : (
                                <span className="relative z-10 flex items-center gap-2 justify-center">
                                    Entrar <i className="fa-solid fa-arrow-right group-hover:translate-x-1 transition-transform"></i>
                                </span>
                            )}
                            {/* Shine Effect */}
                            {!loading && (
                                <div className="absolute top-0 -left-full w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:animate-[shine_1.5s_ease-in-out]"></div>
                            )}
                        </button>
                    </form>

                    {/* Footer */}
                    <div className="mt-4 text-center border-t border-white/10 pt-3">
                        <p className="text-stone-500 text-[10px] mb-1.5">
                            Gerencie suas zonas de caça e grind no{' '}
                            <a
                                href="https://cotwpinplanner.app"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-hunter-orange hover:text-yellow-400 transition-colors font-bold"
                            >
                                Pin Planner →
                            </a>
                        </p>
                    </div>
                </div>

                {/* Guide Button - Below Login Container */}
                <div className="mt-6 flex justify-center z-10 relative">
                    <button
                        onClick={() => {
                            (window as any).ipcRenderer.send('open-user-guide');
                        }}
                        className="flex items-center gap-2 px-6 py-2.5 bg-stone-900/80 hover:bg-hunter-orange text-stone-400 hover:text-white rounded-full border border-white/10 hover:border-hunter-orange   text-xs font-bold uppercase tracking-wider group backdrop-blur-sm shadow-lg"
                    >
                        <i className="fa-solid fa-book text-sm group-hover:scale-110 transition-transform"></i>
                        <span>Guia de Uso e Atalhos</span>
                    </button>
                </div>

                {/* Decorative elements mimicking HUD */}
                <div className="absolute bottom-8 left-8 hidden md:block text-stone-500/50 text-[10px] font-mono tracking-widest">
                    COORD: 48.8566° N, 2.3522° E<br />
                    WIND: 4.2 M/S NW<br />
                    TEMP: 12°C
                </div>

                <div className="absolute top-8 right-8 hidden md:block text-stone-500/50 text-2xl opacity-50">
                    <i className="fa-solid fa-compass fa-spin" style={{ animationDuration: '10s' }}></i>
                </div>
            </div>

            <style>{`
        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus,
        input:-webkit-autofill:active {
          -webkit-box-shadow: 0 0 0 30px #292524 inset !important;
          -webkit-text-fill-color: white !important;
          transition: background-color 5000s ease-in-out 0s;
        }
        
        @keyframes shine {
          0% { left: -100%; }
          100% { left: 100%; }
        }
      `}</style>
        </div>
    );
};
