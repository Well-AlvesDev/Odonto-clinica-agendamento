-- ================================================
-- REMOVER CONFLITO: Dropar função antiga
-- ================================================

-- Remove TODAS as versões de salvar_agendamento_rpc
DROP FUNCTION IF EXISTS salvar_agendamento_rpc(date, text, text, text, text);
DROP FUNCTION IF EXISTS salvar_agendamento_rpc(text, text, text, text, text);
DROP FUNCTION IF EXISTS salvar_agendamento_rpc(text, text);
DROP FUNCTION IF EXISTS salvar_agendamento_rpc(date, text, text, text);

-- Agora cria APENAS a versão com TEXT
CREATE OR REPLACE FUNCTION salvar_agendamento_rpc(
  data_input text, 
  horario_input text,
  nome_input text, 
  servico_input text, 
  telefone_input text
) 
RETURNS uuid 
LANGUAGE plpgsql 
SECURITY DEFINER 
AS $$ 
DECLARE   
  novo_id uuid; 
BEGIN   
  INSERT INTO agendamento (data, horario, nome, servico, telefone)   
  VALUES (data_input, horario_input, nome_input, servico_input, telefone_input)   
  RETURNING id INTO novo_id;      
  RETURN novo_id; 
END; 
$$;
