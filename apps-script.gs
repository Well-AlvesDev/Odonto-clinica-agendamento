const SHEET_NAME = 'Página1';
const SHEET_DISPO = 'Página2';

// --- AUXILIARES DE FORMATAÇÃO E COMPARAÇÃO ---

function normalizarString(str) {
  return str ? str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim() : '';
}

function validarNome(nome) {
  if (!nome || nome.trim() === '') return false;
  const regexNome = /^[a-záàâãéèêíïóôõöúçñ\s]+$/i;
  return regexNome.test(nome.trim());
}

function formatarParaComparar(valor, eHorario = false) {
  if (!valor) return "";
  if (typeof valor === 'string') {
    const limpo = valor.trim();
    if (eHorario && /^\d{2}:\d{2}$/.test(limpo)) return limpo;
    if (!eHorario && /^\d{4}-\d{2}-\d{2}$/.test(limpo)) return limpo;
  }
  try {
    const tz = SpreadsheetApp.getActive().getSpreadsheetTimeZone();
    const formato = eHorario ? "HH:mm" : "yyyy-MM-dd";
    return Utilities.formatDate(new Date(valor), tz, formato);
  } catch (e) {
    return valor.toString().trim();
  }
}

// --- VALIDAÇÃO NA PÁGINA 2 (CATÁLOGO) ---

function validarDisponibilidadeReal(dataDesejada, servicoDesejado, horarioDesejado) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetDispo = ss.getSheetByName(SHEET_DISPO);
  if (!sheetDispo) return { valid: false, error: 'Erro técnico: Aba de disponibilidade não encontrada.' };

  const dadosDispo = sheetDispo.getDataRange().getValues();
  
  for (let i = 1; i < dadosDispo.length; i++) {
    let dataPlanilha = formatarParaComparar(dadosDispo[i][0]);
    
    if (dataPlanilha === dataDesejada) {
      let servicosNaPlanilha = dadosDispo[i][1].toString().split(',').map(s => normalizarString(s));
      let servicoEhValido = servicosNaPlanilha.includes(normalizarString(servicoDesejado));

      let horariosNaPlanilha = dadosDispo[i][2].toString().split(',').map(h => h.trim());
      let horarioEhValido = horariosNaPlanilha.includes(horarioDesejado.trim());

      if (!servicoEhValido) return { valid: false, error: 'Este serviço não está disponível para esta data.' };
      if (!horarioEhValido) return { valid: false, error: 'Este horário não está mais disponível no catálogo.' };

      return { valid: true };
    }
  }
  return { valid: false, error: 'A data selecionada não possui horários disponíveis.' };
}

// --- BUSCA DE RESERVADOS ---

// NOVA FUNÇÃO AUXILIAR: Expande "09:00 - 10:00" para ["09:00", "09:30"]
// Assume intervalos de 30 minutos para bloqueio. Ajuste o '30' se seus slots forem diferentes.
function expandirHorariosRange(valor) {
  if (!valor) return [];
  const str = valor.toString().trim();
  
  // Se for formato simples "09:00", retorna ele mesmo
  if (/^\d{2}:\d{2}$/.test(str)) return [str];

  // Se for formato intervalo "09:00 - 10:30"
  if (/^\d{2}:\d{2}\s*-\s*\d{2}:\d{2}$/.test(str)) {
    const [inicio, fim] = str.split('-').map(h => h.trim());
    const slots = [];
    
    let atual = new Date(`2000-01-01T${inicio}:00`);
    const final = new Date(`2000-01-01T${fim}:00`);
    
    // Loop adicionando 30 minutos até chegar no horário final (exclusivo)
    while (atual < final) {
      const h = Utilities.formatDate(atual, SpreadsheetApp.getActive().getSpreadsheetTimeZone(), "HH:mm");
      slots.push(h);
      atual.setMinutes(atual.getMinutes() + 30); // Incremento de 30 min
    }
    return slots;
  }
  
  return [str];
}

// ATUALIZADA: Busca Reservados (agora entende intervalos)
function buscarHorariosReservados(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet || sheet.getLastRow() <= 1) return [];

  const headersRaw = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const headers = headersRaw.map(h => h.toString().toLowerCase().trim());
  const idxData = headers.indexOf('data');
  const idxHorario = headers.indexOf('horario');
  if (idxData === -1 || idxHorario === -1) return [];

  const registros = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  let horariosReservados = []; // Mudado para let para permitir concatenação

  for (let i = 0; i < registros.length; i++) {
    const dExistente = formatarParaComparar(registros[i][idxData]);
    // Lê o valor cru da célula (pode ser "09:00" ou "09:00 - 10:00")
    const valorHorario = registros[i][idxHorario]; 
    
    if (dExistente === data && valorHorario) {
      // Expande o valor encontrado em slots individuais para bloquear no front
      const slotsOcupados = expandirHorariosRange(valorHorario);
      horariosReservados = horariosReservados.concat(slotsOcupados);
    }
  }
  // Remove duplicatas
  return [...new Set(horariosReservados)];
} 

// --- FUNÇÃO PRINCIPAL COM LOCK (TRATAMENTO DE CONCORRÊNCIA) ---

function handleRequest(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_NAME);
    const params = e.parameter;

    // --- Busca (Read-only) ---
    if (params.action === 'fetch-reservados') {
      const data = params.date;
      if (!data) return responderErro('Data não fornecida');
      const horariosReservados = buscarHorariosReservados(data);
      return ContentService.createTextOutput(JSON.stringify({ 
        success: true, 
        data: horariosReservados 
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Validar Honeypot e Data Passada aqui (código existente)
    if (params.website && params.website.trim() !== '') return responderErro('Erro.');
    const tz = ss.getSpreadsheetTimeZone();
    const hoje = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
    if (formatarParaComparar(params.data) < hoje) return responderErro('⚠️ Não é permitido agendar para datas passadas.');
    
    // Validação de horário passado no mesmo dia
    if (formatarParaComparar(params.data) === hoje) {
      const agora = new Date();
      const horaAtualFormatada = Utilities.formatDate(agora, tz, 'HH:mm');
      const horarioAgendado = formatarParaComparar(params.horario, true);
      if (horarioAgendado < horaAtualFormatada) {
        return responderErro('⚠️ Não é possível agendar para horários que já passaram. Por favor, selecione um horário futuro.');
      }
    }
    if (!validarNome(params.nome)) return responderErro('⚠️ O nome deve conter apenas letras e espaços.');

    const headersRaw = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const headers = headersRaw.map(h => h.toString().toLowerCase().trim());
    
    const idxData = headers.indexOf('data');
    const idxHorario = headers.indexOf('horario');
    const idxNome = headers.indexOf('nome');
    const idxTelefone = headers.indexOf('telefone');

    // --- VERIFICAÇÃO DE CONFLITO ROBUSTA ---
    // Recebe do frontend a string dos slots que o serviço vai ocupar (ex: "09:00,09:30")
    // Se o frontend não mandar, assume apenas o horario inicial
    const slotsNecessarios = params.slots_ocupados ? params.slots_ocupados.split(',') : [params.horario.trim()];

    // VALIDAÇÃO ADICIONAL: garantir que TODOS os slots necessários existam no catálogo (Página2) para a data
    try {
      const sheetDispo = ss.getSheetByName(SHEET_DISPO);
      if (sheetDispo) {
        const dadosDispo = sheetDispo.getDataRange().getValues();
        let horariosNaPlanilha = null;

        for (let i = 1; i < dadosDispo.length; i++) {
          const dataPlanilha = formatarParaComparar(dadosDispo[i][0]);
          if (dataPlanilha === params.data) {
            horariosNaPlanilha = dadosDispo[i][2].toString().split(',').map(h => h.trim());
            break;
          }
        }

        if (horariosNaPlanilha) {
          const missing = slotsNecessarios.filter(s => horariosNaPlanilha.indexOf(s) === -1);
          if (missing.length) {
            const duracao = slotsNecessarios.length * 30; // assumindo slots de 30 min
            const horas = Math.floor(duracao / 60);
            const mins = duracao % 60;
            const durFmt = Utilities.formatString('%02dH%02dMin', horas, mins);
            return responderErro('⚠️ Tempo insuficiente. O serviço dura ' + durFmt + ', mas o horário ' + missing[0] + ' não permite completar o atendimento antes do fechamento.');
          }
        }
      }
    } catch (e) {
      // Se houver erro ao validar catálogo, não bloquear automaticamente — falha segura e log
      console.warn('Erro ao validar disponibilidade no catálogo:', e);
    }

    if (sheet.getLastRow() > 1) {
      const registros = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
      
      for (let i = 0; i < registros.length; i++) {
        let dExistente = formatarParaComparar(registros[i][idxData]);
        
        // Verifica se é a mesma data
        if (dExistente === params.data) {
            // Expande o horário já agendado na planilha (ex: "10:00 - 11:00" vira ["10:00", "10:30"])
            const horariosNaLinha = expandirHorariosRange(registros[i][idxHorario]);
            
            // Verifica se ALGUM slot necessário colide com ALGUM slot já reservado
            const conflito = slotsNecessarios.some(slot => horariosNaLinha.includes(slot));
            
            if (conflito) {
              return responderErro('⚠️ Ops, um ou mais horários necessários para este serviço já foram reservados.');
            }
        }
      }
      
      // Verificação de duplicata de usuário (código existente)
      const usuarioJaAgendou = registros.some(row => 
        normalizarString(row[idxNome]) === normalizarString(params.nome) && 
        String(row[idxTelefone]).trim() === String(params.telefone).trim()
      );
      if (usuarioJaAgendou) return responderErro('⚠️ Já existe um agendamento com o nome e telefone informados.');
    }

    // --- SALVAR DADOS ---
    // Determina o valor a ser salvo na coluna Horário
    // Se tiver horário fim enviado pelo front, salva "09:00 - 11:00", senão só "09:00"
    let horarioParaSalvar = params.horario;
    if (params.horario_fim && params.horario_fim !== params.horario) {
        horarioParaSalvar = `${params.horario} - ${params.horario_fim}`;
    }

    // Atualiza o parâmetro para o mapa salvar corretamente
    const paramsParaSalvar = {...params};
    paramsParaSalvar['horario'] = horarioParaSalvar;

    const novaLinha = headersRaw.map(h => paramsParaSalvar[h.toLowerCase().trim()] || '');
    sheet.appendRow(novaLinha);
    SpreadsheetApp.flush();
    
    return ContentService.createTextOutput(JSON.stringify({ 
      success: true, 
      message: 'Agendamento confirmado com sucesso!' 
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return responderErro('Erro no servidor: ' + error.toString());
  } finally {
    lock.releaseLock();
  }
}

function responderErro(msg) {
  return ContentService.createTextOutput(JSON.stringify({ success: false, error: msg }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) { return handleRequest(e); }
function doGet(e) { return handleRequest(e); }