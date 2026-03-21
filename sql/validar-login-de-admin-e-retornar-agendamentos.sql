-- Criar função que valida login e retorna agendamentos
CREATE OR REPLACE FUNCTION validar_login_admin(p_nome TEXT, p_senha TEXT)
RETURNS TABLE (
    sucesso BOOLEAN,
    mensagem TEXT,
    agendamentos JSON
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    v_admin_encontrado BOOLEAN;
    v_agendamentos JSON;
BEGIN
    -- Verificar se admin existe com as credenciais corretas
    SELECT EXISTS(
        SELECT 1 FROM admin 
        WHERE nome = p_nome AND senha = p_senha
    ) INTO v_admin_encontrado;

    IF v_admin_encontrado THEN
        -- Se credenciais corretas, buscar agendamentos
        SELECT json_agg(
            json_build_object(
                'id', id,
                'nome', nome,
                'telefone', telefone,
                'servico', servico,
                'data', "data",
                'horario', horario
            ) ORDER BY "data" DESC, horario DESC
        ) INTO v_agendamentos
        FROM agendamento;

        RETURN QUERY SELECT 
            true::BOOLEAN as sucesso,
            'Login bem-sucedido'::TEXT as mensagem,
            COALESCE(v_agendamentos, '[]'::json) as agendamentos;
    ELSE
        -- Credenciais incorretas
        RETURN QUERY SELECT 
            false::BOOLEAN as sucesso,
            'Nome de usuário ou senha incorretos'::TEXT as mensagem,
            '[]'::json as agendamentos;
    END IF;
END;
$$;

-- Revogar acesso público à tabela admin (já deve estar feito, mas por segurança)
ALTER TABLE admin DISABLE ROW LEVEL SECURITY;
ALTER TABLE admin ENABLE ROW LEVEL SECURITY;

-- Criar política RLS para admin (negar acesso público)
DROP POLICY IF EXISTS "admin_acesso_negado" ON admin;
CREATE POLICY "admin_acesso_negado" ON admin
    FOR SELECT
    USING (false);

-- Criar política RLS para agendamento (negar acesso público ao select direto)
DROP POLICY IF EXISTS "agendamento_acesso_negado" ON agendamento;
CREATE POLICY "agendamento_acesso_negado" ON agendamento
    FOR SELECT
    USING (false);

-- Permitir que a função acesse as tabelas (grant não é necessário pois usa SECURITY DEFINER)
GRANT EXECUTE ON FUNCTION validar_login_admin(TEXT, TEXT) TO anon;