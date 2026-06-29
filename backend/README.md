# Backend — Google Apps Script (FAV Sistema v2)

Código do backend que roda como **Web App** no Google Apps Script, vinculado
à planilha do sistema. O app (`/index.html`) e a extensão de NFA conversam
com ele via `POST` na URL de implantação (`SHEETS_URL`).

## Arquivos
- `Code.gs` — arquivo principal (rotas, pesagem, recepção, talhões, estoque,
  contratos, NFA, fotos, backup, IA).
- `Painel.gs` — gera a aba **Painel** (fila de emissão, liberados, saldos).

> ⚠️ Este é um **espelho versionado** do projeto Apps Script. Editar aqui não
> altera o backend em produção — é preciso copiar para o editor do Apps Script
> e **reimplantar** o Web App.

## 🔐 Segredos (placeholders)
Os valores sensíveis foram trocados por `<<<PLACEHOLDER>>>` antes de versionar.
Preencha-os **somente no editor do Apps Script** (não commite os reais):

| Constante | O que é |
|-----------|---------|
| `PLANILHA_ID` | ID da planilha do sistema |
| `DRIVE_ID` | ID da pasta raiz no Drive (fotos/backup) |
| `DRIVE_PASTA_NFA` | ID da pasta onde os PDFs de NFA são salvos |
| `TOKEN_SECRET` | Token de autenticação — **igual** ao `TOKEN` do `index.html`/`sw.js` |
| `FAV_WA_ESCRITORIO` | WhatsApp do escritório (DDI+DDD+número) |
| `EMITENTES` | Nome/IE/CPF de cada emitente (dados fiscais) |
| `ANTHROPIC_KEY` | Vai em **Propriedades do Script**, não no código |

## Autorização (escopos)
A primeira execução exige autorizar os escopos do projeto. Se aparecer
**"Você não tem permissão para chamar UrlFetchApp.fetch"**, falta o escopo
`script.external_request`. Para resolver:
1. No editor, **Executar** uma função que usa rede (ex.: `testeIA`).
2. **Revisar permissões → conta dona → Avançado → Acessar projeto → Permitir**
   (inclui "Conectar-se a um serviço externo", Planilhas, Drive e Gmail).
3. **Reimplantar** o Web App (nova versão).

O `appsscript.json` deste repositório já traz os `oauthScopes` explícitos —
cole-o no manifesto do projeto (Configurações do projeto → "Mostrar
appsscript.json no editor") para a tela de consentimento pedir tudo de uma vez.

## Implantação
1. Cole `Code.gs` e `Painel.gs` no projeto Apps Script da planilha.
2. Preencha os segredos.
3. Menu **FAV v2 → ⚙️ Configurar planilha** (cria/atualiza as abas).
4. **Implantar → Nova implantação → App da Web** (executar como você; acesso
   "qualquer pessoa"). Use a URL gerada como `SHEETS_URL` no app.

## Fluxo de NFA (autorizar → emitir → imprimir)
Trechos marcados com `// [NFA-AUTORIZACAO]`:
- Aba **Pesagem** ganhou as colunas **28–30**: `NFA_Autorizada`,
  `NFA_Autorizada_Por`, `NFA_Autorizada_Em`.
- Nova ação **`autorizarNFA`** (gravada pelo app quando o admin autoriza).
- `listarPesagens` devolve `nfa_autorizada`, `nfa_autorizada_por` e
  `nfa_drive_url` (este último vindo da aba `NFAs_Emitidas`).
- A emissão em si (`processarNFA`, chamada pela extensão) já salva o PDF no
  Drive e registra em `NFAs_Emitidas`.

Se a planilha já existe, basta adicionar manualmente os 3 cabeçalhos nas
colunas 28, 29 e 30 da aba **Pesagem** (ou rodar **Configurar planilha**).

Detalhes do estudo e do fluxo: `../docs/nfa-automacao.md`.
