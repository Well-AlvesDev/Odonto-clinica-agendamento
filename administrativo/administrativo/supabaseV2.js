// ===================================================
// CONFIGURAÇÃO - REUTILIZAR DO ARQUIVO PRINCIPAL
// ===================================================

const supabaseUrl = 'https://kqmfhrnoevcckbjafuxq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxbWZocm5vZXZjY2tiamFmdXhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MTI5MDUsImV4cCI6MjA4NjQ4ODkwNX0.7HP95_6KrJ954oW0MWXnewqmYCewACuCE2rOzNnY9fw';

const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

// ===================================================
// VARIÁVEL GLOBAL PARA ARMAZENAR AGENDAMENTOS
// ===================================================

let agendamentosGlobais = [];

// ===================================================
// FUNÇÃO DE LOGIN SEGURO
// ===================================================

async function fazerLogin() {
    // Pegar valores dos inputs
    const nomeUsuario = document.getElementById('nomeUsuario').value.trim();
    const senhaUsuario = document.getElementById('senhaUsuario').value;

    // Validar campos vazios
    if (!nomeUsuario || !senhaUsuario) {
        mostrarErro('Por favor, preencha nome de usuário e senha');
        return;
    }

    // Mostrar loading
    const botaoEntrar = document.getElementById('botaoEntrar');
    const textoBotaoOriginal = botaoEntrar.textContent;
    botaoEntrar.textContent = 'Entrando...';
    botaoEntrar.disabled = true;

    try {
        // Chamar RPC (Remote Procedure Call) para a função segura no Supabase
        const { data, error } = await _supabase.rpc('validar_login_admin', {
            p_nome: nomeUsuario,
            p_senha: senhaUsuario
        });

        // Restaurar botão
        botaoEntrar.textContent = textoBotaoOriginal;
        botaoEntrar.disabled = false;

        // Verificar erros na chamada RPC
        if (error) {
            console.error('Erro na RPC:', error);
            mostrarErro('Erro ao conectar com o servidor. Tente novamente.');
            return;
        }

        // Verificar resposta
        if (data && data.length > 0) {
            const resultado = data[0];

            if (resultado.sucesso) {
                // Login bem-sucedido
                mostrarSucesso(resultado.mensagem);
                agendamentosGlobais = resultado.agendamentos || [];

                // Debug: mostrar agendamentos no console
                console.log('Agendamentos retornados:', agendamentosGlobais);
                console.log('Quantidade de agendamentos:', agendamentosGlobais.length);

                // Salvar em sessionStorage para outras páginas acessarem
                sessionStorage.setItem('usuarioLogado', nomeUsuario);
                // manter também a senha em cache de sessão conforme solicitado
                sessionStorage.setItem('senhaUsuario', senhaUsuario);
                sessionStorage.setItem('agendamentos', JSON.stringify(agendamentosGlobais));

                // Redirecionar para página de agendamentos após 1.5 segundos
                setTimeout(() => {
                    window.location.href = './home.html';
                }, 1500);
            } else {
                // Credenciais inválidas
                mostrarErro(resultado.mensagem);
            }
        } else {
            mostrarErro('Resposta inválida do servidor');
        }
    } catch (erro) {
        console.error('Erro ao fazer login:', erro);
        mostrarErro('Erro inesperado. Verifique a conexão e tente novamente.');
        botaoEntrar.textContent = textoBotaoOriginal;
        botaoEntrar.disabled = false;
    }
}

// ===================================================
// FUNÇÕES DE FEEDBACK AO USUÁRIO
// ===================================================

function mostrarErro(mensagem) {
    const elementoMensagem = document.getElementById('mensagemErro');
    elementoMensagem.textContent = mensagem;
    elementoMensagem.style.display = 'block';
    elementoMensagem.style.color = '#d32f2f';
    elementoMensagem.style.backgroundColor = '#ffebee';

    // Limpar mensagem após 5 segundos
    setTimeout(() => {
        elementoMensagem.style.display = 'none';
    }, 5000);
}

function mostrarSucesso(mensagem) {
    const elementoMensagem = document.getElementById('mensagemErro');
    elementoMensagem.textContent = mensagem;
    elementoMensagem.style.display = 'block';
    elementoMensagem.style.color = '#2e7d32';
    elementoMensagem.style.backgroundColor = '#e8f5e9';
}

// ===================================================
// PERMITIR LOGIN AO PRESSIONAR ENTER
// ===================================================

document.addEventListener('DOMContentLoaded', function () {
    const nomeInput = document.getElementById('nomeUsuario');
    const senhaInput = document.getElementById('senhaUsuario');

    // Preencher campos com valores em cache (se existirem)
    const cachedUser = sessionStorage.getItem('usuarioLogado');
    const cachedPass = sessionStorage.getItem('senhaUsuario');
    if (nomeInput && cachedUser) {
        nomeInput.value = cachedUser;
    }
    if (senhaInput && cachedPass) {
        senhaInput.value = cachedPass;
    }

    // Permitir enter nos inputs
    if (nomeInput && senhaInput) {
        nomeInput.addEventListener('keypress', function (event) {
            if (event.key === 'Enter') {
                fazerLogin();
            }
        });

        senhaInput.addEventListener('keypress', function (event) {
            if (event.key === 'Enter') {
                fazerLogin();
            }
        });
    }
});

// ---------------------------------------------------
// Função auxiliar exposta globalmente para recuperar agendamentos
// com base em credenciais já em cache na sessão.
// ---------------------------------------------------
async function buscarAgendamentosDoServidor(nomeUsuario, senhaUsuario) {
    const { data, error } = await _supabase.rpc('validar_login_admin', {
        p_nome: nomeUsuario,
        p_senha: senhaUsuario
    });
    if (error) {
        throw error;
    }
    if (data && data.length > 0) {
        const resultado = data[0];
        if (resultado.sucesso) {
            return resultado.agendamentos || [];
        }
        throw new Error(resultado.mensagem || 'Login inválido');
    }
    throw new Error('Resposta inválida do servidor');
}

// ---------------------------------------------------
// Função auxiliar para solicitar exclusão de um agendamento
// no servidor usando credenciais de cache. O campo 'id' é
// um UUID, portanto a função SQL deve aceitar uuid como tipo
// (não integer). A função no banco deve ser criada com
// SECURITY DEFINER para poder bypassar as políticas RLS e
// apagar a linha.
// ---------------------------------------------------
async function excluirAgendamentoNoServidor(id, nomeUsuario, senhaUsuario) {
    // usamos um nome diferente para evitar ambiguidade se houver múltiplas
    // assinaturas no banco (ex: integer vs uuid). Certifique-se de que a
    // função SQL no servidor esteja criada como `excluir_agendamento_uuid`.
    const { data, error } = await _supabase.rpc('excluir_agendamento_uuid', {
        p_id: id,
        p_nome: nomeUsuario,
        p_senha: senhaUsuario
    });

    // DEBUG: ver o que o Supabase retornou
    console.log('RPC excluir_agendamento_uuid ->', { data, error });

    if (error) {
        throw error;
    }

    if (data) {
        // dependendo de como a função SQL foi definida, o retorno pode
        // vir como objeto direto ou como array de um elemento.
        const resultado = Array.isArray(data) ? data[0] : data;
        // sempre devolvemos o objeto para que o chamador trate `sucesso:false`
        return resultado || { sucesso: false, mensagem: 'Retorno vazio' };
    }

    // se `data` foi null/undefined algo deu muito errado na RPC
    throw new Error('Resposta inválida do servidor');
}

// tornar disponíveis na janela diretamente
window.buscarAgendamentosDoServidor = buscarAgendamentosDoServidor;
window.excluirAgendamentoNoServidor = excluirAgendamentoNoServidor;

// ---------------------------------------------------
// Função para buscar durações dos serviços do Supabase
// e armazenar em cache de sessão
// ---------------------------------------------------
async function buscarDuracaoServicosDoServidor() {
    const { data, error } = await _supabase
        .from('servicos_tempo')
        .select('servico, duracao_minuto');

    if (error) {
        console.error('Erro ao buscar duração dos serviços:', error);
        throw error;
    }

    // Converter array em objeto para acesso rápido por nome de serviço
    const duracaoMap = {};
    if (data && Array.isArray(data)) {
        data.forEach(item => {
            duracaoMap[item.servico] = item.duracao_minuto;
        });
    }

    console.log('Durações dos serviços carregadas:', duracaoMap);
    return duracaoMap;
}

// ---------------------------------------------------
// Função wrapper para carregar e cachear durações
// ---------------------------------------------------
async function carregarDuracaoServicos() {
    try {
        const duracoes = await buscarDuracaoServicosDoServidor();
        sessionStorage.setItem('duracaoServicos', JSON.stringify(duracoes));
        return duracoes;
    } catch (erro) {
        console.error('Falha ao carregar durações dos serviços:', erro);
        // Tentar carregar do cache se tiver
        const cached = sessionStorage.getItem('duracaoServicos');
        if (cached) {
            return JSON.parse(cached);
        }
        throw erro;
    }
}

window.carregarDuracaoServicos = carregarDuracaoServicos;
