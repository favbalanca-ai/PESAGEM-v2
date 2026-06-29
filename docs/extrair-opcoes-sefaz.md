# Extrair todas as opções dos dropdowns do SEFAZ (aba Produtos)

Para completar/atualizar as listas do app (`FAV_SEFAZ` = Grupo → Natureza →
Produto, e `FAV_DISPLEGAL` = Dispositivo Legal), capture as opções direto da
página do SEFAZ-GO com o script abaixo.

Como **Natureza** e **Produto** dependem do **Grupo**, rode **uma vez por
grupo** (SOJA, MILHO, SORGO, FEIJÃO, e quaisquer outros). O **Dispositivo
Legal** depende da **Natureza** escolhida — para capturá-lo, selecione a
natureza que o habilita e rode de novo.

## Passos
1. No SEFAZ, abra uma NFA até a **aba Produtos**.
2. Selecione um **Grupo** e aguarde carregar Natureza/Produto.
3. `F12` → **Console**.
4. Cole o script e **Enter** (se pedir, digite `allow pasting` antes).
5. Ele copia tudo para a área de transferência → cole para o desenvolvedor.
6. Troque o **Grupo** e repita.

## Script
```js
(function(){
  const lixo = t => !t || t==='-' || /^selecione/i.test(t) || /nenhum dispositivo|nenhum registro/i.test(t);
  const out = [];
  document.querySelectorAll('select').forEach(sel=>{
    const o=[...sel.options].map(x=>(x.text||'').trim()).filter(t=>!lixo(t));
    if(o.length) out.push('### '+(sel.id||'select')+'\n'+o.join('\n'));
  });
  document.querySelectorAll('ul[id$="_items"], .ui-selectonemenu-items').forEach(ul=>{
    const o=[...ul.querySelectorAll('li')].map(li=>(li.textContent||'').trim()).filter(t=>!lixo(t));
    if(o.length) out.push('### '+(ul.id||'lista')+'\n'+o.join('\n'));
  });
  const txt = out.join('\n\n');
  const ta=document.createElement('textarea'); ta.value=txt; document.body.appendChild(ta); ta.select();
  try{document.execCommand('copy');}catch(e){}
  ta.remove();
  console.log(txt);
  alert('✅ Copiado ('+out.length+' listas). Cole para o Claude.');
})();
```

## Script FOCADO (só os campos de produto)
Use este na **aba Produtos** (com um Grupo selecionado) — só extrai os 4
dropdowns de produto, sem as listas enormes de município:
```js
(function(){
  const ids=['grupoProduto','naturezaOperacaoAdmin','nomeProdutoAdmin','dispositivoLegalProduto'];
  const lixo=t=>!t||t==='-'||/^selecione/i.test(t)||/nenhum/i.test(t);
  const out=[];
  ids.forEach(key=>{
    const sel=[...document.querySelectorAll('select')].find(s=>s.id&&s.id.includes(key));
    if(sel){const o=[...sel.options].map(x=>(x.text||'').trim()).filter(t=>!lixo(t));
      if(o.length) out.push('### '+key+'\n'+o.join('\n'));}
  });
  const txt=out.join('\n\n')||'(nenhum campo de produto — confirme aba Produtos + Grupo)';
  const ta=document.createElement('textarea');ta.value=txt;document.body.appendChild(ta);ta.select();
  try{document.execCommand('copy');}catch(e){}ta.remove();
  console.log(txt);alert('Produtos copiados ('+out.length+' listas).');
})();
```
> Dica: o Chrome pede `allow pasting` uma vez — digite isso e Enter **antes** de colar o script.

## O que fazer com o resultado
Os campos do SEFAZ têm `id` contendo:
- `grupoProduto` → Grupo de Produto
- `naturezaOperacaoAdmin` → Natureza/Operação (o código 5101 etc.)
- `nomeProdutoAdmin` → Nome do Produto
- `dispositivoLegalProduto` → Dispositivo Legal

Mande o texto copiado de cada grupo; ele alimenta `FAV_SEFAZ` (por grupo) e
`FAV_DISPLEGAL_GRUPO` no `index.html`, mantendo os **textos idênticos** ao
SEFAZ (a automação seleciona sem erro).
