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
// VARIÁVEIS PARA PAGINAÇÃO DA CONSULTA
// ===================================================

let paginaConsultaAtual = 1;
const ITENS_POR_PAGINA_CONSULTA = 10; // 10 cards por página

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
// FUNÇÃO PARA CALCULAR STATUS DO AGENDAMENTO CONSULTADO (com data)
// ===================================================

/**
 * Calcula o status de um agendamento consultado considerando data e hora
 * @param {string} data - Data do agendamento (formato YYYY-MM-DD)
 * @param {string} horario - Horário do agendamento (formato HH:MM)
 * @param {string} servico - Nome do serviço ou lista de serviços separados por vírgula
 * @returns {string} - Status: 'pendente', 'agora' ou 'concluído'
 */
function calcularStatusConsultado(data, horario, servico) {
    try {
        // Obter a data de hoje
        const hoje = new Date();
        const dataHoje = hoje.toISOString().split('T')[0]; // Formato YYYY-MM-DD

        // Comparar datas
        if (data < dataHoje) {
            // Data é anterior a hoje - agendamento concluído
            return 'concluído';
        } else if (data > dataHoje) {
            // Data é futura - agendamento pendente
            return 'pendente';
        } else {
            // Data é hoje - usar cálculo baseado em hora
            return calcularStatusAgendamento(horario, servico);
        }
    } catch (erro) {
        console.error('Erro ao calcular status consultado:', erro);
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
    const container = document.querySelector('.container');
    if (confirmationLogoutOverlay) {
        confirmationLogoutOverlay.classList.add('ativo');
        if (container) {
            container.classList.add('blur');
        }
    }
}

function fecharModalConfirmacao() {
    const confirmationLogoutOverlay = document.getElementById('confirmationLogoutOverlay');
    const container = document.querySelector('.container');
    if (confirmationLogoutOverlay) {
        confirmationLogoutOverlay.classList.remove('ativo');
        if (container) {
            container.classList.remove('blur');
        }
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
        // Se tem data (agendamento consultado), usar calcularStatusConsultado
        // Senão (agendamento de hoje), usar calcularStatusAgendamento
        let status;
        if (agendamento.data) {
            status = calcularStatusConsultado(agendamento.data, agendamento.horario, agendamento.servico);
        } else {
            status = calcularStatusAgendamento(agendamento.horario, agendamento.servico);
        }

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

// ===================================================
// FUNÇÕES DE CONSULTA DE AGENDAMENTOS POR PERÍODO
// ===================================================

/**
 * Abre o modal de consulta por data range
 */
function abrirConsulta() {
    const consultaOverlay = document.getElementById('consultaOverlay');
    if (consultaOverlay) {
        // Limpar campos e erro anterior
        document.getElementById('dataInicio').value = '';
        document.getElementById('dataFim').value = '';
        const erroConsulta = document.getElementById('erroConsulta');
        if (erroConsulta) erroConsulta.style.display = 'none';

        consultaOverlay.classList.add('ativo');
    }
}

/**
 * Fecha o modal de consulta
 */
function fecharModalConsulta() {
    const consultaOverlay = document.getElementById('consultaOverlay');
    if (consultaOverlay) {
        consultaOverlay.classList.remove('ativo');
    }
    const erroConsulta = document.getElementById('erroConsulta');
    if (erroConsulta) erroConsulta.style.display = 'none';
}

/**
 * Valida e executa a consulta de agendamentos por período
 */
async function executarConsultaAgendamentos() {
    const dataInicio = document.getElementById('dataInicio').value;
    const dataFim = document.getElementById('dataFim').value;
    const erroConsulta = document.getElementById('erroConsulta');

    // Validar campos
    if (!dataInicio || !dataFim) {
        erroConsulta.textContent = 'Por favor, preencha ambas as datas.';
        erroConsulta.style.display = 'block';
        return;
    }

    // Convertendo o formato de data: YYYY-MM-DD é mantido para a RPC
    const [anoI, mesI, diaI] = dataInicio.split('-');
    const [anoF, mesF, diaF] = dataFim.split('-');
    const dateInicio = new Date(anoI, mesI - 1, diaI);
    const dateFim = new Date(anoF, mesF - 1, diaF);

    // Validar se data fim é posterior ou igual à data início
    if (dateFim < dateInicio) {
        erroConsulta.textContent = 'A data de término deve ser posterior à data de início.';
        erroConsulta.style.display = 'block';
        return;
    }

    // Validar sessão
    const usuarioLogado = sessionStorage.getItem('usuarioLogado');
    const senhaUsuario = sessionStorage.getItem('senhaUsuario');

    if (!usuarioLogado || !senhaUsuario) {
        erroConsulta.textContent = 'Sessão expirada. Faça login novamente.';
        erroConsulta.style.display = 'block';
        return;
    }

    try {
        // Mostrar carregamento
        erroConsulta.textContent = '';
        erroConsulta.style.display = 'none';

        const botaoBuscar = document.querySelector('[onclick="executarConsultaAgendamentos()"]');
        if (botaoBuscar) {
            botaoBuscar.disabled = true;
            botaoBuscar.innerHTML = '<i class="ri-loader-4-line"></i> Buscando...';
        }

        // Chamar RPC para obter agendamentos
        const { data, error } = await _supabase.rpc('obter_agendamentos_por_periodo_consulta', {
            p_nome_admin: usuarioLogado,
            p_senha_admin: senhaUsuario,
            p_data_inicio: dataInicio,
            p_data_fim: dataFim
        });

        // Restaurar botão
        if (botaoBuscar) {
            botaoBuscar.disabled = false;
            botaoBuscar.innerHTML = '<i class="ri-search-line"></i> Buscar';
        }

        // Verificar erros
        if (error) {
            console.error('Erro ao buscar agendamentos:', error);
            erroConsulta.textContent = 'Erro ao buscar agendamentos: ' + error.message;
            erroConsulta.style.display = 'block';
            return;
        }

        // Processar resultados
        if (data && data.length > 0) {
            exibirResultadoConsulta(data, dataInicio, dataFim);
            fecharModalConsulta();
        } else {
            erroConsulta.textContent = 'Nenhum agendamento encontrado neste período.';
            erroConsulta.style.display = 'block';
        }

    } catch (erro) {
        console.error('Erro ao executar consulta:', erro);
        erroConsulta.textContent = 'Erro inesperado: ' + erro.message;
        erroConsulta.style.display = 'block';
    }
}

/**
 * Exibe os resultados da consulta como cards em um modal com paginação
 */
function exibirResultadoConsulta(agendamentos, dataInicio, dataFim) {
    const conteudoPeriodo = document.getElementById('resultadoConsultaPeriodo');
    const conteudoResultado = document.getElementById('resultadoConsultaConteudo');

    // Formatar datas para exibição (fazer parse correto para evitar problemas de timezone)
    const [anoI, mesI, diaI] = dataInicio.split('-');
    const dataInicioFormatada = new Date(parseInt(anoI), parseInt(mesI) - 1, parseInt(diaI)).toLocaleDateString('pt-BR');

    const [anoF, mesF, diaF] = dataFim.split('-');
    const dataFimFormatada = new Date(parseInt(anoF), parseInt(mesF) - 1, parseInt(diaF)).toLocaleDateString('pt-BR');

    // Inserir informações de período e total (FIXO no topo)
    if (conteudoPeriodo) {
        conteudoPeriodo.innerHTML = `
            <div class="consulta-info-periodo">
                <p><strong>Período:</strong> ${dataInicioFormatada} até ${dataFimFormatada}</p>
                <p><strong>Total de agendamentos:</strong> ${agendamentos.length}</p>
            </div>
        `;
    }

    // Armazenar dados globalmente para acesso na paginação
    window.ultimoResultadoConsulta = {
        agendamentos: agendamentos,
        dataInicio: dataInicio,
        dataFim: dataFim
    };

    // Resetar a paginação para a página 1
    paginaConsultaAtual = 1;

    // Exibir a primeira página
    exibirPaginaConsulta();

    // Mostrar modal de resultado
    const resultadoConsultaOverlay = document.getElementById('resultadoConsultaOverlay');
    if (resultadoConsultaOverlay) {
        resultadoConsultaOverlay.classList.add('ativo');
    }
}

/**
 * Exibe uma página específica de resultados da consulta
 */
function exibirPaginaConsulta() {
    if (!window.ultimoResultadoConsulta) {
        return;
    }

    const agendamentos = window.ultimoResultadoConsulta.agendamentos;
    const conteudoResultado = document.getElementById('resultadoConsultaConteudo');

    // Calcular índices de início e fim
    const indiceInicio = (paginaConsultaAtual - 1) * ITENS_POR_PAGINA_CONSULTA;
    const indiceFim = indiceInicio + ITENS_POR_PAGINA_CONSULTA;
    const agendamentosPagina = agendamentos.slice(indiceInicio, indiceFim);

    // Calcular total de páginas
    const totalPaginas = Math.ceil(agendamentos.length / ITENS_POR_PAGINA_CONSULTA);

    // Criar container de cards para esta página
    let htmlCards = `<div class="consulta-cards-container">`;

    // Criar cards para cada agendamento da página
    agendamentosPagina.forEach((agendamento, indexPagina) => {
        const indexReal = indiceInicio + indexPagina; // Índice real no array original
        const status = calcularStatusConsultado(agendamento.data, agendamento.horario, agendamento.servico);

        // Normalizar status para "concluido" (sem acento) para compatibilidade com CSS
        const statusNormalizado = status === 'concluído' ? 'concluido' : status;

        // Formatar data para DD/MM/YYYY
        const [ano, mes, dia] = agendamento.data.split('-');
        const dataFormatada = `${dia}/${mes}/${ano}`;

        htmlCards += `
            <div class="consulta-card-item" data-status="${statusNormalizado}" data-index="${indexReal}" onclick="abrirDetalhesConsultado(${indexReal})">
                <div class="consulta-card-info">
                    <div class="consulta-card-nome">
                        <i class="ri-user-line"></i> ${agendamento.nome}
                    </div>
                    <div class="consulta-card-detalhes">
                        <div class="consulta-card-detalhe">
                            <i class="ri-time-line"></i> ${agendamento.horario || 'Sem horário'}
                        </div>
                        <div class="consulta-card-detalhe">
                            <i class="ri-bubble-chart-line"></i> ${agendamento.servico || 'Não especificado'}
                        </div>
                    </div>
                    <div style="font-size: 12px; color: #999; margin-top: 8px; padding-top: 8px; border-top: 1px solid #e0e0e0;">
                        <i class="ri-calendar-line"></i> ${dataFormatada}
                    </div>
                </div>
            </div>
        `;
    });

    htmlCards += `</div>`;

    // Inserir cards no conteúdo (ROLÁVEL)
    if (conteudoResultado) {
        conteudoResultado.innerHTML = htmlCards;
    }

    // Atualizar controles de paginação
    atualizarControlesPaginacaoConsulta(totalPaginas);
}

/**
 * Atualiza os botões e indicador de paginação
 */
function atualizarControlesPaginacaoConsulta(totalPaginas) {
    const paginacaoContainer = document.getElementById('paginacaoConsultaContainer');
    const btnAnterior = document.getElementById('btnAnteriorConsulta');
    const btnProximo = document.getElementById('btnProximoConsulta');
    const indicador = document.getElementById('indicadorPaginaConsulta');

    // Mostrar/ocultar paginação
    if (paginacaoContainer) {
        paginacaoContainer.style.display = totalPaginas > 1 ? 'flex' : 'none';
    }

    // Atualizar indicador
    if (indicador) {
        indicador.textContent = `${paginaConsultaAtual} de ${totalPaginas}`;
    }

    // Desabilitar botão Anterior
    if (btnAnterior) {
        btnAnterior.disabled = paginaConsultaAtual === 1;
        btnAnterior.style.opacity = paginaConsultaAtual === 1 ? '0.5' : '1';
        btnAnterior.style.cursor = paginaConsultaAtual === 1 ? 'not-allowed' : 'pointer';
    }

    // Desabilitar botão Próximo
    if (btnProximo) {
        btnProximo.disabled = paginaConsultaAtual === totalPaginas;
        btnProximo.style.opacity = paginaConsultaAtual === totalPaginas ? '0.5' : '1';
        btnProximo.style.cursor = paginaConsultaAtual === totalPaginas ? 'not-allowed' : 'pointer';
    }
}

/**
 * Navega para a página anterior
 */
function irPaginaAnteriorConsulta() {
    if (paginaConsultaAtual > 1) {
        paginaConsultaAtual--;
        exibirPaginaConsulta();
        // Scroll para o topo do conteúdo
        const conteudo = document.getElementById('resultadoConsultaConteudo');
        if (conteudo) {
            conteudo.scrollTop = 0;
        }
    }
}

/**
 * Navega para a próxima página
 */
function irProximaPaginaConsulta() {
    if (!window.ultimoResultadoConsulta) {
        return;
    }

    const totalPaginas = Math.ceil(window.ultimoResultadoConsulta.agendamentos.length / ITENS_POR_PAGINA_CONSULTA);
    if (paginaConsultaAtual < totalPaginas) {
        paginaConsultaAtual++;
        exibirPaginaConsulta();
        // Scroll para o topo do conteúdo
        const conteudo = document.getElementById('resultadoConsultaConteudo');
        if (conteudo) {
            conteudo.scrollTop = 0;
        }
    }
}

/**
 * Fecha o modal de resultado
 */
function fecharResultadoConsulta() {
    const resultadoConsultaOverlay = document.getElementById('resultadoConsultaOverlay');
    if (resultadoConsultaOverlay) {
        resultadoConsultaOverlay.classList.remove('ativo');
    }
}

/**
 * Abre o modal de detalhes de um agendamento consultado
 */
function abrirDetalhesConsultado(index) {
    if (!window.ultimoResultadoConsulta || !window.ultimoResultadoConsulta.agendamentos[index]) {
        return;
    }

    const agendamento = window.ultimoResultadoConsulta.agendamentos[index];

    // Usar o mesmo modal dos agendados para hoje
    abrirModalDetalhesAgendamento(agendamento);
}

/**
 * Fecha o modal de detalhes do agendamento consultado
 * @deprecated Usar fecharModalDetalhesAgendamento em vez disso
 */
function fecharDetalhesConsultado() {
    // Redirecionar para a função correta
    fecharModalDetalhesAgendamento();
}








