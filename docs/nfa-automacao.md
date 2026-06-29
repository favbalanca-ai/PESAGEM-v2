# Automação da Emissão de NFA — Estudo de Viabilidade

> Status: **estudo / planejamento** (nenhuma automação implementada ainda)
> Última atualização: 2026-06-29

## Contexto

A NFA (Nota Fiscal Avulsa) é emitida no site da SEFAZ-GO
(`https://nfw.sefaz.go.gov.br/nfw/view/TelaInicialNFA.jsf`). Hoje o app
**não emite a NFA sozinho** — ele apenas monta os dados e depende de uma
extensão de navegador (desktop) para preencher o formulário.

### Como funciona hoje (no código)

| Etapa | Onde | Observação |
|-------|------|------------|
| Montar dados da NFA | `montarDadosNFA` (Apps Script) | Backend já entrega o JSON pronto da NFA |
| Disparar emissão | `confirmarEmissaoNFA()` (`index.html`) | Envia os dados para a extensão via `chrome.runtime.sendMessage` |
| Preencher SEFAZ | Extensão Chrome (fora deste repo) | **~90% pronta**; só roda no Chrome desktop |
| Acompanhar conclusão | `iniciarPollingNFA()` / `exibirNFAConcluida()` | App já sabe exibir nº da NFA, link do Drive e WhatsApp |
| Emitir por link | `favEmitirPorURL()` (`?emitir=TICKET_ID`) | Permite acionar a emissão de um ticket específico |

**Bloqueio atual:** no celular não há extensão → o app só abre o site da
SEFAZ para preenchimento **manual**. No desktop com a extensão, a emissão
**já é automática**.

## Cenário confirmado

- **Certificado:** A1 (arquivo `.pfx`/`.p12`) — não exige token físico nem PIN a cada uso.
- **Onde rodar:** existe um **servidor (Windows)** na cidade, além do PC do escritório (horário de expediente).
- **Extensão:** ~90% pronta (contém o mapeamento dos campos da SEFAZ).
- **Objetivo desta fase:** estudo de viabilidade — sem implementar ainda.

## Conclusão de viabilidade

**Totalmente viável e sem depender do PC do escritório ligado.** Como o A1
é um arquivo, ele pode ser instalado no **servidor Windows**, que passa a
ser o motor de emissão. O PC do escritório fica como **plano B**.

## Arquitetura proposta — Fila de emissão

```
📱 App (celular)                     🖥️ Servidor Windows (A1 instalado)
  monta dados da NFA      ─────►   planilha: "fila de emissão"   ─────►  vigia a fila
  (montarDadosNFA)                                                        loga na SEFAZ (A1)
                                                                          preenche + emite
  exibe resultado         ◄─────   planilha: nº NFA + PDF/Drive  ◄─────  grava o resultado
  (exibirNFAConcluida — já existe)
```

O app **já tem as duas pontas** (montar dados e exibir resultado). Falta:
1. App **gravar o pedido** de emissão numa "fila" (na planilha).
2. Servidor **processar a fila** e devolver o resultado.

## Opções para o motor no servidor

### Opção 2a — Reusar a extensão num Chrome no servidor (recomendado para começar)
Rodar a **própria extensão** (90% pronta) num Chrome no servidor Windows,
com o A1 instalado no Windows/Chrome. Aproveita o trabalho já feito quase
sem reescrever.
- ✅ Menor esforço; usa o mapeamento de campos existente.
- ⚠️ Requer um Chrome aberto/sessão ativa no servidor.

### Opção 2b — Script Playwright dedicado (mais robusto a longo prazo)
Portar o mapeamento de campos da extensão para um script **Playwright**
(suporta certificado de cliente A1 via `clientCertificates`).
- ✅ Mais confiável, agendável, sem depender da UI do Chrome.
- ⚠️ Exige reescrever o preenchimento (a extensão serve de referência).

### Opção 3 — Agente de IA ("Cowork") dirigindo o navegador
- ✅ Lida bem com mudanças de tela e exceções pontuais.
- ❌ **Não recomendado como motor principal** de emissão fiscal (mais caro,
  mais lento e menos previsível). Útil só como **rede de segurança** para
  casos que travarem.

## Pontos de atenção

- 🔐 **Segurança do A1:** certificado + senha equivalem à assinatura fiscal.
  No servidor, guardar com acesso restrito/criptografado e registrar quem emitiu.
- 🔁 **Idempotência:** a fila deve marcar `pendente → emitindo → emitida` para
  **nunca emitir a mesma NFA duas vezes** (em caso de queda/retry).
- 🧾 **Auditoria:** registrar cada emissão (quem pediu, quando, nº gerado).
- 🌐 **Disponibilidade:** servidor 24/7 emite a qualquer hora; PC do escritório
  só no expediente (plano B).

## Divisão do trabalho

| Parte | Onde mora | Quem faz |
|-------|-----------|----------|
| App grava pedido na fila + acompanha status | Este repositório (`index.html`) | Pode ser implementado aqui |
| Ações `salvarPedidoNFA` / `listarFilaNFA` / `marcarNFAEmitida` | Apps Script (backend) | Fora deste repo |
| Motor de emissão (extensão/Playwright) | Servidor Windows | Fora deste repo (precisa do código da extensão + acesso ao servidor) |

## Próximos passos sugeridos

1. Definir o formato do registro da "fila de emissão" na planilha
   (colunas: ticket_id, status, solicitante, timestamp, nº NFA, link).
2. Implementar no app a gravação do pedido e o acompanhamento de status.
3. Adicionar os handlers no Apps Script.
4. Instalar o A1 no servidor Windows e subir a Opção 2a (extensão no Chrome).
5. Testar ponta a ponta com idempotência e auditoria.
