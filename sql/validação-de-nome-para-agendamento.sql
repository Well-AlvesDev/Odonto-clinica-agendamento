-- Remover o trigger existente
DROP TRIGGER IF EXISTS trigger_validar_nome ON agendamento;

-- Remover a função existente
DROP FUNCTION IF EXISTS validar_nome();

-- Agora criar novamente com o novo código
CREATE OR REPLACE FUNCTION validar_nome()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.nome !~ '^[a-zA-ZÀ-ÿ\s]+$' THEN
    RAISE EXCEPTION 'Ops, seu agendamento foi recusado pelo sistema. Pois, seu NOME só pode conter letras e ESPAÇO. Por favor, tente novamente.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validar_nome
BEFORE INSERT OR UPDATE ON agendamento
FOR EACH ROW
EXECUTE FUNCTION validar_nome();