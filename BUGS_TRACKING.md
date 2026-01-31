# Problemas Identificados no App (Para Correção Posterior)

Este documento registra bugs e comportamentos inesperados identificados durante o desenvolvimento da landing page que precisam ser resolvidos no código principal do Electron.

## 1. Gerenciamento de Janelas (Always on Top)
- **Problema**: A tela de **Guia** não está respeitando a configuração de "Sempre no Topo" (Always on Top). Quando aberta, ela fica atrás da janela do jogo.
- **Ação Necessária**: 
    - Verificar a configuração de `alwaysOnTop` na criação da janela de Guia.
    - Validar se outras telas (Horários de Necessidade, Atalhos, Login) também apresentam este comportamento.
    - Garantir que todas as janelas auxiliares sigam a preferência global de visibilidade do app.

## 2. Atalhos Globais (Hotkeys)
- **Problema**: Os atalhos de teclado (Numpad) param de funcionar quando o jogo (`theHunter: COTW`) é a janela ativa. O app permanece visível no topo, mas não captura os inputs.
- **Ação Necessária**:
    - Revisar a implementação do módulo `globalShortcut` do Electron.
    - Verificar se há conflitos com o layer do jogo ou se o registro dos atalhos precisa ser reforçado quando o app perde o foco para o game.
    - Testar a captura de inputs em modo Fullscreen vs Borderless do jogo.

## 3. UI e Layout (Refinamentos)
- **Problema**: A tela de **Estatísticas** não exibe a contagem de **Trolls** abatidos por sessão para cada animal.
- **Ação Necessária**: Incluir coluna ou indicador de Trolls na tabela detalhada de sessão da tela de estatísticas.

- **Problema**: Desalinhamento vertical na tela de Estatísticas. O container principal está muito baixo em relação à barra de ferramentas (toolbar).
- **Ação Necessária**: Ajustar o CSS para subir o container de estatísticas, melhorando o alinhamento e o aproveitamento de espaço.

---
*Notas registradas em 27/01/2026*
