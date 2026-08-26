// FAV NFA - Background Service Worker v7.6 (pega o PDF baixado e registra: Drive + planilha)
const GAS_URL = 'https://script.google.com/macros/s/AKfycbwphW8C1gHcsb1YKPAGmqGib0bJnecr7ItfEFDuvP-eGw2TJzMbhgnngriG9Bjx_uB7/exec';

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
    sendResponse({ ok: true, ext: 'FAV-NFA', version: '7.6' });
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

function injetarComDados(tabId, tentativa) {
  tentativa = tentativa || 1;
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
            try { sessionStorage.removeItem('fav_nfa_log'); } catch(e){} // log zera a cada emissão nova
            try { sessionStorage.removeItem('fav_nfa_add_tent'); } catch(e){} // contador do Adicionar também
          }
        },
        args: [dados, ehNova]
      }).then(() => {
        if (ehNova) chrome.storage.local.remove('nfa_nova_' + tabId);
        return chrome.scripting.executeScript({ target: { tabId: tabId }, files: ['content.js'] });
      }).then(() => {
        console.log('[FAV BG] injetado na aba', tabId, ehNova ? '(emissão nova - parada limpa)' : '');
      }).catch(err => {
        // A SEFAZ recarrega a página no meio da injeção ("Frame with ID 0 was removed").
        // Se a aba ainda existir e continuar no SEFAZ, re-tenta em ~1,2s (até 3x).
        const msg = String(err && err.message || err);
        const transitorio = /Frame with ID|No frame with|was removed|No tab with id|cannot be scripted/i.test(msg);
        if (transitorio && tentativa < 3) {
          console.log('[FAV BG] Injeção interrompida por reload (tentativa ' + tentativa + ') — re-tentando...');
          setTimeout(() => {
            chrome.tabs.get(tabId, (tab) => {
              if (chrome.runtime.lastError || !tab || !tab.url) return; // aba fechou — desiste
              if (tab.url.includes('sefaz.go.gov.br')) injetarComDados(tabId, tentativa + 1);
            });
          }, 1200);
        } else {
          console.error('[FAV BG] Falha ao injetar:', err);
        }
      });
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

// ═══════════════════════════════════════════════════════════════════════════
// CAPTURA AUTOMÁTICA DO PDF BAIXADO
// Quando o operador clica "Enviar Nota", a SEFAZ baixa o PDF na pasta Downloads.
// Aqui pegamos esse arquivo e mandamos para o backend, que salva renomeado no
// Drive (EMITENTE/ANO/MÊS · NFA-<nº>-<DESTINATÁRIO>-<data>.pdf), grava na aba
// NFAs_Emitidas e avisa o destinatário. Sem isso, a nota saía e o app não sabia.
// ═══════════════════════════════════════════════════════════════════════════
function ehPDF(item) {
  const mime = String(item.mime || '').toLowerCase();
  const nome = String(item.filename || '');
  const url  = String(item.url || '');
  return /pdf/.test(mime) || /\.pdf$/i.test(nome) ||
         /\.pdf(\?|$)|pdf=|imprimir|impressao|danfe|relatorio|documento/i.test(url);
}
function nomeLocalNFA(dados) {
  const so = (v) => String(v || '').replace(/[^A-Za-z0-9-]/g, '');
  const d = new Date();
  const data = d.getFullYear() + ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2);
  return ['NFA', so(dados.emitente) || 'FAV', so(dados.ticket_id) || 'ticket', so(dados.placa), data]
    .filter(Boolean).join('-') + '.pdf';
}
// Renomeia o arquivo na pasta Downloads enquanto há uma NFA em andamento
chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
  chrome.storage.local.get('nfa_pendente', (d) => {
    if (d.nfa_pendente && ehPDF(item)) suggest({ filename: nomeLocalNFA(d.nfa_pendente), conflictAction: 'uniquify' });
    else suggest();
  });
  return true; // resposta assíncrona
});

const _downloadsVistos = new Set();
chrome.downloads.onCreated.addListener((item) => capturarPDFbaixado(item));
chrome.downloads.onChanged.addListener((delta) => {
  if (delta && delta.state && delta.state.current === 'complete') {
    chrome.downloads.search({ id: delta.id }, (its) => { if (its && its[0]) capturarPDFbaixado(its[0]); });
  }
});

function arrayBufferParaBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
  return btoa(bin);
}
// blob: só pode ser lido pela aba que o criou — peça ao content script de lá
function lerPDFpelaAba(url) {
  return new Promise((resolve) => {
    chrome.tabs.query({ url: ['https://nfw.sefaz.go.gov.br/*', 'https://sistemas.sefaz.go.gov.br/*'] }, (abas) => {
      const aba = (abas || [])[0];
      if (!aba) return resolve(null);
      try {
        chrome.tabs.sendMessage(aba.id, { action: 'FETCH_PDF', url }, (r) => {
          if (chrome.runtime.lastError) return resolve(null);
          resolve(r && r.ok ? r.b64 : null);
        });
      } catch (e) { resolve(null); }
    });
  });
}
async function lerPDFbase64(url) {
  if (/^blob:/i.test(url)) return await lerPDFpelaAba(url);
  try {
    const r = await fetch(url, { credentials: 'include' });
    if (!r.ok) return await lerPDFpelaAba(url);
    const buf = await r.arrayBuffer();
    const cab = String.fromCharCode.apply(null, new Uint8Array(buf.slice(0, 5)));
    if (cab !== '%PDF-') return await lerPDFpelaAba(url);
    return arrayBufferParaBase64(buf);
  } catch (e) { return await lerPDFpelaAba(url); }
}
function avisarAbasSefaz(msg) {
  chrome.tabs.query({ url: ['https://nfw.sefaz.go.gov.br/*', 'https://sistemas.sefaz.go.gov.br/*'] }, (abas) => {
    (abas || []).forEach((t) => { try { chrome.tabs.sendMessage(t.id, msg, () => chrome.runtime.lastError); } catch (e) {} });
  });
}
async function capturarPDFbaixado(item) {
  try {
    if (!item || !item.url || _downloadsVistos.has(item.id)) return;
    if (!ehPDF(item)) return;
    const store = await chrome.storage.local.get('nfa_pendente');
    const dados = store.nfa_pendente;
    if (!dados) return;                       // nenhuma emissão em andamento
    _downloadsVistos.add(item.id);
    console.log('[FAV BG] PDF baixado detectado — registrando NFA...', item.url);
    const b64 = await lerPDFbase64(item.url);
    if (!b64) {
      console.log('[FAV BG] não consegui ler o PDF baixado — use o botão de anexar no painel');
      avisarAbasSefaz({ action: 'NFA_FALHOU', erro: 'não consegui ler o PDF baixado' });
      return;
    }
    const data = await processarPDF({ pdf_base64: b64, dados_nfa: dados });
    if (data && data.ok) {
      console.log('[FAV BG] NFA registrada automaticamente: nº', data.numero_nfa);
      avisarAbasSefaz({ action: 'NFA_REGISTRADA', numero_nfa: data.numero_nfa, drive_url: data.drive_url });
    } else {
      avisarAbasSefaz({ action: 'NFA_FALHOU', erro: (data && data.erro) || 'o servidor recusou' });
    }
  } catch (e) {
    console.error('[FAV BG] captura do PDF falhou:', e);
    avisarAbasSefaz({ action: 'NFA_FALHOU', erro: e.message });
  }
}

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
  if (data.ok) {
    chrome.storage.local.remove('nfa_pendente');
    // O app faz polling de GET_NFA_CONCLUIDA para gravar o nº da NFA no ticket.
    // Sem guardar aqui, o app esperava para sempre e a nota nunca era marcada.
    chrome.storage.local.set({ nfa_concluida: data });
  }
  return data;
}
