// ═══════════════════════════════════════════════════════════════
// FAV Sistema v2 — Backend Google Apps Script (ARQUIVO ÚNICO)
// Repositório: favbalanca-ai/PESAGEM-v2
// ⚠️ Este é o ÚNICO arquivo .gs principal do projeto (além de Painel.gs).
//
// ⚠️ SEGREDOS: os valores abaixo foram substituídos por PLACEHOLDERS antes
//    de versionar. Preencha com os valores reais no editor do Apps Script
//    (NÃO commite os valores reais — TOKEN_SECRET deve ser igual ao TOKEN
//    do index.html / sw.js).
// ═══════════════════════════════════════════════════════════════
var PLANILHA_ID  = "<<<ID_DA_PLANILHA>>>";
var DRIVE_ID     = "<<<ID_DA_PASTA_DRIVE>>>";
var TOKEN_SECRET = "<<<TOKEN_SECRETO>>>";   // deve ser igual ao TOKEN do app

// ── NFA: IDs de pasta e emitentes ────────────────────────────
var DRIVE_PASTA_NFA   = "<<<ID_DA_PASTA_NFA>>>";
var FAV_WA_ESCRITORIO = "<<<DDI_DDD_NUMERO>>>";

// CPF/IE são dados sensíveis — preencha no editor do Apps Script.
var EMITENTES = {
  "JOVANE":  { nome: "<<<NOME EMITENTE 1>>>", ie: "<<<IE_1>>>", cpf: "<<<CPF_1>>>" },
  "JOAQUIM": { nome: "<<<NOME EMITENTE 2>>>", ie: "<<<IE_2>>>", cpf: "<<<CPF_2>>>" },
  "TAIS":    { nome: "<<<NOME EMITENTE 3>>>", ie: "<<<IE_3>>>", cpf: "<<<CPF_3>>>" },
  "JOAO":    { nome: "<<<NOME EMITENTE 4>>>", ie: "<<<IE_4>>>", cpf: "<<<CPF_4>>>" }
};

// ── Helpers ──────────────────────────────────────────────────
function resposta(obj){return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);}
function s(v){return v!=null?String(v):"";}
function n(v){return parseFloat(v)||0;}
function b(v){return v===true||v==="Sim"||v==="sim";}
function fmtD(v){if(!v)return"";if(v instanceof Date)return Utilities.formatDate(v,Session.getScriptTimeZone(),"dd/MM/yyyy");return s(v);}
function fmtH(v){if(!v)return"";if(v instanceof Date)return Utilities.formatDate(v,Session.getScriptTimeZone(),"HH:mm");var t=s(v);return t.length>5?t.substring(0,5):t;}
function fmtDH(v){if(!v)return"";if(v instanceof Date)return Utilities.formatDate(v,Session.getScriptTimeZone(),"dd/MM/yyyy HH:mm:ss");return s(v);}
function agora(){return Utilities.formatDate(new Date(),Session.getScriptTimeZone(),"dd/MM/yyyy HH:mm:ss");}

// ── doGet ────────────────────────────────────────────────────
function doGet(e){
  var result;
  if(e&&e.parameter){
    var p=e.parameter;
    if(p.action==="listarContratosNFA")  result=listarContratosNFA(p.filtros?JSON.parse(p.filtros):{});
    else if(p.action==="montarDadosNFA") result=montarDadosNFA(p.ticket_id,p.contrato_id);
    else result={ok:true,msg:"FAV v2 ativo!",ts:agora()};
  } else {
    result={ok:true,msg:"FAV v2 ativo!",ts:agora()};
  }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

// ── doPost ───────────────────────────────────────────────────
function doPost(e){
  try{
    if(!e||!e.postData)return resposta({ok:true});
    var d=JSON.parse(e.postData.contents);

    // NFA: processamento pós-emissão (sem token — vem da extensão Chrome)
    if(d.action==="processarNFA") return resposta(processarNFA(d));

    // Rotas autenticadas
    if(d.token!==TOKEN_SECRET)return resposta({ok:false,erro:"Token invalido"});
    if(d.acao==="salvar")             return resposta(salvarPesagem(d.ordem));
    if(d.acao==="atualizar")          return resposta(atualizarPesagem(d.ordem));
    if(d.acao==="listar")             return resposta(listarPesagens());
    if(d.acao==="autorizarNFA")       return resposta(autorizarNFA(d.ticket_id,d.por)); // [NFA-AUTORIZACAO]
    if(d.acao==="salvarContrato")     return resposta(salvarContrato(d.contrato));
    if(d.acao==="listarContratos")    return resposta(listarContratos());
    if(d.acao==="delContrato")        return resposta(delContrato(d.num));
    if(d.acao==="salvarFoto")         return resposta(salvarFoto(d.dados,"Fotos"));
    if(d.acao==="salvarRecepcao")     return resposta(salvarRecepcao(d.rec));
    if(d.acao==="listarRecepcoes")    return resposta(listarRecepcoes());
    if(d.acao==="salvarFotoRec")      return resposta(salvarFoto(d.dados,"Recepcao"));
    if(d.acao==="salvarTalhao")       return resposta(salvarTalhao(d.talhao));
    if(d.acao==="listarTalhoes")      return resposta(listarTalhoes());
    if(d.acao==="delTalhao")          return resposta(delTalhao(d.cod));
    if(d.acao==="listarEstoque")      return resposta(listarEstoque());
    if(d.acao==="auditLog")           return resposta(registrarAudit(d.log));
    if(d.acao==="ping")               return resposta({ok:true,msg:"online",ts:agora()});
    if(d.acao==="lerDisplay")         return resposta(lerDisplay(d.frames,d.contexto));
    if(d.acao==="lerPlaca")           return resposta(lerPlaca(d.frame));
    if(d.acao==="lerDocumento")       return resposta(lerDocumento(d.frame,d.tipo));
    if(d.acao==="lerTransportadora")  return resposta(lerTransportadora(d.frame));
    if(d.acao==="testarIA")           return resposta(testarIAapi());
    // NFA via app
    if(d.acao==="salvarContratoNFA")  return resposta(salvarContratoNFA(d.dados));
    if(d.acao==="listarContratosNFA") return resposta(listarContratosNFA(d.filtros||{}));
    if(d.acao==="montarDadosNFA")     return resposta(montarDadosNFA(d.ticket_id,d.contrato_id));
    return resposta({ok:false,erro:"Acao desconhecida: "+d.acao});
  }catch(err){return resposta({ok:false,erro:err.message});}
}

// ═══════════════════════════════════════════════════════════════
// MÓDULO NFA — Contratos e Emissão
// ═══════════════════════════════════════════════════════════════
// ── ABA ÚNICA "Contratos" — contrato completo (carregamento + NFA) ──
var ABA_CONTRATOS = "Contratos";
var ABA_CONTRATOS_NFA = "Contratos"; // alias compat

var COL = {
  ID:1, EMITENTE:2, TIPO_NOTA:3,
  DEST_IE:4, DEST_CNPJ:5, DEST_NOME:6, DEST_EMAIL:7, DEST_WA:8,
  GRUPO:9, TIPO_OP:10, PRODUTO:11, UNIDADE:12,
  VALOR_UNIT:13, VOL_TOTAL:14, VOL_ENTREGUE:15, SALDO:16,
  SAFRA:17, ORIGEM:18, RESP_FRETE:19, INFO_COMP:20,
  BALANCA:21,
  WA_CLASSIFICADOR:22, WA_COMPRADOR:23, EMAIL_CLASSIFICADOR:24, EMAIL_COMPRADOR:25,
  STATUS:26, CRIADO_EM:27, OBS:28, DISP_LEGAL:29
};
var NUM_COLS_CONTRATO = 29;

// Monta linha completa de 28 colunas
function montarLinhaContrato(d, volEntregue, criadoEm, status){
  var row=new Array(NUM_COLS_CONTRATO).fill("");
  row[COL.ID-1]=s(d.id);
  row[COL.EMITENTE-1]=s(d.emitente);
  row[COL.TIPO_NOTA-1]=s(d.tipo_nota||"NORMAL");
  row[COL.DEST_IE-1]=s(d.destinatario_ie);
  row[COL.DEST_CNPJ-1]=s(d.destinatario_cnpj);
  row[COL.DEST_NOME-1]=s(d.destinatario_nome);
  row[COL.DEST_EMAIL-1]=s(d.destinatario_email);
  row[COL.DEST_WA-1]=s(d.destinatario_whatsapp);
  row[COL.GRUPO-1]=s(d.grupo_produto);
  row[COL.TIPO_OP-1]=s(d.tipo_operacao);
  row[COL.PRODUTO-1]=s(d.produto);
  row[COL.UNIDADE-1]=s(d.unidade||"KG");
  row[COL.VALOR_UNIT-1]=n(d.valor_unitario);
  row[COL.VOL_TOTAL-1]=n(d.volume_total);
  row[COL.VOL_ENTREGUE-1]=volEntregue;
  row[COL.SALDO-1]=n(d.volume_total)-volEntregue;
  row[COL.SAFRA-1]=s(d.safra);
  row[COL.ORIGEM-1]=s(d.origem_mercadoria);
  row[COL.RESP_FRETE-1]=s(d.responsavel_frete);
  row[COL.INFO_COMP-1]=s(d.info_complementar);
  row[COL.BALANCA-1]=d.balanca!=null&&d.balanca!==""?n(d.balanca):"";
  row[COL.WA_CLASSIFICADOR-1]=s(d.wa_classificador||"");
  row[COL.WA_COMPRADOR-1]=s(d.wa_comprador||"");
  row[COL.EMAIL_CLASSIFICADOR-1]=s(d.email_classificador||"");
  row[COL.EMAIL_COMPRADOR-1]=s(d.email_comprador||"");
  row[COL.STATUS-1]=status;
  row[COL.CRIADO_EM-1]=criadoEm;
  row[COL.OBS-1]=s(d.obs||"");
  row[COL.DISP_LEGAL-1]=s(d.dispositivo_legal||"");
  return row;
}

// Converte uma linha (array) em objeto contrato
function linhaParaContrato(r, idx){
  return {
    id:s(r[COL.ID-1]), emitente:s(r[COL.EMITENTE-1]), tipo_nota:s(r[COL.TIPO_NOTA-1]),
    destinatario_ie:s(r[COL.DEST_IE-1]), destinatario_cnpj:s(r[COL.DEST_CNPJ-1]), destinatario_nome:s(r[COL.DEST_NOME-1]),
    destinatario_email:s(r[COL.DEST_EMAIL-1]), destinatario_whatsapp:s(r[COL.DEST_WA-1]),
    grupo_produto:s(r[COL.GRUPO-1]), tipo_operacao:s(r[COL.TIPO_OP-1]), produto:s(r[COL.PRODUTO-1]), unidade:s(r[COL.UNIDADE-1]),
    valor_unitario:n(r[COL.VALOR_UNIT-1]), volume_total:n(r[COL.VOL_TOTAL-1]), volume_entregue:n(r[COL.VOL_ENTREGUE-1]), saldo:n(r[COL.SALDO-1]),
    safra:s(r[COL.SAFRA-1]), origem_mercadoria:s(r[COL.ORIGEM-1]), responsavel_frete:s(r[COL.RESP_FRETE-1]),
    info_complementar:s(r[COL.INFO_COMP-1]), balanca:n(r[COL.BALANCA-1])||1,
    wa_classificador:s(r[COL.WA_CLASSIFICADOR-1]), wa_comprador:s(r[COL.WA_COMPRADOR-1]),
    email_classificador:s(r[COL.EMAIL_CLASSIFICADOR-1]), email_comprador:s(r[COL.EMAIL_COMPRADOR-1]),
    status:s(r[COL.STATUS-1]),
    criado_em:fmtDH(r[COL.CRIADO_EM-1]), obs:s(r[COL.OBS-1]),
    dispositivo_legal:s(r[COL.DISP_LEGAL-1]), linha:idx
  };
}

// ── Listar Contratos NFA ─────────────────────────────────────
function listarContratosNFA(filtros){ return listarContratosUnico(filtros); }

// ── Salvar Contrato NFA ──────────────────────────────────────
function salvarContratoNFA(dados){ return salvarContratoUnico(dados); }

// ── Atualizar volume entregue no contrato NFA ────────────────
function atualizarVolumeContratoNFA(contrato_id,sacas){
  try{
    var ss=SpreadsheetApp.openById(PLANILHA_ID);
    var aba=ss.getSheetByName(ABA_CONTRATOS);
    if(!aba) return{ok:false,erro:"Aba não encontrada"};
    var dados=aba.getDataRange().getValues();
    for(var i=1;i<dados.length;i++){
      if(s(dados[i][COL.ID-1])===s(contrato_id)){
        var entregue=n(dados[i][COL.VOL_ENTREGUE-1])+n(sacas);
        var total=n(dados[i][COL.VOL_TOTAL-1]);
        var saldo=total-entregue;
        aba.getRange(i+1,COL.VOL_ENTREGUE,1,2).setValues([[entregue,saldo]]);
        if(saldo<=0) aba.getRange(i+1,COL.STATUS).setValue("Encerrado");
        return{ok:true,entregue:entregue,saldo:saldo};
      }
    }
    return{ok:false,erro:"Contrato não encontrado: "+contrato_id};
  }catch(e){return{ok:false,erro:e.message};}
}

// ── Montar dados para NFA ────────────────────────────────────
function montarDadosNFA(ticket_id,contrato_id){
  try{
    var ss=SpreadsheetApp.openById(PLANILHA_ID);
    var shP=ss.getSheetByName("Pesagem");
    var ticket=null;
    if(shP&&shP.getLastRow()>1){
      var hdrs=shP.getRange(1,1,1,shP.getLastColumn()).getValues()[0];
      var rows=shP.getRange(2,1,shP.getLastRow()-1,shP.getLastColumn()).getValues();
      for(var i=0;i<rows.length;i++){
        if(s(rows[i][0])===s(ticket_id)){
          ticket={};
          hdrs.forEach(function(h,j){ticket[h]=rows[i][j];});
          break;
        }
      }
    }
    if(!ticket) return{ok:false,erro:"Ticket não encontrado: "+ticket_id};

    // Contrato: usa o vínculo do ticket (Num_Ordem) se contrato_id não vier
    var idContrato = contrato_id || s(ticket["Num_Ordem"]);
    if(!idContrato) return{ok:false,erro:"Ticket sem contrato vinculado"};

    var res=listarContratosUnico({});
    var contrato=(res.contratos||[]).find(function(c){return c.id===idContrato;});
    if(!contrato) return{ok:false,erro:"Contrato não encontrado: "+idContrato};

    var emit=EMITENTES[contrato.emitente]||{nome:contrato.emitente,ie:"",cpf:""};
    var pesoLiqKg=n(ticket["Carga_t"]||ticket["cargaLiquida"]||0)*1000;
    var pesoBrKg=n(ticket["Bruto_t"]||ticket["pesoBruto"]||0)*1000;

    // ── Quantidade deste ticket (KG ou cabeças, conforme tipo de nota) ──
    var qtdTicket = contrato.tipo_nota==="GADO"
      ? n(ticket["Cabecas"]||ticket["qtdCabecas"]||1)
      : Math.round(pesoLiqKg);

    // ── Saldo do contrato APÓS descontar este ticket ──
    var saldoAtual   = n(contrato.volume_total) - n(contrato.volume_entregue);
    var saldoProximo = saldoAtual - qtdTicket;
    var unid = contrato.unidade || "KG";
    function fmtNum(x){ return Number(x).toLocaleString("pt-BR"); }

    // ── Motorista e CPF (vêm do ticket de pesagem) ──
    var motorista = s(ticket["Motorista"]||ticket["motorista"]||"");
    var cpfMot    = s(ticket["CPF"]||ticket["cpf"]||"");

    // ── Informações Complementares da NFA ──
    var infoNFA =
      "CONTRATO: " + contrato.id + "\n" +
      "VOLUME CONTRATO: " + fmtNum(contrato.volume_total) + " " + unid + "\n" +
      "SALDO DO CONTRATO: " + fmtNum(saldoProximo) + " " + unid + "\n" +
      (motorista ? "MOTORISTA: " + motorista + "\n" : "") +
      (cpfMot ? "CPF: " + cpfMot + "\n" : "") +
      (contrato.info_complementar ? contrato.info_complementar : "");
    infoNFA = infoNFA.replace(/\n+$/,""); // remove quebras sobrando no fim

    var nfa={
      emitente:contrato.emitente,emitente_nome:emit.nome,emitente_ie:emit.ie,
      tipo_nota:contrato.tipo_nota||"NORMAL",
      destinatario_ie:contrato.destinatario_ie,
      destinatario_cnpj:contrato.destinatario_cnpj,
      destinatario_nome:contrato.destinatario_nome,
      destinatario_email:contrato.destinatario_email,
      destinatario_whatsapp:contrato.destinatario_whatsapp,
      transportadora_cnpj:s(ticket["Transp_CNPJ"]||ticket["transpCnpj"]||ticket["CNPJ_Transp"]||""),
      transportadora_nome:s(ticket["Transp_Nome"]||ticket["transpNome"]||""),
      placa:s(ticket["Placa"]||ticket["placa"]||""),
      uf_veiculo:s(ticket["Estado"]||ticket["estado"]||"GO"),
      municipio_veiculo:s(ticket["Municipio"]||ticket["municipio"]||""),
      data_transporte:fmtD(ticket["Data"]||ticket["dataEntrada"]||new Date()),
      peso_bruto_kg:String(Math.round(pesoBrKg)),
      peso_liquido_kg:String(Math.round(pesoLiqKg)),
      origem_mercadoria:contrato.origem_mercadoria,
      responsavel_frete:contrato.responsavel_frete,
      produtos:[{
        grupo:contrato.grupo_produto,
        tipo_operacao:contrato.tipo_operacao,
        dispositivo_legal:contrato.dispositivo_legal||"",
        produto:contrato.produto,
        unidade:contrato.unidade||"KG",
        quantidade:contrato.tipo_nota==="GADO"
          ? String(n(ticket["Cabecas"]||ticket["qtdCabecas"]||1))
          : String(Math.round(pesoLiqKg)),
        valor_unitario:String(contrato.valor_unitario),
        obs:""
      }],
      info_complementar:infoNFA,
      ticket_id:ticket_id,
      contrato_id:idContrato
    };
    return{ok:true,nfa:nfa};
  }catch(e){return{ok:false,erro:e.message};}
}

// ── [NFA-AUTORIZACAO] Autorizar emissão da NFA (gravado na aba Pesagem) ──
// Colunas 28/29/30 da aba "Pesagem": NFA_Autorizada | NFA_Autorizada_Por | NFA_Autorizada_Em
function autorizarNFA(ticket_id, por){
  try{
    var ss=SpreadsheetApp.openById(PLANILHA_ID);
    var sh=ss.getSheetByName("Pesagem");
    if(!sh||sh.getLastRow()<2) return {ok:false,erro:"Sem pesagens"};
    var ids=sh.getRange(2,1,sh.getLastRow()-1,1).getValues();
    for(var i=0;i<ids.length;i++){
      if(s(ids[i][0])===s(ticket_id)){
        var row=i+2;
        sh.getRange(row,28).setValue("Sim");
        sh.getRange(row,29).setValue(s(por));
        sh.getRange(row,30).setValue(agora());
        return {ok:true};
      }
    }
    return {ok:false,erro:"Ticket não encontrado: "+ticket_id};
  }catch(e){return {ok:false,erro:e.message};}
}

// ── Processar NFA pós-emissão ────────────────────────────────
function processarNFA(payload){
  try{
    var pdf_base64=payload.pdf_base64;
    var emitente=s(payload.emitente);
    var emitente_nome=s(payload.emitente_nome);
    var dest_nome=s(payload.destinatario_nome);
    var dest_email=s(payload.destinatario_email);
    var dest_wa=s(payload.destinatario_whatsapp);
    var ticket_id=s(payload.ticket_id);
    var contrato_id=s(payload.contrato_id);
    var produtos=payload.produtos||[];

    var driveRes=salvarPDFnfa(pdf_base64,emitente,dest_nome);
    var drive_url=driveRes.url;
    var numero_nfa=driveRes.numero_nfa;
    var nome_arquivo=driveRes.nome;

    if(dest_email){
      enviarEmailNFA(dest_email,dest_nome,emitente_nome,numero_nfa,drive_url,pdf_base64,nome_arquivo,produtos);
    }

    var msg=montarMsgWA(dest_nome,emitente_nome,numero_nfa,drive_url,produtos);
    var links_wa=[];
    if(dest_wa) links_wa.push(montarLinkWA(dest_wa,msg));
    var msg_int="✅ *NFA Emitida - FAV*\nEmitente: "+emitente_nome+"\nDestinatário: "+dest_nome+"\nTicket: "+ticket_id+"\nContrato: "+contrato_id+"\nDrive: "+drive_url;
    links_wa.push(montarLinkWA(FAV_WA_ESCRITORIO,msg_int));

    var pesoKg=0;
    produtos.forEach(function(p){pesoKg+=n(p.quantidade);});
    var sacas=Math.round(pesoKg/60);
    atualizarVolumeContratoNFA(contrato_id,sacas);

    registrarNFAEmitida(ticket_id,contrato_id,emitente,dest_nome,numero_nfa,drive_url,sacas);

    return{ok:true,drive_url:drive_url,numero_nfa:numero_nfa,links_whatsapp:links_wa,sacas_registradas:sacas};
  }catch(e){
    Logger.log("processarNFA erro: "+e.message);
    return{ok:false,erro:e.message};
  }
}

function salvarPDFnfa(pdf_base64,emitente,dest_nome){
  var agr=new Date();
  var ano=String(agr.getFullYear());
  var meses=["JANEIRO","FEVEREIRO","MARÇO","ABRIL","MAIO","JUNHO","JULHO","AGOSTO","SETEMBRO","OUTUBRO","NOVEMBRO","DEZEMBRO"];
  var mes=String(agr.getMonth()+1).padStart(2,"0")+"-"+meses[agr.getMonth()];
  var raiz=DriveApp.getFolderById(DRIVE_PASTA_NFA);
  var pEm=obterOuCriar(raiz,emitente.toUpperCase());
  var pAno=obterOuCriar(pEm,ano);
  var pMes=obterOuCriar(pAno,mes);
  var numero_nfa=extrairNumeroNFA(pdf_base64)||("T"+String(agr.getTime()).slice(-6));
  var dataStr=Utilities.formatDate(agr,Session.getScriptTimeZone(),"ddMMyyyy");
  var destNome=dest_nome.replace(/[^a-zA-ZÀ-ÿ0-9\s]/g,"").trim().toUpperCase().substring(0,30);
  var nome="NFA-"+numero_nfa+"-"+destNome+"-"+dataStr+".pdf";
  var blob=Utilities.newBlob(Utilities.base64Decode(pdf_base64),"application/pdf",nome);
  var arq=pMes.createFile(blob);
  arq.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);
  return{url:arq.getUrl(),numero_nfa:numero_nfa,nome:nome};
}

function obterOuCriar(parent,nome){
  var it=parent.getFoldersByName(nome);
  return it.hasNext()?it.next():parent.createFolder(nome);
}

function extrairNumeroNFA(b64){
  try{
    var txt=Utilities.base64Decode(b64).toString();
    var m=txt.match(/N[ºo°\.]\s*(\d{6,9})/i)||txt.match(/Nota\s+Fiscal.*?n[ºo°]\s*(\d+)/i);
    return m?m[1].padStart(6,"0"):null;
  }catch(e){return null;}
}

function enviarEmailNFA(para,dest_nome,emit_nome,numero_nfa,drive_url,pdf_base64,nome_arquivo,produtos){
  var data=Utilities.formatDate(new Date(),Session.getScriptTimeZone(),"dd/MM/yyyy");
  var linhas=produtos.map(function(p){
    var t=n(p.quantidade)*n(p.valor_unitario);
    return "<tr><td style='padding:6px 10px;border-bottom:1px solid #eee'>"+s(p.produto)+"</td>"+
      "<td style='padding:6px 10px;border-bottom:1px solid #eee;text-align:right'>"+Number(p.quantidade).toLocaleString("pt-BR")+" "+(p.unidade||"kg")+"</td>"+
      "<td style='padding:6px 10px;border-bottom:1px solid #eee;text-align:right'>R$ "+Number(p.valor_unitario).toFixed(4)+"</td>"+
      "<td style='padding:6px 10px;border-bottom:1px solid #eee;text-align:right'>R$ "+t.toLocaleString("pt-BR",{minimumFractionDigits:2})+"</td></tr>";
  }).join("");
  var html="<div style='font-family:Arial,sans-serif;max-width:600px;margin:0 auto'>"+
    "<div style='background:#1a3a6c;padding:20px;border-radius:8px 8px 0 0'>"+
    "<h2 style='color:white;margin:0'>📄 Nota Fiscal Avulsa</h2>"+
    "<p style='color:#aac4e8;margin:4px 0 0'>NFA Nº "+numero_nfa+" — "+data+"</p></div>"+
    "<div style='background:white;padding:24px;border:1px solid #ddd;border-top:none'>"+
    "<p>Prezado(a) <strong>"+dest_nome+"</strong>,</p>"+
    "<p>Segue a Nota Fiscal Avulsa emitida por <strong>"+emit_nome+"</strong>.</p>"+
    "<table style='width:100%;border-collapse:collapse;margin:16px 0;font-size:13px'>"+
    "<thead><tr style='background:#f5f5f5'>"+
    "<th style='padding:8px 10px;text-align:left;border-bottom:2px solid #ddd'>Produto</th>"+
    "<th style='padding:8px 10px;text-align:right;border-bottom:2px solid #ddd'>Qtd</th>"+
    "<th style='padding:8px 10px;text-align:right;border-bottom:2px solid #ddd'>Vlr. Unit.</th>"+
    "<th style='padding:8px 10px;text-align:right;border-bottom:2px solid #ddd'>Total</th></tr></thead>"+
    "<tbody>"+linhas+"</tbody></table>"+
    "<p><a href='"+drive_url+"' style='background:#1a3a6c;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:13px'>📥 Ver PDF no Drive</a></p>"+
    "<p style='color:#888;font-size:11px;margin-top:24px'>PDF também em anexo.<br>Fazenda Água Viva — FAV Sistema v2</p>"+
    "</div></div>";
  var pdfBlob=Utilities.newBlob(Utilities.base64Decode(pdf_base64),"application/pdf",nome_arquivo);
  GmailApp.sendEmail(para,"NFA Nº "+numero_nfa+" — "+emit_nome,"",{htmlBody:html,attachments:[pdfBlob],name:"FAV — Fazenda Água Viva"});
}

function montarMsgWA(dest_nome,emit_nome,numero_nfa,drive_url,produtos){
  var data=Utilities.formatDate(new Date(),Session.getScriptTimeZone(),"dd/MM/yyyy");
  var total=0;
  var linhas=produtos.map(function(p){
    var t=n(p.quantidade)*n(p.valor_unitario);total+=t;
    return "▪ "+s(p.produto)+": "+Number(p.quantidade).toLocaleString("pt-BR")+" "+(p.unidade||"kg")+" × R$ "+Number(p.valor_unitario).toFixed(4);
  }).join("\n");
  return "📄 *Nota Fiscal Avulsa — FAV*\n\nOlá *"+dest_nome+"*,\n\nSegue NFA emitida por *"+emit_nome+"*:\n\n"+
    "*NFA Nº:* "+numero_nfa+"\n*Data:* "+data+"\n\n*Produtos:*\n"+linhas+"\n\n"+
    "*Total:* R$ "+total.toLocaleString("pt-BR",{minimumFractionDigits:2})+"\n\n"+
    "📎 PDF: "+drive_url+"\n\n_Fazenda Água Viva — FAV Sistema v2_";
}

function montarLinkWA(numero,mensagem){
  return"https://wa.me/"+numero.replace(/\D/g,"")+"?text="+encodeURIComponent(mensagem);
}

function registrarNFAEmitida(ticket_id,contrato_id,emitente,dest_nome,numero_nfa,drive_url,sacas){
  try{
    var ss=SpreadsheetApp.openById(PLANILHA_ID);
    var aba=ss.getSheetByName("NFAs_Emitidas");
    if(!aba){
      aba=ss.insertSheet("NFAs_Emitidas");
      var cab=["Nº NFA","Ticket","Contrato","Emitente","Destinatário","Sacas","Data Emissão","Drive URL","Registrado Em"];
      aba.getRange(1,1,1,cab.length).setValues([cab]).setBackground("#1a3a6c").setFontColor("white").setFontWeight("bold");
      aba.setFrozenRows(1);
    }
    aba.appendRow([numero_nfa,ticket_id,contrato_id,emitente,dest_nome,sacas,
      Utilities.formatDate(new Date(),Session.getScriptTimeZone(),"dd/MM/yyyy"),drive_url,agora()]);
  }catch(e){Logger.log("registrarNFAEmitida: "+e.message);}
}

function criarAbaContratos(ss){
  var aba=ss.getSheetByName(ABA_CONTRATOS);
  if(aba) return aba;
  aba=ss.insertSheet(ABA_CONTRATOS);
  var cab=["ID","Emitente","Tipo_Nota","Dest_IE","Dest_CNPJ","Dest_Nome","Dest_Email","Dest_WA",
    "Grupo","Tipo_Operacao","Produto","Unidade","Valor_Unit","Vol_Total","Vol_Entregue","Saldo",
    "Safra","Origem","Resp_Frete","Info_Comp","Balanca",
    "WA_Classificador","WA_Comprador","Email_Classificador","Email_Comprador",
    "Status","Criado_Em","Obs","Dispositivo_Legal"];
  aba.getRange(1,1,1,cab.length).setValues([cab]).setBackground("#1a3a6c").setFontColor("white").setFontWeight("bold");
  aba.setFrozenRows(1);
  aba.autoResizeColumns(1,cab.length);
  return aba;
}
function criarAbaContratosNFA(ss){return criarAbaContratos(ss);}

// ── Listagem única (todos os contratos) ──
function listarContratosUnico(filtros){
  try{
    var ss=SpreadsheetApp.openById(PLANILHA_ID);
    var aba=ss.getSheetByName(ABA_CONTRATOS);
    if(!aba) aba=criarAbaContratos(ss);
    if(aba.getLastRow()<=1) return{ok:true,contratos:[]};
    var dados=aba.getDataRange().getValues();
    var lista=[];
    for(var i=1;i<dados.length;i++){
      var r=dados[i];if(!s(r[COL.ID-1]))continue;
      if(filtros&&filtros.status&&s(r[COL.STATUS-1])!==filtros.status)continue;
      if(filtros&&filtros.emitente&&s(r[COL.EMITENTE-1])!==filtros.emitente)continue;
      lista.push(linhaParaContrato(r,i+1));
    }
    return{ok:true,contratos:lista};
  }catch(e){return{ok:false,erro:e.message};}
}

// ── Salvamento único ──
function salvarContratoUnico(dados){
  try{
    var ss=SpreadsheetApp.openById(PLANILHA_ID);
    var aba=ss.getSheetByName(ABA_CONTRATOS);
    if(!aba) aba=criarAbaContratos(ss);
    var agr=new Date();
    if(dados.linha){
      var row=montarLinhaContrato(dados,n(dados.volume_entregue||0),s(dados.criado_em)||agora(),s(dados.status||"Ativo"));
      aba.getRange(dados.linha,1,1,NUM_COLS_CONTRATO).setValues([row]);
    }else{
      var id=dados.id||("CTR-"+agr.getFullYear()+"-"+String(aba.getLastRow()).padStart(4,"0"));
      dados.id=id;
      var row=montarLinhaContrato(dados,0,agora(),"Ativo");
      aba.appendRow(row);
    }
    return{ok:true,id:dados.id};
  }catch(e){return{ok:false,erro:e.message};}
}

// ══════════════════════════════════════════════════════════════
// EXPEDIÇÃO
// ══════════════════════════════════════════════════════════════
function salvarPesagem(o){
  var ss=SpreadsheetApp.openById(PLANILHA_ID);
  var sh=ss.getSheetByName("Pesagem");
  if(!sh){configurarPlanilha();sh=ss.getSheetByName("Pesagem");}
  if(sh.getLastRow()>1){
    var ids=sh.getRange(2,1,sh.getLastRow()-1,1).getValues();
    for(var i=0;i<ids.length;i++){if(s(ids[i][0])===s(o.id))return atualizarPesagem(o);}
  }
  var linha=[
    s(o.id),s(o.dataEntrada),s(o.horaEntrada),s(o.numOrdem),
    s(o.placa),s(o.motorista),s(o.cpf),
    n(o.eixosDianteiro||1),n(o.eixosSimples),n(o.eixosDuplos),n(o.eixosTriplos),
    n(o.totalEixos),s(o.formulaEixos),n(o.pbtMax||o.limPeso),
    n(o.tara),n(o.pesoBruto),n(o.cargaLiquida),
    s(o.status||"Aguardando"),s(o.funcionario),s(o.obs),
    s(o.dataHoraFim),o.assinatura?"Sim":"Nao",
    s(o.municipio),s(o.estado),b(o.longo)?"Sim":"Nao",
    s(o.transpCnpj),s(o.transpNome)
  ];
  sh.appendRow(linha);
  var row=sh.getLastRow();
  var st=s(o.statusPeso);
  var cor=st==="EXCEDIDO"?"#fce8e8":st==="ATENCAO"?"#fff3cd":st!==""?"#e8f5e9":"#fff9e6";
  sh.getRange(row,1,1,linha.length).setBackground(cor);
  if(st!==""){sh.getRange(row,18).setValue("Finalizado - "+st).setFontWeight("bold").setFontColor(st==="EXCEDIDO"?"#c0392b":"#1a5c45");}
  return{ok:true,id:s(o.id),row:row};
}

function atualizarPesagem(o){
  var ss=SpreadsheetApp.openById(PLANILHA_ID);
  var sh=ss.getSheetByName("Pesagem");
  if(!sh||sh.getLastRow()<2)return salvarPesagem(o);
  var ids=sh.getRange(2,1,sh.getLastRow()-1,1).getValues();
  var idx=-1;
  for(var i=0;i<ids.length;i++){if(s(ids[i][0])===s(o.id)){idx=i;break;}}
  if(idx<0)return salvarPesagem(o);
  var row=idx+2;
  var st=s(o.statusPeso);
  var cor=st==="EXCEDIDO"?"#fce8e8":"#e8f5e9";
  // Dados editáveis pelo Adm (validação/edição) — antes não eram persistidos
  if(o.numOrdem!==undefined)  sh.getRange(row,4).setValue(s(o.numOrdem));
  if(o.placa!==undefined)     sh.getRange(row,5).setValue(s(o.placa));
  if(o.motorista!==undefined) sh.getRange(row,6).setValue(s(o.motorista));
  if(o.cpf!==undefined)       sh.getRange(row,7).setValue(s(o.cpf));
  sh.getRange(row,15).setValue(n(o.tara));
  sh.getRange(row,16).setValue(n(o.pesoBruto));
  sh.getRange(row,17).setValue(n(o.cargaLiquida));
  sh.getRange(row,18).setValue(st!==""?"Finalizado - "+st:s(o.status));
  sh.getRange(row,21).setValue(s(o.dataHoraFim));
  sh.getRange(row,22).setValue(o.assinatura?"Sim":"Nao");
  sh.getRange(row,23).setValue(s(o.municipio));
  sh.getRange(row,24).setValue(s(o.estado));
  if(o.longo!==undefined)sh.getRange(row,25).setValue(b(o.longo)?"Sim":"Nao");
  if(o.transpCnpj!==undefined)sh.getRange(row,26).setValue(s(o.transpCnpj));
  if(o.transpNome!==undefined)sh.getRange(row,27).setValue(s(o.transpNome));
  if(st!==""){sh.getRange(row,1,1,25).setBackground(cor);sh.getRange(row,18).setFontWeight("bold").setFontColor(st==="EXCEDIDO"?"#c0392b":"#1a5c45");}
  if(st==="CONFORME"||st==="ATENÇÃO"||st==="EXCEDIDO"){_baixarEstoqueExpedicao(o);}
  return{ok:true,id:s(o.id),atualizado:true};
}

function listarPesagens(){
  var ss=SpreadsheetApp.openById(PLANILHA_ID);
  var sh=ss.getSheetByName("Pesagem");
  if(!sh||sh.getLastRow()<2)return{ok:true,ordens:[]};

  // Map de tickets com NFA emitida (nº + link do Drive) — aba NFAs_Emitidas
  var ticketsComNFA={};
  var shN=ss.getSheetByName("NFAs_Emitidas");
  if(shN&&shN.getLastRow()>1){
    var nfaRows=shN.getRange(2,1,shN.getLastRow()-1,8).getValues(); // Nº, Ticket, Contrato, ..., Drive URL(8)
    for(var k=0;k<nfaRows.length;k++){
      var tk=s(nfaRows[k][1]);
      if(tk) ticketsComNFA[tk]={numero:s(nfaRows[k][0]), drive:s(nfaRows[k][7])};
    }
  }

  var nCols=Math.min(sh.getLastColumn(),30); // [NFA-AUTORIZACAO] lê até col 30
  var dados=sh.getRange(2,1,sh.getLastRow()-1,nCols).getValues();
  var ordens=[];
  for(var i=0;i<dados.length;i++){
    var r=dados[i];if(!s(r[0]))continue;
    var st=s(r[17]);var sp=st.replace("Finalizado - ","").replace("Finalizado — ","");
    var idTicket=s(r[0]);
    ordens.push({
      id:idTicket,dataEntrada:fmtD(r[1]),horaEntrada:fmtH(r[2]),
      numOrdem:s(r[3]),placa:s(r[4]),motorista:s(r[5]),cpf:s(r[6]),
      eixosDianteiro:n(r[7]),eixosSimples:n(r[8]),eixosDuplos:n(r[9]),
      eixosTriplos:n(r[10]),totalEixos:n(r[11]),formulaEixos:s(r[12]),
      pbtMax:n(r[13]),limPeso:n(r[13]),tara:n(r[14]),
      pesoBruto:n(r[15]),cargaLiquida:n(r[16]),status:st,
      funcionario:s(r[18]),obs:s(r[19]),dataHoraFim:fmtDH(r[20]),statusPeso:sp,
      municipio:r[22]?s(r[22]):"",estado:r[23]?s(r[23]):"",
      longo:r[24]?s(r[24])==="Sim":false,
      transpCnpj:r[25]?s(r[25]):"",transpNome:r[26]?s(r[26]):"",
      nfa_emitida:!!ticketsComNFA[idTicket],
      nfa_numero:ticketsComNFA[idTicket]?ticketsComNFA[idTicket].numero:"",
      nfa_drive_url:ticketsComNFA[idTicket]?ticketsComNFA[idTicket].drive:"", // [NFA-AUTORIZACAO]
      nfa_autorizada:(r[27]?s(r[27])==="Sim":false),                          // [NFA-AUTORIZACAO] col 28
      nfa_autorizada_por:(r[28]?s(r[28]):"")                                   // [NFA-AUTORIZACAO] col 29
    });
  }
  return{ok:true,ordens:ordens};
}

function salvarContrato(c){
  // Compat: cadastro vindo do formato antigo de pesagem
  var dados={
    id:c.n, produto:c.p, safra:c.safra, volume_total:c.vol, obs:c.o,
    balanca:n(c.bal)||1, emitente:c.emitente, tipo_nota:c.tipo_nota,
    destinatario_nome:c.destinatario_nome, destinatario_ie:c.destinatario_ie,
    destinatario_cnpj:c.destinatario_cnpj, destinatario_email:c.destinatario_email,
    destinatario_whatsapp:c.destinatario_whatsapp, grupo_produto:c.grupo_produto,
    tipo_operacao:c.tipo_operacao, unidade:c.unidade, valor_unitario:c.valor_unitario,
    origem_mercadoria:c.origem_mercadoria, responsavel_frete:c.responsavel_frete,
    info_complementar:c.info_complementar, dispositivo_legal:c.dispositivo_legal,
    wa_classificador:c.waClas||c.wa_classificador, wa_comprador:c.waComp||c.wa_comprador,
    email_classificador:c.emClas||c.email_classificador, email_comprador:c.emComp||c.email_comprador
  };
  return salvarContratoUnico(dados);
}

function listarContratos(){
  var u=listarContratosUnico({});
  if(!u.ok) return u;
  var contratos=u.contratos.filter(function(c){return c.status!=="Inativo"&&c.status!=="Nao";})
    .map(function(c){
      return {n:c.id, d:c.criado_em, p:c.produto, safra:c.safra, vol:c.volume_total,
        o:c.obs, bal:c.balanca||1,
        waClas:c.wa_classificador||"", waComp:c.wa_comprador||"",
        emClas:c.email_classificador||"", emComp:c.email_comprador||""};
    });
  return{ok:true,contratos:contratos};
}

function delContrato(num){
  var ss=SpreadsheetApp.openById(PLANILHA_ID);var sh=ss.getSheetByName(ABA_CONTRATOS);
  if(!sh||sh.getLastRow()<2)return{ok:false};
  var dados=sh.getRange(2,1,sh.getLastRow()-1,NUM_COLS_CONTRATO).getValues();
  for(var i=0;i<dados.length;i++){
    if(s(dados[i][COL.ID-1])===s(num)){sh.getRange(i+2,COL.STATUS).setValue("Inativo");return{ok:true};}
  }
  return{ok:false};
}

// ══════════════════════════════════════════════════════════════
// RECEPÇÃO
// ══════════════════════════════════════════════════════════════
function salvarRecepcao(o){
  var ss=SpreadsheetApp.openById(PLANILHA_ID);
  var sh=ss.getSheetByName("Recepcao");
  if(!sh){configurarPlanilha();sh=ss.getSheetByName("Recepcao");}
  if(sh.getLastRow()>1){
    var ids=sh.getRange(2,1,sh.getLastRow()-1,1).getValues();
    for(var i=0;i<ids.length;i++){if(s(ids[i][0])===s(o.id))return atualizarRecepcao(o);}
  }
  var linha=[s(o.id),s(o.data),s(o.hora),s(o.safra),s(o.talhaoCod),s(o.talhaoNome),s(o.cultura),s(o.variedade),s(o.placa),s(o.motorista),s(o.cpf),s(o.tipoCaminhao),n(o.balanca)||0,n(o.tara),n(o.bruto),n(o.umidade),n(o.impureza),n(o.descUmidadeKg),n(o.descImpurezaKg),n(o.pesoLiquidoKg),n(o.sacas),n(o.scHa),s(o.status||"Finalizado"),s(o.funcionario),s(o.dataHoraFim||agora()),s(o.obs)];
  sh.appendRow(linha);
  sh.getRange(sh.getLastRow(),1,1,linha.length).setBackground("#e8f5e9");
  _somarEstoqueRecepcao(s(o.safra),s(o.cultura),n(o.sacas));
  return{ok:true,id:s(o.id)};
}

function atualizarRecepcao(o){
  var ss=SpreadsheetApp.openById(PLANILHA_ID);var sh=ss.getSheetByName("Recepcao");
  if(!sh||sh.getLastRow()<2)return salvarRecepcao(o);
  var ids=sh.getRange(2,1,sh.getLastRow()-1,1).getValues();
  for(var i=0;i<ids.length;i++){
    if(s(ids[i][0])===s(o.id)){
      var row=i+2;
      sh.getRange(row,13).setValue(n(o.tara));sh.getRange(row,14).setValue(n(o.bruto));
      sh.getRange(row,15).setValue(n(o.umidade));sh.getRange(row,16).setValue(n(o.impureza));
      sh.getRange(row,17).setValue(n(o.descUmidadeKg));sh.getRange(row,18).setValue(n(o.descImpurezaKg));
      sh.getRange(row,19).setValue(n(o.pesoLiquidoKg));sh.getRange(row,20).setValue(n(o.sacas));sh.getRange(row,21).setValue(n(o.scHa));
      sh.getRange(row,22).setValue(s(o.status||"Finalizado"));sh.getRange(row,24).setValue(s(o.dataHoraFim||agora()));
      return{ok:true,atualizado:true};
    }
  }
  return salvarRecepcao(o);
}

function listarRecepcoes(){
  var ss=SpreadsheetApp.openById(PLANILHA_ID);var sh=ss.getSheetByName("Recepcao");
  if(!sh||sh.getLastRow()<2)return{ok:true,recepcoes:[]};
  var dados=sh.getRange(2,1,sh.getLastRow()-1,25).getValues();
  var lista=[];
  for(var i=0;i<dados.length;i++){
    var r=dados[i];if(!s(r[0]))continue;
    lista.push({id:s(r[0]),data:fmtD(r[1]),hora:fmtH(r[2]),safra:s(r[3]),talhaoCod:s(r[4]),talhaoNome:s(r[5]),cultura:s(r[6]),variedade:s(r[7]),placa:s(r[8]),motorista:s(r[9]),cpf:s(r[10]),tipoCaminhao:s(r[11]),balanca:n(r[12]),tara:n(r[13]),bruto:n(r[13]),umidade:n(r[14]),impureza:n(r[15]),descUmidadeKg:n(r[16]),descImpurezaKg:n(r[17]),pesoLiquidoKg:n(r[18]),sacas:n(r[19]),scHa:n(r[20]),status:s(r[21]),funcionario:s(r[22]),dataHoraFim:fmtDH(r[23]),obs:s(r[24])});
  }
  return{ok:true,recepcoes:lista};
}

// ══════════════════════════════════════════════════════════════
// TALHÕES
// ══════════════════════════════════════════════════════════════
function salvarTalhao(t){
  var ss=SpreadsheetApp.openById(PLANILHA_ID);var sh=ss.getSheetByName("Talhoes");
  if(!sh){configurarPlanilha();sh=ss.getSheetByName("Talhoes");}
  if(sh.getLastRow()>1){
    var todos=sh.getRange(2,1,sh.getLastRow()-1,6).getValues();
    for(var i=0;i<todos.length;i++){
      if(s(todos[i][0])===s(t.cod)&&s(todos[i][2])===s(t.safra)&&s(todos[i][5])===s(t.variedade)){
        var row=i+2;
        sh.getRange(row,2).setValue(s(t.nome));sh.getRange(row,4).setValue(n(t.areaTotal));
        sh.getRange(row,5).setValue(s(t.cultura));sh.getRange(row,7).setValue(n(t.areaVariedade));
        sh.getRange(row,8).setValue(s(t.ativo||"Sim"));sh.getRange(row,10).setValue(s(t.obs));
        return{ok:true,atualizado:true};
      }
    }
  }
  sh.appendRow([s(t.cod),s(t.nome),s(t.safra),n(t.areaTotal),s(t.cultura),s(t.variedade),n(t.areaVariedade),s(t.ativo||"Sim"),agora(),s(t.obs)]);
  return{ok:true,id:s(t.cod)};
}

function listarTalhoes(){
  var ss=SpreadsheetApp.openById(PLANILHA_ID);var sh=ss.getSheetByName("Talhoes");
  if(!sh||sh.getLastRow()<2)return{ok:true,talhoes:[]};
  var dados=sh.getRange(2,1,sh.getLastRow()-1,10).getValues();
  var lista=[];
  for(var i=0;i<dados.length;i++){
    var r=dados[i];if(!s(r[0])||s(r[7])==="Nao")continue;
    lista.push({cod:s(r[0]),nome:s(r[1]),safra:s(r[2]),areaTotal:n(r[3]),cultura:s(r[4]),variedade:s(r[5]),areaVariedade:n(r[6]),ativo:s(r[7]),obs:s(r[9])});
  }
  return{ok:true,talhoes:lista};
}

function delTalhao(cod){
  var ss=SpreadsheetApp.openById(PLANILHA_ID);var sh=ss.getSheetByName("Talhoes");
  if(!sh||sh.getLastRow()<2)return{ok:false};
  var cods=sh.getRange(2,1,sh.getLastRow()-1,1).getValues();
  for(var i=0;i<cods.length;i++){if(s(cods[i][0])===s(cod)){sh.getRange(i+2,8).setValue("Nao");return{ok:true};}}
  return{ok:false};
}

// ══════════════════════════════════════════════════════════════
// ESTOQUE
// ══════════════════════════════════════════════════════════════
function _somarEstoqueRecepcao(safra,cultura,sacas){if(!safra||!cultura||!sacas)return;_upsertEstoque(safra,cultura,sacas,0);}
function _baixarEstoqueExpedicao(o){
  var ss=SpreadsheetApp.openById(PLANILHA_ID);var sh=ss.getSheetByName(ABA_CONTRATOS);
  if(!sh||sh.getLastRow()<2)return;
  var dados=sh.getRange(2,1,sh.getLastRow()-1,NUM_COLS_CONTRATO).getValues();
  for(var i=0;i<dados.length;i++){
    if(s(dados[i][COL.ID-1])===s(o.numOrdem)){
      var cultura=s(dados[i][COL.PRODUTO-1]);var safra=s(dados[i][COL.SAFRA-1]);
      var sacas=n(o.cargaLiquida)*1000/60;
      _upsertEstoque(safra,cultura,0,sacas);return;
    }
  }
}
function _upsertEstoque(safra,cultura,addEntrada,addSaida){
  var ss=SpreadsheetApp.openById(PLANILHA_ID);var sh=ss.getSheetByName("Estoque");
  if(!sh){configurarPlanilha();sh=ss.getSheetByName("Estoque");}
  if(sh.getLastRow()>1){
    var dados=sh.getRange(2,1,sh.getLastRow()-1,5).getValues();
    for(var i=0;i<dados.length;i++){
      if(s(dados[i][0])===safra&&s(dados[i][1])===cultura){
        var row=i+2;var e=n(dados[i][2])+addEntrada;var sa=n(dados[i][3])+addSaida;
        sh.getRange(row,3).setValue(e);sh.getRange(row,4).setValue(sa);
        sh.getRange(row,5).setValue(Math.max(0,e-sa));sh.getRange(row,6).setValue(agora());return;
      }
    }
  }
  sh.appendRow([safra,cultura,addEntrada,addSaida,Math.max(0,addEntrada-addSaida),agora()]);
}
function listarEstoque(){
  var ss=SpreadsheetApp.openById(PLANILHA_ID);var sh=ss.getSheetByName("Estoque");
  if(!sh||sh.getLastRow()<2)return{ok:true,estoque:[],comprometido:{}};
  var dados=sh.getRange(2,1,sh.getLastRow()-1,6).getValues();
  var lista=[];
  for(var i=0;i<dados.length;i++){
    var r=dados[i];if(!s(r[0]))continue;
    lista.push({safra:s(r[0]),cultura:s(r[1]),entradas_sc:n(r[2]),saidas_sc:n(r[3]),saldo_sc:n(r[4]),atualizacao:fmtDH(r[5])});
  }
  return{ok:true,estoque:lista,comprometido:_calcComprometido()};
}
function _calcComprometido(){
  var ss=SpreadsheetApp.openById(PLANILHA_ID);var shC=ss.getSheetByName(ABA_CONTRATOS);var shP=ss.getSheetByName("Pesagem");
  if(!shC||shC.getLastRow()<2)return{};
  var contr=shC.getRange(2,1,shC.getLastRow()-1,NUM_COLS_CONTRATO).getValues();
  var comp={};
  for(var i=0;i<contr.length;i++){
    var r=contr[i];
    if(!s(r[COL.ID-1])||s(r[COL.STATUS-1])==="Inativo"||s(r[COL.STATUS-1])==="Nao")continue;
    var num=s(r[COL.ID-1]);var cultura=s(r[COL.PRODUTO-1]);var safra=s(r[COL.SAFRA-1]);var vol=n(r[COL.VOL_TOTAL-1]);
    var chave=safra+"|"+cultura;
    if(!comp[chave])comp[chave]={safra:safra,cultura:cultura,comprometido_sc:0};
    var jaCarregado=0;
    if(shP&&shP.getLastRow()>1){
      var pesos=shP.getRange(2,1,shP.getLastRow()-1,17).getValues();
      for(var j=0;j<pesos.length;j++){var p=pesos[j];if(s(p[3])===num&&s(p[17]).indexOf("Finalizado")>=0){jaCarregado+=n(p[16])*1000/60;}}
    }
    comp[chave].comprometido_sc+=Math.max(0,vol-jaCarregado);
  }
  return comp;
}

// ══════════════════════════════════════════════════════════════
// AUDIT LOG
// ══════════════════════════════════════════════════════════════
function registrarAudit(log){
  try{
    var ss=SpreadsheetApp.openById(PLANILHA_ID);var sh=ss.getSheetByName("Audit_Log");
    if(!sh){configurarPlanilha();sh=ss.getSheetByName("Audit_Log");}
    sh.appendRow([agora(),s(log.funcionario),s(log.modulo),s(log.acao),s(log.idRegistro),s(log.campo),s(log.valorAnt),s(log.valorNovo)]);
    return{ok:true};
  }catch(e){return{ok:false,erro:e.message};}
}

// ══════════════════════════════════════════════════════════════
// FOTOS
// ══════════════════════════════════════════════════════════════
function salvarFoto(dados,pasta){
  var ref=s(dados.contrato||dados.ref)||"SEM-REF";var data=s(dados.data).replace(/\//g,"-")||"SEM-DATA";
  var placa=s(dados.placa)||"SEM-PLACA";var tipo=s(dados.tipo)||"foto";
  var base64=s(dados.base64);var mime=s(dados.mime)||"image/jpeg";
  var ext=mime.indexOf("png")>=0?".png":".jpg";
  var nome=ref+"."+data+"."+placa+"."+tipo+ext;
  var raiz=DriveApp.getFolderById(DRIVE_ID);var pastaNome=pasta||"Fotos";var pastaObj;
  var it=raiz.getFoldersByName(pastaNome);pastaObj=it.hasNext()?it.next():raiz.createFolder(pastaNome);
  var sub;var it2=pastaObj.getFoldersByName(ref);sub=it2.hasNext()?it2.next():pastaObj.createFolder(ref);
  var bytes=Utilities.base64Decode(base64);var blob=Utilities.newBlob(bytes,mime,nome);
  var arq=sub.createFile(blob);arq.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);
  return{ok:true,nome:nome,url:arq.getUrl()};
}

// ══════════════════════════════════════════════════════════════
// BACKUP
// ══════════════════════════════════════════════════════════════
function backupSemanal(){
  try{
    var ss=SpreadsheetApp.openById(PLANILHA_ID);
    var now=Utilities.formatDate(new Date(),Session.getScriptTimeZone(),"yyyy-MM-dd");
    var nome="FAV-v2-backup-"+now;
    var raiz=DriveApp.getFolderById(DRIVE_ID);var bp;
    var it=raiz.getFoldersByName("Backup");bp=it.hasNext()?it.next():raiz.createFolder("Backup");
    var copia=ss.copy(nome);DriveApp.getFileById(copia.getId()).moveTo(bp);
    var shB=ss.getSheetByName("Backup_Info")||ss.insertSheet("Backup_Info");
    if(shB.getLastRow()<1)shB.appendRow(["Data","Nome","URL","Status","Obs"]);
    shB.appendRow([agora(),nome,copia.getUrl(),"OK","Backup automático semanal"]);
    _limparBackupsAntigos(bp,12);return{ok:true,nome:nome};
  }catch(e){return{ok:false,erro:e.message};}
}
function _limparBackupsAntigos(pasta,manter){
  var files=[];var it=pasta.getFiles();while(it.hasNext())files.push(it.next());
  if(files.length<=manter)return;
  files.sort(function(a,b){return a.getDateCreated()-b.getDateCreated();});
  for(var i=0;i<files.length-manter;i++)files[i].setTrashed(true);
}
function criarTriggerBackup(){
  ScriptApp.getProjectTriggers().forEach(function(t){if(t.getHandlerFunction()==="backupSemanal")ScriptApp.deleteTrigger(t);});
  ScriptApp.newTrigger("backupSemanal").timeBased().everyWeeks(1).onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(2).create();
  SpreadsheetApp.getUi().alert("✅ Trigger criado! Backup toda segunda-feira às 02h.");
}

// ══════════════════════════════════════════════════════════════
// CONFIGURAR PLANILHA
// ══════════════════════════════════════════════════════════════
function configurarPlanilha(){
  var ss=SpreadsheetApp.openById(PLANILHA_ID);var cor="#1a5c45";
  function cab(sh,cols,c){sh.getRange(1,1,1,cols.length).setValues([cols]).setBackground(c||cor).setFontColor("#fff").setFontWeight("bold");sh.setFrozenRows(1);}
  var shP=ss.getSheetByName("Pesagem")||ss.insertSheet("Pesagem");
  // [NFA-AUTORIZACAO] colunas 28-30 acrescentadas ao fim
  cab(shP,["ID","Data","Hora","Num_Ordem","Placa","Motorista","CPF","Eixo_Diant","Eixos_S","Eixos_D","Eixos_T","Total_Eixos","Formula_Eixos","PBT_Max_t","Tara_t","Bruto_t","Carga_t","Status","Funcionario","Obs","DataHora_Fim","Assinatura","Municipio","Estado","Longo","Transp_CNPJ","Transp_Nome","NFA_Autorizada","NFA_Autorizada_Por","NFA_Autorizada_Em"]);
  criarAbaContratos(ss); // aba única Contratos (completo)
  var shR=ss.getSheetByName("Recepcao")||ss.insertSheet("Recepcao");
  cab(shR,["ID","Data","Hora","Safra","Talhao_Cod","Talhao_Nome","Cultura","Variedade","Placa","Motorista","CPF","Tipo_Caminhao","Balanca","Tara_t","Bruto_t","Umidade_pct","Impureza_pct","Desc_Umidade_kg","Desc_Impureza_kg","Peso_Liquido_kg","Sacas","sc_ha","Status","Funcionario","DataHora_Fim","Obs"]);
  var shT=ss.getSheetByName("Talhoes")||ss.insertSheet("Talhoes");
  cab(shT,["Codigo","Nome","Safra","Area_Total_ha","Cultura","Variedade","Area_Variedade_ha","Ativo","Criado_Em","Obs"]);
  var shE=ss.getSheetByName("Estoque")||ss.insertSheet("Estoque");
  cab(shE,["Safra","Cultura","Entradas_sc","Saidas_sc","Saldo_sc","Ultima_Atualizacao"],"#0f6e56");
  var shA=ss.getSheetByName("Audit_Log")||ss.insertSheet("Audit_Log");
  cab(shA,["Timestamp","Funcionario","Modulo","Acao","ID_Registro","Campo","Valor_Anterior","Valor_Novo"],"#333");
  var shBI=ss.getSheetByName("Backup_Info")||ss.insertSheet("Backup_Info");
  cab(shBI,["Data","Nome","URL","Status","Obs"],"#555");
  SpreadsheetApp.getUi().alert("✅ FAV v2 — Planilha configurada!\nAbas criadas incluindo Contratos e NFAs_Emitidas.");
}

function onOpen(){
  SpreadsheetApp.getUi().createMenu("FAV v2")
    .addItem("⚙️ Configurar planilha","configurarPlanilha")
    .addItem("💾 Backup agora","backupSemanal")
    .addItem("🔁 Criar trigger backup semanal","criarTriggerBackup")
    .addItem("🧪 Testar Drive","testarDrive")
    .addItem("📋 Testar pesagens","testeListar")
    .addItem("📦 Testar estoque","testeEstoque")
    .addItem("🤖 Testar IA","testeIA")
    .addItem("📄 Criar/verificar aba Contratos","criarAbaContratosMenu")
    .addSeparator()
    .addItem("📊 Atualizar Painel","atualizarPainel")
    .addToUi();
}

function criarAbaContratosMenu(){criarAbaContratos(SpreadsheetApp.openById(PLANILHA_ID));SpreadsheetApp.getUi().alert("✅ Aba Contratos verificada/criada!");}
function testarDrive(){try{var p=DriveApp.getFolderById(DRIVE_ID);SpreadsheetApp.getUi().alert("✅ Drive OK: "+p.getName());}catch(e){SpreadsheetApp.getUi().alert("❌ Erro: "+e.message);}}
function testeListar(){try{var r=listarPesagens();SpreadsheetApp.getUi().alert("✅ Pesagens: "+r.ordens.length);}catch(e){SpreadsheetApp.getUi().alert("❌ "+e.message);}}
function testeEstoque(){try{var r=listarEstoque();SpreadsheetApp.getUi().alert("✅ Estoque:\n"+JSON.stringify(r.estoque,null,2));}catch(e){SpreadsheetApp.getUi().alert("❌ "+e.message);}}

// ══════════════════════════════════════════════════════════════
// MÓDULO IA — Leitura com Claude Haiku
// ══════════════════════════════════════════════════════════════
var ANTHROPIC_KEY = PropertiesService.getScriptProperties().getProperty("ANTHROPIC_KEY")||"";
var ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
var MODELO_IA     = "claude-haiku-4-5-20251001";

function lerDisplay(frames,contexto){
  if(!ANTHROPIC_KEY)return{ok:false,erro:"ANTHROPIC_KEY não configurada"};
  if(!frames||!frames.length)return{ok:false,erro:"Nenhum frame enviado"};
  frames=frames.slice(0,3);
  for(var fi=0;fi<frames.length;fi++){if(frames[fi]&&frames[fi].base64&&frames[fi].base64.length>3000000)return{ok:false,erro:"Imagem muito grande (frame "+(fi+1)+") — reduza a resolução da foto"};}
  var prompt="Você é um sistema especializado em leitura de balanças de caminhão. A imagem pode ser de DOIS tipos:\n\n(A) DISPLAY DIGITAL (LED/LCD): leia o número diretamente. Alguns dígitos podem piscar/apagar (efeito estroboscópio) — use o valor mais frequente entre os frames.\n\n(B) BALANÇA MECÂNICA DE BRAÇO (romana), com 3 réguas/cursores deslizantes. Neste caso SOME as três leituras, olhando a linha/seta indicadora de cada cursor (não os números vizinhos):\n1) Cursor PRINCIPAL (janela/régua superior, números grandes): valor em MILHARES de kg -> multiplique por 1000 (ex.: 37 -> 37000).\n2) Cursor das CENTENAS (régua do meio, marcas 0,100,...,900): use o valor apontado (ex.: 100).\n3) Cursor das DEZENAS (régua de baixo, marcas 0,10,20,...,90): use o valor apontado (ex.: 20).\nPeso = (principal x 1000) + centenas + dezenas. Exemplos REAIS desta balança: (a) 37 + 100 + 20 = 37120 kg; (b) 30 + 600 + 30 = 30630 kg; (c) 26 + 500 + 0 = 26500 kg.\n\nCONTEXTO: "+s(contexto||"Balança agrícola, peso em kg")+"\n\nREGRAS:\n- Retorne APENAS JSON, sem texto adicional\n- Peso em kg, número inteiro positivo\n- Valores típicos: entre 3.000 kg e 80.000 kg\n- Se a leitura for incerta (cursor entre marcas, foto ruim), retorne confianca: baixa\n\nFORMATO DE RESPOSTA (JSON puro, sem markdown):\n{\"peso_kg\": 37120, \"confianca\": \"alta\", \"tipo\": \"mecanica\", \"leituras\": [37120], \"obs\": \"\"}";
  var content=[];var framesValidos=0;
  frames.forEach(function(frame){if(!frame||!frame.base64)return;content.push({type:"image",source:{type:"base64",media_type:frame.mime||"image/jpeg",data:frame.base64}});framesValidos++;});
  if(framesValidos===0)return{ok:false,erro:"Nenhum frame válido"};
  content.push({type:"text",text:prompt});
  var payload={model:MODELO_IA,max_tokens:256,messages:[{role:"user",content:content}]};
  Logger.log("lerDisplay: enviando "+framesValidos+" frame(s)");
  var resp;
  try{resp=UrlFetchApp.fetch(ANTHROPIC_URL,{method:"post",headers:{"x-api-key":ANTHROPIC_KEY,"anthropic-version":"2023-06-01","content-type":"application/json"},payload:JSON.stringify(payload),muteHttpExceptions:true});}
  catch(e){return{ok:false,erro:"Erro de rede: "+e.message};}
  var code=resp.getResponseCode();var body=resp.getContentText();
  if(code!==200)return{ok:false,erro:"API erro "+code+": "+body.substring(0,300)};
  try{var j=JSON.parse(body);var txt=j.content&&j.content[0]?j.content[0].text:"";txt=txt.replace(/```json|```/g,"").trim();var resultado=JSON.parse(txt);if(resultado.peso_kg<1000||resultado.peso_kg>150000){resultado.confianca="baixa";resultado.obs=(resultado.obs||"")+" Peso fora da faixa esperada.";}return{ok:true,resultado:resultado};}
  catch(e){return{ok:false,erro:"Erro ao interpretar resposta da IA: "+e.message};}
}

function lerPlaca(frame){
  if(!ANTHROPIC_KEY)return{ok:false,erro:"ANTHROPIC_KEY não configurada"};
  if(!frame||!frame.base64)return{ok:false,erro:"Nenhuma imagem enviada"};
  var prompt="Leia a placa do veículo na imagem.\nRetorne APENAS JSON puro, sem texto adicional:\n{\"placa\": \"ABC1D23\", \"confianca\": \"alta\", \"obs\": \"\"}\n\nREGRAS:\n- Formato Mercosul: 3 letras + 1 número + 1 letra + 2 números (ex: ABC1D23)\n- Formato antigo: 3 letras + 4 números (ex: ABC1234)\n- Se não conseguir ler, retorne placa: null e confianca: baixa\n- Retorne apenas a placa, sem hífen ou espaço";
  var payload={model:MODELO_IA,max_tokens:128,messages:[{role:"user",content:[{type:"image",source:{type:"base64",media_type:frame.mime||"image/jpeg",data:frame.base64}},{type:"text",text:prompt}]}]};
  var resp;
  try{resp=UrlFetchApp.fetch(ANTHROPIC_URL,{method:"post",headers:{"x-api-key":ANTHROPIC_KEY,"anthropic-version":"2023-06-01","content-type":"application/json"},payload:JSON.stringify(payload),muteHttpExceptions:true});}
  catch(e){return{ok:false,erro:"Erro de rede: "+e.message};}
  if(resp.getResponseCode()!==200)return{ok:false,erro:"API erro "+resp.getResponseCode()};
  try{var j=JSON.parse(resp.getContentText());var txt=j.content&&j.content[0]?j.content[0].text.replace(/```json|```/g,"").trim():"{}";return{ok:true,resultado:JSON.parse(txt)};}
  catch(e){return{ok:false,erro:"Erro ao interpretar resposta: "+e.message};}
}

function lerDocumento(frame, tipo){
  if(!ANTHROPIC_KEY)return{ok:false,erro:"ANTHROPIC_KEY não configurada"};
  if(!frame||!frame.base64)return{ok:false,erro:"Nenhuma imagem enviada"};
  if(frame.base64.length>3000000)return{ok:false,erro:"Imagem muito grande — reduza a resolução da foto"};
  var prompt;
  if(String(tipo||"").toUpperCase()==="CNH"){
    // Prompt específico para CNH (Carteira Nacional de Habilitação)
    prompt="Analise esta CNH brasileira (Carteira Nacional de Habilitacao) e extraia SOMENTE dois dados do titular.\nRetorne APENAS JSON puro:\n{\"motorista\": \"NOME COMPLETO\", \"cpf\": \"000.000.000-00\", \"confianca\": \"alta\", \"obs\": \"\"}\n\nREGRAS IMPORTANTES:\n- motorista = valor do campo \"NOME\" (o titular da CNH), em MAIUSCULAS. NUNCA use os nomes do campo \"FILIACAO\" (pai/mae).\n- cpf = campo \"CPF\", formato 000.000.000-00 (11 digitos). NAO confundir com \"Nº REGISTRO\" (11 digitos, geralmente em vermelho) nem com \"DOC. IDENTIDADE / RG\".\n- Nao extraia nenhum outro campo. Retorne null para o que nao encontrar. Nao invente dados.";
  }else{
    prompt="Analise este documento de transporte agrícola (Nota Fiscal, CT-e, CRLV, Romaneio ou similar).\nExtraia as informações disponíveis e retorne APENAS JSON puro:\n{\"placa\": \"ABC1D23\", \"motorista\": \"NOME COMPLETO\", \"cpf\": \"000.000.000-00\", \"municipio\": \"Nome da cidade\", \"estado\": \"UF\", \"produto\": \"Soja\", \"peso_kg\": 25000, \"numero_doc\": \"000001\", \"emitente\": \"Nome da empresa\", \"confianca\": \"alta\", \"obs\": \"\"}\n\nREGRAS:\n- Retorne null para campos não encontrados\n- Nome do motorista em MAIÚSCULAS\n- Se for um CRLV (documento do veiculo): placa = campo PLACA; municipio e estado = campo LOCAL (ex.: 'CABECEIRAS GO' -> municipio 'Cabeceiras', estado 'GO')\n- Em NF/CT-e: municipio = cidade de origem ou destino do transporte\n- Estado: sempre a sigla de 2 letras (ex: GO, DF, MT)\n- Produto: nome genérico (Soja, Milho, etc)\n- Peso em kg como número inteiro\n- Não invente dados — null se não encontrar";
  }
  var payload={model:MODELO_IA,max_tokens:512,messages:[{role:"user",content:[{type:"image",source:{type:"base64",media_type:frame.mime||"image/jpeg",data:frame.base64}},{type:"text",text:prompt}]}]};
  var resp;
  try{resp=UrlFetchApp.fetch(ANTHROPIC_URL,{method:"post",headers:{"x-api-key":ANTHROPIC_KEY,"anthropic-version":"2023-06-01","content-type":"application/json"},payload:JSON.stringify(payload),muteHttpExceptions:true});}
  catch(e){return{ok:false,erro:"Erro de rede: "+e.message};}
  if(resp.getResponseCode()!==200)return{ok:false,erro:"API erro "+resp.getResponseCode()+": "+resp.getContentText().substring(0,300)};
  try{var j=JSON.parse(resp.getContentText());var txt=j.content&&j.content[0]?j.content[0].text.replace(/```json|```/g,"").trim():"{}";return{ok:true,resultado:JSON.parse(txt)};}
  catch(e){return{ok:false,erro:"Erro ao interpretar resposta: "+e.message};}
}

// Teste de IA chamável pelo app (Diagnóstico → Testar IA)
function testarIAapi(){
  if(!ANTHROPIC_KEY) return {ok:false, erro:'ANTHROPIC_KEY não configurada'};
  try{
    var resp=UrlFetchApp.fetch(ANTHROPIC_URL,{method:"post",headers:{"x-api-key":ANTHROPIC_KEY,"anthropic-version":"2023-06-01","content-type":"application/json"},payload:JSON.stringify({model:MODELO_IA,max_tokens:16,messages:[{role:"user",content:"Responda: OK"}]}),muteHttpExceptions:true});
    var code=resp.getResponseCode();
    if(code===200) return {ok:true, modelo:MODELO_IA};
    return {ok:false, codigo:code, erro:'API '+code+': '+resp.getContentText().substring(0,160)};
  }catch(e){ return {ok:false, erro:e.message}; }
}

// Aviso tolerante: usa o alerta da planilha; se rodar pelo editor (sem UI), cai no log
function _aviso(msg){ try{ SpreadsheetApp.getUi().alert(msg); }catch(e){ Logger.log(msg); } }
// Lê o documento da transportadora (CNPJ + razão social) — prompt focado
function lerTransportadora(frame){
  if(!ANTHROPIC_KEY)return{ok:false,erro:"ANTHROPIC_KEY não configurada"};
  if(!frame||!frame.base64)return{ok:false,erro:"Nenhuma imagem enviada"};
  if(frame.base64.length>3000000)return{ok:false,erro:"Imagem muito grande — reduza a resolução da foto"};
  var prompt="Analise este documento de uma transportadora (cartão CNPJ, comprovante de inscrição, CT-e ou nota de serviço de transporte).\nExtraia os dados da TRANSPORTADORA e retorne APENAS JSON puro:\n{\"cnpj\": \"00.000.000/0000-00\", \"razao_social\": \"RAZAO SOCIAL\", \"confianca\": \"alta\", \"obs\": \"\"}\n\nREGRAS:\n- Retorne null para campos não encontrados\n- CNPJ com pontuação (00.000.000/0000-00)\n- Razão social em MAIÚSCULAS, sem abreviar\n- Se houver mais de um CNPJ, use o da TRANSPORTADORA (prestadora do transporte), não o do destinatário/remetente\n- Não invente dados";
  var payload={model:MODELO_IA,max_tokens:300,messages:[{role:"user",content:[{type:"image",source:{type:"base64",media_type:frame.mime||"image/jpeg",data:frame.base64}},{type:"text",text:prompt}]}]};
  var resp;
  try{resp=UrlFetchApp.fetch(ANTHROPIC_URL,{method:"post",headers:{"x-api-key":ANTHROPIC_KEY,"anthropic-version":"2023-06-01","content-type":"application/json"},payload:JSON.stringify(payload),muteHttpExceptions:true});}
  catch(e){return{ok:false,erro:"Erro de rede: "+e.message};}
  if(resp.getResponseCode()!==200)return{ok:false,erro:"API erro "+resp.getResponseCode()+": "+resp.getContentText().substring(0,300)};
  try{var j=JSON.parse(resp.getContentText());var txt=j.content&&j.content[0]?j.content[0].text.replace(/```json|```/g,"").trim():"{}";return{ok:true,resultado:JSON.parse(txt)};}
  catch(e){return{ok:false,erro:"Erro ao interpretar resposta: "+e.message};}
}

function testeIA(){
  if(!ANTHROPIC_KEY){_aviso("❌ Configure ANTHROPIC_KEY nas Propriedades do Script primeiro.");return;}
  var resp;
  try{resp=UrlFetchApp.fetch(ANTHROPIC_URL,{method:"post",headers:{"x-api-key":ANTHROPIC_KEY,"anthropic-version":"2023-06-01","content-type":"application/json"},payload:JSON.stringify({model:MODELO_IA,max_tokens:64,messages:[{role:"user",content:"Responda só: OK"}]}),muteHttpExceptions:true,followRedirects:true,validateHttpsCertificates:true});}
  catch(e){_aviso("❌ Erro de rede ao chamar a API: "+e.message);return;}
  var code=resp.getResponseCode();var body=resp.getContentText();
  if(code!==200){_aviso("❌ API respondeu código "+code+":\n"+body.substring(0,300));return;}
  try{var j=JSON.parse(body);var txt=j.content&&j.content[0]?j.content[0].text:"sem resposta";_aviso("✅ IA conectada! Resposta: "+txt);}
  catch(e){_aviso("❌ Erro ao interpretar resposta: "+e.message+"\nBody: "+body.substring(0,200));}
}
