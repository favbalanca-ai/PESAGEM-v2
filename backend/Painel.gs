// ═══════════════════════════════════════════════════════════════
// FAV — PAINEL DE EXPEDIÇÃO (aba "Painel")
// Foco 100% em expedição: fila de NFA, pesagens em andamento,
// expedição por balança, saldo de contratos e NFAs emitidas.
// Rode "atualizarPainel" pelo menu "FAV v2".
// ═══════════════════════════════════════════════════════════════

// URL do app (botão Emitir abre o app já na carga)
var APP_URL = "https://favbalanca-ai.github.io/PESAGEM-v2/";

var PNL = {
  verde:   "#1a5c45", verdeEsc:"#0d2b1e", verdeCl:"#e6f4ee",
  azul:    "#1a3a6c", azulCl:"#e8eef7",
  amareloB:"#fff3cd", amareloT:"#856404",
  verdeB:  "#d4edda", verdeT:"#155724",
  vermB:   "#fce8e8", vermT:"#a32d2d",
  ink:     "#0f1a14", ink3:"#7a9e8a",
  brd:     "#dce8e2", branco:"#ffffff", zebra:"#f7faf8"
};

function _nf(x){ return Number(x||0).toLocaleString("pt-BR"); }
function _nf1(x){ return Number(x||0).toLocaleString("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:1}); }
function _balNome(o){
  var b=s(o.balanca);
  if(/gua viva|bal.*1|^1$/i.test(b)) return "Água Viva";
  if(/espora|bal.*2|^2$/i.test(b))   return "Espora";
  return b||"—";
}

function atualizarPainel(){
  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var aba = ss.getSheetByName("Painel");
  if(aba) ss.deleteSheet(aba);
  aba = ss.insertSheet("Painel", 0);

  aba.getRange(1, 1, aba.getMaxRows(), aba.getMaxColumns()).breakApart();
  aba.setHiddenGridlines(true);
  aba.setColumnWidths(1, 8, 132);

  // ── Dados (somente expedição) ──
  var pes   = (listarPesagens().ordens) || [];
  var contr = (listarContratosUnico({}).contratos) || [];
  var hoje  = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy");

  var finalizadas = pes.filter(function(o){ return (o.status||"").indexOf("Finalizado") >= 0; });
  var emProcesso  = pes.filter(function(o){ return (o.status||"").indexOf("Finalizado") < 0; }); // aguardando pesar
  var aguardando  = finalizadas.filter(function(o){ return !o.nfa_emitida; });                    // disponível p/ emitir
  var emitidas    = pes.filter(function(o){ return o.nfa_emitida; });
  var contrAtivos = contr.filter(function(c){ return c.status !== "Inativo" && c.status !== "Encerrado" && c.status !== "Nao"; });

  var cargasHoje   = finalizadas.filter(function(o){ return o.dataEntrada === hoje; });
  var cargaHojeT   = cargasHoje.reduce(function(t,o){ return t + n(o.cargaLiquida); }, 0);
  var emitidasHoje = emitidas.filter(function(o){ return o.dataEntrada === hoje; });
  var excedHoje    = cargasHoje.filter(function(o){ return (o.statusPeso||"").indexOf("EXCEDIDO") >= 0; });

  var linha = 1;

  // ── CABEÇALHO ──
  aba.getRange(linha,1,1,8).merge()
    .setValue("🚚  FAV — PAINEL DE EXPEDIÇÃO")
    .setBackground(PNL.verde).setFontColor("#ffffff").setFontSize(18).setFontWeight("bold")
    .setVerticalAlignment("middle").setHorizontalAlignment("left");
  aba.setRowHeight(linha, 48); linha++;
  aba.getRange(linha,1,1,6).merge()
    .setValue("Fazenda Água Viva · armazém → comprador · atualizado em " + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy 'às' HH:mm"))
    .setBackground(PNL.verdeEsc).setFontColor("#aac4b8").setFontSize(10).setVerticalAlignment("middle");
  aba.getRange(linha,7,1,2).merge()
    .setFormula('=HYPERLINK("'+APP_URL+'";"📲 Abrir App")')
    .setBackground(PNL.verdeEsc).setFontColor("#ffffff").setFontSize(10).setFontWeight("bold")
    .setVerticalAlignment("middle").setHorizontalAlignment("center");
  aba.setRowHeight(linha, 22); linha += 2;

  // ── KPIs linha 1 — operação do dia ──
  var k = linha;
  desenharKPI(aba, k, 1, "CARGAS HOJE",      cargasHoje.length,       "expedidas",          PNL.verdeCl, PNL.azul);
  desenharKPI(aba, k, 3, "EXPEDIDO HOJE",    _nf1(cargaHojeT)+" t",   "carga líquida",      PNL.verdeCl, PNL.verde);
  desenharKPI(aba, k, 5, "EM PESAGEM",       emProcesso.length,       "aguardando peso",    PNL.amareloB, PNL.amareloT);
  var exBg = excedHoje.length? PNL.vermB:PNL.verdeCl, exFg = excedHoje.length? PNL.vermT:PNL.verde;
  desenharKPI(aba, k, 7, "EXCEDIDOS HOJE",   excedHoje.length,        "acima do PBT",       exBg, exFg);
  linha += 4;

  // ── KPIs linha 2 — fiscal / NFA ──
  k = linha;
  var incompletas0 = aguardando.filter(function(o){ return !s(o.estado).trim() || !s(o.municipio).trim(); }).length;
  desenharKPI(aba, k, 1, "DISPONÍVEIS NFA",  aguardando.length,       "prontas p/ emitir",  PNL.amareloB, PNL.amareloT);
  var icBg = incompletas0? PNL.vermB:PNL.verdeCl, icFg = incompletas0? PNL.vermT:PNL.verde;
  desenharKPI(aba, k, 3, "SEM UF/MUN.",      incompletas0,            "corrigir antes",     icBg, icFg);
  desenharKPI(aba, k, 5, "NFA HOJE",         emitidasHoje.length,     "emitidas hoje",      PNL.verdeCl, PNL.verde);
  desenharKPI(aba, k, 7, "CONTRATOS",        contrAtivos.length,      "ativos com saldo",   PNL.verdeCl, PNL.verde);
  linha += 4;

  // ── FILA DE EMISSÃO NFA (controle principal) ──
  // incompletas (sem UF/Mun.) primeiro, depois mais recentes
  aguardando.sort(function(a,b){
    var fa=(!s(a.estado).trim()||!s(a.municipio).trim())?1:0, fb=(!s(b.estado).trim()||!s(b.municipio).trim())?1:0;
    if(fb!==fa) return fb-fa;
    return _dataKey(b) - _dataKey(a);
  });
  var incompletas = aguardando.filter(function(o){ return !s(o.estado).trim() || !s(o.municipio).trim(); }).length;
  var subFila = aguardando.length + " cargas" + (incompletas? " · ⚠️ "+incompletas+" sem UF/Mun.":"");
  linha = secaoTitulo(aba, linha, "⏳  FILA DE EMISSÃO — NFA", subFila);
  linha = cabecalhoTabela(aba, linha, ["Placa","Motorista","Contrato","Carga (kg)","Balança","Status","Emitir"]);
  if(aguardando.length === 0){
    linha = linhaVazia(aba, linha, "✓ Nenhuma carga aguardando NFA — tudo em dia!");
  } else {
    var totFila = 0, z = 0;
    aguardando.forEach(function(o){
      var carga = Math.round(n(o.cargaLiquida)*1000); totFila += carga;
      var link = APP_URL + "?emitir=" + encodeURIComponent(o.id);
      var falta = !s(o.estado).trim() || !s(o.municipio).trim();   // UF/Município ausente
      var bgRow = falta ? PNL.vermB : ((z%2)?PNL.zebra:PNL.branco); z++;
      aba.getRange(linha,1,1,7).setBackground(bgRow).setVerticalAlignment("middle");
      aba.getRange(linha,1).setValue(o.placa||"—").setFontFamily("Roboto Mono").setFontWeight("bold");
      aba.getRange(linha,2).setValue(o.motorista||"—");
      aba.getRange(linha,3).setValue(o.numOrdem||"—").setFontColor(PNL.verde).setFontWeight("bold");
      aba.getRange(linha,4).setValue(carga).setNumberFormat("#,##0").setHorizontalAlignment("right");
      aba.getRange(linha,5).setValue(_balNome(o)).setFontSize(10).setFontColor(falta?PNL.vermT:PNL.ink3);
      if(falta)
        aba.getRange(linha,6).setValue("⚠️ Sem UF/Mun.").setBackground(PNL.vermB).setFontColor(PNL.vermT).setFontWeight("bold").setHorizontalAlignment("center").setFontSize(10);
      else
        aba.getRange(linha,6).setValue("⏳ Aguardando").setBackground(PNL.amareloB).setFontColor(PNL.amareloT).setFontWeight("bold").setHorizontalAlignment("center").setFontSize(10);
      // Sem UF/Município → botão vira "Corrigir" (o app abre e pede para completar)
      aba.getRange(linha,7).setFormula('=HYPERLINK("'+link+'";"'+(falta?'✏️ CORRIGIR':'📄 EMITIR')+'")')
        .setBackground(falta?PNL.vermT:PNL.azul).setFontColor("#ffffff").setFontWeight("bold").setHorizontalAlignment("center");
      aba.setRowHeight(linha, 30); linha++;
    });
    linha = linhaTotal(aba, linha, "TOTAL NA FILA (kg)", 4, totFila, "#,##0");
  }
  linha += 1;

  // ── PESAGENS EM ANDAMENTO (entraram, falta peso de saída) ──
  emProcesso.sort(function(a,b){ return _dataKey(b)-_dataKey(a); });
  linha = secaoTitulo(aba, linha, "🚧  EM PESAGEM (aguardando peso)", emProcesso.length + " caminhões");
  linha = cabecalhoTabela(aba, linha, ["Placa","Motorista","Contrato","Balança","Entrada","",""]);
  if(emProcesso.length === 0){
    linha = linhaVazia(aba, linha, "Nenhum caminhão em pesagem.");
  } else {
    var z5 = 0;
    emProcesso.slice(0,15).forEach(function(o){
      aba.getRange(linha,1,1,7).setBackground((z5++%2)?PNL.zebra:PNL.branco).setVerticalAlignment("middle");
      aba.getRange(linha,1).setValue(o.placa||"—").setFontFamily("Roboto Mono").setFontWeight("bold");
      aba.getRange(linha,2).setValue(o.motorista||"—");
      aba.getRange(linha,3).setValue(o.numOrdem||"—").setFontColor(PNL.verde).setFontWeight("bold");
      aba.getRange(linha,4).setValue(_balNome(o)).setFontSize(10).setFontColor(PNL.ink3);
      aba.getRange(linha,5).setValue((o.dataEntrada||"")+" "+(o.horaEntrada||"")).setFontSize(9).setFontColor(PNL.ink3);
      aba.getRange(linha,6,1,2).merge().setValue("⏳ aguardando peso").setFontSize(10).setFontColor(PNL.amareloT).setHorizontalAlignment("center").setBackground(PNL.amareloB);
      aba.setRowHeight(linha, 28); linha++;
    });
  }
  linha += 1;

  // ── EXPEDIÇÃO POR BALANÇA (hoje) ──
  var porBal = {};
  cargasHoje.forEach(function(o){
    var bn=_balNome(o); if(!porBal[bn]) porBal[bn]={n:0,t:0};
    porBal[bn].n++; porBal[bn].t += n(o.cargaLiquida);
  });
  var balKeys = Object.keys(porBal);
  linha = secaoTitulo(aba, linha, "⚖️  EXPEDIÇÃO POR BALANÇA (hoje)", cargasHoje.length + " cargas");
  linha = cabecalhoTabela(aba, linha, ["Balança","Cargas","Carga (t)","","","",""]);
  if(balKeys.length === 0){
    linha = linhaVazia(aba, linha, "Nenhuma expedição hoje.");
  } else {
    var z6=0;
    balKeys.forEach(function(bn){
      aba.getRange(linha,1,1,7).setBackground((z6++%2)?PNL.zebra:PNL.branco).setVerticalAlignment("middle");
      aba.getRange(linha,1).setValue("⚖️ "+bn).setFontWeight("bold");
      aba.getRange(linha,2).setValue(porBal[bn].n).setHorizontalAlignment("right");
      aba.getRange(linha,3).setValue(porBal[bn].t).setNumberFormat("#,##0.0").setHorizontalAlignment("right").setFontWeight("bold").setFontColor(PNL.verde);
      aba.setRowHeight(linha, 28); linha++;
    });
    linha = linhaTotal(aba, linha, "TOTAL (t)", 3, cargaHojeT, "#,##0.0");
  }
  linha += 1;

  // ── SALDO DOS CONTRATOS ──
  linha = secaoTitulo(aba, linha, "📊  SALDO DOS CONTRATOS", contrAtivos.length + " ativos");
  linha = cabecalhoTabela(aba, linha, ["Contrato","Destinatário","Produto","Volume","Entregue","Saldo","% Entregue"]);
  if(contrAtivos.length === 0){
    linha = linhaVazia(aba, linha, "Nenhum contrato ativo.");
  } else {
    var z3=0, totVol=0, totEnt=0, totSal=0;
    contrAtivos.sort(function(a,b){ return (n(b.volume_total)-n(b.volume_entregue)) - (n(a.volume_total)-n(a.volume_entregue)); })
    .forEach(function(c){
      var vol=n(c.volume_total), ent=n(c.volume_entregue), sal=vol-ent;
      var pct = vol>0 ? Math.round(ent/vol*100) : 0;
      totVol+=vol; totEnt+=ent; totSal+=sal;
      aba.getRange(linha,1,1,7).setBackground((z3++%2)?PNL.zebra:PNL.branco).setVerticalAlignment("middle");
      aba.getRange(linha,1).setValue(c.id).setFontWeight("bold");
      aba.getRange(linha,2).setValue(c.destinatario_nome||"—");
      aba.getRange(linha,3).setValue(c.grupo_produto||c.produto||"—");
      aba.getRange(linha,4).setValue(vol).setNumberFormat("#,##0").setHorizontalAlignment("right");
      aba.getRange(linha,5).setValue(ent).setNumberFormat("#,##0").setHorizontalAlignment("right");
      aba.getRange(linha,6).setValue(sal).setNumberFormat("#,##0").setHorizontalAlignment("right").setFontWeight("bold");
      aba.getRange(linha,7).setValue(pct/100).setNumberFormat("0%").setHorizontalAlignment("center")
        .setBackground(pct>=100?PNL.verdeB:(pct>=70?PNL.amareloB:PNL.azulCl))
        .setFontColor(pct>=100?PNL.verdeT:(pct>=70?PNL.amareloT:PNL.azul)).setFontWeight("bold");
      aba.setRowHeight(linha, 28); linha++;
    });
    aba.getRange(linha,1,1,3).merge().setValue("TOTAL").setFontWeight("bold").setHorizontalAlignment("right").setBackground(PNL.verdeCl);
    aba.getRange(linha,4).setValue(totVol).setNumberFormat("#,##0").setHorizontalAlignment("right").setFontWeight("bold").setBackground(PNL.verdeCl);
    aba.getRange(linha,5).setValue(totEnt).setNumberFormat("#,##0").setHorizontalAlignment("right").setFontWeight("bold").setBackground(PNL.verdeCl);
    aba.getRange(linha,6).setValue(totSal).setNumberFormat("#,##0").setHorizontalAlignment("right").setFontWeight("bold").setBackground(PNL.verdeCl).setFontColor(PNL.verde);
    aba.getRange(linha,7).setValue(totVol>0?totEnt/totVol:0).setNumberFormat("0%").setHorizontalAlignment("center").setFontWeight("bold").setBackground(PNL.verdeCl);
    aba.setRowHeight(linha, 26); linha += 2;
  }

  // ── NFA EMITIDAS (recentes) ──
  linha = secaoTitulo(aba, linha, "✅  NFA EMITIDAS (recentes)", "últimas " + Math.min(emitidas.length,12));
  linha = cabecalhoTabela(aba, linha, ["Placa","Motorista","Nº NFA","Contrato","Carga (kg)","Data","PDF"]);
  if(emitidas.length === 0){
    linha = linhaVazia(aba, linha, "Nenhuma NFA emitida ainda.");
  } else {
    var z4=0;
    emitidas.slice(-12).reverse().forEach(function(o){
      var carga = Math.round(n(o.cargaLiquida)*1000);
      aba.getRange(linha,1,1,7).setBackground((z4++%2)?PNL.zebra:PNL.branco).setVerticalAlignment("middle");
      aba.getRange(linha,1).setValue(o.placa||"—").setFontFamily("Roboto Mono").setFontWeight("bold");
      aba.getRange(linha,2).setValue(o.motorista||"—");
      aba.getRange(linha,3).setValue(o.nfa_numero||"—").setFontWeight("bold").setFontColor(PNL.azul);
      aba.getRange(linha,4).setValue(o.numOrdem||"—").setFontColor(PNL.verde);
      aba.getRange(linha,5).setValue(carga).setNumberFormat("#,##0").setHorizontalAlignment("right");
      aba.getRange(linha,6).setValue(o.dataEntrada||"").setFontSize(9).setFontColor(PNL.ink3);
      if(o.nfa_drive_url)
        aba.getRange(linha,7).setFormula('=HYPERLINK("'+o.nfa_drive_url+'";"📄 PDF")').setHorizontalAlignment("center").setFontColor(PNL.azul);
      else
        aba.getRange(linha,7).setValue("✅").setHorizontalAlignment("center");
      aba.setRowHeight(linha, 28); linha++;
    });
  }
  linha += 1;

  // ── Rodapé ──
  aba.getRange(linha,1,1,8).merge()
    .setValue("💡 📄 EMITIR abre o app na carga e dispara a emissão pelo SEFAZ (a extensão preenche; você seleciona o certificado A1). "
            + "⚠️ Sem UF/Mun. = corrija no app antes de emitir. Atualize por: menu FAV v2 → 📊 Atualizar Painel.")
    .setFontColor(PNL.ink3).setFontSize(10).setFontStyle("italic").setWrap(true).setVerticalAlignment("middle");
  aba.setRowHeight(linha, 42);

  aba.setFrozenRows(4);
  SpreadsheetApp.getActiveSpreadsheet().toast("Painel de Expedição atualizado!", "🚚 FAV", 3);
}

// chave de ordenação por data/hora (dd/MM/yyyy [HH:mm])
function _dataKey(o){
  var d = s(o.dataEntrada), h = s(o.horaEntrada);
  var m = d.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if(!m) return 0;
  var hm = (h.match(/(\d{2}):(\d{2})/)) || [0,"00","00"];
  return new Date(+m[3], +m[2]-1, +m[1], +hm[1]||0, +hm[2]||0).getTime();
}

// ── helpers de desenho ──
function desenharKPI(aba, row, col, label, valor, desc, bg, fg){
  aba.getRange(row, col, 3, 2).setBackground(bg)
    .setBorder(true,true,true,true,false,false, PNL.brd, SpreadsheetApp.BorderStyle.SOLID);
  aba.getRange(row, col, 1, 2).merge().setValue(label)
    .setFontColor(PNL.ink3).setFontSize(9).setFontWeight("bold").setVerticalAlignment("middle").setHorizontalAlignment("center");
  aba.getRange(row+1, col, 1, 2).merge().setValue(valor)
    .setFontColor(fg).setFontSize(24).setFontWeight("bold").setVerticalAlignment("middle").setHorizontalAlignment("center");
  aba.getRange(row+2, col, 1, 2).merge().setValue(desc)
    .setFontColor(PNL.ink3).setFontSize(9).setVerticalAlignment("middle").setHorizontalAlignment("center");
  aba.setRowHeight(row,18); aba.setRowHeight(row+1,34); aba.setRowHeight(row+2,18);
}

function secaoTitulo(aba, linha, titulo, contagem){
  aba.getRange(linha,1,1,6).merge().setValue(titulo)
    .setBackground(PNL.verde).setFontColor("#ffffff").setFontSize(12).setFontWeight("bold").setVerticalAlignment("middle");
  aba.getRange(linha,7,1,2).merge().setValue(contagem)
    .setBackground(PNL.verde).setFontColor("#aac4b8").setFontSize(10).setVerticalAlignment("middle").setHorizontalAlignment("right");
  aba.setRowHeight(linha, 30);
  return linha+1;
}

function cabecalhoTabela(aba, linha, cols){
  for(var i=0;i<cols.length;i++){
    aba.getRange(linha,i+1).setValue(cols[i])
      .setBackground("#fafdfb").setFontColor(PNL.ink3).setFontSize(9).setFontWeight("bold")
      .setBorder(false,false,true,false,false,false, PNL.brd, SpreadsheetApp.BorderStyle.SOLID);
  }
  aba.setRowHeight(linha, 24);
  return linha+1;
}

function linhaVazia(aba, linha, texto){
  aba.getRange(linha,1,1,7).merge().setValue(texto)
    .setFontColor(PNL.ink3).setFontStyle("italic").setHorizontalAlignment("center").setBackground(PNL.branco);
  aba.setRowHeight(linha,28);
  return linha+1;
}

// Linha de total: rótulo até a coluna (valorCol-1), valor na valorCol
function linhaTotal(aba, linha, rotulo, valorCol, valor, fmt){
  aba.getRange(linha,1,1,valorCol-1).merge().setValue(rotulo)
    .setFontWeight("bold").setHorizontalAlignment("right").setBackground(PNL.verdeCl);
  aba.getRange(linha,valorCol).setValue(valor).setNumberFormat(fmt||"#,##0")
    .setHorizontalAlignment("right").setFontWeight("bold").setBackground(PNL.verdeCl).setFontColor(PNL.verde);
  var resto = 7-valorCol;
  if(resto>0) aba.getRange(linha,valorCol+1,1,resto).setBackground(PNL.verdeCl);
  aba.setRowHeight(linha,26);
  return linha+1;
}
