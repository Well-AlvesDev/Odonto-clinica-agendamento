-- ==================================================
-- RPC para Cancelar (Deletar) Agendamento
-- Com SECURITY DEFINER para contornar RLS policies
-- ==================================================

CREATE OR REPLACE FUNCTION cancelar_agendamento_rpc(id_agendamento uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    agendamento_existe boolean;
    data_agendamento text;
    horario_agendamento text;
    datetime_agendamento timestamp;
    tempo_restante interval;
    horas_restantes numeric;
BEGIN
    -- Verifica se o agendamento existe e obtém data e horário
    SELECT EXISTS(
        SELECT 1 FROM agendamento WHERE id = id_agendamento
    ), data, horario INTO agendamento_existe, data_agendamento, horario_agendamento
    FROM agendamento WHERE id = id_agendamento;

    IF NOT agendamento_existe THEN
        RAISE EXCEPTION 'Agendamento não encontrado com ID: %', id_agendamento;
    END IF;

    -- Converte data (YYYY-MM-DD) e horário (HH:MM) para timestamp
    datetime_agendamento := TO_TIMESTAMP(
        data_agendamento || ' ' || horario_agendamento, 
        'YYYY-MM-DD HH24:MI'
    );

    -- Calcula o tempo restante até o agendamento
    tempo_restante := datetime_agendamento - NOW();
    horas_restantes := EXTRACT(EPOCH FROM tempo_restante) / 3600;

    -- Verifica se há pelo menos 2 horas de antecedência
    IF horas_restantes < 2 THEN
        RAISE EXCEPTION 'Cancelamento não permitido. É necessário cancelar com no mínimo 2 horas de antecedência. Tempo restante: % horas', 
            ROUND(horas_restantes::numeric, 1);
    END IF;

    -- Deleta o agendamento
    DELETE FROM agendamento WHERE id = id_agendamento;

    -- Retorna true para indicar sucesso
    RETURN true;

EXCEPTION
    WHEN OTHERS THEN
        -- Registra o erro e retorna false
        RAISE EXCEPTION 'Erro ao cancelar agendamento: %', SQLERRM;
END;
$$;

-- Conceder permissões para usuarios anonimos poderem chamar a RPC
GRANT EXECUTE ON FUNCTION cancelar_agendamento_rpc(uuid) TO anon;
GRANT EXECUTE ON FUNCTION cancelar_agendamento_rpc(uuid) TO authenticated;
