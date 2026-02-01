# Guia de Atualização Automática (Repositório Privado)

Como seu repositório (`cotw-always-ontop`) é **privado**, a atualização automática nativa do Electron tem uma limitação de segurança: **usuários comuns não conseguem baixar as atualizações sem um token de acesso.**

Existem duas soluções principais para isso:

## Solução 1: Repositório de Releases Público (Recomendado)
A melhor prática é manter seu código fonte no repositório privado, mas publicar os executáveis (as "Releases") em um segundo repositório que seja **público**.

### Passos:
1.  Crie um novo repositório no GitHub (ex: `cotw-releases`) e deixe-o como **Público**.
2.  No arquivo `package.json`, altere a configuração de `publish` para apontar para este novo repositório:

```json
"build": {
  "publish": [
    {
      "provider": "github",
      "owner": "weudes",
      "repo": "cotw-releases" 
    }
  ]
}
```
*(Mantenha o campo "repository" apontando para o seu repo privado de código, mude apenas o "publish")*

3.  Ao gerar o build (`npm run build:win`), o Electron Builder vai tentar subir os arquivos para o repo público.

## Solução 2: Token de Acesso (Apenas para uso interno/dev)
Se o aplicativo for apenas para você ou uma equipe interna que tem acesso ao repositório:

1.  Cada computador que for rodar o app precisa ter uma variável de ambiente chamada `GH_TOKEN`.
2.  O valor dessa variável deve ser um **Personal Access Token** do GitHub com permissão de leitura no repositório.

**Por que não usar a Solução 2 para público?**
Você nunca deve embutir o token no código do aplicativo, pois qualquer um poderia extraí-lo e ganhar acesso ao seu código fonte privado.

3.  Gere o build e publique.

## Como Publicar uma Atualização (Passo a Passo)

Sempre que você quiser liberar uma nova versão para os usuários:

1.  **Atualize a Versão:**
    Abra o arquivo `package.json` e aumente o número da versão (ex: de `"1.0.0"` para `"1.0.1"`).

2.  **Gere o Executável:**
    No terminal, rode o comando:
    ```bash
    npm run build:win
    ```
    Isso vai criar uma pasta `release` com o instalador (`.exe`) e um arquivo `latest.yml`.

3.  **Crie a Release no GitHub:**
    - Vá para o seu repositório público: `https://github.com/weudes-marquez/cotw-releases`
    - Clique em **"Releases"** (na barra lateral direita) -> **"Draft a new release"**.
    - **Choose a tag:** Crie uma tag igual à versão (ex: `v1.0.1`).
    - **Release title:** Coloque o nome da versão (ex: `Versão 1.0.1`).
    - **Description:** Descreva o que mudou.

4.  **Faça Upload dos Arquivos:**
    Arraste os seguintes arquivos da sua pasta `release` para a área de upload do GitHub:
    - `COTW Grind Counter Setup 1.0.1.exe` (o instalador)
    - `latest.yml` (CRÍTICO: este arquivo diz ao app que existe uma atualização)

5.  **Publique:**
    Clique em **"Publish release"**.

Pronto! Quem tiver o app instalado vai receber a atualização automaticamente na próxima vez que abrir o programa.
