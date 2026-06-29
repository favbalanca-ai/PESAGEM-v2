// ═══════════════════════════════════════════════════════════════
// FAV — PAINEL DE CONTROLE (aba "Painel")
// Faz parte do mesmo projeto Apps Script do Code.gs.
// Rode "atualizarPainel" pelo menu "FAV v2".
// ═══════════════════════════════════════════════════════════════

// URL do app (para o botão Emitir abrir o app já na carga — Opção A)
var APP_URL = "https://favbalanca-ai.github.io/PESAGEM-v2/";

// Cores do tema FAV
var PNL = {
  verde:   "#1a5c45",
  verdeEsc:"#0d2b1e",
  verdeCl: "#e6f4ee",
  azul:    "#1a3a6c",
  amareloB:"#fff3cd", amareloT:"#856404",
  verdeB:  "#d4edda", verdeT:"#155724",
  ink:     "#0f1a14", ink3:"#7a9e8a",
  brd:     "#dce8e2", branco:"#ffffff"
};

function atualizarPainel(){
  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var aba = ss.getSheetByName("Painel");
  if(aba) ss.deleteSheet(aba);
  aba = ss.insertSheet("Painel", 0); // cria como primeira aba

  // garante folha limpa (sem mesclagens remanescentes)
  aba.getRange(1, 1, aba.getMaxRows(), aba.getMaxColumns()).breakApart();
  aba.setHiddenGridlines(true);
  aba.setColumnWidths(1, 8, 130);
  aba.getRange("A1").setValue("");

  // ── Coleta de dados ──
  var pes = listarPesagens().ordens || [];
  var contr = (listarContratosUnico({}).contratos) || [];

  var aguardando = pes.filter(function(o){
    return (o.status||"").indexOf("Finalizado") >= 0 && !o.nfa_emitida;
  });
  var emitidas = pes.filter(function(o){ return o.nfa_emitida; });
  var hoje = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy");
  var cargasHoje = pes.filter(function(o){ return o.dataEntrada === hoje; });
  var contrAtivos = contr.filter(function(c){ return c.status !== "Inativo" && c.status !== "Encerrado" && c.status !== "Nao"; });

  var linha = 1;

  // ── CABEÇALHO ──
  aba.getRange(linha,1,1,8).merge()
    .setValue("🌾  FAV — PAINEL DE CONTROLE")
    .setBackground(PNL.verde).setFontColor("#ffffff").setFontSize(18).setFontWeight("bold")
    .setVerticalAlignment("middle").setHorizontalAlignment("left");
  aba.setRowHeight(linha, 46);
  linha++;
  aba.getRange(linha,1,1,8).merge()
    .setValue("Fazenda Água Viva · atualizado em " + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm"))
    .setBackground(PNL.verdeEsc).setFontColor("#aac4b8").setFontSize(10)
    .setVerticalAlignment("middle");
  aba.setRowHeight(linha, 22);
  linha += 2;

  // ── KPIs (4 cards) ──
  var kpiRow = linha;
  desenharKPI(aba, kpiRow, 1, "AGUARDANDO NFA", aguardando.length, "cargas sem nota", PNL.amareloB, PNL.amareloT);
  desenharKPI(aba, kpiRow, 3, "NFA EMITIDAS",   emitidas.length, "total registrado", PNL.verdeCl, PNL.verde);
  desenharKPI(aba, kpiRow, 5, "CARGAS HOJE",    cargasHoje.length, hoje, PNL.verdeCl, PNL.azul);
  desenharKPI(aba, kpiRow, 7, "CONTRATOS",      contrAtivos.length, "ativos com saldo", PNL.verdeCl, PNL.verde);
  linha += 4;

  // ── SEÇÃO: FILA DE NFA ──
  linha = secaoTitulo(aba, linha, "⏳  FILA DE EMISSÃO — AGUARDANDO NFA", aguardando.length + " cargas");
  var cabFila = ["Placa","Motorista","Contrato","Carga (kg)","Data","Status","Emitir NFA"];
  linha = cabecalhoTabela(aba, linha, cabFila);
  if(aguardando.length === 0){
    aba.getRange(linha,1,1,7).merge().setValue("✓ Nenhuma carga aguardando — tudo em dia!")
      .setFontColor(PNL.ink3).setFontStyle("italic").setHorizontalAlignment("center")
      .setBackground(PNL.branco);
    aba.setRowHeight(linha,28); linha++;
  } else {
    aguardando.forEach(function(o){
      var carga = Math.round((o.cargaLiquida||0)*1000);
      var link = APP_URL + "?emitir=" + encodeURIComponent(o.id);
      var rng = aba.getRange(linha,1,1,7);
      rng.setBackground(PNL.branco).setVerticalAlignment("middle").setBorder(false,false,true,false,false,false,"#f0f5f2",SpreadsheetApp.BorderStyle.SOLID);
      aba.getRange(linha,1).setValue(o.placa||"—").setFontFamily("Roboto Mono").setFontWeight("bold");
      aba.getRange(linha,2).setValue(o.motorista||"—");
      aba.getRange(linha,3).setValue(o.numOrdem||"—").setFontColor(PNL.verde).setFontWeight("bold");
      aba.getRange(linha,4).setValue(carga.toLocaleString ? carga.toLocaleString("pt-BR") : carga);
      aba.getRange(linha,5).setValue((o.dataEntrada||"") + " " + (o.horaEntrada||"")).setFontSize(9).setFontColor(PNL.ink3);
      // [NFA-AUTORIZACAO] mostra "Autorizada" quando o admin já liberou pelo app
      if(o.nfa_autorizada){
        aba.getRange(linha,6).setValue("✅ Autorizada").setBackground(PNL.verdeB).setFontColor(PNL.verdeT).setFontWeight("bold").setHorizontalAlignment("center").setFontSize(10);
      } else {
        aba.getRange(linha,6).setValue("⏳ Aguardando").setBackground(PNL.amareloB).setFontColor(PNL.amareloT).setFontWeight("bold").setHorizontalAlignment("center").setFontSize(10);
      }
      aba.getRange(linha,7).setFormula('=HYPERLINK("'+link+'";"📄 EMITIR")').setBackground(PNL.azul).setFontColor("#ffffff").setFontWeight("bold").setHorizontalAlignment("center");
      aba.setRowHeight(linha, 30);
      linha++;
    });
  }
  linha += 1;

  // ── SEÇÃO: LIBERADOS ──
  linha = secaoTitulo(aba, linha, "✅  LIBERADOS — NFA EMITIDA", "últimas " + Math.min(emitidas.length,15));
  var cabLib = ["Placa","Motorista","Nº NFA","Contrato","Carga (kg)","Data","Status"];
  linha = cabecalhoTabela(aba, linha, cabLib);
  if(emitidas.length === 0){
    aba.getRange(linha,1,1,7).merge().setValue("Nenhuma NFA emitida ainda.")
      .setFontColor(PNL.ink3).setFontStyle("italic").setHorizontalAlignment("center").setBackground(PNL.branco);
    aba.setRowHeight(linha,28); linha++;
  } else {
    emitidas.slice(-15).reverse().forEach(function(o){
      var carga = Math.round((o.cargaLiquida||0)*1000);
      aba.getRange(linha,1).setValue(o.placa||"—").setFontFamily("Roboto Mono").setFontWeight("bold");
      aba.getRange(linha,2).setValue(o.motorista||"—");
      aba.getRange(linha,3).setValue(o.nfa_numero||"—").setFontWeight("bold").setFontColor(PNL.azul);
      aba.getRange(linha,4).setValue(o.numOrdem||"—").setFontColor(PNL.verde);
      aba.getRange(linha,5).setValue(carga.toLocaleString ? carga.toLocaleString("pt-BR") : carga);
      aba.getRange(linha,6).setValue((o.dataEntrada||"")).setFontSize(9).setFontColor(PNL.ink3);
      aba.getRange(linha,7).setValue("✅ Emitida").setBackground(PNL.verdeB).setFontColor(PNL.verdeT).setFontWeight("bold").setHorizontalAlignment("center").setFontSize(10);
      aba.getRange(linha,1,1,7).setBackground(PNL.branco).setVerticalAlignment("middle");
      aba.setRowHeight(linha,28);
      linha++;
    });
  }
  linha += 1;

  // ── SEÇÃO: SALDO DOS CONTRATOS ──
  linha = secaoTitulo(aba, linha, "📊  SALDO DOS CONTRATOS", contrAtivos.length + " ativos");
  var cabC = ["Contrato","Destinatário","Produto","Volume","Entregue","Saldo","% Entregue"];
  linha = cabecalhoTabela(aba, linha, cabC);
  if(contrAtivos.length === 0){
    aba.getRange(linha,1,1,7).merge().setValue("Nenhum contrato ativo.")
      .setFontColor(PNL.ink3).setFontStyle("italic").setHorizontalAlignment("center").setBackground(PNL.branco);
    aba.setRowHeight(linha,28); linha++;
  } else {
    contrAtivos.forEach(function(c){
      var vol = n(c.volume_total), ent = n(c.volume_entregue), sal = vol - ent;
      var pct = vol>0 ? Math.round(ent/vol*100) : 0;
      aba.getRange(linha,1).setValue(c.id).setFontWeight("bold");
      aba.getRange(linha,2).setValue(c.destinatario_nome||"—");
      aba.getRange(linha,3).setValue(c.grupo_produto||c.produto||"—");
      aba.getRange(linha,4).setValue(vol.toLocaleString ? vol.toLocaleString("pt-BR") : vol);
      aba.getRange(linha,5).setValue(ent.toLocaleString ? ent.toLocaleString("pt-BR") : ent);
      aba.getRange(linha,6).setValue(sal.toLocaleString ? sal.toLocaleString("pt-BR") : sal).setFontWeight("bold");
      aba.getRange(linha,7).setValue(pct/100).setNumberFormat("0%").setHorizontalAlignment("center")
        .setBackground(pct>=100?PNL.verdeB:PNL.verdeCl).setFontColor(pct>=100?PNL.verdeT:PNL.verde).setFontWeight("bold");
      aba.getRange(linha,1,1,7).setBackground(PNL.branco).setVerticalAlignment("middle");
      aba.setRowHeight(linha,28);
      linha++;
    });
  }
  linha += 2;

  // ── Rodapé ──
  aba.getRange(linha,1,1,8).merge()
    .setValue("💡 Clique em 📄 EMITIR para abrir o app na carga e disparar a emissão pelo SEFAZ (a extensão preenche; você seleciona o certificado).")
    .setFontColor(PNL.ink3).setFontSize(10).setFontStyle("italic").setWrap(true);
  aba.setRowHeight(linha, 34);

  aba.setFrozenRows(4);
  SpreadsheetApp.getActiveSpreadsheet().toast("Painel atualizado!", "📊 FAV", 3);
}

// ── helpers de desenho ──
function desenharKPI(aba, row, col, label, valor, desc, bg, fg){
  // Pinta o fundo das 3 linhas x 2 colunas SEM mesclar o bloco todo (evita conflito)
  aba.getRange(row, col, 3, 2).setBackground(bg)
    .setBorder(true,true,true,true,false,false, PNL.brd, SpreadsheetApp.BorderStyle.SOLID);
  // label (linha 1)
  aba.getRange(row, col, 1, 2).merge().setValue(label)
    .setFontColor(PNL.ink3).setFontSize(9).setFontWeight("bold").setVerticalAlignment("middle").setHorizontalAlignment("center");
  // valor (linha 2)
  aba.getRange(row+1, col, 1, 2).merge().setValue(valor)
    .setFontColor(fg).setFontSize(26).setFontWeight("bold").setVerticalAlignment("middle").setHorizontalAlignment("center");
  // desc (linha 3)
  aba.getRange(row+2, col, 1, 2).merge().setValue(desc)
    .setFontColor(PNL.ink3).setFontSize(9).setVerticalAlignment("middle").setHorizontalAlignment("center");
  aba.setRowHeight(row,18); aba.setRowHeight(row+1,34); aba.setRowHeight(row+2,18);
}

function secaoTitulo(aba, linha, titulo, contagem){
  aba.getRange(linha,1,1,6).merge().setValue(titulo)
    .setBackground(PNL.verde).setFontColor("#ffffff").setFontSize(12).setFontWeight("bold")
    .setVerticalAlignment("middle");
  aba.getRange(linha,7,1,2).merge().setValue(contagem)
    .setBackground(PNL.verde).setFontColor("#aac4b8").setFontSize(10)
    .setVerticalAlignment("middle").setHorizontalAlignment("right");
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
