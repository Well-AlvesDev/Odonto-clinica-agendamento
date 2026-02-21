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
