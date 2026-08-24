// FAV NFA - Content Script v7.1 (valor c/ input escondido + Condicionante pós-dispositivo + limite de Adicionar)
if (window.__FAV_NFA_LOADED__) {
  console.log('[FAV NFA] content.js já carregado — ignorando segunda injeção');
} else {
  window.__FAV_NFA_LOADED__ = true;

const DELAY = 900;

// ─── LOG PERSISTENTE (sobrevive aos reloads da SEFAZ; botão 📋 Copiar log) ────
function logFAV() {
  const args = [...arguments];
  console.log.apply(console, ['[FAV NFA]'].concat(args));
  try {
    const ts = new Date().toLocaleTimeString('pt-BR');
    const linha = ts + '  ' + args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ').replace(/<[^>]+>/g, ' ').trim();
    const log = JSON.parse(sessionStorage.getItem('fav_nfa_log') || '[]');
    log.push(linha);
    while (log.length > 800) log.shift();
    sessionStorage.setItem('fav_nfa_log', JSON.stringify(log));
  } catch (e) {}
}

function wait(ms) {
  return new Promise((resolve, reject) => {
    if (window.__FAV_NFA_PARAR__) return reject(new Error('PARADO_PELO_USUARIO'));
    if (window.__FAV_NFA_PULAR__) { window.__FAV_NFA_PULAR__ = false; return resolve(); } // ⏭️ pular campo
    setTimeout(() => {
      if (window.__FAV_NFA_PARAR__) return reject(new Error('PARADO_PELO_USUARIO'));
      resolve();
    }, ms);
  });
}

function aguardarElemento(seletores, timeout = 15000) {
  const lista = Array.isArray(seletores) ? seletores : [seletores];
  return new Promise((resolve, reject) => {
    const inicio = Date.now();
    const check = () => {
      for (const sel of lista) {
        const el = document.querySelector(sel);
        if (el && el.offsetParent !== null) return resolve(el);
      }
      if (Date.now() - inicio > timeout) return reject(new Error('Timeout: ' + lista[0]));
      setTimeout(check, 300);
    };
    check();
  });
}

async function preencherInput(seletores, valor) {
  const lista = Array.isArray(seletores) ? seletores : [seletores];
  let el = null;
  for (const sel of lista) { el = document.querySelector(sel); if (el) break; }
  if (!el) throw new Error('Campo não encontrado: ' + lista[0]);
  el.focus(); el.value = valor;
  ['input','change','keyup'].forEach(ev => el.dispatchEvent(new Event(ev, { bubbles: true })));
  await wait(200);
}

async function clicarBotao(textos) {
  const lista = Array.isArray(textos) ? textos : [textos];
  const todos = Array.from(document.querySelectorAll('input[type=submit],input[type=button],button,a.btn,a[class*=button],a[id]'));
  for (const texto of lista) {
    const alvo = texto.toLowerCase();
    const btn = todos.find(b => {
      const txt = (b.textContent || '').trim().toLowerCase();
      const val = (b.value || '').trim().toLowerCase();
      const id  = (b.id || '').toLowerCase();
      return txt.includes(alvo) || val.includes(alvo) || id.includes(alvo.replace(/\s+/g,''));
    });
    if (btn && btn.offsetParent !== null) { btn.click(); await wait(DELAY * 2); return; }
  }
  throw new Error('Botão não encontrado: ' + lista[0]);
}

async function clicarPorId(trechoId) {
  const btn = Array.from(document.querySelectorAll('input,button,a')).find(b =>
    b.id && b.id.toLowerCase().includes(trechoId.toLowerCase()) && b.offsetParent !== null);
  if (btn) { btn.click(); await wait(DELAY * 2); return true; }
  return false;
}

function clicarBotaoVisivelPorId(trechoId) {
  const btn = [...document.querySelectorAll('input,button,a')].find(b =>
    b.id && b.id.toLowerCase().includes(trechoId.toLowerCase()) && b.offsetParent !== null);
  if (btn) { btn.click(); return true; }
  return false;
}

// ─── SEQUÊNCIA DE ETAPAS (mostra o fluxo p/ o operador) ───────────────────────
// A etapa corrente é derivada da página atual a cada injeção, então o progresso
// se mantém correto mesmo o content.js recarregando entre as telas do SEFAZ.
const ETAPAS_NFA = ['tipo','emitente','destinatario','transporte','produtos','resumo'];
const ETAPAS_NOME = {
  tipo:'Tipo de nota', emitente:'Emitente', destinatario:'Destinatário',
  transporte:'Transporte', produtos:'Produtos', resumo:'Resumo / Enviar'
};
let _etapaCorrente = null;
function definirEtapa(ch){ if (ETAPAS_NFA.indexOf(ch) >= 0) { _etapaCorrente = ch; if (_overlay) atualizarStatus(_ultimaMsg || '...', _ultimoTipo); } }
function _passosHTML(){
  const idx = ETAPAS_NFA.indexOf(_etapaCorrente);
  return '<div style="margin:2px 0 9px;display:grid;grid-template-columns:1fr 1fr;gap:1px 12px">' +
    ETAPAS_NFA.map(function(c,i){
      var ic  = (idx < 0) ? '⚪' : (i < idx ? '✅' : (i === idx ? '⏳' : '⚪'));
      var cor = (i === idx) ? '#ffffff' : (i < idx ? '#9fe0b6' : '#aebfdd');
      var peso = (i === idx) ? '700' : '400';
      return '<div style="color:'+cor+';font-weight:'+peso+';font-size:11px;white-space:nowrap">'+ic+' '+(i+1)+'. '+ETAPAS_NOME[c]+'</div>';
    }).join('') + '</div>';
}

// ─── OVERLAY + BOTÕES PARAR / CONTINUAR IA ────────────────────────────────────
let _overlay = null;
let _ultimaMsg = '', _ultimoTipo = 'info';
function atualizarStatus(msg, tipo = 'info') {
  _ultimaMsg = msg; _ultimoTipo = tipo;
  logFAV( typeof msg === 'string' ? msg.replace(/<[^>]+>/g,' ') : msg);
  if (!_overlay) {
    _overlay = document.createElement('div');
    _overlay.id = 'fav-nfa-overlay';
    _overlay.style.cssText = 'position:fixed;top:12px;right:12px;z-index:99999;background:#1a3a6c;color:white;padding:14px 18px;border-radius:10px;box-shadow:0 4px 20px rgba(0,0,0,0.4);font-family:Arial,sans-serif;font-size:13px;min-width:300px;max-width:380px;line-height:1.5;';
    document.body.appendChild(_overlay);
  }
  const cores = { info:'#1a3a6c', ok:'#1a6c3c', erro:'#c0392b', aviso:'#e67e22' };
  _overlay.style.background = cores[tipo] || cores.info;
  _overlay.innerHTML = '<div style="font-weight:bold;margin-bottom:6px">🤖 FAV — Automação NFA</div>' +
    _passosHTML() +
    '<div id="fav-status-msg" style="margin-bottom:8px;border-top:1px solid rgba(255,255,255,.25);padding-top:7px">' + msg + '</div>' +
    '<div style="display:flex;gap:6px">' +
    '<button id="fav-btn-parar" style="flex:1;padding:8px;background:#c0392b;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:bold;">⛔ PARAR</button>' +
    '<button id="fav-btn-continuar" style="flex:1;padding:8px;background:#1a6c3c;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:bold;">▶ Continuar IA</button>' +
    '</div>' +
    '<div style="display:flex;gap:6px;margin-top:6px">' +
    '<button id="fav-btn-pular" style="flex:1;padding:7px;background:#e67e22;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:bold;">⏭️ Pular campo</button>' +
    '<button id="fav-btn-log" style="flex:1;padding:7px;background:#546e8f;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:bold;">📋 Copiar log</button>' +
    '</div>';
  const bp = _overlay.querySelector('#fav-btn-parar');
  if (bp) bp.onclick = () => {
    window.__FAV_NFA_PARAR__ = true;
    try { sessionStorage.setItem('fav_nfa_parar', '1'); } catch(e){}
    _overlay.style.background = '#c0392b';
    const m = _overlay.querySelector('#fav-status-msg');
    if (m) m.textContent = '⛔ Pausada. Clique "Continuar IA" para retomar.';
  };
  const bc = _overlay.querySelector('#fav-btn-continuar');
  if (bc) bc.onclick = async () => {
    window.__FAV_NFA_PARAR__ = false;
    try { sessionStorage.removeItem('fav_nfa_parar'); } catch(e){}
    _overlay.style.background = '#1a3a6c';
    const m = _overlay.querySelector('#fav-status-msg');
    if (m) m.textContent = '▶ Retomando...';
    let dados = window.__FAV_NFA_DADOS__;
    if (!dados) { try { dados = await new Promise(r => chrome.runtime.sendMessage({ action: 'GET_NFA_PENDENTE' }, x => r(x||null))); } catch(e){} }
    if (!dados) { if (m) m.textContent = '⚠️ Sem dados da NFA.'; return; }
    await executarUnico(dados); // trava: nunca 2 execuções ao mesmo tempo
  };
  const bpu = _overlay.querySelector('#fav-btn-pular');
  if (bpu) bpu.onclick = () => {
    window.__FAV_NFA_PULAR__ = true;  // faz a espera atual desistir e seguir ao próximo campo
    const m = _overlay.querySelector('#fav-status-msg');
    if (m) m.textContent = '⏭️ Pulando o campo atual...';
  };
  const blog = _overlay.querySelector('#fav-btn-log');
  if (blog) blog.onclick = () => {
    let txt = '';
    try {
      const log = JSON.parse(sessionStorage.getItem('fav_nfa_log') || '[]');
      txt = '=== FAV Automação NFA — LOG (' + log.length + ' linhas · ' + new Date().toLocaleString('pt-BR') + ' · ' + location.href + ') ===\n' + log.join('\n');
    } catch (e) { txt = '(log vazio)'; }
    const feito = () => { blog.textContent = '✓ Copiado!'; setTimeout(() => { blog.textContent = '📋 Copiar log'; }, 1600); };
    const fallback = () => {
      try {
        const ta = document.createElement('textarea');
        ta.value = txt; ta.style.cssText = 'position:fixed;opacity:0';
        document.body.appendChild(ta); ta.focus(); ta.select();
        document.execCommand('copy'); document.body.removeChild(ta); feito();
      } catch (e) { blog.textContent = '⚠️ Falhou'; setTimeout(() => { blog.textContent = '📋 Copiar log'; }, 1600); }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(feito).catch(fallback);
    else fallback();
  };
}
function removerOverlay() { if (_overlay) { _overlay.remove(); _overlay = null; } }

// ─── HELPERS ──────────────────────────────────────────────────────────────────
// Preenche um campo NUMÉRICO do PrimeFaces: seta TODOS os inputs com o id
// (inclusive o hidden _hinput que é o que vai pro servidor) e dispara blur.
function setCampoNumero(idParcial, valor) {
  const els = [...document.querySelectorAll('input')].filter(i => i.id && i.id.includes(idParcial));
  if (!els.length || valor === undefined || valor === null || valor === '') return false;
  els.forEach(el => {
    try {
      el.focus && el.focus();
      el.value = valor;
      ['input','change','keyup','blur'].forEach(ev => el.dispatchEvent(new Event(ev, { bubbles: true })));
    } catch (e) {}
  });
  return true;
}
function setInputPorId(idParcial, valor) {
  const el = [...document.querySelectorAll('input')].find(i => i.id && i.id.includes(idParcial) && i.offsetParent !== null);
  if (!el || valor === undefined || valor === null || valor === '') return false;
  el.focus(); el.value = valor;
  ['input','change','keyup','blur'].forEach(ev => el.dispatchEvent(new Event(ev, { bubbles: true })));
  return true;
}

function setSelectPorId(idParcial, textoOuValor) {
  const sel = [...document.querySelectorAll('select')].find(s => s.id && s.id.includes(idParcial));
  if (!sel || !textoOuValor) return false;
  const alvo = String(textoOuValor).toLowerCase().trim();
  let opt = [...sel.options].find(o => o.text.toLowerCase().trim() === alvo);
  if (!opt) opt = [...sel.options].find(o => o.text.toLowerCase().includes(alvo));
  if (!opt) return false;
  sel.value = opt.value;
  ['input','change','blur'].forEach(ev => sel.dispatchEvent(new Event(ev, { bubbles: true })));
  if (typeof sel.onchange === 'function') { try { sel.onchange(); } catch(e){} }
  return true;
}

function formatarDocumento(doc) {
  let n = String(doc).replace(/\D/g, '');
  if (n.length <= 11) { n = n.padStart(11, '0'); return n.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4'); }
  n = n.padStart(14, '0'); return n.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

function normalizarTexto(t) {
  return String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[´`'’.]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ')
    .replace(/\s+go$/i, '').replace(/\bd\s+/g, 'd').replace(/\s+/g, ' ').trim();
}

function aguardarSefazLivre(timeout = 15000) {
  return new Promise((resolve) => {
    const ini = Date.now();
    const check = () => {
      if (window.__FAV_NFA_PULAR__) { window.__FAV_NFA_PULAR__ = false; return resolve(true); } // ⏭️ pular campo
      const bloqueio = document.querySelector('.ui-blockui, .blockUI, .ui-widget-overlay');
      const temAguarde = [...document.querySelectorAll('div,span')].some(e =>
        e.offsetParent !== null && /aguarde/i.test(e.textContent || '') && (e.textContent||'').length < 30);
      if (!((bloqueio && bloqueio.offsetParent !== null) || temAguarde)) return resolve(true);
      if (Date.now() - ini > timeout) return resolve(false);
      setTimeout(check, 400);
    };
    setTimeout(check, 500);
  });
}

function aguardarPreenchimento(condFn, timeout = 10000) {
  return new Promise((resolve) => {
    const ini = Date.now();
    const check = () => {
      if (window.__FAV_NFA_PULAR__) { window.__FAV_NFA_PULAR__ = false; return resolve(false); } // ⏭️ pular campo
      try { if (condFn()) return resolve(true); } catch(e){}
      if (Date.now() - ini > timeout) return resolve(false);
      setTimeout(check, 300);
    };
    check();
  });
}

// CONFIRMA a caixa "Atenção" do SEFAZ (botão Confirmar). Robusta: espera a caixa surgir.
function clicarRobusto(el){
  // 1) eventos de mouse completos
  try {
    var r = el.getBoundingClientRect();
    var cx = r.left + r.width/2, cy = r.top + r.height/2;
    ['pointerover','mouseover','pointerdown','mousedown','focus','pointerup','mouseup','click'].forEach(function(tipo){
      var ev;
      if (tipo === 'focus') { try { el.focus(); } catch(e){} return; }
      ev = new MouseEvent(tipo, {bubbles:true, cancelable:true, view:window, clientX:cx, clientY:cy, button:0});
      el.dispatchEvent(ev);
    });
  } catch(e){}
  // 2) .click() nativo
  try { el.click(); } catch(e){}
  // 3) executa o onclick inline do botão (PrimeFaces usa onclick p/ disparar AJAX)
  try {
    var oc = el.getAttribute && el.getAttribute('onclick');
    if (oc) { (new Function(oc)).call(el); }
  } catch(e){}
  // 4) se o botão estiver dentro de <a> ou tiver handler no pai, tenta o pai também
  try {
    var pai = el.closest('a[onclick], button[onclick]');
    if (pai && pai !== el) {
      var oc2 = pai.getAttribute('onclick');
      if (oc2) { (new Function(oc2)).call(pai); }
    }
  } catch(e){}
}

async function confirmarCaixa(timeout = 8000) {
  const ini = Date.now();

  // Um diálogo PrimeFaces está ABERTO se NÃO tem a classe ui-overlay-hidden e está no DOM visível
  function dialogAberto(d){
    if (!d) return false;
    if (d.className && d.className.indexOf('ui-overlay-hidden') >= 0) return false;
    var st = window.getComputedStyle(d);
    if (st.display === 'none' || st.visibility === 'hidden') return false;
    return true;
  }

  function acharBotaoConfirmar(raiz){
    var botoes = [...raiz.querySelectorAll('button, input[type=button], input[type=submit], a')];
    function txtBtn(x){ return (x.textContent||x.value||'').trim().toLowerCase(); }
    var b = botoes.find(x => txtBtn(x) === 'confirmar');
    if (!b) b = botoes.find(x => /confirmar/.test(txtBtn(x)) && !/cancelar/.test(txtBtn(x)));
    if (!b) b = botoes.find(x => /^(sim|ok|continuar|prosseguir)$/.test(txtBtn(x)) && !/cancelar/.test(txtBtn(x)));
    return b || null;
  }

  while (Date.now() - ini < timeout) {
    // 0) Popup "Condicionante" (ex.: MANTEM O CREDITO): marcar "Aceito os Termos" e Confirmar
    var dlgCond = [...document.querySelectorAll('.ui-dialog, .ui-confirm-dialog, [id*="ondicionante"]')]
      .find(d => dialogAberto(d) && /aceito os termos|condicionante/i.test(d.textContent||''));
    if (dlgCond) {
      // marca o checkbox (nativo ou estilizado do PrimeFaces)
      var chk = dlgCond.querySelector('input[type=checkbox]');
      var chkBox = dlgCond.querySelector('.ui-chkbox-box');
      var marcado = chk ? chk.checked : (chkBox && /ui-state-active/.test(chkBox.className||''));
      if (!marcado) {
        logFAV('confirmarCaixa: Condicionante -> marcando "Aceito os Termos"');
        if (chkBox) clicarRobusto(chkBox); else if (chk) clicarRobusto(chk);
        await wait(700);
      }
      var bC = acharBotaoConfirmar(dlgCond);
      if (bC) {
        logFAV('confirmarCaixa: Condicionante -> Confirmar');
        clicarRobusto(bC);
        await wait(1200);
        var dC2 = [...document.querySelectorAll('.ui-dialog, .ui-confirm-dialog, [id*="ondicionante"]')]
          .find(d => dialogAberto(d) && /aceito os termos|condicionante/i.test(d.textContent||''));
        if (!dC2) { await wait(300); return true; }
      }
      await wait(500);
      continue; // insiste no Condicionante até fechar (ou estourar o timeout)
    }
    // 1) Mira a caixa específica de troca de operação (id fixo do SEFAZ)
    var alvo = null;
    var cfop = document.getElementById('form:tabView:confirmDialogCFOP');
    if (cfop && dialogAberto(cfop)) {
      alvo = acharBotaoConfirmar(cfop);
    }
    // 2) Qualquer diálogo aberto com o texto característico
    if (!alvo) {
      var dlgs = [...document.querySelectorAll('.ui-dialog, .ui-confirm-dialog')]
        .filter(d => dialogAberto(d) && /alterar a opera|informados novamente|deseja continuar/i.test(d.textContent||''));
      for (const d of dlgs) { alvo = acharBotaoConfirmar(d); if (alvo) break; }
    }

    if (alvo) {
      logFAV('confirmarCaixa: CONFIRMAR ->', alvo.id, '| txt:', (alvo.textContent||alvo.value||'').trim());
      clicarRobusto(alvo);
      await wait(1200);
      // verifica se a caixa CFOP fechou
      var c2 = document.getElementById('form:tabView:confirmDialogCFOP');
      var aindaAberta = (c2 && dialogAberto(c2)) ||
        [...document.querySelectorAll('.ui-dialog, .ui-confirm-dialog')]
          .some(d => dialogAberto(d) && /alterar a opera|informados novamente|deseja continuar/i.test(d.textContent||''));
      if (!aindaAberta) { await wait(300); return true; }
    }
    await wait(400);
  }
  logFAV('confirmarCaixa: caixa não encontrada/confirmada no tempo');
  return false;
}

// Seleciona num PrimeFaces SelectOneMenu clicando no componente visual + confirma a caixa
async function selecionarPrimeFaces(baseIdParcial, texto) {
  if (!texto) return false;
  let widget = null;
  const iniW = Date.now();
  while (Date.now() - iniW < 8000) {
    widget = [...document.querySelectorAll('div.ui-selectonemenu')].find(d =>
      d.id && d.id.includes(baseIdParcial) && d.offsetParent !== null);
    if (widget) break;
    await wait(300);
  }
  if (!widget) return false;
  const trigger = widget.querySelector('.ui-selectonemenu-trigger') || widget;
  const panel = document.getElementById(widget.id + '_panel');
  const alvo = String(texto).toLowerCase().trim();
  const alvoNorm = normalizarTexto(texto);
  const codAlvo = String(texto).replace(/\D/g,'').slice(-4);
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    trigger.click();
    await wait(500);
    let itens = [];
    const iniP = Date.now();
    while (Date.now() - iniP < 6000) {
      const p = panel || document.getElementById(widget.id + '_panel');
      itens = p ? [...p.querySelectorAll('li.ui-selectonemenu-item, li')] : [];
      const reais = itens.filter(li => (li.textContent||'').trim() && (li.textContent||'').trim() !== '-');
      if (reais.length > 0) { itens = reais; break; }
      await wait(300);
    }
    if (itens.length === 0) { await wait(600); continue; }
    // Ordem de prioridade do match (do mais preciso para o menos):
    // 1) texto idêntico
    let item = itens.find(li => (li.textContent||'').toLowerCase().trim() === alvo);
    // 2) normalizado idêntico (ignora acento/apóstrofo)
    if (!item) item = itens.find(li => normalizarTexto(li.textContent) === alvoNorm);
    // 3) código exato no FINAL da opção (ex: "...- 5101") — só se o alvo tiver um código de 4 díg.
    if (!item && codAlvo.length === 4) {
      var reCod = new RegExp('[-\\s]' + codAlvo + '\\s*$');   // termina em "- 5101" ou " 5101"
      item = itens.find(li => reCod.test((li.textContent||'').trim()));
    }
    // 4) o alvo é um texto longo e a opção começa igual (primeiros 25 chars normalizados)
    if (!item && alvoNorm.length >= 12) {
      var ini = alvoNorm.slice(0, 25);
      item = itens.find(li => normalizarTexto(li.textContent).indexOf(ini) === 0);
    }
    // 5) só então tenta inclusão (menos preciso) — exige alvo longo p/ evitar falso match
    if (!item && alvoNorm.length >= 12) item = itens.find(li => normalizarTexto(li.textContent).includes(alvoNorm));
    if (!item) item = itens.find(li => (li.textContent||'').toLowerCase().includes(alvo) && alvo.length >= 12);
    if (item) {
      item.click();
      await wait(900);
      await confirmarCaixa(6000);   // confirma a caixa "Atenção" que aparece após selecionar
      return true;
    }
    trigger.click();
    await wait(600);
  }
  return false;
}

// ─── ETAPAS ───────────────────────────────────────────────────────────────────
async function etapa_TelaInicial() {
  try { sessionStorage.removeItem('fav_dest_pesquisado'); sessionStorage.removeItem('fav_nfa_parar'); } catch(e){}
  definirEtapa('tipo');
  atualizarStatus('Abrindo formulário...');
  await aguardarElemento(['input[value*="Emitir"]','button']);
  await clicarBotao('Emitir Nota Fiscal');
}

async function etapa_TipoNota(dados) {
  atualizarStatus('Selecionando tipo de nota...');
  await wait(DELAY);
  const valorAlvo = (dados.tipo_nota === 'GADO') ? '2' : '1';
  const radios = document.querySelectorAll('input[type=radio][name*="radioTipoNovaNota"]');
  let achou = false;
  for (const radio of radios) {
    if (radio.value === valorAlvo) { radio.checked = true; radio.click(); radio.dispatchEvent(new Event('change', { bubbles: true })); achou = true; break; }
  }
  if (!achou && radios.length >= 2) {
    const idx = (dados.tipo_nota === 'GADO') ? 1 : 0;
    radios[idx].checked = true; radios[idx].click(); radios[idx].dispatchEvent(new Event('change', { bubbles: true }));
  }
  await wait(600);
  const prefixo = (radios[0] && radios[0].name) ? radios[0].name.split(':')[0] : '';
  const botoes = [...document.querySelectorAll('input[type=submit],input[type=button],button')];
  let ok = botoes.find(b => (b.value === 'OK' || b.textContent.trim() === 'OK') && prefixo && b.id.startsWith(prefixo));
  if (!ok) ok = botoes.find(b => (b.value === 'OK' || b.textContent.trim() === 'OK') && b.offsetParent !== null);
  if (!ok) throw new Error('Botão OK do tipo de nota não encontrado');
  ok.click();
  await wait(DELAY * 2);
}

async function etapa_Emitente(dados) {
  atualizarStatus('Emitente: ' + (dados.emitente_nome || dados.emitente) + '. Continuando...');
  await wait(DELAY); await wait(400);
  await clicarBotao(['Continuar', 'Continuar >>', 'Próximo', 'Avançar']);
}

async function etapa_Destinatario(dados) {
  await wait(800);
  const nomeDest = [...document.querySelectorAll('input[type=text]')].find(i =>
    /nome|razao/i.test(i.id) && i.offsetParent !== null && !/emitente/i.test(i.id));
  const jaPreenchido = nomeDest && ((nomeDest.value && nomeDest.value.trim().length > 2) || (nomeDest.placeholder && nomeDest.placeholder.trim().length > 2));
  if (jaPreenchido) {
    atualizarStatus('Destinatário já preenchido. Continuando...');
    await wait(1000); await aguardarSefazLivre(12000); await wait(800);
    if (!clicarBotaoVisivelPorId('btnContinuarDest')) {
      const btn = [...document.querySelectorAll('input[type=submit],input[type=button],button,a')].find(b => /continuar/i.test(b.textContent || b.value || '') && b.offsetParent !== null);
      if (btn) btn.click();
    }
    await wait(DELAY * 2); return;
  }
  atualizarStatus('Destinatário: preenchendo documento...');
  await wait(DELAY);
  const docRaw = dados.destinatario_cnpj || dados.destinatario_cpf || '';
  if (docRaw) {
    const campoDoc = [...document.querySelectorAll('input[type=text]')].find(i => /cnpj|cpf/i.test(i.id) && i.offsetParent !== null);
    if (campoDoc) {
      campoDoc.focus(); campoDoc.value = formatarDocumento(docRaw);
      ['input','change','keyup','blur'].forEach(ev => campoDoc.dispatchEvent(new Event(ev, { bubbles: true })));
      await wait(400);
    }
  }
  atualizarStatus('Destinatário: pesquisando dados...');
  if (!await clicarPorId('btPesquisar')) { try { await clicarBotao('Pesquisar'); } catch(e){} }
  await wait(2000); await aguardarSefazLivre(20000); await wait(1500);
  atualizarStatus('Destinatário: continuando...');
  if (!clicarBotaoVisivelPorId('btnContinuarDest')) {
    const btn = [...document.querySelectorAll('input[type=submit],input[type=button],button,a')].find(b => /continuar/i.test(b.textContent || b.value || '') && b.offsetParent !== null);
    if (btn) { btn.click(); await wait(DELAY * 2); } else throw new Error('Botão Continuar do destinatário não encontrado');
  } else { await wait(DELAY * 2); }
}

async function etapa_Transporte(dados) {
  const transpDoc = dados.transportadora_cnpj || dados.transp_cnpj || '';
  if (transpDoc) {
    const nomeTransp = [...document.querySelectorAll('input')].find(i => /nomeRazaoSocialTransporte/i.test(i.id) && i.offsetParent !== null);
    const jaPesq = nomeTransp && ((nomeTransp.value && nomeTransp.value.trim().length > 2) || (nomeTransp.placeholder && nomeTransp.placeholder.trim().length > 2));
    if (!jaPesq) {
      setInputPorId('cpfCnpjTransporte', formatarDocumento(transpDoc));
      await wait(500);
      const btnP = [...document.querySelectorAll('input,button')].find(b => /pesquisar/i.test((b.value||'')+(b.textContent||'')) && b.offsetParent !== null);
      if (btnP) btnP.click();
      atualizarStatus('Transporte: pesquisando transportadora...');
      await wait(2500); await aguardarSefazLivre(15000); await wait(1000);
      // Se a busca não achou (transportadora de OUTRO ESTADO / não cadastrada em GO),
      // pausa para o usuário digitar a transportadora manualmente e depois clicar Continuar IA.
      const nomeDepois = [...document.querySelectorAll('input')].find(i => /nomeRazaoSocialTransporte/i.test(i.id) && i.offsetParent !== null);
      const achou = nomeDepois && nomeDepois.value && nomeDepois.value.trim().length > 2;
      if (!achou) {
        window.__FAV_NFA_PARAR__ = true;
        try { sessionStorage.setItem('fav_nfa_parar', '1'); } catch(e){}
        atualizarStatus('⚠️ Transportadora não encontrada (provável de OUTRO ESTADO). Preencha a transportadora MANUALMENTE (nome e endereço) e depois clique "▶ Continuar IA".', 'aviso');
        throw new Error('PARADO_PELO_USUARIO');
      }
    }
  }
  atualizarStatus('Transporte: data...');
  if (dados.data_transporte) setInputPorId('dataTransporte', dados.data_transporte);
  await wait(400);
  if (dados.origem_mercadoria) {
    atualizarStatus('Transporte: origem da mercadoria...');
    if (!await selecionarPrimeFaces('municipioMercadoriaTransporte', dados.origem_mercadoria)) setSelectPorId('municipioMercadoriaTransporte', dados.origem_mercadoria);
  }
  await wait(400);
  if (dados.responsavel_frete) {
    atualizarStatus('Transporte: responsável pelo frete...');
    if (!await selecionarPrimeFaces('responsavelFrete', dados.responsavel_frete)) setSelectPorId('responsavelFrete', dados.responsavel_frete);
  }
  await wait(400);
  if (dados.peso_liquido_kg) setInputPorId('pesoLiquidoTransporte', dados.peso_liquido_kg);
  if (dados.peso_bruto_kg) setInputPorId('pesoBrutoTransporte', dados.peso_bruto_kg);
  await wait(400);
  atualizarStatus('Transporte: Veículo Automotor...');
  if (!await selecionarPrimeFaces('tipoDeTransporte', 'Veículo Automotor')) setSelectPorId('tipoDeTransporte', 'Veículo Automotor');
  await wait(1800); await aguardarSefazLivre(12000);
  atualizarStatus('Transporte: placa...');
  await aguardarPreenchimento(() => [...document.querySelectorAll('input')].some(i => /placa/i.test(i.id) && i.offsetParent !== null), 8000);
  if (dados.placa) { setInputPorId('placa', String(dados.placa).toUpperCase().replace(/[^A-Z0-9]/g,'')); await wait(1000); await aguardarSefazLivre(10000); }
  atualizarStatus('Transporte: UF do veículo...');
  await wait(600);
  if (dados.uf_veiculo) { if (!await selecionarPrimeFaces('ufVeiculo', dados.uf_veiculo)) setSelectPorId('ufVeiculo', dados.uf_veiculo); }
  await wait(1000); await aguardarSefazLivre(8000);
  if (dados.municipio_veiculo) {
    atualizarStatus('Transporte: município do veículo...');
    await wait(800);
    if (!await selecionarPrimeFaces('municipioVeiculo', dados.municipio_veiculo)) setSelectPorId('municipioVeiculo', dados.municipio_veiculo);
  }
  await wait(800); await aguardarSefazLivre(8000);
  atualizarStatus('Transporte: continuando...');
  await aguardarSefazLivre(10000);
  if (!clicarBotaoVisivelPorId('j_idt362')) {
    const btn = [...document.querySelectorAll('button,input[type=submit],input[type=button]')].find(b => /continuar/i.test(b.textContent||b.value||'') && b.offsetParent !== null);
    if (btn) btn.click();
  }
  await wait(DELAY * 2);
}

async function selecionarDispositivoLegal(valorContrato) {
  // localiza o <select> nativo do Dispositivo Legal
  const sel = document.getElementById('form:tabView:dispositivoLegalProduto_input');
  if (!sel) { logFAV('Dispositivo Legal: campo não existe, pulando'); return false; }

  // campo desabilitado = não há dispositivo legal para esta operação (ex: vendas 5101) -> PULA
  if (sel.disabled) { logFAV('Dispositivo Legal: desabilitado (venda/sem benefício), pulando'); return false; }

  // opções reais (descarta o placeholder e o "Nenhum...")
  const opcoes = [...sel.options].map(o => (o.text||'').trim());
  const temReais = opcoes.some(t => t &&
    !/^selecione somente/i.test(t) &&
    !/nenhum dispositivo legal/i.test(t));
  if (!temReais) { logFAV('Dispositivo Legal: só placeholder, pulando'); return false; }

  // se o contrato não informou um dispositivo legal, deixa no placeholder (não obrigatório)
  if (!valorContrato) { logFAV('Dispositivo Legal: habilitado mas contrato não informou — deixando em branco'); return false; }

  // JÁ SELECIONADO com o valor DO CONTRATO? Não re-seleciona — evita novo postback.
  // (Prioriza o label visível; o select nativo pode marcar a 1ª opção por padrão.)
  const lblDL = [...document.querySelectorAll('[id$="_label"]')].find(e => e.id.includes('dispositivoLegalProduto') && e.offsetParent !== null);
  const atualSel = ((lblDL ? lblDL.textContent : ((sel.options[sel.selectedIndex] || {}).text || '')) || '').trim();
  const normDL = (t) => String(t||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toUpperCase().replace(/\s+/g,' ').trim();
  const aDL = normDL(atualSel), bDL = normDL(valorContrato);
  if (aDL && bDL && !/^SELECIONE/.test(aDL) && !/^[-–—\s]+$/.test(atualSel) && (aDL === bDL || aDL.includes(bDL) || bDL.includes(aDL))) {
    logFAV('Dispositivo Legal: já selecionado ✓ ("' + atualSel + '")');
    return false;
  }

  // seleciona via PrimeFaces pelo texto do contrato
  logFAV('Dispositivo Legal: selecionando "' + valorContrato + '"');
  const ok = await selecionarPrimeFaces('dispositivoLegalProduto', valorContrato);
  if (!ok) setSelectPorId('dispositivoLegalProduto', valorContrato);
  await confirmarCaixa(5000);
  await aguardarSefazLivre(8000);
  return true;
}

async function etapa_Produtos(dados) {
  atualizarStatus('Produtos: preenchendo...');
  await wait(DELAY);
  const jaAdicionado = [...document.querySelectorAll('table, .ui-datatable')].some(t => {
    const txt = (t.textContent||'');
    if (/nenhum produto adicionado/i.test(txt)) return false;
    return [...t.querySelectorAll('tbody tr')].some(tr => {
      const c = (tr.textContent||'');
      return /\d{3,}/.test(c) && !/nenhum/i.test(c) && (c.toUpperCase().includes('SOJA') || /\d{2,}[.,]\d/.test(c));
    });
  });
  if (jaAdicionado) {
    try { sessionStorage.removeItem('fav_nfa_add_tent'); } catch(e){}
    atualizarStatus('Produto já adicionado. Indo para Continuar...');
    await wait(800); await irParaContinuarProdutos(); return;
  }
  // Texto da opção selecionada num <select> (PrimeFaces esconde o select nativo,
  // então NÃO filtra por visibilidade). Vazio se placeholder ("Selecione...").
  // Lê o texto SELECIONADO de um dropdown PrimeFaces. Prioriza o LABEL VISÍVEL
  // (o que o usuário vê) — o <select> nativo escondido pode vir com a 1ª opção
  // marcada por padrão após o AJAX, dando "já selecionado" FALSO.
  const selTexto = (idParcial) => {
    const limpa = (t) => {
      t = String(t || '').trim();
      if (!t || /^selecione/i.test(t) || /^[-–—\s]+$/.test(t)) return '';
      return t;
    };
    const lbl = [...document.querySelectorAll('[id$="_label"]')].find(e => e.id.includes(idParcial) && e.offsetParent !== null);
    if (lbl) return limpa(lbl.textContent);
    const sel = [...document.querySelectorAll('select')].find(s => s.id && s.id.includes(idParcial));
    if (!sel || sel.selectedIndex < 0) return '';
    return limpa(((sel.options[sel.selectedIndex] || {}).text || ''));
  };
  // Compara textos de opção (sem acentos/caixa/espaços). Só considera "já
  // selecionado" se for O VALOR DESEJADO — não qualquer valor.
  const norm = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
  const mesmoTexto = (a, b) => {
    a = norm(a); b = norm(b);
    if (!a || !b) return false;
    return a === b || a.includes(b) || b.includes(a);
  };

  for (let i = 0; i < dados.produtos.length; i++) {
    const prod = dados.produtos[i];
    const qtdStr = String(prod.quantidade).replace('.', ',');
    const valStr = String(prod.valor_unitario).replace('.', ',');
    const lerCampo = (idp) => {
      const el = [...document.querySelectorAll('input')].find(i2 => i2.id && i2.id.includes(idp) && i2.offsetParent !== null);
      return el ? String(el.value||'').trim() : '';
    };
    const produtoNaTabela = () => [...document.querySelectorAll('table, .ui-datatable')].some(t => {
      const txt = (t.textContent||'');
      if (/nenhum produto adicionado/i.test(txt)) return false;
      return [...t.querySelectorAll('tbody tr')].some(tr => /\d{2,}[.,]\d/.test(tr.textContent||''));
    });

    // ⚠️ O SEFAZ às vezes faz RELOAD/reset no meio da etapa, mas costuma PRESERVAR
    // parte do que foi feito. Rodamos a sequência em RODADAS: cada rodada refaz
    // SOMENTE o que estiver vazio e tenta Adicionar; se o SEFAZ resetar algo,
    // a rodada seguinte re-seleciona só o que faltar.
    let adicionadoOk = false;
    for (let rodada = 1; rodada <= 3 && !adicionadoOk; rodada++) {
      if (rodada > 1) { atualizarStatus('Produto: reavaliando os campos (rodada ' + rodada + ')...'); await wait(1500); }

      // 1) Grupo — pula SÓ se o selecionado for o grupo desejado
      if (mesmoTexto(selTexto('grupoProduto'), prod.grupo)) {
        atualizarStatus('Produto: grupo já selecionado ✓ (' + selTexto('grupoProduto') + ')');
      } else {
        atualizarStatus('Produto: grupo ' + prod.grupo + '...');
        if (!await selecionarPrimeFaces('grupoProduto', prod.grupo)) setSelectPorId('grupoProduto', prod.grupo);
        await confirmarCaixa(6000);
        await aguardarSefazLivre(12000);
        await wait(5000);
      }

      // 2) Tipo de Operação / Natureza — pula SÓ se for a operação desejada
      const natBusca = prod.tipo_operacao || prod.natureza || '5101';
      if (mesmoTexto(selTexto('naturezaOperacaoAdmin'), natBusca)) {
        atualizarStatus('Produto: tipo de operação já selecionado ✓');
      } else {
        atualizarStatus('Produto: tipo de operação...');
        if (!await selecionarPrimeFaces('naturezaOperacaoAdmin', natBusca)) setSelectPorId('naturezaOperacaoAdmin', natBusca);
        await confirmarCaixa(6000);
        await aguardarSefazLivre(12000);
        await wait(5000);
      }

      // 3) Nome do Produto — pula SÓ se for o produto desejado
      if (prod.produto && mesmoTexto(selTexto('nomeProdutoAdmin'), prod.produto)) {
        atualizarStatus('Produto: nome já selecionado ✓');
      } else {
        atualizarStatus('Produto: nome do produto...');
        if (prod.produto) { if (!await selecionarPrimeFaces('nomeProdutoAdmin', prod.produto)) setSelectPorId('nomeProdutoAdmin', prod.produto); }
        await confirmarCaixa(6000);
        await aguardarSefazLivre(10000);
        await wait(5000);
      }

      // 4) Quantidade e Valor — SEMPRE re-aplica com o setter robusto (o campo do
      //    SEFAZ tem input escondido que vai pro servidor; só o visível não basta)
      atualizarStatus('Produto: quantidade e valor...');
      await confirmarCaixa(2500); // popup atrasado trava a tela
      setCampoNumero('quantidadeProduto', qtdStr); await wait(700);
      setCampoNumero('valorUnitarioProduto', valStr); await wait(900);
      await aguardarSefazLivre(6000);
      logFAV('Campos lidos → qtd="' + lerCampo('quantidadeProduto') + '" valor="' + lerCampo('valorUnitarioProduto') + '"');
      if (lerCampo('quantidadeProduto') === '' || lerCampo('valorUnitarioProduto') === '') {
        setCampoNumero('quantidadeProduto', qtdStr); await wait(700);
        setCampoNumero('valorUnitarioProduto', valStr); await wait(900);
      }

      // 5) Dispositivo Legal — por ÚLTIMO entre os selects (sequência da página).
      //    A caixa "Condicionante" costuma aparecer DEPOIS dele → janela LONGA.
      atualizarStatus('Produto: dispositivo legal...');
      const usouDispLegal = await selecionarDispositivoLegal(prod.dispositivo_legal);
      if (usouDispLegal) {
        await confirmarCaixa(12000);        // Condicionante pós-dispositivo (Aceito os Termos)
        await aguardarSefazLivre(15000); await wait(1500);
        // o postback pode limpar qtd/valor — re-aplica
        setCampoNumero('quantidadeProduto', qtdStr); await wait(600);
        setCampoNumero('valorUnitarioProduto', valStr); await wait(800);
        logFAV('Pós-dispositivo → qtd="' + lerCampo('quantidadeProduto') + '" valor="' + lerCampo('valorUnitarioProduto') + '"');
      } else await wait(500);

      if (prod.obs) {
        const ta = document.querySelector('textarea[id*="observacao"],textarea[id*="Observacao"]');
        if (ta) { ta.value = prod.obs; ta.dispatchEvent(new Event('change',{bubbles:true})); }
      }

      // 6) Adicionar — só com TODOS os campos ok; conta tentativas em sessionStorage
      //    (sobrevive ao reload do SEFAZ — sem isso o reload zera o contador e vira loop)
      if (!selTexto('grupoProduto') || !selTexto('naturezaOperacaoAdmin') || !selTexto('nomeProdutoAdmin')) {
        atualizarStatus('Produto: um dos campos resetou — reavaliando...');
        continue; // rodada seguinte re-seleciona o que faltar
      }
      let addTent = 0;
      try { addTent = parseInt(sessionStorage.getItem('fav_nfa_add_tent') || '0', 10) || 0; } catch(e){}
      if (addTent >= 3) {
        try { sessionStorage.removeItem('fav_nfa_add_tent'); } catch(e){}
        window.__FAV_NFA_PARAR__ = true;
        try { sessionStorage.setItem('fav_nfa_parar', '1'); } catch(e){}
        atualizarStatus('⚠️ O Adicionar recarregou a página 3x sem gravar o produto. CONFIRA na tela: Valor Unitário (' + valStr + '), a caixa "Aceito os Termos" se aparecer, e clique Adicionar manualmente. Depois "▶ Continuar IA".', 'aviso');
        throw new Error('PARADO_PELO_USUARIO');
      }
      try { sessionStorage.setItem('fav_nfa_add_tent', String(addTent + 1)); } catch(e){}
      await confirmarCaixa(3000); // caixa pendente antes do Adicionar
      atualizarStatus('Produto: adicionando... (tentativa ' + (addTent + 1) + ')');
      await wait(500);
      const btnAdd = [...document.querySelectorAll('input,button')].find(b => /adicionar/i.test((b.value||'')+(b.textContent||'')) && b.offsetParent !== null && !b.disabled);
      if (btnAdd) { btnAdd.click(); await wait(DELAY); }
      await aguardarSefazLivre(20000);
      await confirmarCaixa(8000);
      await aguardarSefazLivre(20000);
      await wait(2000);
      adicionadoOk = produtoNaTabela();
      if (adicionadoOk) { try { sessionStorage.removeItem('fav_nfa_add_tent'); } catch(e){} }
    }

    if (!adicionadoOk) {
      window.__FAV_NFA_PARAR__ = true;
      try { sessionStorage.setItem('fav_nfa_parar', '1'); } catch(e){}
      atualizarStatus('⚠️ Não consegui ADICIONAR o produto após 3 rodadas. Confira os campos (Qtd: ' + qtdStr + ' · Valor: ' + valStr + '), clique Adicionar manualmente e depois "▶ Continuar IA".', 'aviso');
      throw new Error('PARADO_PELO_USUARIO');
    }
  }
  await irParaContinuarProdutos();
}

async function irParaContinuarProdutos() {
  atualizarStatus('Produtos: continuando...');
  await aguardarSefazLivre(20000);
  await wait(1500);
  // tenta avançar até 3x — se a validação segurar a tela na aba Produtos, re-clica
  for (let t = 1; t <= 3; t++) {
    const btnCont = [...document.querySelectorAll('input,button')].find(b => /continuar/i.test((b.value||'')+(b.textContent||'')) && b.offsetParent !== null);
    if (btnCont) btnCont.click();
    await wait(1500);
    await confirmarCaixa(6000);
    await aguardarSefazLivre(15000);
    await wait(DELAY * 2);
    const aindaEmProdutos = [...document.querySelectorAll('input,select')].some(e => e.id && e.id.includes('quantidadeProduto') && e.offsetParent !== null);
    if (!aindaEmProdutos) return; // avançou (resumo/informações complementares)
    atualizarStatus('Produtos: tela não avançou — tentando Continuar de novo (' + t + '/3)...');
    await wait(1200);
  }
  atualizarStatus('⚠️ Não consegui avançar da aba Produtos. Clique "Continuar" manualmente na página e depois "▶ Continuar IA".', 'aviso');
}

async function etapa_Resumo(dados) {
  definirEtapa('resumo');
  atualizarStatus('Revisando resumo...');
  await wait(DELAY);
  if (dados.info_complementar) {
    const ta = document.querySelector('textarea[id*="informacoes"],textarea[id*="complementar"],textarea[id*="Informacoes"]');
    if (ta) { ta.value = dados.info_complementar; ta.dispatchEvent(new Event('change',{bubbles:true})); }
  }
  // Resumo de conferência (fluxo de informação): mostra o principal antes de enviar
  const prod = (dados.produtos && dados.produtos[0]) || {};
  const fmtKg = v => v ? Number(String(v).replace(',','.')).toLocaleString('pt-BR') + ' kg' : '—';
  const linhas = [
    '👤 ' + (dados.destinatario_nome || '—'),
    '📦 ' + (prod.produto || '—'),
    '⚖️ Líq.: ' + fmtKg(dados.peso_liquido_kg) + (dados.peso_bruto_kg ? ' · Bruto: ' + fmtKg(dados.peso_bruto_kg) : ''),
    '🚚 ' + (dados.placa || '—') + (dados.uf_veiculo ? ' / ' + dados.uf_veiculo : '')
  ].join('<br>');
  atualizarStatus(
    '<b>✅ Tudo preenchido!</b> Confira abaixo e clique em <b>"Enviar Nota"</b> você mesmo.' +
    '<div style="margin-top:7px;font-size:11px;color:#e6f0ff;line-height:1.45;background:rgba(0,0,0,.18);padding:7px 9px;border-radius:7px">' + linhas + '</div>',
    'ok'
  );
}

async function detectarPaginaEExecutar(dados) {
  const url = window.location.href;
  if (url.includes('TelaInicialNFA')) { await etapa_TelaInicial(); return; }
  const visivel = (idp) => [...document.querySelectorAll('input,select')].some(e => e.id && e.id.includes(idp) && e.offsetParent !== null);
  const abaProdutos = visivel('grupoProduto') || visivel('quantidadeProduto') || visivel('nomeProdutoAdmin');
  const abaTransporte = visivel('dataTransporte') || visivel('tipoDeTransporte') || visivel('pesoLiquidoTransporte') || visivel('cpfCnpjTransporte');
  const abaDestinat = visivel('cpfCnpjDestinatario') || visivel('tipoContribuinte') || visivel('nomeRazaoSocialDestinatario');
  const abaEmitente = visivel('inscricaoEstadualEmitente') || visivel('nomeRazaoSocialEmitente');
  const txtPagina = document.body.innerText || '';
  const temResumo = txtPagina.includes('Resumo da Nota');
  const enviarVisivel = [...document.querySelectorAll('input,button')].some(e => /enviar nota|finalizar/i.test(((e.value||'')+(e.textContent||'')).toLowerCase()) && e.offsetParent !== null);
  if (url.includes('ConsultaNFA') && !abaEmitente && !abaDestinat && !abaTransporte && !abaProdutos) {
    definirEtapa('tipo');
    atualizarStatus('Iniciando nova nota...');
    await wait(1000);
    if (!await clicarPorId('buttonNovaNota')) await clicarBotao('Nova Nota');
    await wait(DELAY); await etapa_TipoNota(dados); return;
  }
  if (abaProdutos) { definirEtapa('produtos'); await etapa_Produtos(dados); }
  else if (abaTransporte) { definirEtapa('transporte'); await etapa_Transporte(dados); }
  else if (abaDestinat) { definirEtapa('destinatario'); await etapa_Destinatario(dados); }
  else if (abaEmitente) { definirEtapa('emitente'); await etapa_Emitente(dados); }
  else if (enviarVisivel || temResumo) { definirEtapa('resumo'); await etapa_Resumo(dados); }
  else { atualizarStatus('⏳ Aguardando próxima tela do SEFAZ...', 'aviso'); }
}

// ─── EXECUÇÃO ÚNICA ──────────────────────────────────────────────────────────
// Impede DUAS execuções simultâneas (ex.: clicar "Continuar IA" com uma execução
// ainda ativa) — elas se atropelam nos postbacks e o formulário reseta em loop.
async function executarUnico(dados) {
  if (window.__FAV_NFA_EXECUTANDO__) {
    logFAV('Já existe uma execução ativa — não inicio outra.');
    return;
  }
  window.__FAV_NFA_EXECUTANDO__ = true;
  try { await detectarPaginaEExecutar(dados); }
  catch (err) {
    if (err && err.message === 'PARADO_PELO_USUARIO') { atualizarStatus('⛔ Pausada. Clique "Continuar IA" para retomar.', 'aviso'); }
    else { atualizarStatus('❌ ' + err.message, 'erro'); console.error('[FAV NFA] Erro:', err); }
  }
  finally { window.__FAV_NFA_EXECUTANDO__ = false; }
}

// ─── INICIALIZAÇÃO ───────────────────────────────────────────────────────────
(async () => {
  try { if (sessionStorage.getItem('fav_nfa_parar') === '1') window.__FAV_NFA_PARAR__ = true; } catch(e){}
  if (window.__FAV_NFA_PARAR__) { atualizarStatus('⛔ Pausada. Clique "Continuar IA" para retomar.', 'aviso'); return; }
  atualizarStatus('🤖 Automação carregada. Procurando dados da NFA...', 'info');
  await wait(1200);
  let dados = (typeof window !== 'undefined' && window.__FAV_NFA_DADOS__) ? window.__FAV_NFA_DADOS__ : null;
  if (!dados) { try { dados = await new Promise((resolve) => { chrome.runtime.sendMessage({ action: 'GET_NFA_PENDENTE' }, (r) => resolve(r || null)); }); } catch (e) { dados = null; } }
  if (!dados) { atualizarStatus('⚠️ Nenhuma NFA pendente. Emita pelo app FAV.', 'aviso'); setTimeout(removerOverlay, 6000); return; }
  await executarUnico(dados);
})();

} // fim guarda __FAV_NFA_LOADED__
