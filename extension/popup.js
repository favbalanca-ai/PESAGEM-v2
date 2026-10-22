/* O popup antes trazia o script dentro do próprio HTML. No Manifest V3 isso
   não roda: a política de segurança das páginas da extensão é script-src
   'self', e script embutido é simplesmente ignorado — o popup abria mudo e o
   botão não fazia nada. Por isso virou arquivo. */
const PADRAO = { cfg_pasta_nfa: 'NFA', cfg_manter_local: true };

function salvar() {
  const pasta = document.getElementById('pasta').value.trim();
  const manter = document.getElementById('manter').checked;
  chrome.storage.local.set({ cfg_pasta_nfa: pasta, cfg_manter_local: manter }, () => {
    const a = document.getElementById('aviso');
    a.textContent = '✓ Guardado';
    setTimeout(() => { a.textContent = ''; }, 1500);
  });
}

chrome.storage.local.get(['nfa_pendente', 'nfa_registro_pendente', 'cfg_pasta_nfa', 'cfg_manter_local'], (d) => {
  const s = document.getElementById('status');
  if (d.nfa_pendente) {
    s.innerHTML = '✅ Nota pendente:<br><b>' + (d.nfa_pendente.emitente_nome || '') + '</b><br>→ ' +
      (d.nfa_pendente.destinatario_nome || 'Destinatário...');
  } else {
    s.textContent = '⚪ Nenhuma nota pendente.';
  }
  if (d.nfa_registro_pendente) {
    s.innerHTML += '<br><b style="color:#c0392b">⚠️ Tem nota emitida esperando registro</b>';
  }
  document.getElementById('pasta').value = d.cfg_pasta_nfa != null ? d.cfg_pasta_nfa : PADRAO.cfg_pasta_nfa;
  document.getElementById('manter').checked = d.cfg_manter_local != null ? d.cfg_manter_local : PADRAO.cfg_manter_local;
});

document.getElementById('pasta').addEventListener('change', salvar);
document.getElementById('manter').addEventListener('change', salvar);
document.getElementById('btnLimpar').onclick = () => {
  chrome.runtime.sendMessage({ action: 'LIMPAR_NFA' }, () => {
    document.getElementById('status').textContent = 'Dados limpos.';
  });
};
