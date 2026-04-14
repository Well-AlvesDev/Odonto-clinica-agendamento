// ===================================================
// CONFIGURAÇÃO - REUTILIZAR DO ARQUIVO PRINCIPAL (supabase.js)
// ===================================================
// supabaseUrl, supabaseKey e _supabase são definidos em supabase.js

// ===================================================
// VARIÁVEL GLOBAL PARA CONTROLAR AUTO-REFRESH
// ===================================================

let intervalAutoRefreshAgendamentos = null;
const INTERVALO_AUTO_REFRESH_MS = 15000; // 15 segundos
let agendamentoSelecionadoDetalhes = null;

// ===================================================
// FUNÇÃO PARA CALCULAR STATUS DO AGENDAMENTO
// ===================================================

/**
 * Calcula o status atual de um agendamento baseado no horário atual
 * @param {string} horario - Horário do agendamento (formato HH:MM)
 * @param {string} servico - Nome do serviço ou lista de serviços separados por vírgula
 * @returns {string} - Status: 'pendente', 'agora' ou 'concluído'
 */
function calcularStatusAgendamento(horario, servico) {
    try {
        // Obter durações do sessionStorage
        const duracoesJson = sessionStorage.getItem('servicosDuracoes');
        const duracoes = duracoesJson ? JSON.parse(duracoesJson) : {};

        // Extrair todos os serviços do texto (separados por vírgula)
        const servicos = (servico || '')
            .split(',')
            .map(item => item.trim())
            .filter(Boolean);

        // Somar duração de todos os serviços do agendamento
        const duracaoTotal = servicos.reduce((total, nomeServico) => {
            // Usar a mesma normalização que é usada em carregarDuracoesServicos
            const nomeNormalizado = (typeof normalizarServicoNome === 'function')
                ? normalizarServicoNome(nomeServico)
                : nomeServico.toLowerCase().trim();
            const duracao = parseInt(duracoes[nomeNormalizado], 10) || 0;
            return total + duracao;
        }, 0);

        // Converter horário para minutos desde 00:00
        const [horas, minutos] = (horario || '00:00').split(':').map(Number);
        const horarioEmMinutos = horas * 60 + minutos;

        // Calcular horário de término usando duração total
        const horarioTermino = horarioEmMinutos + duracaoTotal;

        // Obter horário atual em minutos
        const agora = new Date();
        const horaAtual = agora.getHours();
        const minutoAtual = agora.getMinutes();
        const horarioAtualEmMinutos = horaAtual * 60 + minutoAtual;

        // Comparar e determinar status
        if (horarioAtualEmMinutos < horarioEmMinutos) {
            return 'pendente';
        } else if (horarioAtualEmMinutos >= horarioEmMinutos && horarioAtualEmMinutos < horarioTermino) {
            return 'agora';
        } else {
            return 'concluído';
        }
    } catch (erro) {
        console.error('Erro ao calcular status do agendamento:', erro);
        return 'pendente';
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

        return true;
    } catch (erro) {
        // Não é crítico - usar defaults (duração 0) se falhar
        sessionStorage.setItem('servicosDuracoes', JSON.stringify({}));
        return false;
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
            if (!autoRefresh) {
                mostrarErroAgendamentos(`Erro ao carregar agendamentos: ${error.message}`);
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
        if (!autoRefresh) {
            mostrarErroAgendamentos(`Erro inesperado: ${erro.message}`);
        }
    }
}

// ===================================================
// RECALCULAR APENAS OS STATUS DOS AGENDAMENTOS (sem novo fetch)
// ===================================================

function recalcularStatusAgendamentos() {
    const containerAgendamentos = document.getElementById('agendamentosLista');
    if (!containerAgendamentos) return;

    // Definir prioridade dos status
    const prioridadeStatus = {
        'agora': 1,      // primeiro
        'pendente': 2,   // segundo
        'concluído': 3   // terceiro
    };

    // Selecionar todos os cards de agendamentos
    const cards = Array.from(containerAgendamentos.querySelectorAll('.agendamento-card'));
    let houveMudancaDeStatus = false;

    // Atualizar status de cada card
    cards.forEach(card => {
        const id = card.getAttribute('data-id');
        const horarioElement = card.querySelector('.agendamento-hora');
        const servicoElement = card.querySelector('.agendamento-servico');
        const statusElement = card.querySelector('.agendamento-status');

        if (horarioElement && servicoElement && statusElement) {
            // Extrair horário e serviço do card
            const horarioTexto = horarioElement.textContent.replace(/[^\d:]/g, '').trim();
            const servicoTexto = servicoElement.textContent.replace(/Serviço:\s*/i, '').trim();

            // Recalcular status
            const novoStatus = calcularStatusAgendamento(horarioTexto, servicoTexto);

            // Se o status mudou, atualizar o visual e marcar que houve mudança
            if (card.getAttribute('data-status') !== novoStatus) {
                card.setAttribute('data-status', novoStatus);
                houveMudancaDeStatus = true;

                // Atualizar classe CSS
                statusElement.className = 'agendamento-status';
                const statusClasse = `status-${novoStatus}`;
                statusElement.classList.add(statusClasse);

                // Atualizar texto do status
                const statusTexto = {
                    'pendente': 'Pendente',
                    'agora': 'Agora',
                    'concluído': 'Concluído'
                };
                statusElement.textContent = statusTexto[novoStatus] || 'Desconhecido';
            }
        }
    });

    // Sempre reordenar os cards para garantir a ordem correta
    cards.sort((a, b) => {
        const statusA = a.getAttribute('data-status');
        const statusB = b.getAttribute('data-status');
        const prioridadeA = prioridadeStatus[statusA] || 999;
        const prioridadeB = prioridadeStatus[statusB] || 999;

        // Se status são diferentes, ordenar por status
        if (prioridadeA !== prioridadeB) {
            return prioridadeA - prioridadeB;
        }

        // Se status são iguais, ordenar por horário (decrescente - maior primeiro)
        const horarioElementA = a.querySelector('.agendamento-hora');
        const horarioElementB = b.querySelector('.agendamento-hora');
        const horarioTextoA = horarioElementA ? horarioElementA.textContent.replace(/[^\d:]/g, '').trim() : '00:00';
        const horarioTextoB = horarioElementB ? horarioElementB.textContent.replace(/[^\d:]/g, '').trim() : '00:00';

        const partsA = horarioTextoA.split(':').map(Number);
        const partsB = horarioTextoB.split(':').map(Number);
        const minutosA = partsA[0] * 60 + partsA[1];
        const minutosB = partsB[0] * 60 + partsB[1];

        return minutosB - minutosA; // Decrescente (maior primeiro)
    });

    // Reorganizar cards no DOM
    cards.forEach(card => {
        containerAgendamentos.appendChild(card);
    });
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
        // Recarregar agendamentos do servidor
        carregarAgendamentosHoje(true);
        // E também recalcular status dos agendamentos já exibidos
        recalcularStatusAgendamentos();
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

    // Definir prioridade dos status
    const prioridadeStatus = {
        'agora': 1,      // primeiro
        'pendente': 2,   // segundo
        'concluído': 3   // terceiro
    };

    // Calcular status e ordenar agendamentos
    const agendamentosComStatus = agendamentos.map(agendamento => ({
        ...agendamento,
        status: calcularStatusAgendamento(agendamento.horario, agendamento.servico)
    }));

    agendamentosComStatus.sort((a, b) => {
        const prioridadeA = prioridadeStatus[a.status] || 999;
        const prioridadeB = prioridadeStatus[b.status] || 999;

        // Se status são diferentes, ordenar por status
        if (prioridadeA !== prioridadeB) {
            return prioridadeA - prioridadeB;
        }

        // Se status são iguais, ordenar por horário (decrescente - maior primeiro)
        const horarioA = a.horario ? a.horario.split(':').map(Number) : [0, 0];
        const horarioB = b.horario ? b.horario.split(':').map(Number) : [0, 0];
        const minutosA = horarioA[0] * 60 + horarioA[1];
        const minutosB = horarioB[0] * 60 + horarioB[1];

        return minutosB - minutosA; // Decrescente (maior primeiro)
    });

    // Criar elementos para cada agendamento (já ordenados)
    agendamentosComStatus.forEach(agendamento => {
        const cardAgendamento = document.createElement('div');
        cardAgendamento.className = 'agendamento-card';
        cardAgendamento.setAttribute('data-id', agendamento.id);

        // Usar status já calculado
        const status = agendamento.status;
        cardAgendamento.setAttribute('data-status', status);

        // Formatar horário
        const horarioFormatado = agendamento.horario || 'Sem horário';

        // Texto e classe de status
        const statusTexto = {
            'pendente': 'Pendente',
            'agora': 'Agora',
            'concluído': 'Concluído'
        };
        const statusClasse = `status-${status}`;

        cardAgendamento.innerHTML = `
            <div class="agendamento-info">
                <div class="agendamento-header">
                 <h3>  <i class="ri-user-line"></i>  ${agendamento.nome}</h3>
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

        cardAgendamento.addEventListener('click', () => {
            abrirModalDetalhesAgendamento(agendamento);
        });

        containerAgendamentos.appendChild(cardAgendamento);
    });
}

function abrirModalDetalhesAgendamento(agendamento) {
    agendamentoSelecionadoDetalhes = agendamento;

    const modalPacienteNome = document.getElementById('modalPacienteNome');
    const modalServico = document.getElementById('modalServico');
    const modalHorario = document.getElementById('modalHorario');
    const modalTelefone = document.getElementById('modalTelefone');
    const btnWhatsapp = document.getElementById('btnWhatsapp');
    const btnTelefone = document.getElementById('btnTelefone');
    const btnCancelar = document.getElementById('btnCancelarAgendamentoModal');

    if (modalPacienteNome) modalPacienteNome.textContent = agendamento.nome || 'Sem nome';
    if (modalServico) modalServico.textContent = agendamento.servico || 'Não informado';
    if (modalHorario) modalHorario.textContent = agendamento.horario || 'Sem horário';
    if (modalTelefone) modalTelefone.textContent = agendamento.telefone || 'Sem telefone';

    const telefoneLimpo = (agendamento.telefone || '').replace(/\D/g, '');
    const whatsappHref = telefoneLimpo ? `https://wa.me/55${telefoneLimpo}` : '#';
    const telefoneHref = telefoneLimpo ? `tel:+55${telefoneLimpo}` : '#';

    if (btnWhatsapp) {
        btnWhatsapp.href = whatsappHref;
        btnWhatsapp.setAttribute('aria-label', 'Abrir WhatsApp');
        btnWhatsapp.classList.toggle('disabled', !telefoneLimpo);
    }
    if (btnTelefone) {
        btnTelefone.href = telefoneHref;
        btnTelefone.setAttribute('aria-label', 'Ligar para telefone');
        btnTelefone.classList.toggle('disabled', !telefoneLimpo);
    }
    if (btnCancelar) {
        btnCancelar.disabled = false;
        // Alterar texto do botão baseado no status do agendamento
        const status = calcularStatusAgendamento(agendamento.horario, agendamento.servico);
        if (status === 'concluído') {
            btnCancelar.innerHTML = '<i class="ri-delete-bin-line"></i> Apagar Registro de Agendamento';
        } else {
            btnCancelar.innerHTML = '<i class="ri-close-circle-line"></i> Cancelar Agendamento';
        }
    }

    const overlay = document.getElementById('agendamentoDetalhesOverlay');
    if (overlay) overlay.classList.add('ativo');
}

function fecharModalDetalhesAgendamento() {
    const overlay = document.getElementById('agendamentoDetalhesOverlay');
    if (overlay) overlay.classList.remove('ativo');
    agendamentoSelecionadoDetalhes = null;
}

// ===================================================
// MODAIS DE CONFIRMAÇÃO E SUCESSO PARA EXCLUSÃO
// ===================================================

function abrirModalConfirmacaoExclusao() {
    if (!agendamentoSelecionadoDetalhes) return;

    // Calcular status do agendamento
    const status = calcularStatusAgendamento(
        agendamentoSelecionadoDetalhes.horario,
        agendamentoSelecionadoDetalhes.servico
    );

    // Elementos do modal
    const confirmacaoIcon = document.getElementById('confirmacaoIcon');
    const confirmacaoTitulo = document.getElementById('confirmacaoTitulo');
    const confirmacaoMensagem = document.getElementById('confirmacaoMensagem');
    const btnConfirmarExclusao = document.getElementById('btnConfirmarExclusao');

    // Atualizar conteúdo dinamicamente baseado no status
    if (status === 'concluído') {
        // Contexto de exclusão de registro
        if (confirmacaoIcon) {
            confirmacaoIcon.className = 'ri-delete-bin-line confirmation-modal-icon';
            confirmacaoIcon.style.color = '#d32f2f';
        }
        if (confirmacaoTitulo) {
            confirmacaoTitulo.textContent = 'Apagar Registro?';
        }
        if (confirmacaoMensagem) {
            confirmacaoMensagem.textContent = 'Tem certeza que deseja apagar o registro deste agendamento concluído? Esta ação não pode ser desfeita.';
        }
        if (btnConfirmarExclusao) {
            btnConfirmarExclusao.innerHTML = '<i class="ri-delete-bin-line"></i> Sim, Apagar';
        }
    } else {
        // Contexto de cancelamento de agendamento
        if (confirmacaoIcon) {
            confirmacaoIcon.className = 'ri-close-circle-line confirmation-modal-icon';
            confirmacaoIcon.style.color = '#d32f2f';
        }
        if (confirmacaoTitulo) {
            confirmacaoTitulo.textContent = 'Cancelar Agendamento?';
        }
        if (confirmacaoMensagem) {
            confirmacaoMensagem.textContent = 'Tem certeza que deseja cancelar este agendamento? A notificação será enviada ao paciente. Esta ação não pode ser desfeita.';
        }
        if (btnConfirmarExclusao) {
            btnConfirmarExclusao.innerHTML = '<i class="ri-close-circle-line"></i> Sim, Cancelar';
        }
    }

    const overlay = document.getElementById('confirmacaoExclusaoOverlay');
    if (overlay) overlay.classList.add('ativo');
}

function fecharModalConfirmacaoExclusao() {
    const overlay = document.getElementById('confirmacaoExclusaoOverlay');
    if (overlay) overlay.classList.remove('ativo');
}

function mostrarModalSucesso(mensagem = null) {
    if (!agendamentoSelecionadoDetalhes) return;

    // Se não foi fornecida uma mensagem, usar uma padrão baseada no status
    if (!mensagem) {
        const status = calcularStatusAgendamento(
            agendamentoSelecionadoDetalhes.horario,
            agendamentoSelecionadoDetalhes.servico
        );

        if (status === 'concluído') {
            mensagem = 'Registro de agendamento apagado com sucesso.';
        } else {
            mensagem = 'Agendamento cancelado com sucesso.';
        }
    }

    const mensagemElement = document.getElementById('mensagemSucesso');
    if (mensagemElement) {
        mensagemElement.textContent = mensagem;
    }
    const overlay = document.getElementById('modalSucessoOverlay');
    if (overlay) overlay.classList.add('ativo');
}

function fecharModalSucesso() {
    const overlay = document.getElementById('modalSucessoOverlay');
    if (overlay) overlay.classList.remove('ativo');
    fecharModalDetalhesAgendamento();
    carregarAgendamentosHoje();
}

async function executarCancelarAgendamento() {
    const botao = document.getElementById('btnConfirmarExclusao');
    if (!agendamentoSelecionadoDetalhes) return;

    const usuarioLogado = sessionStorage.getItem('usuarioLogado');
    const senhaUsuario = sessionStorage.getItem('senhaUsuario');

    if (!usuarioLogado || !senhaUsuario) {
        mostrarErroGenerico('Sessão expirada. Faça login novamente.');
        setTimeout(() => {
            window.location.href = './login.html';
        }, 2000);
        return;
    }

    if (botao) {
        botao.disabled = true;
        botao.innerHTML = '<i class="ri-loader-4-line" style="animation: spin 1s linear infinite;"></i> Processando...';
    }

    try {
        const { data, error } = await _supabase.rpc('cancelar_agendamento_por_admin', {
            p_nome_admin: usuarioLogado,
            p_senha_admin: senhaUsuario,
            p_id_agendamento: String(agendamentoSelecionadoDetalhes.id)
        });

        if (error) {
            console.error('Erro ao cancelar agendamento:', error);
            mostrarErroGenerico('Erro ao cancelar agendamento: ' + error.message);
            return;
        }

        const resultado = Array.isArray(data) ? data[0] : data;
        if (resultado && resultado.sucesso) {
            fecharModalConfirmacaoExclusao();
            // Passar a mensagem do servidor ou deixar vazio para usar a mensagem padrão dinâmica
            mostrarModalSucesso(resultado.mensagem);
        } else {
            const mensagem = resultado?.mensagem || 'Não foi possível processar o agendamento.';
            mostrarErroGenerico(mensagem);
        }
    } catch (erro) {
        console.error('Erro ao cancelar agendamento:', erro);
        mostrarErroGenerico('Erro inesperado ao processar o agendamento.');
    } finally {
        if (botao) {
            botao.disabled = false;
            // Restaurar o texto do botão baseado no status
            const status = calcularStatusAgendamento(
                agendamentoSelecionadoDetalhes.horario,
                agendamentoSelecionadoDetalhes.servico
            );
            if (status === 'concluído') {
                botao.innerHTML = '<i class="ri-delete-bin-line"></i> Sim, Apagar';
            } else {
                botao.innerHTML = '<i class="ri-close-circle-line"></i> Sim, Cancelar';
            }
        }
    }
}

// ===================================================
// MODAL GENÉRICO DE ERRO
// ===================================================

function mostrarErroGenerico(mensagem) {
    // Se há um modal de sucesso aberto, fechá-lo
    const modalSucesso = document.getElementById('modalSucessoOverlay');
    if (modalSucesso && modalSucesso.classList.contains('ativo')) {
        modalSucesso.classList.remove('ativo');
    }

    // Usar alert como fallback para erros
    alert(mensagem);
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






