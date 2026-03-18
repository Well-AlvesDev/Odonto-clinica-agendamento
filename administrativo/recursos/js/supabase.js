// CONFIGURAÇÃO DO SUPABASE
const supabaseUrl = 'https://kqmfhrnoevcckbjafuxq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxbWZocm5vZXZjY2tiamFmdXhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MTI5MDUsImV4cCI6MjA4NjQ4ODkwNX0.7HP95_6KrJ954oW0MWXnewqmYCewACuCE2rOzNnY9fw';

const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

// =====================================================
// UTILIDADES PARA VERIFICAR BLOQUEIOS DE HORÁRIOS
// =====================================================

// Converte horário em minutos desde o início do dia
function horarioParaMinutos(horario) {
    const [horas, minutos] = horario.split(':').map(Number);
    return horas * 60 + minutos;
}


// CACHE DE DURAÇÕES DE SERVIÇOS
const SERVICOS_DURACAO_CACHE_KEY = 'servicos_duracao_cache';
const SERVICOS_DURACAO_CACHE_EXPIRY = 30 * 1000; // 30 segundos em milissegundos

// Verifica se o cache de durações é válido
function isDuracoesCacheValido() {
    const cached = localStorage.getItem(SERVICOS_DURACAO_CACHE_KEY);
    if (!cached) return false;

    try {
        const cacheData = JSON.parse(cached);
        const now = Date.now();
        const isValido = (now - cacheData.timestamp) < SERVICOS_DURACAO_CACHE_EXPIRY;

        if (!isValido) {
            localStorage.removeItem(SERVICOS_DURACAO_CACHE_KEY);
        }

        return isValido;
    } catch (err) {
        localStorage.removeItem(SERVICOS_DURACAO_CACHE_KEY);
        return false;
    }
}

// Salva durações em cache
function salvarDuracoesEmCache(duracoes) {
    const cacheData = {
        duracoes: duracoes,
        timestamp: Date.now()
    };
    localStorage.setItem(SERVICOS_DURACAO_CACHE_KEY, JSON.stringify(cacheData));
}

// Obtém durações do cache
function obterDuracoesDoCache() {
    const cached = localStorage.getItem(SERVICOS_DURACAO_CACHE_KEY);
    if (!cached) return null;

    try {
        const cacheData = JSON.parse(cached);
        return cacheData.duracoes;
    } catch (err) {
        return null;
    }
}

// Invalida o cache de durações de serviços (usado quando for necessário forçar um novo fetch imediato)
function invalidarCacheDuracoesServicos() {
    localStorage.removeItem(SERVICOS_DURACAO_CACHE_KEY);
    console.log('[Cache] Durações de serviços invalidadas');
}

// função auxiliar para normalizar nome de serviço (remove acentos, espaços e coloca em minúsculas)
function normalizarServicoNome(nome) {
    return nome
        .toLowerCase()
        .trim()
        .replace(/[áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ]/g, (char) => {
            const mapa = {
                'á': 'a', 'à': 'a', 'â': 'a', 'ã': 'a', 'ä': 'a',
                'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e',
                'í': 'i', 'ì': 'i', 'î': 'i', 'ï': 'i',
                'ó': 'o', 'ò': 'o', 'ô': 'o', 'õ': 'o', 'ö': 'o',
                'ú': 'u', 'ù': 'u', 'û': 'u', 'ü': 'u',
                'ç': 'c'
            };
            return mapa[char] || char;
        });
}

// Carrega as durações dos serviços do Supabase com cache
// Retorna um objeto: { "canal": 60, "limpeza": 30, ... }
async function carregarDuracoesServicos() {
    try {
        // Verifica se o cache é válido
        if (isDuracoesCacheValido()) {
            console.log('Durações de serviços carregadas do cache');
            const cached = obterDuracoesDoCache();
            // atualizar referência global para uso imediato
            window.duracoesServicosCache = cached || {};
            return cached;
        }

        // Se cache inválido, faz o fetch
        const { data, error } = await _supabase
            .from('servicos_tempo')
            .select('servico, duracao_minuto');

        if (error) throw error;

        if (!data || data.length === 0) {
            console.warn('Nenhum serviço com duração encontrado na tabela');
            window.duracoesServicosCache = {};
            return {};
        }

        // Cria um objeto normalizado { "servico": duracao }
        const duracoes = {};
        data.forEach(item => {
            const servicoNormalizado = normalizarServicoNome(item.servico);
            duracoes[servicoNormalizado] = item.duracao_minuto;
        });

        // Salva em cache
        salvarDuracoesEmCache(duracoes);
        // guarda também na variável global para acesso rápido
        window.duracoesServicosCache = duracoes;

        console.log('Durações de serviços carregadas do Supabase e cacheadas');
        return duracoes;

    } catch (err) {
        console.error('Erro ao buscar durações de serviços:', err);

        // Se falhar, tenta retornar do cache mesmo que expirado
        const duracoesCache = obterDuracoesDoCache();
        if (duracoesCache) {
            console.log('Retornando durações do cache (expirado) devido a erro');
            window.duracoesServicosCache = duracoesCache;
            return duracoesCache;
        }

        window.duracoesServicosCache = {};
        return {};
    }
}

// Obtém a duração de um serviço específico
// Antes de disparar qualquer fetch, tenta usar a tabela pré-carregada em
// `window.duracoesServicosCache` (populada por carregarDuracoesServicos
// quando a página inicializa). Isso evita um segundo request quando o
// usuário só está selecionando coisas na UI.
async function obterDuracaoServico(nomeServico) {
    // procura no cache global se existir
    if (window.duracoesServicosCache) {
        const chave = normalizarServicoNome(nomeServico);
        return window.duracoesServicosCache[chave] || 0;
    }

    // fallback: carrega via Supabase (pode acionar fetch ou cache)
    const duracoes = await carregarDuracoesServicos();
    const servicoNormalizado = normalizarServicoNome(nomeServico);
    return duracoes[servicoNormalizado] || 0;
}

// CACHE NO LOCALSTORAGE
const STORAGE_KEY = 'meus_agendamentos_ids';

// Salva um novo ID no array local
function salvarIdLocalmente(novoId) {
    let listaIds = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!listaIds.includes(novoId)) {
        listaIds.push(novoId);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(listaIds));
}

// Lê todos os IDs salvos
function lerIdsLocais() {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
}

// Remove IDs de agendamentos com datas passadas do cache
// Remove IDs de agendamentos com datas/horários passados do cache
function limparIdsComDataPassada(agendamentos) {
    const agora = new Date();

    const idsValidos = [];

    agendamentos.forEach((item) => {
        try {
            if (!item || !item.id) {
                return;
            }

            let data = String(item.data || '').trim();
            let horario = String(item.horario || '').trim();

            if (!data) {
                idsValidos.push(item.id);
                return;
            }

            let dataObj;

            if (data.includes('/')) {
                // Formato DD/MM/YYYY
                const [dia, mes, ano] = data.split('/').map(Number);

                if (isNaN(dia) || isNaN(mes) || isNaN(ano)) {
                    idsValidos.push(item.id);
                    return;
                }

                dataObj = new Date(ano, mes - 1, dia);
            } else if (data.includes('-')) {
                // Formato YYYY-MM-DD
                const [ano, mesStr, diaStr] = data.split('-');
                const mes = parseInt(mesStr);
                const dia = parseInt(diaStr);
                const anoNum = parseInt(ano);

                if (isNaN(dia) || isNaN(mes) || isNaN(anoNum)) {
                    idsValidos.push(item.id);
                    return;
                }

                dataObj = new Date(anoNum, mes - 1, dia);
            } else {
                idsValidos.push(item.id);
                return;
            }

            if (isNaN(dataObj.getTime())) {
                idsValidos.push(item.id);
                return;
            }

            // Se tem horário, adiciona à comparação
            if (horario && horario.includes(':')) {
                const [horas, minutos] = horario.split(':').map(Number);

                if (!isNaN(horas) && !isNaN(minutos)) {
                    dataObj.setHours(horas, minutos, 0, 0);
                } else {
                    dataObj.setHours(0, 0, 0, 0);
                }
            } else {
                dataObj.setHours(0, 0, 0, 0);
            }

            // Só mantém se a data/hora é futura
            if (dataObj > agora) {
                idsValidos.push(item.id);
            }
        } catch (err) {
            if (item && item.id) {
                idsValidos.push(item.id);
            }
        }
    });

    localStorage.setItem(STORAGE_KEY, JSON.stringify(idsValidos));
}

// Carrega os agendamentos do usuário
async function carregarMeusAgendamentos(conteudoLista) {
    // Esconde a mensagem de comparecimento no início do carregamento
    const msgComparencimento = document.getElementById('msgComparencimento');
    if (msgComparencimento) {
        msgComparencimento.style.display = 'none';
    }

    conteudoLista.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; padding: 40px 20px;">
            <div style="width: 50px; height: 50px; border: 4px solid #f0f0f0; border-top: 4px solid #d37c7cd7; border-radius: 50%; animation: spin-loader 1s linear infinite;"></div>
            <p style="color: #666; font-size: 14px; margin: 0;">Carregando seus agendamentos...</p>
        </div>
        <style>
            @keyframes spin-loader {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        </style>
    `;

    const meusIds = (lerIdsLocais() || []).filter(Boolean);

    if (meusIds.length === 0) {
        conteudoLista.innerHTML = '<p>Você ainda não fez agendamentos neste dispositivo.</p>';
        return;
    }

    try {
        console.log('IDs salvos no localStorage:', meusIds);

        const { data, error } = await _supabase
            .rpc('buscar_agendamentos_por_ids', { lista_ids: meusIds });

        if (error) throw error;

        if (!data || data.length === 0) {
            conteudoLista.innerHTML = '<p>Nenhum registro encontrado.</p>';
            // Esconde a mensagem de comparecimento se não houver agendamentos
            const msgComparencimento = document.getElementById('msgComparencimento');
            if (msgComparencimento) {
                msgComparencimento.style.display = 'none';
            }
            return;
        }

        // Limpa IDs de agendamentos com datas passadas
        limparIdsComDataPassada(data);

        // Obtém os IDs válidos após a limpeza
        const idsValidos = (lerIdsLocais() || []).filter(Boolean);

        // Filtra apenas os agendamentos com IDs válidos
        const agendamentosValidos = data.filter(item => idsValidos.includes(item.id));

        if (agendamentosValidos.length === 0) {
            conteudoLista.innerHTML = '<p>Você ainda não fez agendamentos válidos neste dispositivo.</p>';
            const msgComparencimento = document.getElementById('msgComparencimento');
            if (msgComparencimento) {
                msgComparencimento.style.display = 'none';
            }
            return;
        }

        let html = '<div class="agendamentos-grid">';
        agendamentosValidos.forEach(item => {
            html += `
                <div class="card-agendamento">
                    <div class="card-header">
                        <div class="card-usuario">
                            <i class="ri-user-line"></i>
                            <span class="card-nome">${item.nome}</span>
                        </div>
                        <div class="card-status">
                            <span class="badge-agendado">Agendado</span>
                        </div>
                    </div>
                    <div class="card-body">
                        <div class="card-item">
                            <i class="ri-phone-line"></i>
                            <span class="card-label">Telefone</span>
                            <span class="card-value">${item.telefone}</span>
                        </div>
                        <div class="card-item">
                            <i class="ri-bubble-chart-line"></i>
                            <span class="card-label">Serviço</span>
                            <span class="card-value">${item.servico}</span>
                        </div>
                    </div>
                    <div class="card-footer">
                        <div class="card-item-footer">
                            <i class="ri-calendar-line"></i>
                            <div>
                                <span class="card-label">Data</span>
                                <span class="card-value">${item.data}</span>
                            </div>
                        </div>
                        <div class="card-item-footer">
                            <i class="ri-time-line"></i>
                            <div>
                                <span class="card-label">Horário</span>
                                <span class="card-value">${item.horario}</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        conteudoLista.innerHTML = html;

        // Mostra a mensagem de comparecimento após os cards serem renderizados
        const msgComparencimento = document.getElementById('msgComparencimento');
        if (msgComparencimento) {
            msgComparencimento.style.display = 'block';
        }

    } catch (err) {
        console.error('Erro ao buscar agendamentos:', err);
        conteudoLista.innerHTML = `<p style="color:red">Erro ao carregar: ${err.message}</p>`;
    }
}

// CACHE DE SERVIÇOS
const SERVICOS_CACHE_KEY = 'servicos_cache';
const SERVICOS_CACHE_EXPIRY = 30 * 1000; // 30 segundos em milissegundos

// Verifica se o cache de serviços é válido
function isCacheValido() {
    const cached = localStorage.getItem(SERVICOS_CACHE_KEY);
    if (!cached) return false;

    try {
        const cacheData = JSON.parse(cached);
        const now = Date.now();
        const isValido = (now - cacheData.timestamp) < SERVICOS_CACHE_EXPIRY;

        if (!isValido) {
            localStorage.removeItem(SERVICOS_CACHE_KEY);
        }

        return isValido;
    } catch (err) {
        localStorage.removeItem(SERVICOS_CACHE_KEY);
        return false;
    }
}

// Salva serviços em cache
function salvarServicosEmCache(servicos) {
    const cacheData = {
        servicos: servicos,
        timestamp: Date.now()
    };
    localStorage.setItem(SERVICOS_CACHE_KEY, JSON.stringify(cacheData));
}

// Obtém serviços do cache
function obterServicosDoCache() {
    const cached = localStorage.getItem(SERVICOS_CACHE_KEY);
    if (!cached) return null;

    try {
        const cacheData = JSON.parse(cached);
        return cacheData.servicos;
    } catch (err) {
        return null;
    }
}

// Carrega os serviços disponíveis do Supabase com cache
async function carregarServicosDisponiveis() {
    try {
        // Verifica se o cache é válido
        if (isCacheValido()) {
            console.log('Serviços carregados do cache');
            return obterServicosDoCache();
        }

        // Se cache inválido, faz o fetch
        const { data, error } = await _supabase
            .from('arch_de_contx')
            .select('servicos')
            .limit(1);

        if (error) throw error;

        if (!data || data.length === 0) {
            console.warn('Nenhum serviço encontrado na tabela');
            return [];
        }

        const servicosString = data[0].servicos;
        if (!servicosString) {
            console.warn('Campo servicos vazio');
            return [];
        }

        // Separar por vírgulas e remover espaços em branco
        const servicos = servicosString
            .split(',')
            .map(servico => servico.trim())
            .filter(servico => servico.length > 0);

        // Salva em cache
        salvarServicosEmCache(servicos);

        console.log('Serviços carregados do Supabase e cacheados');
        return servicos;

    } catch (err) {
        console.error('Erro ao buscar serviços:', err);

        // Se falhar, tenta retornar do cache mesmo que expirado
        const servicosCache = obterServicosDoCache();
        if (servicosCache) {
            console.log('Retornando serviços do cache (expirado) devido a erro');
            return servicosCache;
        }

        return [];
    }
}

// CACHE DE DATAS
const DATAS_CACHE_KEY = 'datas_cache';
const DATAS_CACHE_EXPIRY = 30 * 1000; // 30 segundos em milissegundos

// Verifica se o cache de datas é válido
function isDatassCacheValido() {
    const cached = localStorage.getItem(DATAS_CACHE_KEY);
    if (!cached) return false;

    try {
        const cacheData = JSON.parse(cached);
        const now = Date.now();
        const isValido = (now - cacheData.timestamp) < DATAS_CACHE_EXPIRY;

        if (!isValido) {
            localStorage.removeItem(DATAS_CACHE_KEY);
        }

        return isValido;
    } catch (err) {
        localStorage.removeItem(DATAS_CACHE_KEY);
        return false;
    }
}

// Salva datas em cache
function salvarDatasEmCache(datas) {
    const cacheData = {
        datas: datas,
        timestamp: Date.now()
    };
    localStorage.setItem(DATAS_CACHE_KEY, JSON.stringify(cacheData));
}

// Obtém datas do cache
function obterDatasDoCache() {
    const cached = localStorage.getItem(DATAS_CACHE_KEY);
    if (!cached) return null;

    try {
        const cacheData = JSON.parse(cached);
        return cacheData.datas;
    } catch (err) {
        return null;
    }
}

// Carrega as datas disponíveis do Supabase com cache
async function carregarDatasDisponiveis() {
    try {
        // Verifica se o cache é válido
        if (isDatassCacheValido()) {
            console.log('Datas carregadas do cache');
            return obterDatasDoCache();
        }

        // Se cache inválido, faz o fetch
        const { data, error } = await _supabase
            .from('arch_de_contx')
            .select('datas')
            .limit(1);

        if (error) throw error;

        if (!data || data.length === 0) {
            console.warn('Nenhuma data encontrada na tabela');
            return [];
        }

        const datasString = data[0].datas;
        if (!datasString) {
            console.warn('Campo datas vazio');
            return [];
        }

        // Separar por vírgulas e remover espaços em branco
        const datas = datasString
            .split(',')
            .map(data => data.trim())
            .filter(data => data.length > 0)
            .sort();

        // Salva em cache
        salvarDatasEmCache(datas);

        console.log('Datas carregadas do Supabase e cacheadas');
        return datas;

    } catch (err) {
        console.error('Erro ao buscar datas:', err);

        // Se falhar, tenta retornar do cache mesmo que expirado
        const datasCache = obterDatasDoCache();
        if (datasCache) {
            console.log('Retornando datas do cache (expirado) devido a erro');
            return datasCache;
        }

        return [];
    }
}

// CACHE DE HORÁRIOS
const HORARIOS_CACHE_KEY = 'horarios_cache';
const HORARIOS_CACHE_EXPIRY = 30 * 1000; // 30 segundos em milissegundos

// Verifica se o cache de horários é válido
function isHorariosCacheValido() {
    const cached = localStorage.getItem(HORARIOS_CACHE_KEY);
    if (!cached) return false;

    try {
        const cacheData = JSON.parse(cached);
        const now = Date.now();
        const isValido = (now - cacheData.timestamp) < HORARIOS_CACHE_EXPIRY;

        if (!isValido) {
            localStorage.removeItem(HORARIOS_CACHE_KEY);
        }

        return isValido;
    } catch (err) {
        localStorage.removeItem(HORARIOS_CACHE_KEY);
        return false;
    }
}

// Salva horários em cache
function salvarHorariosEmCache(horarios) {
    const cacheData = {
        horarios: horarios,
        timestamp: Date.now()
    };
    localStorage.setItem(HORARIOS_CACHE_KEY, JSON.stringify(cacheData));
}

// Obtém horários do cache
function obterHorariosDoCache() {
    const cached = localStorage.getItem(HORARIOS_CACHE_KEY);
    if (!cached) return null;

    try {
        const cacheData = JSON.parse(cached);
        return cacheData.horarios;
    } catch (err) {
        return null;
    }
}

// Expande um intervalo de horas em horários de 30 em 30 minutos
// Observação: não inclui o horário final do intervalo (ex.: para "08:00-12:00" retorna até "11:30", NÃO inclui "12:00").
function expandirFaixaHoraria(faixaStr) {
    const [inicio, fim] = faixaStr.split('-').map(h => h.trim());

    const [horaInicio, minInicio] = inicio.split(':').map(Number);
    const [horaFim, minFim] = fim.split(':').map(Number);

    const minutosInicio = horaInicio * 60 + minInicio;
    const minutosFim = horaFim * 60 + minFim;

    const horarios = [];
    // Gera slots de 30 em 30 minutos até, mas EXCLUINDO, o minuto final do intervalo
    for (let min = minutosInicio; min < minutosFim; min += 30) {
        const h = String(Math.floor(min / 60)).padStart(2, '0');
        const m = String(min % 60).padStart(2, '0');
        horarios.push(`${h}:${m}`);
    }

    return horarios;
}

// Processa os horários da string do banco
// Formato esperado: "08:00-12:00,13:00-17:00/09:00-13:00,14:00-18:00"
// Retorna um objeto: { "2025-02-15": ["08:00", "08:30", ...], "2025-02-16": [...] }
function processarHorarios(horariosString, datasDisponiveisString) {
    try {
        const horariosArray = horariosString.split('/').map(h => h.trim());
        const datasArray = datasDisponiveisString.split(',').map(d => d.trim());

        console.log('Horários por dia:', horariosArray);
        console.log('Datas disponíveis:', datasArray);

        if (horariosArray.length !== datasArray.length) {
            console.warn(`Número de horários (${horariosArray.length}) não corresponde ao número de datas (${datasArray.length})`);
        }

        const horariosPorData = {};
        const finaisPorData = {}; // guarda os horários FINAIS originais por data (para sanitização segura)

        horariosArray.forEach((horariosDia, index) => {
            if (index >= datasArray.length) {
                console.warn(`Horário ${index} não tem data correspondente`);
                return;
            }

            let dataStr = datasArray[index];

            // Converte para formato YYYY-MM-DD se necessário
            if (dataStr.includes('/')) {
                const [dia, mes, ano] = dataStr.split('/');
                dataStr = `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
            }

            // Processa as faixas de horário deste dia (separadas por vírgula)
            const faixas = horariosDia.split(',').map(f => f.trim());
            const horariosExpandidos = [];
            finaisPorData[dataStr] = new Set();

            faixas.forEach(faixa => {
                // Expande a faixa em slots de 30 minutos
                const horariosExpandidosFaixa = expandirFaixaHoraria(faixa);

                // Normaliza o horário final da faixa (defensivo) e remove qualquer slot
                // que coincida exatamente com o fim do intervalo — assim garantimos
                // que o "horário final do intervalo" NÃO aparecerá como badge.
                const partes = faixa.split('-').map(s => s.trim());
                const fimStrRaw = partes[1] || null;

                if (fimStrRaw) {
                    const [fh, fm] = fimStrRaw.split(':').map(Number);
                    const fimNormalized = `${String(fh).padStart(2, '0')}:${String(fm).padStart(2, '0')}`;

                    // registra o horário final original para sanitização posterior
                    finaisPorData[dataStr].add(fimNormalized);

                    const filtrados = horariosExpandidosFaixa.filter(h => h !== fimNormalized);
                    if (filtrados.length !== horariosExpandidosFaixa.length) {
                        console.log(`[processarHorarios] removido horário final do intervalo (${fimNormalized}) da faixa: ${faixa}`);
                    }

                    horariosExpandidos.push(...filtrados);
                } else {
                    horariosExpandidos.push(...horariosExpandidosFaixa);
                }
            });

            horariosPorData[dataStr] = horariosExpandidos;
            console.log(`Horários da data ${dataStr}:`, horariosExpandidos);
        });

        // Sanitiza usando apenas os horários FINAIS conhecidos — assim **não** removemos
        // o penúltimo (ou qualquer outro) quando ele não corresponde ao final original.
        return sanitizeHorariosPorData(horariosPorData, finaisPorData);
    } catch (error) {
        console.error('Erro ao processar horários:', error);
        return {};
    }
}

// Remove o último horário de cada sequência contínua **APENAS** se esse horário
// corresponde ao horário FINAL original de uma faixa.
// finaisPorData (opcional) deve ser um objeto { 'YYYY-MM-DD': Set(['11:40','16:30',...]) }
function sanitizeHorariosPorData(horariosPorData, finaisPorData = null) {
    const resultado = {};

    Object.keys(horariosPorData || {}).forEach(date => {
        // Normaliza e ordena horários
        const arr = Array.from(new Set((horariosPorData[date] || []).map(s => String(s).trim()).filter(Boolean)));
        arr.sort((a, b) => horarioParaMinutos(a) - horarioParaMinutos(b));

        const toRemove = new Set();
        let runStart = 0;

        for (let i = 0; i < arr.length; i++) {
            const current = horarioParaMinutos(arr[i]);
            const next = i + 1 < arr.length ? horarioParaMinutos(arr[i + 1]) : null;

            if (next !== null && next - current === 30) {
                // ainda dentro da sequência contínua
            } else {
                // fim da sequência - se a sequência tiver >= 2 slots, consideramos remover
                const runLength = i - runStart + 1;
                if (runLength >= 2) {
                    const candidato = arr[i];

                    // Se nos forneceram os horários finais originais, só removemos
                    // quando o candidato for explicitamente um horário final nessa data.
                    if (finaisPorData && finaisPorData[date] && finaisPorData[date].has(candidato)) {
                        toRemove.add(candidato);
                        console.log(`[sanitizeHorariosPorData] remoção do horário final da sequência em ${date}: ${candidato}`);
                    } else if (!finaisPorData) {
                        // Comportamento legado (sem informações dos finais): remove como antes.
                        toRemove.add(candidato);
                        console.log(`[sanitizeHorariosPorData][legacy] remoção do horário final da sequência em ${date}: ${candidato}`);
                    } else {
                        // Não remover — candidato NÃO corresponde ao fim original
                        console.log(`[sanitizeHorariosPorData] candidato ${candidato} NÃO corresponde a um fim original; preservado`);
                    }
                }
                runStart = i + 1;
            }
        }

        resultado[date] = arr.filter(h => !toRemove.has(h));
    });

    return resultado;

}

// Carrega os horários disponíveis do Supabase com cache
// Retorna um objeto: { "2025-02-15": ["08:00", "08:30", ...], "2025-02-16": [...] }
async function carregarHorariosDisponiveis() {
    try {
        // Verifica se o cache é válido
        if (isHorariosCacheValido()) {
            console.log('Horários carregados do cache (rápido, via localStorage)');
            return obterHorariosDoCache() || {};
        }

        // Se cache inválido, faz o fetch
        const { data, error } = await _supabase
            .from('arch_de_contx')
            .select('horarios, datas')
            .limit(1);

        if (error) throw error;

        if (!data || data.length === 0) {
            console.warn('Nenhum horário encontrado na tabela');
            return {};
        }

        const horariosString = data[0].horarios;
        const datasString = data[0].datas;

        if (!horariosString || !datasString) {
            console.warn('Campo horarios ou datas vazio');
            return {};
        }

        // Processa os horários
        const horariosPorData = processarHorarios(horariosString, datasString);

        // Salva em cache
        salvarHorariosEmCache(horariosPorData);

        console.log('Horários carregados do Supabase e cacheados');
        return horariosPorData;

    } catch (err) {
        console.error('Erro ao buscar horários:', err);

        // Se falhar, tenta retornar do cache mesmo que expirado
        const horariosCache = obterHorariosDoCache();
        if (horariosCache) {
            console.log('Retornando horários do cache (expirado) devido a erro');
            return horariosCache;
        }

        return {};
    }
}

// CACHE DE HORÁRIOS OCUPADOS
const HORARIOS_OCUPADOS_CACHE_KEY = 'horarios_ocupados_cache';
const HORARIOS_OCUPADOS_CACHE_EXPIRY = 30 * 1000; // 30 segundos em milissegundos

// Verifica se o cache de horários ocupados é válido
function isHorariosOcupadosCacheValido() {
    const cached = localStorage.getItem(HORARIOS_OCUPADOS_CACHE_KEY);
    if (!cached) return false;

    try {
        const cacheData = JSON.parse(cached);
        const now = Date.now();
        const isValido = (now - cacheData.timestamp) < HORARIOS_OCUPADOS_CACHE_EXPIRY;

        if (!isValido) {
            localStorage.removeItem(HORARIOS_OCUPADOS_CACHE_KEY);
        }

        return isValido;
    } catch (err) {
        localStorage.removeItem(HORARIOS_OCUPADOS_CACHE_KEY);
        return false;
    }
}

// Invalida o cache de horários ocupados (para usar quando servico ou data muda)
function invalidarCacheHorariosOcupados() {
    localStorage.removeItem(HORARIOS_OCUPADOS_CACHE_KEY);
    console.log('[Cache] Horários ocupados invalidados');
}

// Salva horários ocupados em cache
function salvarHorariosOcupadosEmCache(horariosOcupados) {
    const cacheData = {
        horariosOcupados: horariosOcupados,
        timestamp: Date.now()
    };
    localStorage.setItem(HORARIOS_OCUPADOS_CACHE_KEY, JSON.stringify(cacheData));
}

// Obtém horários ocupados do cache
function obterHorariosOcupadosDoCache() {
    const cached = localStorage.getItem(HORARIOS_OCUPADOS_CACHE_KEY);
    if (!cached) return null;

    try {
        const cacheData = JSON.parse(cached);
        return cacheData.horariosOcupados;
    } catch (err) {
        return null;
    }
}

// Carrega os horários ocupados do Supabase com cache
// Retorna um objeto: { "2025-02-15": ["08:00", "08:30", ...], "2025-02-16": [...] }
async function carregarHorariosOcupados() {
    try {
        // Verifica se o cache é válido
        if (isHorariosOcupadosCacheValido()) {
            console.log('[Horários Ocupados] Carregando do cache (válido)');
            return obterHorariosOcupadosDoCache();
        }

        // Se cache inválido, faz o fetch pela RPC
        console.log('[Horários Ocupados] Cache inválido ou não existe, buscando da RPC...');
        const { data, error } = await _supabase
            .rpc('buscar_horarios_ocupados');

        if (error) {
            console.error('[Horários Ocupados] Erro da RPC:', error);
            throw error;
        }

        console.log('[Horários Ocupados] Resposta bruta da RPC:', data, typeof data);

        // Converte a resposta em objeto { data: [horarios_intervalos] }
        const horariosOcupadosPorData = {};

        if (!data) {
            console.warn('[Horários Ocupados] A RPC retornou null ou undefined');
            salvarHorariosOcupadosEmCache(horariosOcupadosPorData);
            return horariosOcupadosPorData;
        }

        if (!Array.isArray(data)) {
            console.warn('[Horários Ocupados] A resposta da RPC não é um array:', typeof data);
            salvarHorariosOcupadosEmCache(horariosOcupadosPorData);
            return horariosOcupadosPorData;
        }

        data.forEach((item, index) => {
            console.log(`[Horários Ocupados] Item ${index}:`, item);

            if (!item || typeof item !== 'object') {
                console.warn(`[Horários Ocupados] Item ${index} é inválido:`, item);
                return;
            }

            if (!item.data) {
                console.warn(`[Horários Ocupados] Item ${index} não tem campo 'data'`);
                return;
            }

            // Normaliza a data se necessário
            let dataStr = String(item.data).trim();
            if (dataStr.includes('/')) {
                const [dia, mes, ano] = dataStr.split('/');
                dataStr = `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
            }

            // Garante que horarios_ocupados é um array de strings
            let horariosArray = item.horarios_ocupados;
            if (!Array.isArray(horariosArray)) {
                console.warn(`[Horários Ocupados] Para data ${dataStr}, horarios_ocupados não é array:`, horariosArray, typeof horariosArray);
                horariosArray = [];
            }

            // Filtra e limpa os valores (remove null/undefined)
            horariosArray = horariosArray.filter(h => h && typeof h === 'string');

            console.log(`[Horários Ocupados] Horários ocupados para ${dataStr}:`, horariosArray);
            horariosOcupadosPorData[dataStr] = horariosArray;
        });

        // Salva em cache
        salvarHorariosOcupadosEmCache(horariosOcupadosPorData);

        console.log('[Horários Ocupados] Carregado do Supabase e cacheado:', horariosOcupadosPorData);
        return horariosOcupadosPorData;

    } catch (err) {
        console.error('[Horários Ocupados] Erro ao buscar:', err);
        console.error('[Horários Ocupados] Stack:', err.stack);

        // Se falhar, tenta retornar do cache mesmo que expirado
        const horariosOcupadosCache = obterHorariosOcupadosDoCache();
        if (horariosOcupadosCache) {
            console.log('[Horários Ocupados] Retornando do cache (expirado) devido a erro');
            return horariosOcupadosCache;
        }

        return {};
    }
}

// Salva novo agendamento
async function salvarNovoAgendamento(nome, telefone, servico, data, horario) {
    // Garante que data e horario sejam strings (text)
    const dataTexto = String(data);
    const horarioTexto = String(horario);

    const { data: novoId, error } = await _supabase
        .rpc('salvar_agendamento_rpc', {
            data_input: dataTexto,
            horario_input: horarioTexto,
            nome_input: nome,
            servico_input: servico,
            telefone_input: telefone
        });

    if (error) {
        throw error;
    }

    salvarIdLocalmente(novoId);
    return novoId;
}
