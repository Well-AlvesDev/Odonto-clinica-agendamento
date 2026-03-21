-- FIX: Atualizar função de busca para incluir data e horário
DROP FUNCTION IF EXISTS buscar_agendamentos_por_ids(uuid[]);

CREATE OR REPLACE FUNCTION buscar_agendamentos_por_ids(lista_ids uuid[])
RETURNS TABLE(id uuid, nome text, telefone text, servico text, data text, horario text) AS $$
BEGIN
  RETURN QUERY
  SELECT agendamento.id, agendamento.nome, agendamento.telefone, agendamento.servico, agendamento.data, agendamento.horario
  FROM agendamento
  WHERE agendamento.id = ANY(lista_ids);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
