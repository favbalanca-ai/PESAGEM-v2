# PESAGEM-v2

App da balança (recepção da colheita, expedição e emissão de NFA) da Fazenda Água Viva. Web app estático publicado
no GitHub Pages; o backend é um Apps Script (`backend/`) vinculado à planilha; a extensão Chrome (`extension/`)
preenche a NFA no portal da SEFAZ-GO.

## Segredos: nada fica no repositório (v198)

Este repositório é **público**. Por isso:

- A **URL do servidor** (implantação `/exec` do Apps Script) **não está escrita** no `index.html`, no `sw.js` nem na
  extensão. Cada aparelho recebe a URL uma vez e guarda no próprio navegador (`localStorage`, chave `fav_sheets_url`).
- Não existe mais **chave fixa** ("token") no app: toda chamada usa a **sessão assinada** que o login devolve
  (`loginUsuario`). O backend recusa a chave antiga (`PERMITIR_TOKEN_ANTIGO = false`) e assina as sessões com um
  segredo aleatório guardado em Propriedades do Script (`SEGREDO_SESSAO`, criado sozinho na primeira execução).

### Como configurar o servidor em um aparelho

1. O administrador abre o app, entra, vai em **🔍 Diagnóstico → Testar servidor** e toca em
   **📋 Copiar link de configuração**. O link tem a forma `https://…/PESAGEM-v2/?servidor=URL`.
2. Manda esse link (WhatsApp) para quem vai usar o aparelho. Ao abrir, o app guarda a URL e a tira da barra de endereço.
3. Alternativa manual: na tela de entrar aparece a caixa **Servidor (URL do Apps Script)** quando o aparelho ainda não
   tem servidor; basta colar a URL da implantação (termina em `/exec`).
4. Trocou a implantação no Apps Script (URL nova)? Repita o passo 1 e 2. Em **Diagnóstico** há o botão **Trocar**.

### Extensão de NFA

A extensão recebe a URL do servidor do próprio app quando a emissão é disparada (campo `gasUrl` da mensagem
`INICIAR_NFA`) e guarda em `chrome.storage`. Se precisar, cole a URL no popup da extensão (campo **URL do servidor**).

### Se a URL ou a chave antiga vazaram

1. No Apps Script, **Implantar → Gerenciar implantações**: crie uma **nova implantação** (URL nova) e **arquive** a
   antiga — a URL vazada deixa de responder.
2. Troque o valor de `TOKEN_SECRET` por qualquer coisa nova (ele não é mais usado pelo app) e mantenha
   `PERMITIR_TOKEN_ANTIGO = false`.
3. Em **Propriedades do Script**, apague `SEGREDO_SESSAO` se quiser forçar todo mundo a entrar de novo (o script
   cria outro sozinho).
4. Mande o link de configuração novo para os aparelhos e cole a URL nova no popup da extensão (ou emita uma NFA pelo app, que já a envia).
