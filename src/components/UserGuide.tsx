import { useState } from 'react';

export const UserGuide = () => {
    const [activeSection, setActiveSection] = useState('inicio');

    const sections = [
        { id: 'inicio', title: '🎮 Começando', icon: 'fa-rocket' },
        { id: 'sessoes', title: '📊 Sessões vs Grind', icon: 'fa-chart-line' },
        { id: 'contadores', title: '🔢 Contadores', icon: 'fa-calculator' },
        { id: 'estatisticas', title: '📈 Estatísticas', icon: 'fa-trophy' },
        { id: 'atalhos', title: '⌨️ Atalhos', icon: 'fa-keyboard' },
    ];

    return (
        <div className="h-screen w-full bg-stone-950 text-gray-100 flex">
            {/* Sidebar */}
            <div className="w-64 bg-stone-900 border-r border-white/10 p-4 flex flex-col">
                <div
                    className="mb-6 cursor-move"
                    style={{ WebkitAppRegion: 'drag' } as any}
                >
                    <h1 className="text-xl font-bold text-hunter-orange flex items-center gap-2 pointer-events-none select-none">
                        <i className="fa-solid fa-book"></i>
                        Guia de Uso
                    </h1>
                    <p className="text-xs text-stone-400 mt-1 pointer-events-none select-none">COTW Grind Counter</p>
                </div>

                <nav
                    className="space-y-2"
                    style={{ WebkitAppRegion: 'no-drag' } as any}
                >
                    {sections.map(section => (
                        <button
                            key={section.id}
                            onClick={() => setActiveSection(section.id)}
                            className={`w-full text-left px-3 py-2 rounded-sm  flex items-center gap-2 text-sm ${activeSection === section.id
                                ? 'bg-hunter-orange text-white'
                                : 'text-stone-400 hover:bg-stone-800 hover:text-white'
                                }`}
                        >
                            <i className={`fa-solid ${section.icon} w-4`}></i>
                            {section.title}
                        </button>
                    ))}
                </nav>

                <button
                    onClick={() => window.close()}
                    className="w-full mt-6 px-3 py-2 bg-stone-800 hover:bg-red-600 text-stone-400 hover:text-white rounded-sm  text-sm flex items-center justify-center gap-2"
                    style={{ WebkitAppRegion: 'no-drag' } as any}
                >
                    <i className="fa-solid fa-xmark"></i>
                    Fechar
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8">
                {activeSection === 'inicio' && (
                    <div className="max-w-3xl space-y-6">
                        <div>
                            <h2 className="text-2xl font-bold mb-4 text-hunter-orange">🎮 Começando</h2>
                            <div className="space-y-4 text-stone-300">
                                <p>Bem-vindo ao <strong className="text-white">COTW Grind Counter</strong>!</p>
                                <p>Este aplicativo foi desenvolvido para ajudar você a rastrear seus grinds de caça no theHunter: Call of the Wild.</p>

                                <div className="bg-stone-900 border border-hunter-orange/30 p-4 rounded-sm">
                                    <h3 className="font-bold text-white mb-2">📌 Primeiros Passos:</h3>
                                    <ol className="list-decimal list-inside space-y-2 text-sm">
                                        <li>Faça login com sua conta do Pin Planner</li>
                                        <li>Selecione o animal que deseja grindear</li>
                                        <li>Clique em "Iniciar Grind"</li>
                                        <li>Use o botão <code className="bg-stone-800 px-1 rounded">+</code> para cada abate</li>
                                    </ol>
                                    <div className="mt-4 pt-4 border-t border-white/5 text-xs text-stone-400">
                                        <p className="flex items-center gap-2">
                                            <i className="fa-solid fa-circle-info text-blue-400"></i>
                                            <span><strong>Dica:</strong> Se o app não aparecer sobre o jogo, use <kbd className="bg-stone-800 px-1 rounded border border-stone-700 font-mono">ALT + Enter</kbd> para alternar (ativar/desativar) o modo janela sem borda.</span>
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeSection === 'sessoes' && (
                    <div className="max-w-3xl space-y-6">
                        <h2 className="text-2xl font-bold mb-4 text-hunter-orange">📊 Sessões vs Grind</h2>
                        <div className="space-y-4 text-stone-300">
                            <div className="bg-stone-900 p-4 rounded-sm border border-white/10">
                                <h3 className="font-bold text-white mb-3">🔘 Botões de Controle:</h3>
                                <div className="space-y-3 text-sm">
                                    <div className="flex gap-3">
                                        <code className="bg-hunter-orange/20 text-hunter-orange px-2 py-1 rounded shrink-0">Encerrar Sessão</code>
                                        <span>Finaliza a sessão atual e zera o contador laranja. O contador principal (branco) continua acumulando.</span>
                                    </div>
                                    <div className="flex gap-3">
                                        <code className="bg-red-900/20 text-red-400 px-2 py-1 rounded shrink-0">Encerrar Grind</code>
                                        <span>Finaliza TUDO e volta para o menu. Use quando terminar de grindear aquele animal.</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeSection === 'contadores' && (
                    <div className="max-w-3xl space-y-6">
                        <h2 className="text-2xl font-bold mb-4 text-hunter-orange">🔢 Entendendo os Contadores</h2>
                        <div className="space-y-4 text-stone-300">
                            <div className="bg-stone-900 p-6 rounded-sm border border-white/10">
                                <div className="flex items-end justify-center gap-2 mb-4">
                                    <span className="text-hunter-orange font-bold text-xl">15</span>
                                    <span className="text-white font-bold text-6xl">150</span>
                                </div>
                                <div className="space-y-3 text-sm border-t border-white/10 pt-4">
                                    <div>
                                        <strong className="text-hunter-orange">Número Laranja (pequeno):</strong> Abates da sessão atual.
                                    </div>
                                    <div>
                                        <strong className="text-white">Número Branco (grande):</strong> Total do grind (todas as sessões).
                                    </div>
                                </div>
                            </div>

                            <div className="bg-yellow-900/20 border border-yellow-600/50 p-4 rounded-sm">
                                <h3 className="font-bold text-yellow-400 mb-2">💡 Exemplo Prático:</h3>
                                <div className="space-y-2 text-sm">
                                    <p>1. Você inicia um grind. Contadores: <code>0 | 0</code></p>
                                    <p>2. Abate 10 animais. Contadores: <code>10 | 10</code></p>
                                    <p>3. Clica "Encerrar Sessão". Contadores: <code>0 | 10</code></p>
                                    <p>4. Abate mais 5. Contadores: <code>5 | 15</code></p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeSection === 'estatisticas' && (
                    <div className="max-w-3xl space-y-6">
                        <h2 className="text-2xl font-bold mb-4 text-hunter-orange">📈 Estatísticas e Histórico</h2>
                        <div className="space-y-4 text-stone-300">
                            <p>O botão de estatísticas mostra TODO o seu histórico de caça:</p>

                            <div className="bg-stone-900 p-4 rounded-sm border border-white/10 space-y-4">
                                <div>
                                    <h3 className="font-bold text-white mb-2">📊 Sessões Ativas</h3>
                                    <p className="text-sm">Mostra todos os grinds que você está fazendo agora (não finalizados).</p>
                                </div>

                                <div>
                                    <h3 className="font-bold text-white mb-2">🏆 Histórico</h3>
                                    <p className="text-sm">Lista TODOS os animais já grindados, com:</p>
                                    <ul className="list-disc list-inside mt-2 space-y-1 text-sm ml-4">
                                        <li>Total de abates</li>
                                        <li>Diamantes obtidos</li>
                                        <li>Great Ones capturados</li>
                                        <li>Raros coletados</li>
                                        <li><strong className="text-hunter-orange">Médias:</strong> Quantos abates em média para cada diamante, Great One e raro</li>
                                        <li><strong className="text-hunter-orange">Contador de Sessões:</strong> Ícone <i className="fa-solid fa-clock-rotate-left text-xs mx-1"></i> mostra quantas sessões com abates você já fez para aquele animal.</li>
                                        <li><strong className="text-go-gold">Destaque Great One:</strong> Animais com Great One registrado ganham um brilho dourado especial na lista.</li>
                                    </ul>
                                </div>

                                <div className="bg-hunter-orange/10 border border-hunter-orange/30 p-4 rounded-sm mt-4">
                                    <h3 className="font-bold text-hunter-orange mb-2 flex items-center gap-2">
                                        <i className="fa-solid fa-magnifying-glass-chart"></i> Estatísticas Detalhadas
                                    </h3>
                                    <p className="text-xs leading-relaxed text-stone-300">
                                        Ao clicar no botão <strong>"Ver Detalhes"</strong> em qualquer animal do histórico, você abre um painel avançado que mostra:
                                    </p>
                                    <ul className="list-disc list-inside mt-2 space-y-1 text-[11px] text-stone-400 ml-2">
                                        <li>Distribuição exata de abates por tipo (Diamante, Raro, Troll, etc.)</li>
                                        <li>Lista detalhada de todas as pelagens raras capturadas</li>
                                        <li>Gráficos de progresso e eficiência do seu grind</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeSection === 'atalhos' && (
                    <div className="max-w-3xl space-y-6">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-2xl font-bold text-hunter-orange">⌨️ Atalhos de Teclado</h2>
                            <span className="text-[10px] bg-hunter-orange/20 text-hunter-orange px-2 py-1 rounded font-bold uppercase tracking-wider">Customizáveis</span>
                        </div>

                        <div className="space-y-4 text-stone-300">
                            <p className="text-sm">Os atalhos abaixo são <strong>globais</strong>, ou seja, funcionam mesmo quando você está com o jogo em foco.</p>

                            <div className="space-y-2">
                                {[
                                    { label: 'Adicionar Abate', key: 'Numpad +' },
                                    { label: 'Remover Abate', key: 'Numpad -' },
                                    { label: 'Abrir Estatísticas', key: 'Alt + Shift + S' },
                                    { label: 'Expandir / Recolher App', key: 'Alt + Shift + G' },
                                    { label: 'Toggle HUD (Overlay)', key: 'Alt + Shift + H' },
                                ].map((item, idx) => (
                                    <div key={idx} className="bg-stone-900 p-3 rounded-sm border border-white/10 flex justify-between items-center">
                                        <span className="text-sm">{item.label}</span>
                                        <kbd className="bg-stone-800 px-3 py-1 rounded border border-stone-700 text-xs font-mono text-hunter-orange">{item.key}</kbd>
                                    </div>
                                ))}
                            </div>

                            <div className="bg-blue-900/20 border border-blue-500/30 p-4 rounded-sm mt-6">
                                <h3 className="text-blue-400 font-bold text-sm mb-2 flex items-center gap-2">
                                    <i className="fa-solid fa-gear"></i> Como Personalizar:
                                </h3>
                                <p className="text-xs leading-relaxed">
                                    Você pode alterar qualquer um desses atalhos clicando no ícone de <strong>Teclado</strong> <i className="fa-solid fa-keyboard mx-1"></i> no Dashboard.
                                    Lá você pode gravar novas combinações ou resetar para o padrão do Teclado Numérico.
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
