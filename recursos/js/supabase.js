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
                    <strong>Serviço:</strong> ${item.servico}
                </div>
            `;
        });
        conteudoLista.innerHTML = html;

    } catch (err) {
        console.error('Erro ao buscar agendamentos:', err);
        conteudoLista.innerHTML = `<p style="color:red">Erro ao carregar: ${err.message}</p>`;
    }
}

// Salva novo agendamento
async function salvarNovoAgendamento(nome, telefone, servico) {
    const { data: novoId, error } = await _supabase
        .rpc('salvar_agendamento_rpc', {
            nome_input: nome,
            telefone_input: telefone,
            servico_input: servico
        });

    if (error) {
        throw error;
    }

    salvarIdLocalmente(novoId);
    return novoId;
}
