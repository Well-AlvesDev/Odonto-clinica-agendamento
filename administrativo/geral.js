// ===================================================
// CONFIGURAÇÃO DO SUPABASE
// ===================================================
const supabaseUrl = 'https://kqmfhrnoevcckbjafuxq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxbWZocm5vZXZjY2tiamFmdXhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MTI5MDUsImV4cCI6MjA4NjQ4ODkwNX0.7HP95_6KrJ954oW0MWXnewqmYCewACuCE2rOzNnY9fw';
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

// ===================================================
// VARIÁVEIS GLOBAIS
// ===================================================
let horariosGlobais = [];
let horariosEmEdicao = null;
let datas = [];
let horariosServidor = [];

// Serviços disponíveis (carregados dinamicamente da tabela arch_de_contx)
let servicosDisponiveis = [];
let servicosSelecionadosNovo = [];
let servicosSelecionadosEdicao = [];

// State para Time Picker (Edição)
const timePickerState = {
    inicio1: { hora: 0, minuto: 0 },
    fim1: { hora: 0, minuto: 0 },
    inicio2: { hora: 0, minuto: 0 },
    fim2: { hora: 0, minuto: 0 }
};

// State para Time Picker (Novo Horário)
const timePickerStateNovo = {
    inicio1: { hora: 0, minuto: 0 },
    fim1: { hora: 0, minuto: 0 },
    inicio2: { hora: 0, minuto: 0 },
    fim2: { hora: 0, minuto: 0 }
};

// State para Date Picker (Edição)
const datePickerState = {
    dia: 1,
    mes: 1,
    ano: new Date().getFullYear()
};

// State para Date Picker (Novo Horário)
const datePickerStateNovo = {
    dia: 1,
    mes: 1,
    ano: new Date().getFullYear()
};

// ===================================================
// VARIÁVEIS DE PAGINAÇÃO
// ===================================================
let paginacaoAtual = 1;
const ITENS_POR_PAGINA = 6;

// ===================================================
// FUNÇÕES PARA CONGELAR/DESCONGELAR SCROLL
// ===================================================
function congelarScroll() {
    document.body.style.overflow = 'hidden';
}

function descongelarScroll() {
    document.body.style.overflow = '';
}

// ===================================================
// FUNÇÕES TIME PICKER
// ===================================================
function incrementarHora(campo) {
    if (timePickerState[campo]) {
        timePickerState[campo].hora = (timePickerState[campo].hora + 1) % 24;
        atualizarPickerDisplay(campo);
        sincronizarInputTime(campo);
    }
}

function decrementarHora(campo) {
    if (timePickerState[campo]) {
        timePickerState[campo].hora = (timePickerState[campo].hora - 1 + 24) % 24;
        atualizarPickerDisplay(campo);
        sincronizarInputTime(campo);
    }
}

function incrementarMinuto(campo) {
    if (timePickerState[campo]) {
        timePickerState[campo].minuto = (timePickerState[campo].minuto + 5) % 60;
        atualizarPickerDisplay(campo);
        sincronizarInputTime(campo);
    }
}

function decrementarMinuto(campo) {
    if (timePickerState[campo]) {
        timePickerState[campo].minuto = (timePickerState[campo].minuto - 5 + 60) % 60;
        atualizarPickerDisplay(campo);
        sincronizarInputTime(campo);
    }
}

function atualizarPickerDisplay(campo) {
    const { hora, minuto } = timePickerState[campo];

    // Mapeamento explícito de campos para IDs
    const idMap = {
        'inicio1': { hora: 'displayHoraInicio1', minuto: 'displayMinutoInicio1' },
        'fim1': { hora: 'displayHoraFim1', minuto: 'displayMinutoFim1' },
        'inicio2': { hora: 'displayHoraInicio2', minuto: 'displayMinutoInicio2' },
        'fim2': { hora: 'displayHoraFim2', minuto: 'displayMinutoFim2' }
    };

    const ids = idMap[campo];
    if (ids) {
        const horaDisplay = document.getElementById(ids.hora);
        const minutoDisplay = document.getElementById(ids.minuto);

        if (horaDisplay) horaDisplay.textContent = String(hora).padStart(2, '0');
        if (minutoDisplay) minutoDisplay.textContent = String(minuto).padStart(2, '0');
    }
}

function sincronizarInputTime(campo) {
    const { hora, minuto } = timePickerState[campo];
    const timeString = `${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}`;

    // Mapear campo para ID do input
    const inputIdMap = {
        'inicio1': 'editHoraInicio1',
        'fim1': 'editHoraFim1',
        'inicio2': 'editHoraInicio2',
        'fim2': 'editHoraFim2'
    };

    const inputElement = document.getElementById(inputIdMap[campo]);
    if (inputElement) {
        inputElement.value = timeString;
    }
}

function inicializarPickerDeInput(campo, inputId) {
    const inputElement = document.getElementById(inputId);
    if (inputElement && inputElement.value) {
        const [hora, minuto] = inputElement.value.split(':').map(Number);
        timePickerState[campo] = { hora, minuto };
    } else {
        timePickerState[campo] = { hora: 0, minuto: 0 };
    }
    atualizarPickerDisplay(campo);
}

// ===================================================
// FUNÇÕES DATE PICKER
// ===================================================
function incrementarDia() {
    const diasNoMes = new Date(datePickerState.ano, datePickerState.mes, 0).getDate();
    datePickerState.dia = (datePickerState.dia % diasNoMes) + 1;
    atualizarDatePickerDisplay();
    sincronizarInputDate();
    atualizarEstadoBotoesDatePicker();
}

function decrementarDia() {
    // Verificar se pode decrementar (data mínima)
    if (!podeDecrementarDia()) return;

    const diasNoMes = new Date(datePickerState.ano, datePickerState.mes, 0).getDate();
    datePickerState.dia = datePickerState.dia === 1 ? diasNoMes : datePickerState.dia - 1;
    atualizarDatePickerDisplay();
    sincronizarInputDate();
    atualizarEstadoBotoesDatePicker();
}

function incrementarMes() {
    datePickerState.mes = (datePickerState.mes % 12) + 1;
    // Ajustar dia se necessário (ex: 31 de janeiro para fevereiro)
    const diasNoMes = new Date(datePickerState.ano, datePickerState.mes, 0).getDate();
    if (datePickerState.dia > diasNoMes) {
        datePickerState.dia = diasNoMes;
    }
    atualizarDatePickerDisplay();
    sincronizarInputDate();
    atualizarEstadoBotoesDatePicker();
}

function decrementarMes() {
    // Verificar se pode decrementar (data mínima)
    if (!podeDecrementarMes()) return;

    datePickerState.mes = datePickerState.mes === 1 ? 12 : datePickerState.mes - 1;
    // Ajustar dia se necessário
    const diasNoMes = new Date(datePickerState.ano, datePickerState.mes, 0).getDate();
    if (datePickerState.dia > diasNoMes) {
        datePickerState.dia = diasNoMes;
    }
    atualizarDatePickerDisplay();
    sincronizarInputDate();
    atualizarEstadoBotoesDatePicker();
}

function atualizarDatePickerDisplay() {
    document.getElementById('displayDia').textContent = String(datePickerState.dia).padStart(2, '0');
    document.getElementById('displayMes').textContent = String(datePickerState.mes).padStart(2, '0');
    document.getElementById('displayAno').textContent = String(datePickerState.ano);
}

function sincronizarInputDate() {
    const dateString = `${String(datePickerState.ano)}-${String(datePickerState.mes).padStart(2, '0')}-${String(datePickerState.dia).padStart(2, '0')}`;
    document.getElementById('editData').value = dateString;
}

function inicializarPickerDeData(dataISO) {
    if (dataISO) {
        const [ano, mes, dia] = dataISO.split('-').map(Number);
        datePickerState.dia = dia;
        datePickerState.mes = mes;
        datePickerState.ano = ano;
    } else {
        const hoje = new Date();
        datePickerState.dia = hoje.getDate();
        datePickerState.mes = hoje.getMonth() + 1;
        datePickerState.ano = hoje.getFullYear();
    }
    atualizarDatePickerDisplay();
    atualizarEstadoBotoesDatePicker();
}

// Verificar se pode decrementar dia (edição)
function podeDecrementarDia() {
    const hoje = new Date();
    const dataAtual = new Date(datePickerState.ano, datePickerState.mes - 1, datePickerState.dia);
    const dataMenosUm = new Date(dataAtual);
    dataMenosUm.setDate(dataMenosUm.getDate() - 1);

    return dataMenosUm >= new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
}

// Verificar se pode decrementar mês (edição)
function podeDecrementarMes() {
    const hoje = new Date();
    let novoMes = datePickerState.mes === 1 ? 12 : datePickerState.mes - 1;
    let novoAno = datePickerState.mes === 1 ? datePickerState.ano - 1 : datePickerState.ano;

    const dataMesAnterior = new Date(novoAno, novoMes - 1, datePickerState.dia);
    const dataHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());

    return dataMesAnterior >= dataHoje;
}

// Atualizar estado dos botões de decrementar (edição)
function atualizarEstadoBotoesDatePicker() {
    const btnDecrementarDia = document.getElementById('btnDecrementarDia');
    const btnDecrementarMes = document.getElementById('btnDecrementarMes');

    if (btnDecrementarDia) {
        if (podeDecrementarDia()) {
            btnDecrementarDia.disabled = false;
        } else {
            btnDecrementarDia.disabled = true;
        }
    }

    if (btnDecrementarMes) {
        if (podeDecrementarMes()) {
            btnDecrementarMes.disabled = false;
        } else {
            btnDecrementarMes.disabled = true;
        }
    }
}

// ===================================================
// FUNÇÕES DATE PICKER PARA NOVO HORÁRIO
// ===================================================
function incrementarDiaNovo() {
    const diasNoMes = new Date(datePickerStateNovo.ano, datePickerStateNovo.mes, 0).getDate();
    const proximoDia = datePickerStateNovo.dia + 1;

    // Se o próximo dia ultrapassa o fim do mês
    if (proximoDia > diasNoMes) {
        const hoje = new Date();
        const anoHoje = hoje.getFullYear();
        const mesHoje = hoje.getMonth() + 1;

        // Só volta para hoje se estiver no mês atual
        if (datePickerStateNovo.ano === anoHoje && datePickerStateNovo.mes === mesHoje) {
            datePickerStateNovo.dia = hoje.getDate();
        } else {
            // Caso contrário, volta para o primeiro dia do mês
            datePickerStateNovo.dia = 1;
        }
    } else {
        datePickerStateNovo.dia = proximoDia;
    }

    atualizarDatePickerDisplayNovo();
    sincronizarInputDateNovo();
    atualizarEstadoBotoesDatePickerNovo();
}

function decrementarDiaNovo() {
    // Verificar se pode decrementar (data mínima)
    if (!podeDecrementarDiaNovo()) return;

    const diasNoMes = new Date(datePickerStateNovo.ano, datePickerStateNovo.mes, 0).getDate();
    datePickerStateNovo.dia = datePickerStateNovo.dia === 1 ? diasNoMes : datePickerStateNovo.dia - 1;
    atualizarDatePickerDisplayNovo();
    sincronizarInputDateNovo();
    atualizarEstadoBotoesDatePickerNovo();
}

function incrementarMesNovo() {
    const proximoMes = datePickerStateNovo.mes + 1;

    // Se o próximo mês ultrapassa 12 (dezembro)
    if (proximoMes > 12) {
        const hoje = new Date();
        const anoHoje = hoje.getFullYear();
        const mesHoje = hoje.getMonth() + 1;
        const diaHoje = hoje.getDate();

        // Se estiver no ano atual, volta para o mês atual
        if (datePickerStateNovo.ano === anoHoje) {
            datePickerStateNovo.mes = mesHoje;
            datePickerStateNovo.dia = diaHoje;
        } else {
            // Caso contrário, volta para janeiro (mês 1) do mesmo ano
            datePickerStateNovo.mes = 1;
            datePickerStateNovo.dia = 1;
        }
    } else {
        datePickerStateNovo.mes = proximoMes;
        // Ajustar dia se necessário (ex: 31 de janeiro para fevereiro)
        const diasNoMes = new Date(datePickerStateNovo.ano, datePickerStateNovo.mes, 0).getDate();
        if (datePickerStateNovo.dia > diasNoMes) {
            datePickerStateNovo.dia = diasNoMes;
        }
    }

    atualizarDatePickerDisplayNovo();
    sincronizarInputDateNovo();
    atualizarEstadoBotoesDatePickerNovo();
}

function decrementarMesNovo() {
    // Verificar se pode decrementar (data mínima)
    if (!podeDecrementarMesNovo()) return;

    datePickerStateNovo.mes = datePickerStateNovo.mes === 1 ? 12 : datePickerStateNovo.mes - 1;
    // Ajustar dia se necessário
    const diasNoMes = new Date(datePickerStateNovo.ano, datePickerStateNovo.mes, 0).getDate();
    if (datePickerStateNovo.dia > diasNoMes) {
        datePickerStateNovo.dia = diasNoMes;
    }

    // Ajustar dia se estiver no passado (quando volta para o mês atual) usando lógica inteligente
    const hoje = new Date();
    const anoHoje = hoje.getFullYear();
    const mesHoje = hoje.getMonth() + 1;
    const diaHoje = hoje.getDate();

    if (datePickerStateNovo.ano === anoHoje && datePickerStateNovo.mes === mesHoje) {
        if (datePickerStateNovo.dia < diaHoje) {
            // Usar data padrão inteligente que detecta datas registradas
            const dataPadrao = obterDataPadraoInteligente();
            datePickerStateNovo.dia = dataPadrao.dia;
            datePickerStateNovo.mes = dataPadrao.mes;
            datePickerStateNovo.ano = dataPadrao.ano;
        }
    }

    atualizarDatePickerDisplayNovo();
    sincronizarInputDateNovo();
    atualizarEstadoBotoesDatePickerNovo();
}

function atualizarDatePickerDisplayNovo() {
    document.getElementById('displayDiaNovo').textContent = String(datePickerStateNovo.dia).padStart(2, '0');
    document.getElementById('displayMesNovo').textContent = String(datePickerStateNovo.mes).padStart(2, '0');
    document.getElementById('displayAnoNovo').textContent = String(datePickerStateNovo.ano);
}

function sincronizarInputDateNovo() {
    const dateString = `${String(datePickerStateNovo.ano)}-${String(datePickerStateNovo.mes).padStart(2, '0')}-${String(datePickerStateNovo.dia).padStart(2, '0')}`;
    document.getElementById('inputData').value = dateString;
}

// ===================================================
// OBTER DATA PADRÃO INTELIGENTE
// ===================================================
// Lógica:
// 1. Se hoje não está registrado → retorna hoje
// 2. Se hoje está registrado → tenta amanhã
// 3. Se amanhã também está registrado → retorna o dia após a última data registrada
function obterDataPadraoInteligente() {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    // Função helper para converter Date para YYYY-MM-DD
    const dateToISO = (date) => {
        const ano = date.getFullYear();
        const mes = String(date.getMonth() + 1).padStart(2, '0');
        const dia = String(date.getDate()).padStart(2, '0');
        return `${ano}-${mes}-${dia}`;
    };

    // Função helper para converter string YYYY-MM-DD para Date (evita problemas com timezone)
    const isoToDate = (isoString) => {
        const [ano, mes, dia] = isoString.split('-').map(Number);
        return new Date(ano, mes - 1, dia);
    };

    const hojeISO = dateToISO(hoje);

    // Verificar se hoje está registrado
    const hojeRegistrado = horariosGlobais.some(h => h.data === hojeISO);

    if (!hojeRegistrado) {
        // Hoje não está registrado, usar hoje
        return {
            dia: hoje.getDate(),
            mes: hoje.getMonth() + 1,
            ano: hoje.getFullYear()
        };
    }

    // Tentar amanhã
    const amanha = new Date(hoje);
    amanha.setDate(amanha.getDate() + 1);
    const amanhaISO = dateToISO(amanha);

    const amanhaRegistrado = horariosGlobais.some(h => h.data === amanhaISO);

    if (!amanhaRegistrado) {
        // Amanhã não está registrado, usar amanhã
        return {
            dia: amanha.getDate(),
            mes: amanha.getMonth() + 1,
            ano: amanha.getFullYear()
        };
    }

    // Se ambas estão registradas, encontrar a última data registrada e retornar o dia seguinte
    if (horariosGlobais.length > 0) {
        // Converter strings ISO para Date objects de forma segura (sem timezone issues)
        const datas = horariosGlobais.map(h => ({
            iso: h.data,
            date: isoToDate(h.data)
        }));

        // Ordenar por data descendente (maior para menor)
        datas.sort((a, b) => b.date - a.date);
        const ultimaData = datas[0].date;

        // Próxima data após a última
        const proximaData = new Date(ultimaData);
        proximaData.setDate(proximaData.getDate() + 1);

        return {
            dia: proximaData.getDate(),
            mes: proximaData.getMonth() + 1,
            ano: proximaData.getFullYear()
        };
    }

    // Fallback: retornar hoje
    return {
        dia: hoje.getDate(),
        mes: hoje.getMonth() + 1,
        ano: hoje.getFullYear()
    };
}

function inicializarPickerDeDataNovo(dataISO) {
    if (dataISO) {
        const [ano, mes, dia] = dataISO.split('-').map(Number);
        datePickerStateNovo.dia = dia;
        datePickerStateNovo.mes = mes;
        datePickerStateNovo.ano = ano;
    } else {
        // Usar data padrão inteligente (verifica datas já registradas)
        const dataPadrao = obterDataPadraoInteligente();
        datePickerStateNovo.dia = dataPadrao.dia;
        datePickerStateNovo.mes = dataPadrao.mes;
        datePickerStateNovo.ano = dataPadrao.ano;
    }
    atualizarDatePickerDisplayNovo();
    sincronizarInputDateNovo();
    atualizarEstadoBotoesDatePickerNovo();
}

// Verificar se pode decrementar dia
function podeDecrementarDiaNovo() {
    const hoje = new Date();
    const dataAtual = new Date(datePickerStateNovo.ano, datePickerStateNovo.mes - 1, datePickerStateNovo.dia);
    const dataMenosUm = new Date(dataAtual);
    dataMenosUm.setDate(dataMenosUm.getDate() - 1);

    return dataMenosUm >= new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
}

// Verificar se pode decrementar mês
function podeDecrementarMesNovo() {
    const hoje = new Date();
    const anoHoje = hoje.getFullYear();
    const mesHoje = hoje.getMonth() + 1; // +1 para usar 1-12 (consistente com datePickerStateNovo.mes)

    let novoMes = datePickerStateNovo.mes === 1 ? 12 : datePickerStateNovo.mes - 1;
    let novoAno = datePickerStateNovo.mes === 1 ? datePickerStateNovo.ano - 1 : datePickerStateNovo.ano;

    // Comparar apenas ano e mês, não o dia
    // Permite decrementar se o mês anterior é igual ou posterior ao mês atual
    if (novoAno > anoHoje) {
        return true;
    } else if (novoAno === anoHoje) {
        return novoMes >= mesHoje;
    } else {
        return false;
    }
}

// Atualizar estado dos botões de decrementar
function atualizarEstadoBotoesDatePickerNovo() {
    const btnDecrementarDia = document.getElementById('btnDecrementarDiaNovo');
    const btnDecrementarMes = document.getElementById('btnDecrementarMesNovo');

    if (btnDecrementarDia) {
        if (podeDecrementarDiaNovo()) {
            btnDecrementarDia.disabled = false;
        } else {
            btnDecrementarDia.disabled = true;
        }
    }

    if (btnDecrementarMes) {
        if (podeDecrementarMesNovo()) {
            btnDecrementarMes.disabled = false;
        } else {
            btnDecrementarMes.disabled = true;
        }
    }
}

// ===================================================
// FUNÇÕES TIME PICKER PARA NOVO HORÁRIO
// ===================================================
function incrementarHoraNovo(campo) {
    if (timePickerStateNovo[campo]) {
        timePickerStateNovo[campo].hora = (timePickerStateNovo[campo].hora + 1) % 24;
        atualizarPickerDisplayNovo(campo);
        sincronizarInputTimeNovo(campo);
    }
}

function decrementarHoraNovo(campo) {
    if (timePickerStateNovo[campo]) {
        timePickerStateNovo[campo].hora = (timePickerStateNovo[campo].hora - 1 + 24) % 24;
        atualizarPickerDisplayNovo(campo);
        sincronizarInputTimeNovo(campo);
    }
}

function incrementarMinutoNovo(campo) {
    if (timePickerStateNovo[campo]) {
        timePickerStateNovo[campo].minuto = (timePickerStateNovo[campo].minuto + 5) % 60;
        atualizarPickerDisplayNovo(campo);
        sincronizarInputTimeNovo(campo);
    }
}

function decrementarMinutoNovo(campo) {
    if (timePickerStateNovo[campo]) {
        timePickerStateNovo[campo].minuto = (timePickerStateNovo[campo].minuto - 5 + 60) % 60;
        atualizarPickerDisplayNovo(campo);
        sincronizarInputTimeNovo(campo);
    }
}

function atualizarPickerDisplayNovo(campo) {
    const { hora, minuto } = timePickerStateNovo[campo];

    // Mapeamento explícito de campos para IDs (sufixo "Novo")
    const idMap = {
        'inicio1': { hora: 'displayHoraInicio1Novo', minuto: 'displayMinutoInicio1Novo' },
        'fim1': { hora: 'displayHoraFim1Novo', minuto: 'displayMinutoFim1Novo' },
        'inicio2': { hora: 'displayHoraInicio2Novo', minuto: 'displayMinutoInicio2Novo' },
        'fim2': { hora: 'displayHoraFim2Novo', minuto: 'displayMinutoFim2Novo' }
    };

    const ids = idMap[campo];
    if (ids) {
        const horaDisplay = document.getElementById(ids.hora);
        const minutoDisplay = document.getElementById(ids.minuto);

        if (horaDisplay) horaDisplay.textContent = String(hora).padStart(2, '0');
        if (minutoDisplay) minutoDisplay.textContent = String(minuto).padStart(2, '0');
    }
}

function sincronizarInputTimeNovo(campo) {
    const { hora, minuto } = timePickerStateNovo[campo];
    const timeString = `${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}`;

    // Mapear campo para ID do input (sufixo "Novo")
    const inputIdMap = {
        'inicio1': 'inputHoraInicio1',
        'fim1': 'inputHoraFim1',
        'inicio2': 'inputHoraInicio2',
        'fim2': 'inputHoraFim2'
    };

    const inputElement = document.getElementById(inputIdMap[campo]);
    if (inputElement) {
        inputElement.value = timeString;
    }
}

function inicializarPickerDeInputNovo(campo, inputId) {
    const inputElement = document.getElementById(inputId);
    if (inputElement && inputElement.value) {
        const [hora, minuto] = inputElement.value.split(':').map(Number);
        timePickerStateNovo[campo] = { hora, minuto };
    } else {
        timePickerStateNovo[campo] = { hora: 0, minuto: 0 };
    }
    atualizarPickerDisplayNovo(campo);
}

// ===================================================
// FUNÇÕES DE GERENCIAMENTO DE SERVIÇOS (BADGES)
// ===================================================
function renderizarBadgesServicos(containerId, servicosSelecionados = []) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';

    servicosDisponiveis.forEach(servico => {
        const badge = document.createElement('button');
        badge.type = 'button';
        badge.className = 'servico-badge';

        const isAtivo = servicosSelecionados.includes(servico);

        // Criar conteúdo com ícone check se estiver ativo
        if (isAtivo) {
            badge.innerHTML = `<i class="ri-check-line"></i> ${servico}`;
            badge.classList.add('ativo');
        } else {
            badge.textContent = servico;
        }

        badge.onclick = (e) => {
            e.preventDefault();
            alternarServico(servico, containerId);
        };

        container.appendChild(badge);
    });
}

function alternarServico(servico, containerId) {
    const isNovoForm = containerId === 'servicosNovoContainer';
    const servicosList = isNovoForm ? servicosSelecionadosNovo : servicosSelecionadosEdicao;
    const inputId = isNovoForm ? 'inputServico' : 'editServico';

    const index = servicosList.indexOf(servico);
    if (index > -1) {
        servicosList.splice(index, 1);
        // Se um serviço foi descelecionado, desmarcar o checkbox "Selecionar Todos"
        const checkboxSelectAll = document.getElementById('selectAllServicos');
        if (checkboxSelectAll && checkboxSelectAll.checked) {
            checkboxSelectAll.checked = false;
        }
    } else {
        servicosList.push(servico);
    }

    // Atualizar input hidden
    document.getElementById(inputId).value = servicosList.join(', ');

    // Renderizar novamente os badges
    renderizarBadgesServicos(containerId, servicosList);
}

function obterServicosDoTexto(textoServicos) {
    if (!textoServicos) return [];
    return textoServicos.split(',').map(s => s.trim()).filter(s => s);
}

// ===================================================
// INICIALIZAÇÃO
// ===================================================
document.addEventListener('DOMContentLoaded', async function () {
    // Verificar se o usuário está autenticado
    const usuarioLogado = sessionStorage.getItem('usuarioLogado');
    if (!usuarioLogado) {
        window.location.href = 'login.html';
        return;
    }

    // Mostrar loader
    document.getElementById('loaderOverlay').style.display = 'flex';

    try {
        carregarNomeUsuario();
        carregarDataAtual();
        await carregarDadosDoServidor();
        await carregarServicosClinica();
        configurarFormulario();

        // Renderizar badges de serviços nos formulários
        renderizarBadgesServicos('servicosNovoContainer', servicosSelecionadosNovo);
        renderizarBadgesServicos('servicosEditContainer', servicosSelecionadosEdicao);
    } finally {
        // Esconder loader
        document.getElementById('loaderOverlay').style.display = 'none';
    }
});

// ===================================================
// CARREGAR DADOS DO SERVIDOR SUPABASE
// ===================================================
async function carregarDadosDoServidor() {
    try {
        // Resetar paginação ao carregar novos dados
        paginacaoAtual = 1;

        // Buscar datas e serviços da tabela 'cpxm'
        const { data: dataCpxm, error: errorCpxm } = await _supabase
            .from('cpxm')
            .select('data, servicos');

        if (errorCpxm) {
            console.error('Erro ao buscar cpxm:', errorCpxm);
            return;
        }

        datas = dataCpxm || [];
        console.log('Datas do Supabase:', datas);

        // Buscar horários e serviços da tabela 'arch_de_contx'
        const { data: dataHorarios, error: errorHorarios } = await _supabase
            .from('arch_de_contx')
            .select('horarios, servicos');

        if (errorHorarios) {
            console.error('Erro ao buscar dados de arch_de_contx:', errorHorarios);
            return;
        }

        // Carregar serviços disponíveis da coluna 'servicos' em arch_de_contx
        if (dataHorarios && dataHorarios.length > 0 && dataHorarios[0].servicos) {
            const servicosTexto = dataHorarios[0].servicos;
            servicosDisponiveis = servicosTexto.split(',').map(s => s.trim()).filter(s => s);
            console.log('Serviços disponíveis carregados:', servicosDisponiveis);
        }

        // Processar horários - separados por / (um horário completo por data)
        if (dataHorarios && dataHorarios.length > 0) {
            const horariosTexto = dataHorarios[0].horarios || '';
            horariosServidor = horariosTexto.split('/').map(h => h.trim()).filter(h => h);
        }

        // Correlacionar dados
        horariosGlobais = datas.map((item, index) => {
            const dataISO = converterDataParaISO(item.data); // Converter DD/MM/YYYY para YYYY-MM-DD
            return {
                id: dataISO, // Usar data ISO como ID único (YYYY-MM-DD)
                data: dataISO,
                horarios: horariosServidor[index] || '',
                servicos: item.servicos || 'Geral',
                dataCriacao: new Date().toISOString()
            };
        });

        console.log('horariosGlobais carregados:', horariosGlobais);
        exibirHorarios();
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
    }
}

// ===================================================
// CONVERTER DATA DE DD/MM/YYYY PARA YYYY-MM-DD
// ===================================================
function converterDataParaISO(data) {
    if (!data) return '';

    // Se já está em YYYY-MM-DD, retorna como está
    if (data.includes('-')) {
        return data;
    }

    // Converte DD/MM/YYYY para YYYY-MM-DD
    if (data.includes('/')) {
        const partes = data.split('/');
        if (partes.length === 3) {
            const dia = partes[0];
            const mes = partes[1];
            const ano = partes[2];
            return `${ano}-${mes}-${dia}`;
        }
    }

    return data;
}

// ===================================================
// CARREGAR NOME DO USUÁRIO
// ===================================================
function carregarNomeUsuario() {
    const usuarioLogado = sessionStorage.getItem('usuarioLogado');
    if (usuarioLogado) {
        document.getElementById('usuarioLogado').innerHTML = `<i class="ri-user-line"></i> ${usuarioLogado}`;
    }
}

// ===================================================
// CARREGAR DATA ATUAL
// ===================================================
function carregarDataAtual() {
    const hoje = new Date();
    const opcoes = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dataFormatada = hoje.toLocaleDateString('pt-BR', opcoes);
    document.getElementById('dataAtual').textContent = `Hoje: ${dataFormatada}`;

    // Definir data mínima do input como hoje
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const dia = String(hoje.getDate()).padStart(2, '0');
    const dataMinima = `${ano}-${mes}-${dia}`;
    document.getElementById('inputData').min = dataMinima;
}

// ===================================================
// CONFIGURAR FORMULÁRIO
// ===================================================
function configurarFormulario() {
    const form = document.getElementById('formNovoHorario');
    if (form) {
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            salvarNovoHorario();
        });
    }

    const formEdicao = document.getElementById('formEdicaoHorario');
    if (formEdicao) {
        formEdicao.addEventListener('submit', function (e) {
            e.preventDefault();
            atualizarHorario();
        });
    }
}

// ===================================================
// ABRIR/FECHAR FORMULÁRIO
// ===================================================
function abrirModalNovoHorario() {
    // ============================================================
    // VERIFICAR SE EXISTEM SERVIÇOS CADASTRADOS
    // ============================================================
    if (servicosClinica.length === 0) {
        mostrarErro(
            'Nenhum serviço foi cadastrado ainda. É necessário criar pelo menos um serviço antes de registrar horários.',
            'Serviços não cadastrados'
        );
        return;
    }

    // Limpar serviços selecionados
    servicosSelecionadosNovo = [];
    document.getElementById('inputServico').value = '';
    document.getElementById('formNovoHorario').reset();

    // Inicializar date picker do novo horário (com data atual)
    inicializarPickerDeDataNovo();
    atualizarEstadoBotoesDatePickerNovo();

    // Inicializar time pickers do novo horário com valores padrão
    // 1º intervalo: 08:00-12:00
    // 2º intervalo: 13:00-17:00
    timePickerStateNovo.inicio1 = { hora: 8, minuto: 0 };
    timePickerStateNovo.fim1 = { hora: 12, minuto: 0 };
    timePickerStateNovo.inicio2 = { hora: 13, minuto: 0 };
    timePickerStateNovo.fim2 = { hora: 17, minuto: 0 };

    // Atualizar displays e inputs dos pickers
    atualizarPickerDisplayNovo('inicio1');
    sincronizarInputTimeNovo('inicio1');
    atualizarPickerDisplayNovo('fim1');
    sincronizarInputTimeNovo('fim1');
    atualizarPickerDisplayNovo('inicio2');
    sincronizarInputTimeNovo('inicio2');
    atualizarPickerDisplayNovo('fim2');
    sincronizarInputTimeNovo('fim2');

    renderizarBadgesServicos('servicosNovoContainer', servicosSelecionadosNovo);

    document.getElementById('modalOverlayNovoHorario').classList.add('ativo');

    // Fazer scroll para o topo do modal
    const modalContainer = document.getElementById('modalOverlayNovoHorario').querySelector('.modal-container');
    if (modalContainer) {
        modalContainer.scrollTop = 0;
    }

    congelarScroll();
}

function fecharFormulario() {
    document.getElementById('modalOverlayNovoHorario').classList.remove('ativo');
    document.getElementById('formNovoHorario').reset();
    servicosSelecionadosNovo = [];
    document.getElementById('inputServico').value = '';

    // Resetar estado do botão
    const btnSalvar = document.getElementById('btnSalvarHorario');
    btnSalvar.disabled = false;
    btnSalvar.classList.remove('loading');

    descongelarScroll();
}

function fecharModalEdicao() {
    document.getElementById('modalOverlay').classList.remove('ativo');
    document.getElementById('formEdicaoHorario').reset();
    servicosSelecionadosEdicao = [];
    document.getElementById('editServico').value = '';
    horariosEmEdicao = null;
}

// ===================================================
// FUNÇÃO AUXILIAR - CONVERTER HORÁRIO PARA MINUTOS
// ===================================================
function converterHorarioParaMinutos(horarioString) {
    if (!horarioString) return null;
    const [horas, minutos] = horarioString.split(':').map(Number);
    return horas * 60 + minutos;
}

// ===================================================
// SALVAR NOVO HORÁRIO
// ===================================================
async function salvarNovoHorario() {
    const btnSalvar = document.getElementById('btnSalvarHorario');
    const data = document.getElementById('inputData').value;
    const horaInicio1 = document.getElementById('inputHoraInicio1').value;
    const horaFim1 = document.getElementById('inputHoraFim1').value;
    const horaInicio2 = document.getElementById('inputHoraInicio2').value;
    const horaFim2 = document.getElementById('inputHoraFim2').value;
    const servicoElement = document.getElementById('inputServico');

    // Obter serviços selecionados dos badges
    let servicosSelecionados = [];
    const badges = document.querySelectorAll('#servicosNovoContainer .servico-badge.ativo');
    badges.forEach(badge => {
        const nomeServico = badge.textContent.trim().replace(/[×\s]+$/, '').trim();
        if (nomeServico) servicosSelecionados.push(nomeServico);
    });

    // ============================================================
    // VALIDAÇÃO: VERIFICAR SE ALGUM SERVIÇO FOI SELECIONADO
    // ============================================================
    if (servicosSelecionados.length === 0) {
        mostrarErro('Por favor, selecione pelo menos um serviço!', 'Nenhum serviço selecionado');
        return;
    }

    const servicos = servicosSelecionados.join(', ');

    // ============================================================
    // VALIDAÇÕES
    // ============================================================
    if (!data) {
        mostrarErro('Por favor, preencha a data!', 'Campo obrigatório');
        return;
    }

    // Validar pelo menos o primeiro intervalo
    if (!horaInicio1 || !horaFim1) {
        mostrarErro('Por favor, preencha pelo menos o 1º intervalo de horários!', 'Campo obrigatório');
        return;
    }

    // Converter horários para minutos para comparação
    const minInicio1 = converterHorarioParaMinutos(horaInicio1);
    const minFim1 = converterHorarioParaMinutos(horaFim1);
    const minInicio2 = horaInicio2 ? converterHorarioParaMinutos(horaInicio2) : null;
    const minFim2 = horaFim2 ? converterHorarioParaMinutos(horaFim2) : null;

    // Validação 1: Verificar se os 4 horários são todos diferentes (quando ambos os intervalos estão preenchidos)
    if (horaInicio2 && horaFim2) {
        const horarios = [minInicio1, minFim1, minInicio2, minFim2];
        if (new Set(horarios).size !== horarios.length) {
            mostrarErro('Os 4 horários devem ser sempre diferentes entre si!', 'Erro na validação');
            return;
        }
    }

    // Validação 2: Validar que início1 < fim1
    if (minInicio1 >= minFim1) {
        mostrarErro('O horário de início deve ser menor que o de fim (1º intervalo)!', 'Horário inválido');
        return;
    }

    // Validação 3: Se o segundo intervalo está preenchido
    if (horaInicio2 && horaFim2) {
        // Validar que fim1 < início2
        if (minFim1 >= minInicio2) {
            mostrarErro('O fim do 1º intervalo deve ser menor que o início do 2º intervalo!', 'Ordem de horários inválida');
            return;
        }

        // Validar que início2 < fim2
        if (minInicio2 >= minFim2) {
            mostrarErro('O horário de início deve ser menor que o de fim (2º intervalo)!', 'Horário inválido');
            return;
        }

        // Validação 4: Validar a ordem completa: início1 < fim1 < início2 < fim2
        if (!(minInicio1 < minFim1 && minFim1 < minInicio2 && minInicio2 < minFim2)) {
            mostrarErro('Os horários devem estar em ordem crescente: Início 1º < Fim 1º < Início 2º < Fim 2º', 'Ordem de horários inválida');
            return;
        }
    } else if (horaInicio2 || horaFim2) {
        // Se apenas um dos campos do 2º intervalo está preenchido
        mostrarErro('Preencha ambos os campos do 2º intervalo de horários ou deixe em branco!', 'Campo incompleto');
        return;
    }

    // Construir string de horários
    let horarioString = `${horaInicio1}-${horaFim1}`;

    // Adicionar segundo intervalo se preenchido
    if (horaInicio2 && horaFim2) {
        horarioString += `, ${horaInicio2}-${horaFim2}`;
    }

    // ============================================================
    // DESABILITAR BOTÃO E MOSTRAR LOADER
    // ============================================================
    btnSalvar.disabled = true;
    btnSalvar.classList.add('loading');

    try {
        // ============================================================
        // OBTER CREDENCIAIS DO sessionStorage
        // ============================================================
        const usuarioLogado = sessionStorage.getItem('usuarioLogado');
        const senhaUsuario = sessionStorage.getItem('senhaUsuario');

        if (!usuarioLogado || !senhaUsuario) {
            mostrarErro('Credenciais não encontradas. Por favor, faça login novamente.', 'Erro de autenticação');
            btnSalvar.disabled = false;
            btnSalvar.classList.remove('loading');
            return;
        }

        // ============================================================
        // CHAMAR FUNÇÃO SQL COM SECURITY DEFINER
        // adicionar_data_horario_por_admin
        // ============================================================
        const { data: resultadoSQL, error: erroSQL } = await _supabase.rpc(
            'adicionar_data_horario_por_admin',
            {
                p_nome_usuario: usuarioLogado,
                p_senha_usuario: senhaUsuario,
                p_data_nova: data,
                p_horarios_novos: horarioString,
                p_servicos: servicos
            }
        );

        if (erroSQL) {
            console.error('Erro ao salvar horário:', erroSQL);
            mostrarErro('Erro ao salvar: ' + erroSQL.message, 'Erro no servidor');
            btnSalvar.disabled = false;
            btnSalvar.classList.remove('loading');
            return;
        }

        if (!resultadoSQL.sucesso) {
            mostrarErro(resultadoSQL.mensagem, 'Erro');
            btnSalvar.disabled = false;
            btnSalvar.classList.remove('loading');
            return;
        }

        // ============================================================
        // ATUALIZAR DADOS LOCAIS
        // ============================================================
        // Recarregar dados do servidor para manter sincronização
        await carregarDadosDoServidor();

        exibirHorarios();
        fecharFormulario();
        btnSalvar.disabled = false;
        btnSalvar.classList.remove('loading');
        mostrarSucesso(resultadoSQL.mensagem, 'Sucesso!');
    } catch (erro) {
        console.error('Erro inesperado:', erro);
        mostrarErro('Erro ao salvar: ' + erro.message, 'Erro inesperado');
        btnSalvar.disabled = false;
        btnSalvar.classList.remove('loading');
    }
}

// ===================================================
// EXIBIR HORÁRIOS
// ===================================================
function exibirHorarios() {
    const container = document.getElementById('horariosContainer');
    const paginationContainer = document.getElementById('paginationContainer');

    if (horariosGlobais.length === 0) {
        container.innerHTML = '<div class="sem-dados">Nenhum horário registrado ainda.</div>';
        paginationContainer.style.display = 'none';
        return;
    }

    // Primeiro, classificar cada horário
    const horariosClassificados = horariosGlobais.map(horario => ({
        ...horario,
        status: verificarStatusHorario(horario)
    }));

    // Separar por status
    const hoje = horariosClassificados.filter(h => h.status === 'Hoje');
    const ativos = horariosClassificados.filter(h => h.status === 'Ativo');
    const finalizados = horariosClassificados.filter(h => h.status === 'Finalizado');

    // Ordenar cada grupo
    // Hoje: ordenar por data (apenas um, mas mantém consistência)
    hoje.sort((a, b) => new Date(a.data) - new Date(b.data));

    // Em breve: do mais próximo (recente) para o mais distante (antigo)
    ativos.sort((a, b) => new Date(a.data) - new Date(b.data));

    // Finalizado: do mais recente para o mais antigo
    finalizados.sort((a, b) => new Date(b.data) - new Date(a.data));

    // Combinar na ordem desejada
    const horariosOrdenados = [...hoje, ...ativos, ...finalizados];

    // ===================================================
    // LÓGICA DE PAGINAÇÃO
    // ===================================================
    const totalPages = Math.ceil(horariosOrdenados.length / ITENS_POR_PAGINA);

    // Validar página atual
    if (paginacaoAtual > totalPages) {
        paginacaoAtual = totalPages;
    }
    if (paginacaoAtual < 1) {
        paginacaoAtual = 1;
    }

    // Calcular índices
    const startIdx = (paginacaoAtual - 1) * ITENS_POR_PAGINA;
    const endIdx = startIdx + ITENS_POR_PAGINA;

    // Obter horários da página atual
    const horariosPagina = horariosOrdenados.slice(startIdx, endIdx);

    container.innerHTML = '';

    horariosPagina.forEach((horario, index) => {
        const card = document.createElement('div');
        card.className = 'horario-card horario-card-animated';

        // Aplicar delay progressivo a cada card
        card.style.animationDelay = `${index * 0.08}s`;

        const dataFormatada = formatarData(horario.data);
        const horariosFormatados = formatarHorarios(horario.horarios);

        card.innerHTML = `
                    <div class="horario-info">
                        <div class="horario-data">${dataFormatada}</div>
                        <div class="horario-detalhes">
                            <strong>Horários:</strong> ${horariosFormatados}
                        </div>
                        <div class="horario-servico">
                            Serviços: ${horario.servicos}
                        </div>
                        <span class="horario-status ${horario.status.toLowerCase()}">${horario.status}</span>
                    </div>
                    <div class="horario-actions">
                        <button class="btn-excluir" onclick="excluirHorario('${horario.data}')">
                            <i class="ri-delete-bin-line"></i> Excluir
                        </button>
                    </div>
                `;

        container.appendChild(card);
    });

    // ===================================================
    // ATUALIZAR CONTROLES DE PAGINAÇÃO
    // ===================================================
    atualizarControlesPaginacao(totalPages);
}

// ===================================================
// FUNÇÕES DE PAGINAÇÃO
// ===================================================
function atualizarControlesPaginacao(totalPages) {
    const paginationContainer = document.getElementById('paginationContainer');
    const btnAnterior = document.getElementById('btnAnterior');
    const btnProximo = document.getElementById('btnProximo');
    const paginationInfo = document.getElementById('paginationInfo');

    // Mostrar ou ocultar container de paginação
    if (totalPages > 1) {
        paginationContainer.style.display = 'flex';

        // Atualizar informação de página
        paginationInfo.textContent = `${paginacaoAtual} de ${totalPages}`;

        // Atualizar estado dos botões
        btnAnterior.disabled = paginacaoAtual === 1;
        btnProximo.disabled = paginacaoAtual === totalPages;
    } else {
        paginationContainer.style.display = 'none';
    }
}

function irPaginaAnterior() {
    if (paginacaoAtual > 1) {
        paginacaoAtual--;
        exibirHorarios();
        window.scrollTo(0, 0);
    }
}

function irProximaPagina() {
    const totalPages = Math.ceil(horariosGlobais.length / ITENS_POR_PAGINA);
    if (paginacaoAtual < totalPages) {
        paginacaoAtual++;
        exibirHorarios();
        window.scrollTo(0, 0);
    }
}

// ===================================================
// FORMATAR HORÁRIOS
// ===================================================
function formatarHorarios(horariosTexto) {
    if (!horariosTexto) return '-';

    // Separador é BARRA (/) para separar horários de diferentes datas
    // Dentro de uma data, intervalos são separados por VÍRGULA (,)
    const horariosPorData = horariosTexto.split('/').map(h => h.trim()).filter(h => h);

    if (horariosPorData.length === 0) {
        return '-';
    }

    // Para cada data, os intervalos (separados por vírgula) já estão juntos
    return horariosPorData.map(horario => {
        // Dentro de cada horário, pode ter múltiplos intervalos separados por vírgula
        const intervalos = horario.split(',').map(i => i.trim()).filter(i => i);
        return intervalos.join(' às ');
    }).join(' / ');
}

// ===================================================
// VERIFICAR STATUS HORÁRIO
// ===================================================
function verificarStatusHorario(horario) {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const dia = String(hoje.getDate()).padStart(2, '0');
    const dataHoje = `${ano}-${mes}-${dia}`;

    // Normalizar a data do horário para formato YYYY-MM-DD
    let dataHorario = horario.data;
    if (dataHorario && dataHorario.includes('T')) {
        dataHorario = dataHorario.split('T')[0];
    }

    // Remover espaços em branco
    dataHorario = dataHorario.trim();

    // Converter para números para comparação segura
    const dataHorarioNum = parseInt(dataHorario.replace(/-/g, ''));
    const dataHojeNum = parseInt(dataHoje.replace(/-/g, ''));

    console.log(`Comparando: ${dataHorario} (${dataHorarioNum}) vs ${dataHoje} (${dataHojeNum})`);

    if (dataHorarioNum < dataHojeNum) {
        return 'Finalizado';
    } else if (dataHorarioNum === dataHojeNum) {
        return 'Hoje';
    } else {
        return 'Ativo';
    }
}

// ===================================================
// FORMATAR DATA
// ===================================================
function formatarData(data) {
    if (!data) return '-';
    const partes = data.split('-');
    if (partes.length === 3) {
        const d = new Date(partes[0], partes[1] - 1, partes[2]);
        return d.toLocaleDateString('pt-BR', { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' });
    }
    return data;
}

// ===================================================
// ABRIR MODAL EDIÇÃO
// ===================================================
// function abrirModalEdicao(id) {
//     const horario = horariosGlobais.find(h => h.id === id);
//
//     if (!horario) {
//         alert('Horário não encontrado!');
//         return;
//     }
//
//     horariosEmEdicao = horario;
//
//     document.getElementById('editData').value = horario.data;
// }

// ===================================================
// ATUALIZAR HORÁRIO
// ===================================================
async function atualizarHorario() {
    if (!horariosEmEdicao) {
        mostrarErro('Erro ao atualizar horário!', 'Erro desconhecido');
        return;
    }

    const data = document.getElementById('editData').value;
    const horaInicio1 = document.getElementById('editHoraInicio1').value;
    const horaFim1 = document.getElementById('editHoraFim1').value;
    const horaInicio2 = document.getElementById('editHoraInicio2').value;
    const horaFim2 = document.getElementById('editHoraFim2').value;
    const servico = document.getElementById('editServico').value || 'Geral';

    // Validações
    if (!data) {
        mostrarErro('Por favor, preencha a data!', 'Campo obrigatório');
        return;
    }

    // Validar pelo menos o primeiro intervalo
    if (!horaInicio1 || !horaFim1) {
        mostrarErro('Por favor, preencha pelo menos o 1º intervalo de horários!', 'Campo obrigatório');
        return;
    }

    // Validar que início < fim
    if (horaInicio1 >= horaFim1) {
        mostrarErro('O horário de início deve ser menor que o de fim (1º intervalo)!', 'Horário inválido');
        return;
    }

    // Construir string de horários
    let horarioString = `${horaInicio1}-${horaFim1}`;

    // Adicionar segundo intervalo se preenchido
    if (horaInicio2 && horaFim2) {
        if (horaInicio2 >= horaFim2) {
            mostrarErro('O horário de início deve ser menor que o de fim (2º intervalo)!', 'Horário inválido');
            return;
        }
        horarioString += `, ${horaInicio2}-${horaFim2}`;
    }

    try {
        // Obter credenciais do sessionStorage
        const usuarioLogado = sessionStorage.getItem('usuarioLogado');
        const senhaUsuario = sessionStorage.getItem('senhaUsuario');

        // Validar se as credenciais estão disponíveis
        if (!usuarioLogado || !senhaUsuario) {
            mostrarErro('Credenciais não encontradas na sessão. Faça login novamente.', 'Erro de autenticação');
            return;
        }

        // Chamar função SQL segura para atualizar
        const { data: resultadoSQL, error: errorRPC } = await _supabase.rpc('atualizar_data_por_admin', {
            p_nome_usuario: usuarioLogado,
            p_senha_usuario: senhaUsuario,
            p_data_antiga: horariosEmEdicao.data,
            p_data_nova: data,
            p_horarios_novos: horarioString,
            p_servicos_novos: servico
        });

        if (errorRPC) {
            console.error('Erro ao chamar RPC:', errorRPC);
            mostrarErro('Erro ao atualizar: ' + errorRPC.message, 'Erro no servidor');
            return;
        }

        // Verificar resposta da função SQL
        if (!resultadoSQL.sucesso) {
            console.error('Erro SQL:', resultadoSQL.mensagem);
            mostrarErro(resultadoSQL.mensagem, 'Erro ao atualizar');
            if (resultadoSQL.debug) {
                console.error('Debug info:', resultadoSQL.debug);
            }
            return;
        }

        // Atualizar array local
        const index = horariosGlobais.findIndex(h => h.id === horariosEmEdicao.id);
        if (index !== -1) {
            horariosGlobais[index] = {
                ...horariosGlobais[index],
                data: data,
                horarios: horarioString,
                servicos: servico
            };
        }

        exibirHorarios();
        fecharModalEdicao();
        mostrarSucesso(resultadoSQL.mensagem, 'Sucesso!');
    } catch (erro) {
        console.error('Erro inesperado:', erro);
        mostrarErro('Erro ao atualizar: ' + erro.message, 'Erro inesperado');
    }
}

// ===================================================
// EXCLUIR HORÁRIO (SEGURO COM SQL)
// ===================================================
async function excluirHorario(data) {
    abrirModalExclusao(data);
}

// ===================================================
// GERENCIAR SERVIÇOS DA CLÍNICA
// ===================================================
let servicosClinica = [];
let servicoEmEdicao = null;
let duracaoServico = 0; // Nova variável para armazenar duração do serviço em edição
let precoServico = 0; // Variável para armazenar preço do serviço em edição
let servicoParaRemover = null; // Variável para armazenar o serviço que será removido

async function carregarServicosClinica() {
    try {
        const { data, error } = await _supabase
            .from('arch_de_contx')
            .select('servicos')
            .maybeSingle();

        if (error) {
            console.error('Erro ao carregar serviços:', error);
            servicosClinica = [];
        } else if (data && data.servicos) {
            // Converter string de serviços em array
            servicosClinica = data.servicos
                .split(',')
                .map(s => s.trim())
                .filter(s => s);
        } else {
            servicosClinica = [];
        }

        exibirServicosClinica();
    } catch (erro) {
        console.error('Erro ao carregar serviços:', erro);
        servicosClinica = [];
    }
}

function exibirServicosClinica() {
    const container = document.getElementById('servicosClinicaContainer');
    if (!container) return;

    if (servicosClinica.length === 0) {
        container.innerHTML = '<div class="sem-dados" style="width: 100%; text-align: center; padding: 30px;">Nenhum serviço cadastrado ainda.</div>';
        return;
    }

    container.innerHTML = '';

    servicosClinica.forEach(servico => {
        const badge = document.createElement('div');
        badge.className = 'servico-badge-clinica';
        badge.style.cursor = 'pointer';
        badge.innerHTML = `
                    <i class="ri-stethoscope-line"></i>
                    <span>${servico}</span>
                    <div class="badge-actions">
                        <button type="button" class="badge-action-btn" onclick="removerServico('${servico.replace(/'/g, "\\'")}', event)" title="Remover serviço">
                            <i class="ri-close-line"></i>
                        </button>
                    </div>
                `;
        badge.onclick = function (e) {
            if (!e.target.closest('.badge-action-btn')) {
                abrirModalDetalhesServico(servico);
            }
        };
        container.appendChild(badge);
    });
}

function abrirModalNovoServico() {
    servicoEmEdicao = null;
    duracaoServico = 0;
    precoServico = 0;
    document.getElementById('modalServicoTitulo').textContent = 'Adicionar Novo Serviço';
    document.getElementById('inputNomeServico').value = '';
    document.getElementById('inputDuracaoServico').value = '';
    document.getElementById('inputPrecoServico').value = '';
    document.getElementById('btnSalvarServico').textContent = 'Adicionar Serviço';
    document.getElementById('formServico').onsubmit = function (e) {
        e.preventDefault();
        salvarServico();
    };
    document.getElementById('modalOverlayServico').classList.add('ativo');
    congelarScroll();
}

function formatarDuracao(minutos) {
    if (!minutos) {
        return '-';
    }

    if (minutos < 60) {
        return minutos === 1 ? '1 Minuto' : `${minutos} Minutos`;
    }

    const horas = Math.floor(minutos / 60);
    const minutosRestantes = minutos % 60;

    const parteHoras = horas === 1 ? '1 Hora' : `${horas} Horas`;

    if (minutosRestantes === 0) {
        return parteHoras;
    }

    const parteMinutos = minutosRestantes === 1 ? '1 Minuto' : `${minutosRestantes} Minutos`;
    return `${parteHoras} e ${parteMinutos}`;
}

async function abrirModalDetalhesServico(nomeServico) {
    document.getElementById('detalhesNomeServico').textContent = nomeServico;

    // Carregar duração e preço do serviço
    try {
        const usuarioLogado = sessionStorage.getItem('usuarioLogado');
        const senhaUsuario = sessionStorage.getItem('senhaUsuario');

        if (usuarioLogado && senhaUsuario) {
            const { data, error } = await _supabase.rpc('gerenciar_tempo_servicos', {
                p_nome_usuario: usuarioLogado,
                p_senha_usuario: senhaUsuario,
                p_acao: 'obter',
                p_servico_nome: '',
                p_servico_anterior: nomeServico,
                p_duracao_minutos: 0,
                p_preco: null
            });

            console.log('Resposta RPC para detalhes do serviço:', { data, error });

            if (error) {
                console.error('Erro na RPC:', error);
                document.getElementById('detalhesDuracaoServico').textContent = '-';
                document.getElementById('detalhesPrecoServico').textContent = '-';
            } else if (data && data.sucesso) {
                const duracao = data.duracao_minutos || 0;
                const duracaoFormatada = formatarDuracao(duracao);
                document.getElementById('detalhesDuracaoServico').textContent = duracaoFormatada;

                const preco = data.preco || 0;
                const precoFormatado = preco > 0 ? `R$ ${preco.toFixed(2).replace('.', ',')}` : '-';
                document.getElementById('detalhesPrecoServico').textContent = precoFormatado;
            } else {
                console.warn('RPC retornou sucesso=false:', data);
                document.getElementById('detalhesDuracaoServico').textContent = '-';
                document.getElementById('detalhesPrecoServico').textContent = '-';
            }
        } else {
            console.warn('Usuário ou senha não encontrados no sessionStorage');
            document.getElementById('detalhesDuracaoServico').textContent = '-';
            document.getElementById('detalhesPrecoServico').textContent = '-';
        }
    } catch (erro) {
        console.error('Erro ao carregar detalhes do serviço:', erro);
        document.getElementById('detalhesDuracaoServico').textContent = '-';
        document.getElementById('detalhesPrecoServico').textContent = '-';
    }

    document.getElementById('modalOverlayDetalhesServico').classList.add('ativo');
    congelarScroll();
}

function fecharModalDetalhesServico() {
    document.getElementById('modalOverlayDetalhesServico').classList.remove('ativo');
    descongelarScroll();
}

function fecharModalServico() {
    document.getElementById('modalOverlayServico').classList.remove('ativo');
    servicoEmEdicao = null;
    descongelarScroll();
}

async function abrirModalEditarServico(nomeServico) {
    servicoEmEdicao = nomeServico;
    document.getElementById('modalServicoTitulo').textContent = 'Editar Serviço';
    document.getElementById('inputNomeServico').value = nomeServico;
    document.getElementById('btnSalvarServico').textContent = 'Atualizar Serviço';

    // Carregar duração e preço do serviço
    try {
        const usuarioLogado = sessionStorage.getItem('usuarioLogado');
        const senhaUsuario = sessionStorage.getItem('senhaUsuario');

        if (usuarioLogado && senhaUsuario) {
            const { data, error } = await _supabase.rpc('gerenciar_tempo_servicos', {
                p_nome_usuario: usuarioLogado,
                p_senha_usuario: senhaUsuario,
                p_acao: 'obter',
                p_servico_nome: '',
                p_servico_anterior: nomeServico,
                p_duracao_minutos: 0
            });

            if (data && data.sucesso) {
                duracaoServico = data.duracao_minutos || 0;
                document.getElementById('inputDuracaoServico').value = duracaoServico;

                precoServico = data.preco || 0;
                document.getElementById('inputPrecoServico').value = precoServico;
            } else {
                duracaoServico = 0;
                precoServico = 0;
                document.getElementById('inputDuracaoServico').value = '';
                document.getElementById('inputPrecoServico').value = '';
            }
        }
    } catch (erro) {
        console.error('Erro ao carregar detalhes do serviço:', erro);
        duracaoServico = 0;
        precoServico = 0;
        document.getElementById('inputDuracaoServico').value = '';
        document.getElementById('inputPrecoServico').value = '';
    }

    document.getElementById('formServico').onsubmit = function (e) {
        e.preventDefault();
        atualizarServico();
    };
    document.getElementById('modalOverlayServico').classList.add('ativo');
    congelarScroll();
}

async function salvarServico() {
    const nomeServico = document.getElementById('inputNomeServico').value.trim();
    const duracaoMinutos = parseInt(document.getElementById('inputDuracaoServico').value);
    const precoServico = parseFloat(document.getElementById('inputPrecoServico').value);

    if (!nomeServico) {
        mostrarErro('Por favor, insira o nome do serviço!');
        return;
    }

    if (!duracaoMinutos || duracaoMinutos <= 0) {
        alert('Por favor, insira uma duração válida (maior que 0 minutos)!');
        return;
    }

    if (isNaN(precoServico) || precoServico < 0) {
        alert('Por favor, insira um preço válido!');
        return;
    }

    // Verificar se o serviço já existe
    if (servicosClinica.includes(nomeServico)) {
        mostrarErro('Este serviço já está cadastrado!');
        return;
    }

    // Desabilitar botão e mostrar loader
    const btnSalvar = document.getElementById('btnSalvarServico');
    const textoOriginal = btnSalvar?.innerHTML || 'Adicionar Serviço';
    if (btnSalvar) {
        btnSalvar.disabled = true;
        btnSalvar.classList.add('loading');
        btnSalvar.innerHTML = '<i class="ri-loader-4-line"></i> Adicionando...';
    }

    try {
        // Obter credenciais do sessionStorage
        const usuarioLogado = sessionStorage.getItem('usuarioLogado');
        const senhaUsuario = sessionStorage.getItem('senhaUsuario');

        if (!usuarioLogado || !senhaUsuario) {
            mostrarErro('Erro: Credenciais não encontradas na sessão. Faça login novamente.');
            if (btnSalvar) {
                btnSalvar.disabled = false;
                btnSalvar.classList.remove('loading');
                btnSalvar.innerHTML = textoOriginal;
            }
            return;
        }

        // Primeira: Adicionar serviço na tabela arch_de_contx
        const { data: dataServico, error: errorServico } = await _supabase.rpc('gerenciar_servicos_clinica', {
            p_nome_usuario: usuarioLogado,
            p_senha_usuario: senhaUsuario,
            p_acao: 'adicionar',
            p_servico_anterior: '',
            p_servico_novo: nomeServico
        });

        if (errorServico) {
            console.error('Erro ao salvar serviço:', errorServico);
            mostrarErro('Erro ao salvar serviço: ' + errorServico.message);
            if (btnSalvar) {
                btnSalvar.disabled = false;
                btnSalvar.classList.remove('loading');
                btnSalvar.innerHTML = textoOriginal;
            }
            return;
        }

        if (!dataServico.sucesso) {
            mostrarErro('Erro: ' + dataServico.mensagem);
            if (btnSalvar) {
                btnSalvar.disabled = false;
                btnSalvar.classList.remove('loading');
                btnSalvar.innerHTML = textoOriginal;
            }
            return;
        }

        // Segunda: Adicionar duração e preço na tabela servicos_tempo
        const { data: dataDuracao, error: errorDuracao } = await _supabase.rpc('gerenciar_tempo_servicos', {
            p_nome_usuario: usuarioLogado,
            p_senha_usuario: senhaUsuario,
            p_acao: 'adicionar',
            p_servico_nome: nomeServico,
            p_servico_anterior: '',
            p_duracao_minutos: duracaoMinutos,
            p_preco: precoServico
        });

        if (errorDuracao) {
            console.error('Erro ao salvar duração e preço:', errorDuracao);
            mostrarErro('Serviço criado, mas houve erro ao salvar duração e preço: ' + errorDuracao.message);
            if (btnSalvar) {
                btnSalvar.disabled = false;
                btnSalvar.classList.remove('loading');
                btnSalvar.innerHTML = textoOriginal;
            }
            return;
        }

        if (!dataDuracao.sucesso) {
            mostrarErro('Serviço criado, mas erro ao salvar duração e preço: ' + dataDuracao.mensagem);
            if (btnSalvar) {
                btnSalvar.disabled = false;
                btnSalvar.classList.remove('loading');
                btnSalvar.innerHTML = textoOriginal;
            }
            return;
        }

        // Adicionar novo serviço à lista
        servicosClinica.push(nomeServico);
        servicosDisponiveis = servicosClinica;

        exibirServicosClinica();
        fecharModalServico();
        mostrarSucesso('Serviço, duração e preço adicionados com sucesso!');

        // Restaurar botão ao final (sucesso)
        if (btnSalvar) {
            btnSalvar.disabled = false;
            btnSalvar.classList.remove('loading');
            btnSalvar.innerHTML = textoOriginal;
        }
    } catch (erro) {
        console.error('Erro inesperado:', erro);
        mostrarErro('Erro ao adicionar serviço: ' + erro.message);

        // Restaurar botão em caso de erro
        if (btnSalvar) {
            btnSalvar.disabled = false;
            btnSalvar.classList.remove('loading');
            btnSalvar.innerHTML = textoOriginal;
        }
    }
}

async function atualizarServico() {
    const nomeNovoServico = document.getElementById('inputNomeServico').value.trim();
    const duracaoMinutos = parseInt(document.getElementById('inputDuracaoServico').value);
    const precoMinutos = parseFloat(document.getElementById('inputPrecoServico').value);

    if (!nomeNovoServico) {
        mostrarErro('Por favor, insira o nome do serviço!');
        return;
    }

    if (!duracaoMinutos || duracaoMinutos <= 0) {
        mostrarErro('Por favor, insira uma duração válida (maior que 0 minutos)!');
        return;
    }

    if (isNaN(precoMinutos) || precoMinutos < 0) {
        alert('Por favor, insira um preço válido!');
        return;
    }

    if (servicoEmEdicao === nomeNovoServico && duracaoServico === duracaoMinutos && precoServico === precoMinutos) {
        fecharModalServico();
        return;
    }

    // Verificar se o novo nome já existe
    if (servicosClinica.includes(nomeNovoServico) && nomeNovoServico !== servicoEmEdicao) {
        mostrarErro('Este serviço já está cadastrado!');
        return;
    }

    // Desabilitar botão e mostrar loader
    const btnSalvar = document.getElementById('btnSalvarServico');
    const textoOriginal = btnSalvar?.innerHTML || 'Atualizar Serviço';
    if (btnSalvar) {
        btnSalvar.disabled = true;
        btnSalvar.classList.add('loading');
        btnSalvar.innerHTML = '<i class="ri-loader-4-line"></i> Atualizando...';
    }

    try {
        // Obter credenciais do sessionStorage
        const usuarioLogado = sessionStorage.getItem('usuarioLogado');
        const senhaUsuario = sessionStorage.getItem('senhaUsuario');

        if (!usuarioLogado || !senhaUsuario) {
            mostrarErro('Erro: Credenciais não encontradas na sessão. Faça login novamente.');
            if (btnSalvar) {
                btnSalvar.disabled = false;
                btnSalvar.classList.remove('loading');
                btnSalvar.innerHTML = textoOriginal;
            }
            return;
        }

        // Se o nome foi alterado, atualizar na tabela arch_de_contx
        if (nomeNovoServico !== servicoEmEdicao) {
            const { data: dataServico, error: errorServico } = await _supabase.rpc('gerenciar_servicos_clinica', {
                p_nome_usuario: usuarioLogado,
                p_senha_usuario: senhaUsuario,
                p_acao: 'editar',
                p_servico_anterior: servicoEmEdicao,
                p_servico_novo: nomeNovoServico
            });

            if (errorServico) {
                console.error('Erro ao atualizar serviço:', errorServico);
                mostrarErro('Erro ao atualizar serviço: ' + errorServico.message);
                if (btnSalvar) {
                    btnSalvar.disabled = false;
                    btnSalvar.classList.remove('loading');
                    btnSalvar.innerHTML = textoOriginal;
                }
                return;
            }

            if (!dataServico.sucesso) {
                mostrarErro('Erro: ' + dataServico.mensagem);
                if (btnSalvar) {
                    btnSalvar.disabled = false;
                    btnSalvar.classList.remove('loading');
                    btnSalvar.innerHTML = textoOriginal;
                }
                return;
            }
        }

        // Atualizar duração e preço na tabela servicos_tempo
        const { data: dataDuracao, error: errorDuracao } = await _supabase.rpc('gerenciar_tempo_servicos', {
            p_nome_usuario: usuarioLogado,
            p_senha_usuario: senhaUsuario,
            p_acao: 'editar',
            p_servico_nome: '',
            p_servico_anterior: nomeNovoServico !== servicoEmEdicao ? nomeNovoServico : servicoEmEdicao,
            p_duracao_minutos: duracaoMinutos,
            p_preco: precoMinutos
        });

        if (errorDuracao) {
            console.error('Erro ao atualizar duração e preço:', errorDuracao);
            mostrarErro('Erro ao atualizar duração e preço: ' + errorDuracao.message);
            if (btnSalvar) {
                btnSalvar.disabled = false;
                btnSalvar.classList.remove('loading');
                btnSalvar.innerHTML = textoOriginal;
            }
            return;
        }

        if (!dataDuracao.sucesso) {
            mostrarErro('Erro ao atualizar duração e preço: ' + dataDuracao.mensagem);
            if (btnSalvar) {
                btnSalvar.disabled = false;
                btnSalvar.classList.remove('loading');
                btnSalvar.innerHTML = textoOriginal;
            }
            return;
        }

        // Atualizar na lista local
        if (nomeNovoServico !== servicoEmEdicao) {
            const index = servicosClinica.indexOf(servicoEmEdicao);
            if (index !== -1) {
                servicosClinica[index] = nomeNovoServico;
            }
        }

        servicosDisponiveis = servicosClinica;
        exibirServicosClinica();
        fecharModalServico();
        mostrarSucesso('Serviço, duração e preço atualizados com sucesso!');

        // Restaurar botão ao final (sucesso)
        if (btnSalvar) {
            btnSalvar.disabled = false;
            btnSalvar.classList.remove('loading');
            btnSalvar.innerHTML = textoOriginal;
        }
    } catch (erro) {
        console.error('Erro inesperado:', erro);
        mostrarErro('Erro ao atualizar serviço: ' + erro.message);

        // Restaurar botão em caso de erro
        if (btnSalvar) {
            btnSalvar.disabled = false;
            btnSalvar.classList.remove('loading');
            btnSalvar.innerHTML = textoOriginal;
        }
    }
}

async function removerServico(nomeServico, event) {
    event.preventDefault();
    event.stopPropagation();

    servicoParaRemover = nomeServico;
    document.getElementById('mensagemConfirmacaoRemocaoServico').innerHTML =
        `Tem certeza que deseja remover o serviço <strong>"${nomeServico}"</strong>?<br><br>Esta ação é irreversível.`;

    document.getElementById('confirmationRemocaoServicoOverlay').classList.add('ativo');
    congelarScroll();
}

function fecharModalConfirmacaoRemocaoServico() {
    document.getElementById('confirmationRemocaoServicoOverlay').classList.remove('ativo');
    servicoParaRemover = null;
    descongelarScroll();
}

async function confirmarRemocaoServico() {
    if (!servicoParaRemover) return;

    const nomeServico = servicoParaRemover;

    // Estado dos botões antes da operação
    const btnConfirmar = document.getElementById('btnConfirmarRemocaoServico');
    const btnCancelar = document.getElementById('btnCancelarRemocaoServico');
    const textoOriginal = btnConfirmar.innerHTML;

    // Desabilitar botões e mostrar loader
    btnConfirmar.disabled = true;
    btnCancelar.disabled = true;
    btnConfirmar.innerHTML = '<i class="ri-loader-4-line"></i> Removendo...';

    // Timer mínimo de 1 segundo
    const minTimeoutPromise = new Promise(resolve => setTimeout(resolve, 1000));

    let operacaoPromise = Promise.resolve();

    try {
        // Obter credenciais do sessionStorage
        const usuarioLogado = sessionStorage.getItem('usuarioLogado');
        const senhaUsuario = sessionStorage.getItem('senhaUsuario');

        if (!usuarioLogado || !senhaUsuario) {
            btnConfirmar.disabled = false;
            btnCancelar.disabled = false;
            btnConfirmar.innerHTML = textoOriginal;
            mostrarErro('Erro: Credenciais não encontradas na sessão. Faça login novamente.');
            return;
        }

        // Primeira: Chamar função SQL para remover serviço de arch_de_contx
        operacaoPromise = (async () => {
            const { data: dataServico, error: errorServico } = await _supabase.rpc('gerenciar_servicos_clinica', {
                p_nome_usuario: usuarioLogado,
                p_senha_usuario: senhaUsuario,
                p_acao: 'remover',
                p_servico_anterior: nomeServico,
                p_servico_novo: ''
            });

            if (errorServico) {
                console.error('Erro ao remover serviço:', errorServico);
                throw new Error(errorServico.message);
            }

            if (!dataServico.sucesso) {
                throw new Error(dataServico.mensagem);
            }

            // Segunda: Remover duração de servicos_tempo
            const { data: dataDuracao, error: errorDuracao } = await _supabase.rpc('gerenciar_tempo_servicos', {
                p_nome_usuario: usuarioLogado,
                p_senha_usuario: senhaUsuario,
                p_acao: 'remover',
                p_servico_nome: '',
                p_servico_anterior: nomeServico,
                p_duracao_minutos: 0
            });

            // Não alertar se falhar remover duração (o serviço principal já foi removido)
            if (errorDuracao) {
                console.warn('Aviso ao remover duração:', errorDuracao);
            }

            // Remover da lista
            servicosClinica = servicosClinica.filter(s => s !== nomeServico);
            servicosDisponiveis = servicosClinica;

            exibirServicosClinica();
        })();

        // Aguardar no mínimo 1 segundo + conclusão da operação
        await Promise.all([minTimeoutPromise, operacaoPromise]);

        btnConfirmar.disabled = false;
        btnCancelar.disabled = false;
        btnConfirmar.innerHTML = textoOriginal;
        fecharModalConfirmacaoRemocaoServico();
        mostrarSucesso('Serviço removido com sucesso!');
    } catch (erro) {
        console.error('Erro inesperado:', erro);

        // Aguardar no mínimo 1 segundo mesmo em caso de erro
        await minTimeoutPromise;

        btnConfirmar.disabled = false;
        btnCancelar.disabled = false;
        btnConfirmar.innerHTML = textoOriginal;
        fecharModalConfirmacaoRemocaoServico();
        mostrarErro('Erro ao remover serviço: ' + erro.message);
    }
}

async function editarServico(nomeServico, event) {
    event.preventDefault();
    event.stopPropagation();
    await abrirModalEditarServico(nomeServico);
}

// ===================================================
// LOGOUT
// ===================================================
function fazerLogout() {
    const overlay = document.getElementById('confirmationLogoutOverlay');
    overlay.classList.add('ativo');
    congelarScroll();
}

function fecharModalConfirmacao() {
    const overlay = document.getElementById('confirmationLogoutOverlay');
    overlay.classList.remove('ativo');
    descongelarScroll();
}

function confirmarLogout() {
    sessionStorage.removeItem('usuarioLogado');
    sessionStorage.removeItem('senhaUsuario');
    sessionStorage.removeItem('agendamentos');
    window.location.href = './login.html';
}

// ===================================================
// EXCLUSÃO DE HORÁRIO COM MODAL
// ===================================================
let idHorarioEmExclusao = null; // Armazena a data (YYYY-MM-DD) do horário em exclusão

function abrirModalExclusao(data) {
    const horario = horariosGlobais.find(h => h.data === data);
    if (!horario) {
        mostrarErro('Horário não encontrado!');
        return;
    }

    idHorarioEmExclusao = data;
    const dataFormatada = formatarData(horario.data);
    document.getElementById('mensagemExclusao').innerHTML =
        `Tem certeza que deseja excluir a data <strong>${dataFormatada}</strong>?<br><br>Esta ação é irreversível e removerá a data registrada no sistema, não ficando mais disponível para agendamento.`;

    document.getElementById('confirmationExclusaoOverlay').classList.add('ativo');
    congelarScroll();
}

function fecharModalExclusao() {
    document.getElementById('confirmationExclusaoOverlay').classList.remove('ativo');
    idHorarioEmExclusao = null;

    // Resetar botão
    const botaoExcluir = document.getElementById('btnExcluirHorario');
    if (botaoExcluir) {
        botaoExcluir.disabled = false;
        botaoExcluir.innerHTML = 'Excluir';
    }

    descongelarScroll();
}

async function confirmarExclusao() {
    if (!idHorarioEmExclusao) return;

    const horario = horariosGlobais.find(h => h.data === idHorarioEmExclusao);
    if (!horario) {
        mostrarErro('Horário não encontrado!');
        fecharModalExclusao();
        return;
    }

    const dataParaExcluir = horario.data; // Já em formato YYYY-MM-DD

    // Obter o botão de exclusão
    const botaoExcluir = document.getElementById('btnExcluirHorario');
    const textoOriginal = botaoExcluir?.innerHTML || 'Excluir';

    try {
        // Desabilitar o botão e mostrar loader
        if (botaoExcluir) {
            botaoExcluir.disabled = true;
            botaoExcluir.innerHTML = '<i class="ri-loader-4-line loader-spinner"></i> Processando...';
        }

        // Obter credenciais do sessionStorage
        const usuarioLogado = sessionStorage.getItem('usuarioLogado');
        const senhaUsuario = sessionStorage.getItem('senhaUsuario');

        // Validar se as credenciais estão disponíveis
        if (!usuarioLogado || !senhaUsuario) {
            mostrarErro('Erro: Credenciais não encontradas na sessão. Faça login novamente.');

            // Restaurar botão em caso de erro
            if (botaoExcluir) {
                botaoExcluir.disabled = false;
                botaoExcluir.innerHTML = textoOriginal;
            }

            fecharModalExclusao();
            return;
        }

        // Chamar função SQL segura
        const { data, error } = await _supabase.rpc('excluir_data_por_admin', {
            p_nome_usuario: usuarioLogado,
            p_senha_usuario: senhaUsuario,
            p_data_exclusao: dataParaExcluir
        });

        // Verificar erro
        if (error) {
            console.error('Erro ao excluir:', error);
            mostrarErro(`Erro ao excluir: ${error.message}`);

            // Restaurar botão em caso de erro
            if (botaoExcluir) {
                botaoExcluir.disabled = false;
                botaoExcluir.innerHTML = textoOriginal;
            }

            fecharModalExclusao();
            return;
        }

        // Verificar resposta da função SQL
        if (!data.sucesso) {
            mostrarErro(`Erro: ${data.mensagem}`);

            // Restaurar botão em caso de erro
            if (botaoExcluir) {
                botaoExcluir.disabled = false;
                botaoExcluir.innerHTML = textoOriginal;
            }

            fecharModalExclusao();
            return;
        }

        // Remover do array local
        horariosGlobais = horariosGlobais.filter(h => h.data !== idHorarioEmExclusao);

        // Atualizar exibição
        exibirHorarios();

        // Fechar modal de confirmação
        fecharModalExclusao();

        // Mostrar sucesso
        mostrarSucesso(data.mensagem);

    } catch (erro) {
        console.error('Erro inesperado:', erro);
        mostrarErro(`Erro inesperado: ${erro.message}`);

        // Restaurar botão em caso de erro
        const botaoExcluir = document.getElementById('btnExcluirHorario');
        if (botaoExcluir) {
            botaoExcluir.disabled = false;
            botaoExcluir.innerHTML = 'Excluir';
        }

        fecharModalExclusao();
    }
}

// ===================================================
// MODAIS DE SUCESSO E ERRO
// ===================================================
function mostrarSucesso(mensagem, titulo = 'Sucesso!') {
    document.getElementById('tituloSucesso').textContent = titulo;
    document.getElementById('mensagemSucesso').textContent = mensagem;
    document.getElementById('successModal').classList.add('ativo');
    congelarScroll();
}

function fecharModalSucesso() {
    document.getElementById('successModal').classList.remove('ativo');
    descongelarScroll();
}

function mostrarErro(mensagem, titulo = 'Erro') {
    document.getElementById('tituloErro').textContent = titulo;
    document.getElementById('mensagemErro').textContent = mensagem;
    document.getElementById('errorModal').classList.add('ativo');
    congelarScroll();
}

function fecharModalErro() {
    document.getElementById('errorModal').classList.remove('ativo');
    descongelarScroll();
}

// Fechar modal ao pressionar ESC
document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
        fecharModalEdicao();
        fecharModalServico();
        fecharModalConfirmacao();
        fecharModalExclusao();
        fecharModalConfirmacaoRemocaoServico();
        fecharModalSucesso();
        fecharModalErro();
    }
});

function selecionarTodosServicos() {
    const checkbox = document.getElementById('selectAllServicos');

    if (checkbox.checked) {
        // Selecionar todos os serviços
        servicosSelecionadosNovo = [...servicosDisponiveis];
    } else {
        // Desselecionar todos os serviços
        servicosSelecionadosNovo = [];
    }

    // Atualizar input hidden
    document.getElementById('inputServico').value = servicosSelecionadosNovo.join(', ');

    // Renderizar novamente os badges
    renderizarBadgesServicos('servicosNovoContainer', servicosSelecionadosNovo);
}