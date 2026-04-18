// Funcoes para o modal de confirmacao de cancelamento

// Abre o modal de cancelamento com os dados do agendamento
function abrirModalCancelamento(idAgendamento, data, horario, botaoCancelar, conteudoLista) {
    const modal = document.getElementById('modalCancelamento');
    if (!modal) return;

    // Formata a data para exibicao (DD/MM/YYYY)
    let dataFormatada = data;
    if (data.includes('-')) {
        const [ano, mes, dia] = data.split('-');
        dataFormatada = `${dia}/${mes}/${ano}`;
    }

    // Obtem o servico do atributo data-servico do botao
    let servico = botaoCancelar.getAttribute('data-servico') || '—';

    // Preenche os dados do modal
    const nome = botaoCancelar.getAttribute('data-nome') || '—';
    const telefone = botaoCancelar.getAttribute('data-telefone') || '—';
    document.getElementById('cancelamentoNome').textContent = nome.toUpperCase();
    document.getElementById('cancelamentoTelefone').textContent = telefone;
    document.getElementById('cancelamentoServico').textContent = servico;
    document.getElementById('cancelamentoData').textContent = dataFormatada;
    document.getElementById('cancelamentoHorario').textContent = horario;

    // Define os handlers dos botoes
    const btnNao = document.getElementById('btnCancelamentoNao');
    const btnSim = document.getElementById('btnCancelamentoSim');

    // Limpa os listeners anteriores
    const btnNaoNew = btnNao.cloneNode(true);
    const btnSimNew = btnSim.cloneNode(true);
    btnNao.parentNode.replaceChild(btnNaoNew, btnNao);
    btnSim.parentNode.replaceChild(btnSimNew, btnSim);

    // Adiciona novos listeners
    document.getElementById('btnCancelamentoNao').addEventListener('click', () => {
        fecharModalCancelamento();
    });

    document.getElementById('btnCancelamentoSim').addEventListener('click', async () => {
        await confirmarCancelamento(idAgendamento, botaoCancelar, conteudoLista);
    });

    // Mostra o modal
    modal.classList.remove('hidden');
}

// Fecha o modal de cancelamento
function fecharModalCancelamento() {
    const modal = document.getElementById('modalCancelamento');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// Abre o modal de sucesso
function abrirModalSucesso() {
    const modal = document.getElementById('modalSucesso');
    if (modal) {
        modal.classList.remove('hidden');
    }

    // Adiciona evento ao botão OK
    const btnFecharSucesso = document.getElementById('btnFecharSucesso');
    if (btnFecharSucesso) {
        btnFecharSucesso.onclick = () => {
            fecharModalSucesso();
        };
    }
}

// Fecha o modal de sucesso
function fecharModalSucesso() {
    const modal = document.getElementById('modalSucesso');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// Confirma o cancelamento
async function confirmarCancelamento(idAgendamento, botaoCancelar, conteudoLista) {
    const btnSim = document.getElementById('btnCancelamentoSim');

    try {
        btnSim.disabled = true;
        btnSim.textContent = 'Cancelando...';

        await cancelarAgendamento(idAgendamento);

        // Fecha o modal de cancelamento
        fecharModalCancelamento();

        // Abre o modal de sucesso
        abrirModalSucesso();

        // Remove o card da tela
        const card = botaoCancelar.closest('.card-agendamento');
        if (card) {
            card.style.opacity = '0';
            card.style.transition = 'opacity 0.3s ease';
            setTimeout(() => {
                card.remove();
            }, 300);
        }

        // Recarrega a lista de agendamentos apos um tempo
        setTimeout(() => {
            carregarMeusAgendamentos(conteudoLista);
        }, 500);

    } catch (err) {
        console.error('Erro ao cancelar agendamento:', err);

        // Trata erro especifico de antecedencia da RPC
        let mensagemErro = 'Erro ao cancelar o agendamento. Tente novamente.';
        if (err.message && err.message.includes('2 horas')) {
            mensagemErro = 'Cancelamento nao permitido.\n\n' + err.message;
        }

        alert(mensagemErro);
        btnSim.disabled = false;
        btnSim.textContent = 'Confirmar cancelamento';
    }
}
