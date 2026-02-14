// CONFIGURAÇÃO DO SUPABASE
const supabaseUrl = 'https://kqmfhrnoevcckbjafuxq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxbWZocm5vZXZjY2tiamFmdXhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MTI5MDUsImV4cCI6MjA4NjQ4ODkwNX0.7HP95_6KrJ954oW0MWXnewqmYCewACuCE2rOzNnY9fw';

const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

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

// Carrega os agendamentos do usuário
async function carregarMeusAgendamentos(conteudoLista) {
    conteudoLista.innerHTML = 'Carregando...';

    const meusIds = (lerIdsLocais() || []).filter(Boolean);

    if (meusIds.length === 0) {
        conteudoLista.innerHTML = '<p>Você ainda não fez agendamentos neste dispositivo.</p>';
        return;
    }

    try {
        console.log('IDs salvos no localStorage:', meusIds);

        const { data, error } = await _supabase
            .rpc('buscar_agendamentos_por_ids', { lista_ids: meusIds });

        console.log('Resposta da RPC:', { data, error });

        if (error) throw error;

        if (!data || data.length === 0) {
            conteudoLista.innerHTML = '<p>Nenhum registro encontrado.</p>';
            return;
        }

        let html = '';
        data.forEach(item => {
            html += `
                <div class="item-agendamento">
                    <strong>Nome:</strong> ${item.nome} <br>
                    <strong>Tel:</strong> ${item.telefone} <br>
                    <strong>Serviço:</strong> ${item.servico} <br>
                    <strong>Data:</strong> ${item.data} <br>
                    <strong>Horário:</strong> ${item.horario}
                </div>
            `;
        });
        conteudoLista.innerHTML = html;

    } catch (err) {
        console.error('Erro ao buscar agendamentos:', err);
        conteudoLista.innerHTML = `<p style="color:red">Erro ao carregar: ${err.message}</p>`;
    }
}

// CACHE DE SERVIÇOS
const SERVICOS_CACHE_KEY = 'servicos_cache';
const SERVICOS_CACHE_EXPIRY = 2 * 60 * 1000; // 2 minutos em milissegundos

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
const DATAS_CACHE_EXPIRY = 2 * 60 * 1000; // 2 minutos em milissegundos

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
const HORARIOS_CACHE_EXPIRY = 2 * 60 * 1000; // 2 minutos em milissegundos

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
// Exemplo: "08:00-12:00" retorna ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00"]
function expandirFaixaHoraria(faixaStr) {
    const [inicio, fim] = faixaStr.split('-').map(h => h.trim());

    const [horaInicio, minInicio] = inicio.split(':').map(Number);
    const [horaFim, minFim] = fim.split(':').map(Number);

    const minutosInicio = horaInicio * 60 + minInicio;
    const minutosFim = horaFim * 60 + minFim;

    const horarios = [];
    for (let min = minutosInicio; min <= minutosFim; min += 30) {
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

            faixas.forEach(faixa => {
                const horariosExpandidosFaixa = expandirFaixaHoraria(faixa);
                horariosExpandidos.push(...horariosExpandidosFaixa);
            });

            horariosPorData[dataStr] = horariosExpandidos;
            console.log(`Horários da data ${dataStr}:`, horariosExpandidos);
        });

        return horariosPorData;
    } catch (error) {
        console.error('Erro ao processar horários:', error);
        return {};
    }
}

// Carrega os horários disponíveis do Supabase com cache
// Retorna um objeto: { "2025-02-15": ["08:00", "08:30", ...], "2025-02-16": [...] }
async function carregarHorariosDisponiveis() {
    try {
        // Verifica se o cache é válido
        if (isHorariosCacheValido()) {
            console.log('Horários carregados do cache');
            return obterHorariosDoCache();
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
