# Extensão Chrome — FAV Emissor NFA (SEFAZ-GO)

Extensão de navegador (Chrome desktop) que **preenche automaticamente** a NFA
no portal SEFAZ-GO com os dados enviados pelo app FAV. Espelho versionado do
projeto da extensão (Manifest V3).

## Arquivos
- `manifest.json` — Manifest V3 (v5.7). Permite `storage`, `tabs`, `scripting`;
  host nas páginas `nfw.sefaz.go.gov.br` e `sistemas.sefaz.go.gov.br`;
  `externally_connectable` com `https://favbalanca-ai.github.io/*` (o app fala
  com a extensão por `chrome.runtime.sendMessage`).
- `background.js` — service worker: recebe `INICIAR_NFA` do app, abre a página
  da SEFAZ e injeta o `content.js`; em `processarNFA` envia o PDF emitido ao
  Apps Script (`GAS_URL`).
- `content.js` — automação do formulário (etapas: tipo de nota → emitente →
  destinatário → transporte → produtos → resumo). Tem overlay com
  **Parar / Continuar**. Para nas telas e deixa o **Enviar Nota** para o usuário.
- `popup.html` — popup simples (status + limpar dados pendentes).

## Como o app conversa com a extensão
1. App (`confirmarEmissaoNFA`) → `chrome.runtime.sendMessage(extId, {action:'INICIAR_NFA', dados})`.
2. Extensão abre a SEFAZ e preenche os campos com `dados`.
3. Ao concluir, o app faz polling `GET_NFA_CONCLUIDA` e mostra nº da NFA + Drive.

O `extId` é configurável no app via `configurarExtNFA('ID')` (padrão em `getNFAExtId`).

## Textos exatos dos campos (importante)
O cadastro de contrato no app usa os **textos idênticos** aos dropdowns do
SEFAZ (Grupo → Natureza/Operação → Produto → Dispositivo Legal) — ver
`../docs/CAMPOS_PRODUTOS_SEFAZ.md` e `../docs/DISPOSITIVO_LEGAL_SOJA.md`. Assim a
automação seleciona cada opção sem erro de "opção não encontrada".

## Instalar (Chrome desktop)
1. `chrome://extensions` → ativar **Modo do desenvolvedor**.
2. **Carregar sem compactação** → selecionar esta pasta `extension/`.
3. Copiar o **ID** gerado e configurar no app (`configurarExtNFA('ID')`), se diferente do padrão.
4. Ter o **certificado A1** instalado no Chrome/Windows para autenticar na SEFAZ.

> Espelho versionado — alterar aqui não atualiza a extensão instalada; recarregue
> a extensão em `chrome://extensions` após editar.
