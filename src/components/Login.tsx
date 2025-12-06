import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { sanitizeLoginCredentials, rateLimiter } from '../utils/sanitize';

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
            return;
        }

        // Rate limiting - máximo 5 tentativas por minuto
        if (!rateLimiter.canProceed(sanitized.email, 5, 60000)) {
            setError('Muitas tentativas de login. Aguarde 1 minuto e tente novamente.');
            return;
        }

        setLoading(true);

        try {
            console.log('🔐 Step 1: Authenticating with Firebase...');

            // Step 1: Authenticate with Firebase (client-side) usando credenciais sanitizadas
            const userCredential = await signInWithEmailAndPassword(auth, sanitized.email, sanitized.password);
            const user = userCredential.user;
            console.log('✅ Firebase authentication successful!');

            // Resetar rate limiter após sucesso
            rateLimiter.reset(sanitized.email);

            // Step 2: Get the idToken
            console.log('🎫 Step 2: Getting idToken...');
            const idToken = await user.getIdToken(true); // Force refresh
            console.log('✅ idToken obtained');

            // Step 3: Send idToken to backend API to create session
            console.log('🌐 Step 3: Creating session on backend...');
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
            console.log('✅ Session created successfully!', responseData);

            // Navigate to dashboard
            navigate('/dashboard');
        } catch (err: any) {
            console.error('❌ Login error:', err);
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-screen w-full overflow-hidden bg-stone-dark text-gray-100 font-sans relative">
            {/* Background Layers */}
            <div className="absolute inset-0 w-full h-full overflow-hidden z-0 pointer-events-none">
                {/* Imagem com efeito de Zoom lento */}
                <div
                    className="absolute inset-0 animate-ken-burns"
                    style={{
                        backgroundImage: 'url(https://images.unsplash.com/photo-1519331379826-f9686293dea8?q=80&w=2560&auto=format&fit=crop)',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center'
                    }}
                ></div>
                {/* Overlay Escuro para legibilidade */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-stone-900/80 to-black/95"></div>
                {/* Overlay de Vinheta */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-transparent to-black opacity-90"></div>

                {/* Crosshairs Background Icon */}
                <div className="absolute inset-0 flex items-center justify-center opacity-5">
                    <i className="fa-solid fa-crosshairs text-[400px] text-white"></i>
                </div>
            </div>

            {/* Main Container */}
            <div className="relative z-10 flex items-center justify-center h-full">
                {/* Login Card */}
                <div className="w-full max-w-md bg-stone-900/80 backdrop-blur-sm border border-white/10 p-6 shadow-2xl rounded-sm animate-fade-in relative overflow-hidden group">
                    {/* Decorative Top Line (Hunter Orange) */}
                    <div className="absolute top-0 left-0 w-full h-1 bg-hunter-orange shadow-[0_0_10px_rgba(217,93,30,0.5)]"></div>

                    {/* Header */}
                    <div className="text-center mb-4 space-y-1">
                        {/* Logo + Title (Inline) */}
                        <div className="flex items-center justify-center gap-3">
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
                    <form onSubmit={handleSubmit} className="space-y-3">
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
                                    className="block w-full pl-10 pr-3 py-2 bg-stone-800/50 border border-stone-600 text-stone-100 placeholder-stone-600 focus:outline-none focus:border-hunter-orange focus:bg-stone-800 transition-all duration-300 rounded-none text-sm"
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
                                    className="block w-full pl-10 pr-12 py-2 bg-stone-800/50 border border-stone-600 text-stone-100 placeholder-stone-600 focus:outline-none focus:border-hunter-orange focus:bg-stone-800 transition-all duration-300 rounded-none text-sm"
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
                            <div className="bg-red-900/30 border border-red-500/50 text-red-200 px-4 py-3 rounded-sm text-sm">
                                <i className="fa-solid fa-exclamation-triangle mr-2"></i>
                                {error}
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="relative w-full bg-hunter-orange hover:bg-hunter-orange/90 text-white font-bold py-2.5 px-4 transition-all duration-300 uppercase tracking-[0.15em] text-xs shadow-lg hover:shadow-hunter-orange/50 disabled:opacity-50 disabled:cursor-not-allowed group overflow-hidden active:scale-[0.98]"
                        >
                            {loading ? (
                                <i className="fa-solid fa-circle-notch fa-spin text-white"></i>
                            ) : (
                                <span className="relative z-10 flex items-center gap-2">
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
                    <div className="mt-5 text-center border-t border-white/10 pt-3">
                        <p className="text-stone-500 text-[10px]">
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
