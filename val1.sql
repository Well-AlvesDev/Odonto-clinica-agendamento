-- 1. REMOVER TODAS AS FUNÇÕES E TRIGGERS ANTIGAS
DROP TRIGGER IF EXISTS trigger_validar_agendamento ON agendamento;
DROP TRIGGER IF EXISTS trigger_validar_nome ON agendamento;
DROP TRIGGER IF EXISTS trigger_validar_duplicado ON agendamento;
DROP FUNCTION IF EXISTS validar_agendamento();
DROP FUNCTION IF EXISTS validar_nome();
DROP FUNCTION IF EXISTS validar_duplicado();
DROP FUNCTION IF EXISTS buscar_agendamentos_por_ids(uuid[]);
DROP FUNCTION IF EXISTS salvar_agendamento_rpc(text, text);
DROP FUNCTION IF EXISTS salvar_agendamento_rpc(text, text, text, text, text);
DROP FUNCTION IF EXISTS salvar_agendamento_rpc(text, text, text, text);
DROP FUNCTION IF EXISTS salvar_agendamento_rpc(date, text, text, text, text);
DROP FUNCTION IF EXISTS salvar_agendamento_rpc(date, text, text, text);
-- Configurar timezone para Brasil
SET timezone TO 'America/Sao_Paulo';
-- ================================================
-- CRIAÇÃO: FUNÇÃO AUXILIAR PARA VERIFICAR SE HORÁRIO ESTÁ NO INTERVALO
-- ================================================
CREATE OR REPLACE FUNCTION esta_no_intervalo_horario(horario_agendamento TEXT, intervalo_texto TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  hora_inicio TIME;
  hora_fim TIME;
  horario_time TIME;
  partes TEXT[];
BEGIN
  -- Converte o horário do agendamento para TIME
  horario_time := horario_agendamento::TIME;
  
  -- Divide o intervalo em início e fim (formato: HH:MM-HH:MM)
  partes := regexp_split_to_array(TRIM(intervalo_texto), '-');
  
  IF array_length(partes, 1) != 2 THEN
    RETURN FALSE;
  END IF;
  
  hora_inicio := TRIM(partes[1])::TIME;
  hora_fim := TRIM(partes[2])::TIME;
  
  -- Verifica se o horário está dentro do intervalo
  RETURN horario_time >= hora_inicio AND horario_time <= hora_fim;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================
-- CRIAÇÃO: FUNÇÃO DE VALIDAÇÃO COMPLETA COM VERIFICAÇÃO DE DATA E HORÁRIO
-- ================================================
CREATE OR REPLACE FUNCTION validar_agendamento()
RETURNS TRIGGER AS $$
DECLARE
  nome_normalizado TEXT;
  telefone_normalizado TEXT;
  existe BOOLEAN;
  datas_validas TEXT;
  horarios_validos TEXT;
  datas_array TEXT[];
  horarios_array TEXT[];
  data_encontrada BOOLEAN;
  data_normalizada TEXT;
  data_lista_normalizada TEXT;
  data_agendamento DATE;
  posicao_data INTEGER;
  horarios_da_data TEXT;
  intervalos_horarios TEXT[];
  i INTEGER;
  j INTEGER;
  horario_encontrado BOOLEAN;
  servicos_disponiveis TEXT;
  servicos_array TEXT[];
  servico_encontrado BOOLEAN;
  k INTEGER;
  servico_normalizado TEXT;
  duracao_servico INTEGER;
  hora_fim_agendamento TIME;
  hora_inicio_intervalo TIME;
  hora_fim_intervalo TIME;
  intervalo_partes TEXT[];
  duracao_existente INTEGER;
  hora_ini_existente TIME;
  hora_fim_existente TIME;
  servico_existente TEXT;
  agend_rec RECORD;

  -- variáveis auxiliares com fuso horário explícito
  data_atual DATE := (now() AT TIME ZONE 'America/Sao_Paulo')::DATE;
  hora_atual TIME := (now() AT TIME ZONE 'America/Sao_Paulo')::TIME;
BEGIN
  -- 1. VALIDAR NOME
  IF TRIM(NEW.nome) = '' OR NEW.nome IS NULL THEN
    RAISE EXCEPTION 'Erro: O campo NOME não pode estar vazio.';
  END IF;
  
  IF LENGTH(NEW.nome) > 80 THEN
    RAISE EXCEPTION 'Erro: O campo NOME não pode exceder 80 caracteres.';
  END IF;
  
  IF NEW.nome !~ '^[a-zA-ZÀ-ÿ\s]+$' THEN
    RAISE EXCEPTION 'Ops, seu agendamento foi recusado pelo sistema. Pois, seu NOME só pode conter letras e ESPAÇO. Por favor, tente novamente.';
  END IF;
  
  -- 2. VALIDAR TELEFONE
  IF TRIM(NEW.telefone) = '' OR NEW.telefone IS NULL THEN
    RAISE EXCEPTION 'Erro: O campo TELEFONE não pode estar vazio.';
  END IF;
  
  IF NEW.telefone !~ '^\(81\)9[0-9]{4}-[0-9]{4}$' THEN
    RAISE EXCEPTION 'Erro: O telefone deve seguir exatamente o padrão: (81)9XXXX-XXXX';
  END IF;
  
  -- 3. VALIDAR SERVIÇO
  IF TRIM(NEW.servico) = '' OR NEW.servico IS NULL THEN
    RAISE EXCEPTION 'Erro: O campo SERVIÇO não pode estar vazio.';
  END IF;
  
  -- 4. VALIDAR DATA
  IF NEW.data IS NULL THEN
    RAISE EXCEPTION 'Erro: O campo DATA não pode estar vazio.';
  END IF;
  
  -- Converte a data para o formato DATE
  BEGIN
    IF NEW.data ~ '^\d{2}/\d{2}/\d{4}$' THEN
      -- Formato DD/MM/YYYY
      data_agendamento := TO_DATE(NEW.data, 'DD/MM/YYYY');
    ELSIF NEW.data ~ '^\d{4}-\d{2}-\d{2}$' THEN
      -- Formato YYYY-MM-DD
      data_agendamento := NEW.data::DATE;
    ELSE
      RAISE EXCEPTION 'Erro: O formato da data é inválido. Use DD/MM/YYYY ou YYYY-MM-DD.';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Erro: Não foi possível converter a data. Use DD/MM/YYYY ou YYYY-MM-DD.';
  END;
  
  -- 4.1 VALIDAR DATA PASSADA - BLOQUEIO EXPLÍCITO E ROBUSTO
  IF data_agendamento IS NULL THEN
    RAISE EXCEPTION 'Erro: Falha ao processar a data. Tente novamente.';
  END IF;
  
  -- Converte para strings para comparação segura (YYYY-MM-DD)
  -- usa data_atual com timezone explícito para evitar discrepâncias
  IF TO_CHAR(data_agendamento, 'YYYY-MM-DD') < TO_CHAR(data_atual, 'YYYY-MM-DD') THEN
    RAISE EXCEPTION 'Erro: Não é possível agendar para datas passadas. Por favor, escolha uma data futura.';
  END IF;
  
  -- 5. VALIDAR HORÁRIO
  IF TRIM(NEW.horario) = '' OR NEW.horario IS NULL THEN
    RAISE EXCEPTION 'Erro: O campo HORÁRIO não pode estar vazio.';
  END IF;
  
  IF NEW.horario !~ '^([0-1][0-9]|2[0-3]):[0-5][0-9]$' THEN
    RAISE EXCEPTION 'Erro: O horário deve seguir exatamente o padrão: HH:MM (ex: 14:30)';
  END IF;
  
  -- 6. VERIFICAR SE A DATA EXISTE NA TABELA arch_de_contx
  SET LOCAL row_security = OFF;
  
  SELECT datas, horarios INTO datas_validas, horarios_validos FROM arch_de_contx LIMIT 1;
  
  IF datas_validas IS NULL THEN
    RAISE EXCEPTION 'Erro: Nenhuma data configurada no sistema. Por favor, contate o administrador.';
  END IF;
  
  -- Converte a string de datas em array
  datas_array := regexp_split_to_array(datas_validas, ',');
  
  -- Verifica se a data do agendamento existe na lista
  -- Suporta ambos os formatos: DD/MM/YYYY e YYYY-MM-DD
  data_encontrada := FALSE;
  posicao_data := 0;
  
  FOR i IN array_lower(datas_array, 1) .. array_upper(datas_array, 1) LOOP
    -- Sempre converte para DD/MM/YYYY para comparação
    data_normalizada := TO_CHAR(data_agendamento, 'DD/MM/YYYY');
    
    -- Normaliza data da lista
    data_lista_normalizada := TRIM(datas_array[i]);
    
    IF data_normalizada = data_lista_normalizada THEN
      data_encontrada := TRUE;
      posicao_data := i;
      EXIT;
    END IF;
  END LOOP;
  
  IF NOT data_encontrada THEN
    RAISE EXCEPTION 'Erro: A data % não está disponível para agendamento. Por favor, escolha uma data válida.', NEW.data;
  END IF;
  
  -- 6.1 VALIDAR SERVIÇO DISPONÍVEL NA TABELA cpxm
  -- Verifica se o serviço está disponível para a data selecionada na tabela cpxm
  SELECT servicos INTO servicos_disponiveis FROM cpxm 
  WHERE data = TO_CHAR(data_agendamento, 'DD/MM/YYYY')
  LIMIT 1;
  
  IF servicos_disponiveis IS NULL THEN
    RAISE EXCEPTION 'Erro: Nenhum serviço configurado para a data %. Por favor, contate o administrador.', NEW.data;
  END IF;
  
  -- Converte a string de serviços em array (separados por ',')
  servicos_array := regexp_split_to_array(servicos_disponiveis, ',');
  
  -- Verifica se o serviço do agendamento está disponível
  -- Normaliza removendo acentos para comparação consistente
  servico_normalizado := LOWER(TRIM(TRANSLATE(NEW.servico, 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucaaaaaeeeeiiiiooooouuuuc')));
  servico_encontrado := FALSE;
  
  FOR k IN array_lower(servicos_array, 1) .. array_upper(servicos_array, 1) LOOP
    IF LOWER(TRIM(TRANSLATE(servicos_array[k], 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucaaaaaeeeeiiiiooooouuuuc'))) = servico_normalizado THEN
      servico_encontrado := TRUE;
      EXIT;
    END IF;
  END LOOP;
  
  IF NOT servico_encontrado THEN
    RAISE EXCEPTION 'Erro: O serviço "%" não está disponível para a data %. Os serviços disponíveis são: %', NEW.servico, NEW.data, servicos_disponiveis;
  END IF;
  
  -- 6.2 VALIDAR HORÁRIO DENTRO DOS INTERVALOS DISPONÍVEIS
  IF horarios_validos IS NULL OR TRIM(horarios_validos) = '' THEN
    RAISE EXCEPTION 'Erro: Nenhum horário configurado no sistema. Por favor, contate o administrador.';
  END IF;
  
  -- Converte a string de horários em array (separados por '/')
  horarios_array := regexp_split_to_array(horarios_validos, '/');
  
  -- Verifica se existe horário na posição correspondente à data
  IF posicao_data > array_length(horarios_array, 1) THEN
    RAISE EXCEPTION 'Erro: Nenhum horário configurado para a data %. Por favor, contate o administrador.', NEW.data;
  END IF;
  
  -- Pega os horários disponíveis para a data (podem ser múltiplos intervalos separados por vírgula)
  horarios_da_data := TRIM(horarios_array[posicao_data]);
  
  -- Converte os intervalos em array (separados por vírgula)
  intervalos_horarios := regexp_split_to_array(horarios_da_data, ',');
  
  -- Verifica se o horário do agendamento está em algum dos intervalos
  horario_encontrado := FALSE;
  
  FOR j IN array_lower(intervalos_horarios, 1) .. array_upper(intervalos_horarios, 1) LOOP
    IF esta_no_intervalo_horario(NEW.horario, intervalos_horarios[j]) THEN
      horario_encontrado := TRUE;
      EXIT;
    END IF;
  END LOOP;
  
  IF NOT horario_encontrado THEN
    RAISE EXCEPTION 'Erro: O horário % não está disponível para a data %. Os horários disponíveis são: %', NEW.horario, NEW.data, horarios_da_data;
  END IF;
  
  -- 6.3 VALIDAR SE A DURAÇÃO DO SERVIÇO CABE NO INTERVALO
  -- Buscar a duração do serviço na tabela servicos_tempo
  SELECT duracao_minuto INTO duracao_servico FROM servicos_tempo 
  WHERE LOWER(TRIM(TRANSLATE(servico, 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucaaaaaeeeeiiiiooooouuuuc'))) = servico_normalizado
  LIMIT 1;
  
  IF duracao_servico IS NULL THEN
    RAISE EXCEPTION 'Erro: A duração do serviço "%" não foi configurada no sistema. Por favor, contate o administrador.', NEW.servico;
  END IF;
  
  -- Calcular a hora final do agendamento (horário inicial + duração)
  hora_fim_agendamento := (NEW.horario::TIME) + (duracao_servico || ' minutes')::INTERVAL;
  
  -- Verificar se a hora final do agendamento cabe dentro do intervalo disponível
  horario_encontrado := FALSE;
  
  FOR j IN array_lower(intervalos_horarios, 1) .. array_upper(intervalos_horarios, 1) LOOP
    -- Divide o intervalo em hora início e hora fim
    intervalo_partes := regexp_split_to_array(TRIM(intervalos_horarios[j]), '-');
    
    IF array_length(intervalo_partes, 1) = 2 THEN
      hora_inicio_intervalo := TRIM(intervalo_partes[1])::TIME;
      hora_fim_intervalo := TRIM(intervalo_partes[2])::TIME;
      
      -- Verifica se o horário inicial está dentro e a hora final não ultrapassa o intervalo
      IF (NEW.horario::TIME >= hora_inicio_intervalo AND hora_fim_agendamento <= hora_fim_intervalo) THEN
        horario_encontrado := TRUE;
        EXIT;
      END IF;
    END IF;
  END LOOP;
  
  IF NOT horario_encontrado THEN
    RAISE EXCEPTION 'Erro: O serviço "%" com duração de % minuto(s) não cabe no horário escolhido (%). Ele terminaria às %. Por favor, escolha um horário com mais tempo disponível.', 
      NEW.servico, duracao_servico, NEW.horario, TO_CHAR(hora_fim_agendamento, 'HH24:MI');
  END IF;
  
  -- 7. VERIFICAR DUPLICATA - NOME E TELEFONE (COM LIMITE DE 3 POR DATA E SERVIÇO DIFERENTE)
  nome_normalizado := LOWER(TRIM(TRANSLATE(NEW.nome, 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucaaaaaeeeeiiiiooooouuuuc')));
  telefone_normalizado := REPLACE(REPLACE(REPLACE(REPLACE(NEW.telefone, '(', ''), ')', ''), ' ', ''), '-', '');
  
  -- 7.1 VERIFICAR SE JÁ EXISTE AGENDAMENTO COM MESMO NOME, TELEFONE, DATA E SERVIÇO
  SELECT EXISTS (
    SELECT 1 FROM agendamento
    WHERE LOWER(TRIM(TRANSLATE(nome, 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucaaaaaeeeeiiiiooooouuuuc'))) = nome_normalizado
      AND REPLACE(REPLACE(REPLACE(REPLACE(telefone, '(', ''), ')', ''), ' ', ''), '-', '') = telefone_normalizado
      AND data = NEW.data
      AND LOWER(TRIM(TRANSLATE(servico, 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucaaaaaeeeeiiiiooooouuuuc'))) = servico_normalizado
      AND telefone_normalizado != ''
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000')
  ) INTO existe;
  
  IF existe THEN
    RAISE EXCEPTION 'Ops, você já possui um agendamento com este NOME, TELEFONE e SERVIÇO nesta data. Por favor, escolha um serviço diferente ou outra data.';
  END IF;
  
  -- 7.2 VERIFICAR SE JÁ ATINGIU O LIMITE DE 3 AGENDAMENTOS COM MESMO NOME E TELEFONE NA MESMA DATA
  DECLARE
    total_agendamentos INTEGER;
  BEGIN
    SELECT COUNT(*) INTO total_agendamentos FROM agendamento
    WHERE LOWER(TRIM(TRANSLATE(nome, 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucaaaaaeeeeiiiiooooouuuuc'))) = nome_normalizado
      AND REPLACE(REPLACE(REPLACE(REPLACE(telefone, '(', ''), ')', ''), ' ', ''), '-', '') = telefone_normalizado
      AND data = NEW.data
      AND telefone_normalizado != ''
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000');
    
    IF total_agendamentos >= 3 THEN
      RAISE EXCEPTION 'Ops, você já atingiu o limite máximo de 3 agendamentos com este NOME e TELEFONE para esta data. Por favor, escolha outra data.';
    END IF;
  END;
  
  -- 8. VERIFICAR DUPLICATA - Horário no mesmo dia
  SELECT EXISTS (
    SELECT 1 FROM agendamento
    WHERE data = NEW.data
      AND horario = NEW.horario
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000')
  ) INTO existe;
  
  IF existe THEN
    RAISE EXCEPTION 'Erro: Já existe um agendamento para o horário %s nesta data. Por favor, escolha outro horário.', NEW.horario;
  END IF;
  
  -- 9. VERIFICAR CONFLITOS DE DURAÇÃO - Se há sobreposição com serviços já agendados
  -- Buscar todos os agendamentos na mesma data (exceto o atual) e verificar conflitos de duração
  FOR agend_rec IN 
    SELECT id, horario, servico FROM agendamento
    WHERE data = NEW.data
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000')
  LOOP
    -- Buscar a duração do serviço existente
    SELECT duracao_minuto INTO duracao_existente FROM servicos_tempo 
    WHERE LOWER(TRIM(TRANSLATE(servico, 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucaaaaaeeeeiiiiooooouuuuc'))) = LOWER(TRIM(TRANSLATE(agend_rec.servico, 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucaaaaaeeeeiiiiooooouuuuc')))
    LIMIT 1;
    
    IF duracao_existente IS NOT NULL THEN
      -- Calcular o horário inicial e final do agendamento existente
      hora_ini_existente := agend_rec.horario::TIME;
      hora_fim_existente := hora_ini_existente + (duracao_existente || ' minutes')::INTERVAL;
      
      -- Verificar se há sobreposição entre o novo agendamento e o existente
      -- Dois períodos se sobrepõem se: novo_inicio < existente_fim AND novo_fim > existente_inicio
      IF (NEW.horario::TIME < hora_fim_existente AND hora_fim_agendamento > hora_ini_existente) THEN
        RAISE EXCEPTION 'Erro: Não é possível agendar neste horário. Já existe um agendamento de % que vai de % até % nesta data. Por favor, escolha outro horário.', 
          agend_rec.servico, TO_CHAR(hora_ini_existente, 'HH24:MI'), TO_CHAR(hora_fim_existente, 'HH24:MI');
      END IF;
    END IF;
  END LOOP;
  
  -- 10. VALIDAR HORÁRIO PASSADO NO DIA ATUAL - APÓS TODAS AS OUTRAS VALIDAÇÕES
  -- compara com data_atual e hora_atual já calculadas no mesmo fuso
  IF data_agendamento = data_atual THEN
    IF NEW.horario::TIME < hora_atual THEN
      RAISE EXCEPTION 'Erro: Não é possível agendar para horários que já passaram. Por favor, escolha um horário futuro.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_validar_agendamento
BEFORE INSERT OR UPDATE ON agendamento
FOR EACH ROW
EXECUTE FUNCTION validar_agendamento();

-- ================================================
-- CRIAÇÃO: FUNÇÃO RPC PARA SALVAR
-- ================================================
CREATE OR REPLACE FUNCTION salvar_agendamento_rpc(
  data_input TEXT, 
  horario_input TEXT,
  nome_input TEXT, 
  servico_input TEXT, 
  telefone_input TEXT
) 
RETURNS UUID 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
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

-- ================================================
-- CRIAÇÃO: FUNÇÃO RPC PARA BUSCAR
-- ================================================
CREATE OR REPLACE FUNCTION buscar_agendamentos_por_ids(lista_ids UUID[])
RETURNS TABLE(id UUID, nome TEXT, telefone TEXT, servico TEXT, data TEXT, horario TEXT) 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public 
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    agendamento.id, 
    agendamento.nome, 
    agendamento.telefone, 
    agendamento.servico, 
    agendamento.data, 
    agendamento.horario
  FROM agendamento
  WHERE agendamento.id = ANY(lista_ids)
  ORDER BY agendamento.data DESC, agendamento.horario DESC;
END;
$$;
