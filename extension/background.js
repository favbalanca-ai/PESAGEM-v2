// FAV NFA - Background Service Worker v5.1
const GAS_URL = 'https://script.google.com/macros/s/AKfycbxs7y4PiJ1bj_zrykqwxaG3OVkGwznrbV38bM9AwLKgAodbxZApbSOwudzBk3K2aZ8Y/exec';

function tratarMensagem(msg, sendResponse) {
  if (msg.action === 'INICIAR_NFA') {
    const dados = msg.dados;
    chrome.tabs.query({}, (abas) => {
      const antigas = (abas || []).filter(t => t.url && t.url.includes('sefaz.go.gov.br'));
      const idsAntigos = antigas.map(t => t.id);
      const abrir = () => {
        chrome.storage.local.set({ nfa_pendente: dados }, () => {
          chrome.tabs.create({
            url: 'https://nfw.sefaz.go.gov.br/nfw/view/TelaInicialNFA.jsf'
          }, (tab) => {
            const obj = {};
            obj['nfa_aba_' + tab.id] = dados;
            obj['nfa_nova_' + tab.id] = true; // emissão nova → limpar parada na 1ª injeção
            chrome.storage.local.set(obj, () => {
              console.log('[FAV BG] INICIAR_NFA + dados salvos p/ aba', tab.id);
              sendResponse({ ok: true, tabId: tab.id });
            });
          });
        });
      };
      if (idsAntigos.length) chrome.tabs.remove(idsAntigos, abrir);
      else abrir();
    });
    return true;
  }
  if (msg.action === 'GET_NFA_PENDENTE') {
    chrome.storage.local.get('nfa_pendente', (data) => sendResponse(data.nfa_pendente || null));
    return true;
  }
  if (msg.action === 'PROCESSAR_PDF_NFA') {
    processarPDF(msg).then(sendResponse).catch(e => sendResponse({ erro: e.message }));
    return true;
  }
  if (msg.action === 'LIMPAR_NFA') {
    chrome.storage.local.remove(['nfa_pendente', 'nfa_concluida']);
    sendResponse({ ok: true });
    return true;
  }
  if (msg.action === 'GET_NFA_CONCLUIDA') {
    chrome.storage.local.get('nfa_concluida', (data) => sendResponse(data.nfa_concluida || null));
    return true;
  }
  if (msg.action === 'PING') {
    sendResponse({ ok: true, ext: 'FAV-NFA', version: '5.7' });
    return true;
  }
  return false;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => tratarMensagem(msg, sendResponse));
chrome.runtime.onMessageExternal.addListener((msg, sender, sendResponse) => tratarMensagem(msg, sendResponse));

function obterDados(tabId, cb) {
  const chave = 'nfa_aba_' + tabId;
  chrome.storage.local.get([chave, 'nfa_pendente'], (data) => {
    cb(data[chave] || data.nfa_pendente || null);
  });
}

function injetarComDados(tabId) {
  obterDados(tabId, (dados) => {
    if (!dados) { console.log('[FAV BG] Sem dados para aba', tabId, '- não injeta'); return; }
    chrome.storage.local.get('nfa_nova_' + tabId, (marca) => {
      const ehNova = !!marca['nfa_nova_' + tabId];
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: (d, limpar) => {
          window.__FAV_NFA_DADOS__ = d;
          if (limpar) {
            window.__FAV_NFA_PARAR__ = false;
            try { sessionStorage.removeItem('fav_nfa_parar'); } catch(e){}
          }
        },
        args: [dados, ehNova]
      }).then(() => {
        if (ehNova) chrome.storage.local.remove('nfa_nova_' + tabId);
        return chrome.scripting.executeScript({ target: { tabId: tabId }, files: ['content.js'] });
      }).then(() => {
        console.log('[FAV BG] injetado na aba', tabId, ehNova ? '(emissão nova - parada limpa)' : '');
      }).catch(err => console.error('[FAV BG] Falha ao injetar:', err));
    });
  });
}

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status !== 'complete' || !tab.url) return;
  if (tab.url.includes('nfw.sefaz.go.gov.br') || tab.url.includes('sistemas.sefaz.go.gov.br')) {
    injetarComDados(tabId);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.local.remove(['nfa_aba_' + tabId, 'nfa_nova_' + tabId]);
});

async function processarPDF(msg) {
  const { pdf_base64, pdf_url, dados_nfa } = msg;
  const payload = {
    action: 'processarNFA', pdf_base64, pdf_url,
    ticket_id: dados_nfa.ticket_id, contrato_id: dados_nfa.contrato_id,
    emitente: dados_nfa.emitente, emitente_nome: dados_nfa.emitente_nome,
    destinatario_nome: dados_nfa.destinatario_nome,
    destinatario_email: dados_nfa.destinatario_email,
    destinatario_whatsapp: dados_nfa.destinatario_whatsapp,
    data_emissao: new Date().toISOString(), produtos: dados_nfa.produtos
  };
  const resp = await fetch(GAS_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  if (!resp.ok) throw new Error('GAS retornou: ' + resp.status);
  const data = await resp.json();
  if (data.ok) chrome.storage.local.remove('nfa_pendente');
  return data;
}
