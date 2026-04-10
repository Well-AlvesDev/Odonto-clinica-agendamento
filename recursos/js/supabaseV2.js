// ===================================================
// CONFIGURAÇÃO - REUTILIZAR DO ARQUIVO PRINCIPAL
// ===================================================

const supabaseUrl = 'https://kqmfhrnoevcckbjafuxq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxbWZocm5vZXZjY2tiamFmdXhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MTI5MDUsImV4cCI6MjA4NjQ4ODkwNX0.7HP95_6KrJ954oW0MWXnewqmYCewACuCE2rOzNnY9fw';

const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

// ===================================================
// VARIÁVEL GLOBAL PARA CONTROLAR AUTO-REFRESH
// ===================================================

let intervalAutoRefreshAgendamentos = null;
const INTERVALO_AUTO_REFRESH_MS = 15000; // 15 segundos

// ===================================================
// FUNÇÃO PARA CALCULAR STATUS DO AGENDAMENTO
// ===================================================

/**
 * Calcula o status atual de um agendamento baseado no horário atual
 * @param {string} horario - Horário do agendamento (formato HH:MM)
 * @param {string} servico - Nome do serviço
 * @returns {string} - Status: 'pendente', 'agora' ou 'concluído'
 */
function calcularStatusAgendamento(horario, servico) {
    try {
        // Obter durações do sessionStorage
        const duracoesJson = sessionStorage.getItem('servicosDuracoes');
        const duracoes = duracoesJson ? JSON.parse(duracoesJson) : {};

        // Normalizar nome do serviço (mesmo padrão usado no backend)
        const servicoNormalizado = (servico || '')
            .toLowerCase()
            .trim();

        // Obter duração do serviço em minutos (padrão: 0 se não encontrar)
        const duracao = duracoes[servicoNormalizado] || 0;

        // Converter horário para minutos desde 00:00
        const [horas, minutos] = (horario || '00:00').split(':').map(Number);
        const horarioEmMinutos = horas * 60 + minutos;

        // Calcular horário de término
        const horariotermino = horarioEmMinutos + duracao;

        // Obter horário atual em minutos
        const agora = new Date();
        const horaAtual = agora.getHours();
        const minutoAtual = agora.getMinutes();
        const horarioAtualEmMinutos = horaAtual * 60 + minutoAtual;

        // Comparar e determinar status
        if (horarioAtualEmMinutos < horarioEmMinutos) {
            // Ainda não começou
            return 'pendente';
        } else if (horarioAtualEmMinutos >= horarioEmMinutos && horarioAtualEmMinutos < horariotermino) {
            // Está acontecendo agora
            return 'agora';
        } else {
            // Já encerrou
            return 'concluído';
        }
    } catch (erro) {
        console.error('Erro ao calcular status do agendamento:', erro);
        return 'pendente'; // Default para segurança
    }
}



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

                // Salvar em sessionStorage para outras páginas acessarem
                sessionStorage.setItem('usuarioLogado', nomeUsuario);
                // manter também a senha em cache de sessão conforme solicitado
                sessionStorage.setItem('senhaUsuario', senhaUsuario);
                sessionStorage.setItem('agendamentos', JSON.stringify(agendamentosGlobais));

                // Carregar e salvar durações dos serviços
                await carregarDuracesSessao();

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

    // Atualizar nome do usuário na página home
    atualizarNomeUsuario();
});

// ===================================================
// ATUALIZAR NOME DO USUÁRIO NA INTERFACE
// ===================================================

function atualizarNomeUsuario() {
    const usuarioLogado = sessionStorage.getItem('usuarioLogado');
    const elementoUsuario = document.getElementById('usuarioLogado');

    if (elementoUsuario && usuarioLogado) {
        elementoUsuario.innerHTML = `<i class="ri-user-line"></i> ${usuarioLogado}`;
    }
}

// ===================================================
// FUNÇÃO DE LOGOUT
// ===================================================

function fazerLogout() {
    // Mostrar modal de confirmação
    const confirmationLogoutOverlay = document.getElementById('confirmationLogoutOverlay');
    if (confirmationLogoutOverlay) {
        confirmationLogoutOverlay.classList.add('ativo');
    }
}

function fecharModalConfirmacao() {
    const confirmationLogoutOverlay = document.getElementById('confirmationLogoutOverlay');
    if (confirmationLogoutOverlay) {
        confirmationLogoutOverlay.classList.remove('ativo');
    }
}

function confirmarLogout() {
    // Fechar modal
    fecharModalConfirmacao();

    // Parar auto-refresh dos agendamentos
    pararAutoRefreshAgendamentos();

    // Limpar dados de sessão
    sessionStorage.removeItem('usuarioLogado');
    sessionStorage.removeItem('senhaUsuario');
    sessionStorage.removeItem('agendamentos');
    sessionStorage.removeItem('servicosDuracoes');

    // Redirecionar para página de login
    setTimeout(() => {
        window.location.href = './login.html';
    }, 300);
}

// ===================================================
// CARREGAR DURAÇÕES DOS SERVIÇOS PARA SESSÃO
// ===================================================

/**
 * Carrega as durações dos serviços do Supabase e salva em sessionStorage
 * para uso no cálculo de status dos agendamentos
 */
async function carregarDuracesSessao() {
    try {
        // Chamar a função já existente em supabase.js para carregar durações
        const duracoes = await carregarDuracoesServicos();

        // Normalizar os dados para armazenar apenas o nome do serviço e duração
        const duracoesNormalizadas = {};
        Object.keys(duracoes).forEach(chave => {
            // Chave já vem normalizada de carregarDuracoesServicos()
            duracoesNormalizadas[chave] = duracoes[chave].duracao;
        });

        // Salvar em sessionStorage para acesso rápido no cálculo de status
        sessionStorage.setItem('servicosDuracoes', JSON.stringify(duracoesNormalizadas));
        console.log('✓ Durações dos serviços carregadas e armazenadas na sessão');
    } catch (erro) {
        console.error('Erro ao carregar durações dos serviços:', erro);
        // Não é crítico - usar defaults (duração 0) se falhar
    }
}

function carregarDataAtual() {
    const hoje = new Date();
    const opcoes = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dataFormatada = hoje.toLocaleDateString('pt-BR', opcoes);
    const elementoData = document.getElementById('dataAtual');
    if (elementoData) {
        elementoData.textContent = `Hoje: ${dataFormatada}`;
    }
}

// ===================================================
// CARREGAR AGENDAMENTOS DE HOJE COM VALIDAÇÃO
// ===================================================

async function carregarAgendamentosHoje(autoRefresh = false) {
    try {
        // Validar se há usuário logado
        const usuarioLogado = sessionStorage.getItem('usuarioLogado');
        const senhaUsuario = sessionStorage.getItem('senhaUsuario');

        if (!usuarioLogado || !senhaUsuario) {
            console.warn('Nenhum usuário logado. Redirecionando para login...');
            // Parar auto-refresh se estiver ativo
            pararAutoRefreshAgendamentos();
            setTimeout(() => {
                window.location.href = './login.html';
            }, 1000);
            return;
        }

        // Mostrar carregando apenas se não for auto-refresh
        const containerAgendamentos = document.getElementById('agendamentosLista');
        if (containerAgendamentos && !autoRefresh) {
            containerAgendamentos.innerHTML = '<div class="carregando"><i class="ri-loader-4-line"></i> Carregando agendamentos...</div>';
        }

        // Chamar RPC com security definer passando nome e senha
        const { data, error } = await _supabase.rpc('obter_agendamentos_hoje', {
            p_nome_admin: usuarioLogado,
            p_senha_admin: senhaUsuario
        });

        // Verificar erros
        if (error) {
            console.error('Erro ao carregar agendamentos:', error);
            if (!autoRefresh) {
                mostrarErroAgendamentos('Erro ao carregar agendamentos. Tente recarregar a página.');
            }
            return;
        }

        // Processar e exibir agendamentos
        if (data && data.length > 0) {
            exibirAgendamentos(data);
        } else {
            exibirMensagemVazio();
        }

    } catch (erro) {
        console.error('Erro inesperado ao carregar agendamentos:', erro);
        if (!autoRefresh) {
            mostrarErroAgendamentos('Erro inesperado. Tente recarregar a página.');
        }
    }
}

// ===================================================
// INICIAR AUTO-REFRESH DOS AGENDAMENTOS A CADA 15 SEGUNDOS
// ===================================================

function iniciarAutoRefreshAgendamentos() {
    // Se já existe um intervalo, limpar antes
    if (intervalAutoRefreshAgendamentos) {
        clearInterval(intervalAutoRefreshAgendamentos);
    }

    // Carregar agendamentos imediatamente
    carregarAgendamentosHoje(false);

    // Configurar intervalo para atualizar a cada 15 segundos
    intervalAutoRefreshAgendamentos = setInterval(() => {
        carregarAgendamentosHoje(true);
    }, INTERVALO_AUTO_REFRESH_MS);

    console.log('✓ Auto-refresh de agendamentos ativado (a cada 15 segundos)');
}

// ===================================================
// PARAR AUTO-REFRESH DOS AGENDAMENTOS
// ===================================================

function pararAutoRefreshAgendamentos() {
    if (intervalAutoRefreshAgendamentos) {
        clearInterval(intervalAutoRefreshAgendamentos);
        intervalAutoRefreshAgendamentos = null;
        console.log('✓ Auto-refresh de agendamentos desativado');
    }
}

// ===================================================
// EXIBIR AGENDAMENTOS NA PÁGINA
// ===================================================

function exibirAgendamentos(agendamentos) {
    const containerAgendamentos = document.getElementById('agendamentosLista');

    if (!containerAgendamentos) return;

    // Limpar container
    containerAgendamentos.innerHTML = '';

    // Criar elementos para cada agendamento
    agendamentos.forEach(agendamento => {
        const cardAgendamento = document.createElement('div');
        cardAgendamento.className = 'agendamento-card';
        cardAgendamento.setAttribute('data-id', agendamento.id);

        // Calcular status do agendamento
        const status = calcularStatusAgendamento(agendamento.horario, agendamento.servico);
        cardAgendamento.setAttribute('data-status', status);

        // Formatar horário
        const horarioFormatado = agendamento.horario || 'Sem horário';

        // Texto e classe de status
        const statusTexto = {
            'pendente': 'Pendente',
            'agora': 'Em Andamento',
            'concluído': 'Concluído'
        };
        const statusClasse = `status-${status}`;

        cardAgendamento.innerHTML = `
            <div class="agendamento-info">
                <div class="agendamento-header">
                    <h3>${agendamento.nome}</h3>
                    <div class="agendamento-header-right">
                        <span class="agendamento-hora"><i class="ri-time-line"></i> ${horarioFormatado}</span>
                        <span class="agendamento-status ${statusClasse}">${statusTexto[status]}</span>
                    </div>
                </div>
                <div class="agendamento-detalhes">
                    <p class="agendamento-servico"><strong>Serviço:</strong> ${agendamento.servico || 'Não especificado'}</p>
                    <p class="agendamento-contato"><i class="ri-phone-line"></i> ${agendamento.telefone || 'Sem telefone'}</p>
                    <p class="agendamento-data"><i class="ri-calendar-line"></i> ${agendamento.data || 'Sem data'}</p>
                </div>
            </div>
        `;

        containerAgendamentos.appendChild(cardAgendamento);
    });
}

// ===================================================
// EXIBIR MENSAGEM DE VAZIO
// ===================================================

function exibirMensagemVazio() {
    const containerAgendamentos = document.getElementById('agendamentosLista');

    if (!containerAgendamentos) return;

    containerAgendamentos.innerHTML = `
        <div class="agendamentos-vazio">
            <i class="ri-calendar-blank-line"></i>
            <p>Nenhum agendamento para hoje</p>
        </div>
    `;
}

// ===================================================
// EXIBIR ERRO DE AGENDAMENTOS
// ===================================================

function mostrarErroAgendamentos(mensagem) {
    const containerAgendamentos = document.getElementById('agendamentosLista');

    if (!containerAgendamentos) return;

    containerAgendamentos.innerHTML = `
        <div class="agendamentos-erro">
            <i class="ri-alert-line"></i>
            <p>${mensagem}</p>
            <button class="btn-recarregar" onclick="carregarAgendamentosHoje()">
                <i class="ri-refresh-line"></i> Tentar novamente
            </button>
        </div>
    `;
}






