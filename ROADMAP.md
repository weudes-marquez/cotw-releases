# 🗺️ Roadmap - COTW Grind Counter

Este documento descreve as funcionalidades planejadas e melhorias futuras para o COTW Grind Counter.

---

## 🚀 Próximas Funcionalidades

### 🏆 Sala de Troféus Virtual 3D
- [ ] **Ambiente 3D Interativo**: Criar uma galeria virtual usando Three.js para exibir os troféus mais importantes do usuário.
- [ ] **Visualização 2.5D (Display de Luxo)**: Implementar um sistema de pedestais 3D onde os prints dos animais são exibidos como displays de alta qualidade com iluminação dinâmica.
- [ ] **Rotação e Zoom**: Permitir que o usuário interaja com o troféu, girando a base e aproximando a câmera para ver detalhes.

### 🖥️ Interface e Overlay
- [ ] **Controle de Opacidade**: Permitir que o usuário defina o nível de transparência das camadas de estatísticas e overlays para melhor integração com o jogo.
- [ ] **Customização de Layout**: Permitir que o usuário arraste e redimensione os elementos do HUD do Overlay.
- [ ] **Guia de Pelagens Raras**: Criar tela de consulta de pelagens raras e suas probabilidades de spawn, utilizando a base de dados integrada.

### 🧠 Inteligência de Dados & Comunidade
- [ ] **Estatísticas Preditivas (Heurística)**: Implementar algoritmo heurístico que analisa o histórico de abates (respawns, tendências) para calcular e exibir a probabilidade estimada de spawn de um animal Raro, Diamante ou Great One em tempo real.
- [ ] **Estatísticas Globais (Community Repo)**: Criar um repositório centralizado de dados anônimos de todos os usuários para gerar médias globais (ex: "Quantos abates em média para um Great One?"). Exibir essas métricas comparativas dentro do app e disponibilizá-las publicamente na web.

### ⚙️ Funcionalidades de Sistema
- [ ] **Melhoria nos Atalhos Globais**: Expandir a biblioteca de hotkeys para controlar todas as novas camadas de overlay.
- [ ] **Atalhos Rápidos de Abate**: Implementar atalhos dedicados para registrar abates específicos (ex: Alt+D para Diamante, Alt+T para Troll, Alt+G para Great One) sem precisar abrir o menu de seleção.
- [ ] **Sincronização Avançada**: Otimizar ainda mais a comunicação com o Supabase para garantir latência zero nos overlays.

### 📱 Expansão Mobile (Pós-Windows)
- [ ] **Versão Android**: Desenvolver aplicativo nativo ou híbrido para acompanhamento do grind via celular.
- [ ] **Versão iOS**: Lançamento na App Store para usuários de iPhone/iPad.

---

## ✅ Concluído recentemente
- [x] **Overlay Superior (HUD)**: Implementado com transparência, click-through inteligente e atalho global `Alt+Shift+H`.
- [x] **Local First (IndexedDB)**: Implementação de banco de dados local via Dexie.js para funcionamento offline e sincronização em tempo real.
- [x] **Ícones Personalizados**: Adicionados ícones temáticos para Diamantes, Great Ones, Rares, Trolls e Super Rares no Overlay.
- [x] **Correção Crítica do Contador**: Implementação de lógica baseada em `COUNT` real do banco de dados para evitar perda de abates.
- [x] **Sincronização de Sessão**: Unificação dos contadores principal e de sessão.
- [x] **Proteção de UI**: Adicionado delay (cooldown) de 300ms e indicadores de carregamento para evitar inconsistências.

---

## 💡 Sugestões?
Se você tiver ideias de novas funcionalidades, sinta-se à vontade para sugerir!
