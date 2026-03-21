-- ============================================================
-- FUNÇÃO SQL COM SECURITY DEFINER PARA EXCLUSÃO SEGURA DE DATAS
-- ============================================================
-- Execute este script no Supabase SQL Editor
-- URL: https://app.supabase.com/project/[seu-projeto]/sql/new

-- ============================================================
-- FUNÇÃO: excluir_data_por_admin
-- ============================================================
-- Descrição: Função com SECURITY DEFINER que valida credenciais 
-- do admin e executa a exclusão de data com segurança
-- ============================================================

CREATE OR REPLACE FUNCTION excluir_data_por_admin(
  p_nome_usuario TEXT,
  p_senha_usuario TEXT,
  p_data_exclusao TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_validacao BOOLEAN;
  v_datas_atualizadas TEXT;
  v_horarios_atualizados TEXT;
  v_index_data INT;
  v_index_horario INT;
  v_datas_array TEXT[];
  v_horarios_array TEXT[];
  v_resultado JSON;
  v_data_convertida TEXT;
  v_partes TEXT[];
BEGIN
  -- ============================================================
  -- PASSO 1: VALIDAR CREDENCIAIS DO ADMINISTRADOR
  -- ============================================================
  SELECT EXISTS(
    SELECT 1 FROM admin
    WHERE nome = p_nome_usuario
    AND senha = p_senha_usuario
  ) INTO v_validacao;

  -- Se não for um admin válido, retornar erro
  IF NOT v_validacao THEN
    RETURN json_build_object(
      'sucesso', FALSE,
      'mensagem', 'Credenciais inválidas. Operação negada.'
    );
  END IF;

  -- ============================================================
  -- PASSO 2: BUSCAR DADOS ATUAIS (datas e horários)
  -- ============================================================
  SELECT datas, horarios INTO v_datas_atualizadas, v_horarios_atualizados
  FROM arch_de_contx
  LIMIT 1;

  -- Se não houver dados, retornar erro
  IF v_datas_atualizadas IS NULL THEN
    RETURN json_build_object(
      'sucesso', FALSE,
      'mensagem', 'Nenhum dado encontrado em arch_de_contx.'
    );
  END IF;

  -- ============================================================
  -- PASSO 3: CONVERTER STRINGS EM ARRAYS
  -- Datas: separadas por VÍRGULA (,)
  -- Horários: BARRA (/) separa datas, VÍRGULA (,) separa intervalos dentro de uma data
  -- Formato datas: "01/01/2026, 15/01/2026"
  --          horários: "08:00-12:00, 14:00-18:00 / 09:00-13:00"
  -- ============================================================
  v_datas_array := COALESCE(string_to_array(v_datas_atualizadas, ','), ARRAY[]::TEXT[]);
  v_horarios_array := COALESCE(string_to_array(v_horarios_atualizados, '/'), ARRAY[]::TEXT[]);
  
  -- Remover espaços em branco de cada elemento
  IF v_datas_array IS NOT NULL AND array_length(v_datas_array, 1) IS NOT NULL THEN
    FOR i IN 1..array_length(v_datas_array, 1) LOOP
      v_datas_array[i] := TRIM(v_datas_array[i]);
      IF v_horarios_array IS NOT NULL AND i <= array_length(v_horarios_array, 1) THEN
        v_horarios_array[i] := TRIM(v_horarios_array[i]);
      END IF;
    END LOOP;
  END IF;
  -- ============================================================
  -- A data chega em formato ISO (YYYY-MM-DD) do JavaScript
  -- Mas no banco está em DD/MM/YYYY
  -- Converter para o formato do banco
  IF p_data_exclusao ~ '^\d{4}-\d{2}-\d{2}$' THEN
    -- Formato ISO (YYYY-MM-DD) detectado
    v_partes := string_to_array(p_data_exclusao, '-');
    -- Converter YYYY-MM-DD para DD/MM/YYYY
    v_data_convertida := v_partes[3] || '/' || v_partes[2] || '/' || v_partes[1];
  ELSE
    -- Se já está em outro formato, usar como está
    v_data_convertida := p_data_exclusao;
  END IF;

  -- ============================================================
  -- PASSO 4: ENCONTRAR ÍNDICE DA DATA A EXCLUIR
  -- ============================================================
  v_index_data := NULL;
  IF v_datas_array IS NOT NULL AND array_length(v_datas_array, 1) IS NOT NULL THEN
    FOR i IN 1..array_length(v_datas_array, 1) LOOP
      IF v_datas_array[i] = v_data_convertida THEN
        v_index_data := i;
        EXIT;
      END IF;
    END LOOP;
  END IF;

  -- Se data não encontrada, retornar erro com info de debug
  IF v_index_data IS NULL THEN
    RETURN json_build_object(
      'sucesso', FALSE,
      'mensagem', 'Data não encontrada nos registros.',
      'debug', json_build_object(
        'data_procurada', v_data_convertida,
        'datas_no_banco', v_datas_array
      )
    );
  END IF;

  -- ============================================================
  -- PASSO 5: REMOVER DATA DO ARRAY
  -- ============================================================
  v_datas_array := v_datas_array[:v_index_data-1] || v_datas_array[v_index_data+1:];

  -- ============================================================
  -- PASSO 6: REMOVER HORÁRIO CORRESPONDENTE
  -- ============================================================
  -- Se houver horários correspondentes, remover também
  IF v_index_data <= array_length(v_horarios_array, 1) THEN
    v_horarios_array := v_horarios_array[:v_index_data-1] || v_horarios_array[v_index_data+1:];
  END IF;

  -- ============================================================
  -- PASSO 7: ATUALIZAR TABELA arch_de_contx
  -- Datas separadas por VÍRGULA (,)
  -- Horários separados por BARRA (/) entre datas, VÍRGULA (,) dentro de uma data
  -- NOTA: Atualiza TODAS as linhas (deveria ser apenas 1)
  -- ============================================================
  UPDATE arch_de_contx
  SET 
    datas = TRIM(array_to_string(v_datas_array, ', ')),
    horarios = TRIM(array_to_string(v_horarios_array, ' / '))
  WHERE 1=1;

  -- ============================================================
  -- PASSO 8: DELETAR DA TABELA cpxm
  -- ============================================================
  DELETE FROM cpxm
  WHERE TRIM(data) = v_data_convertida;

  -- ============================================================
  -- PASSO 9: RETORNAR SUCESSO
  -- ============================================================
  RETURN json_build_object(
    'sucesso', TRUE,
    'mensagem', 'Data excluída com sucesso!',
    'data_excluida', v_data_convertida,
    'timestamp', NOW()
  );

EXCEPTION WHEN OTHERS THEN
  -- Se houver qualquer erro, retornar detalhes
  RETURN json_build_object(
    'sucesso', FALSE,
    'mensagem', 'Erro ao processar exclusão: ' || SQLERRM
  );
END;
$$;

-- ============================================================
-- GRANT DE PERMISSÕES
-- ============================================================
-- Dar permissão aos usuários anônimos e autenticados para usar a função
GRANT EXECUTE ON FUNCTION excluir_data_por_admin(TEXT, TEXT, TEXT) TO anon, authenticated;

-- ============================================================
-- FUNÇÃO: atualizar_data_por_admin
-- ============================================================
-- Descrição: Função com SECURITY DEFINER que valida credenciais 
-- do admin e executa a atualização de data e horários com segurança
-- ============================================================

DROP FUNCTION IF EXISTS atualizar_data_por_admin(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION atualizar_data_por_admin(
  p_nome_usuario TEXT,
  p_senha_usuario TEXT,
  p_data_antiga TEXT,
  p_data_nova TEXT,
  p_horarios_novos TEXT,
  p_servicos_novos TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_validacao BOOLEAN;
  v_data_convertida_antiga TEXT;
  v_data_convertida_nova TEXT;
  v_partes TEXT[];
  v_registros_atualizados INT;
  v_datas_atualizadas TEXT;
  v_horarios_atualizados TEXT;
  v_datas_array TEXT[];
  v_horarios_array TEXT[];
  v_index_data INT;
BEGIN
  -- ============================================================
  -- PASSO 1: VALIDAR CREDENCIAIS DO ADMINISTRADOR
  -- ============================================================
  SELECT EXISTS(
    SELECT 1 FROM admin
    WHERE nome = p_nome_usuario
    AND senha = p_senha_usuario
  ) INTO v_validacao;

  -- Se não for um admin válido, retornar erro
  IF NOT v_validacao THEN
    RETURN json_build_object(
      'sucesso', FALSE,
      'mensagem', 'Credenciais inválidas. Operação negada.'
    );
  END IF;

  -- ============================================================
  -- PASSO 2: CONVERTER DATAS (YYYY-MM-DD → DD/MM/YYYY)
  -- ============================================================
  IF p_data_antiga ~ '^\d{4}-\d{2}-\d{2}$' THEN
    v_partes := string_to_array(p_data_antiga, '-');
    v_data_convertida_antiga := v_partes[3] || '/' || v_partes[2] || '/' || v_partes[1];
  ELSE
    v_data_convertida_antiga := p_data_antiga;
  END IF;

  IF p_data_nova ~ '^\d{4}-\d{2}-\d{2}$' THEN
    v_partes := string_to_array(p_data_nova, '-');
    v_data_convertida_nova := v_partes[3] || '/' || v_partes[2] || '/' || v_partes[1];
  ELSE
    v_data_convertida_nova := p_data_nova;
  END IF;

  -- ============================================================
  -- PASSO 3: ATUALIZAR NA TABELA cpxm
  -- ============================================================
  UPDATE cpxm
  SET 
    data = v_data_convertida_nova,
    servicos = COALESCE(p_servicos_novos, servicos)
  WHERE TRIM(data) = v_data_convertida_antiga;

  GET DIAGNOSTICS v_registros_atualizados = ROW_COUNT;

  -- Se nenhum registro foi atualizado, retornar erro
  IF v_registros_atualizados = 0 THEN
    RETURN json_build_object(
      'sucesso', FALSE,
      'mensagem', 'Data não encontrada nos registros.',
      'debug', json_build_object(
        'data_procurada', v_data_convertida_antiga
      )
    );
  END IF;

  -- ============================================================
  -- PASSO 4: BUSCAR DADOS ATUAIS DA TABELA arch_de_contx
  -- ============================================================
  SELECT datas, horarios INTO v_datas_atualizadas, v_horarios_atualizados
  FROM arch_de_contx
  LIMIT 1;

  -- Se não houver dados, retornar erro
  IF v_datas_atualizadas IS NULL THEN
    RETURN json_build_object(
      'sucesso', FALSE,
      'mensagem', 'Nenhum dado encontrado em arch_de_contx.'
    );
  END IF;

  -- ============================================================
  -- PASSO 5: CONVERTER STRINGS EM ARRAYS
  -- Datas: separadas por VÍRGULA (,)
  -- Horários: BARRA (/) separa datas diferentes
  -- ============================================================
  v_datas_array := COALESCE(string_to_array(v_datas_atualizadas, ','), ARRAY[]::TEXT[]);
  v_horarios_array := COALESCE(string_to_array(v_horarios_atualizados, '/'), ARRAY[]::TEXT[]);
  
  -- Remover espaços em branco de cada elemento
  IF v_datas_array IS NOT NULL AND array_length(v_datas_array, 1) IS NOT NULL THEN
    FOR i IN 1..array_length(v_datas_array, 1) LOOP
      v_datas_array[i] := TRIM(v_datas_array[i]);
      IF v_horarios_array IS NOT NULL AND i <= array_length(v_horarios_array, 1) THEN
        v_horarios_array[i] := TRIM(v_horarios_array[i]);
      END IF;
    END LOOP;
  END IF;

  -- ============================================================
  -- PASSO 6: ENCONTRAR ÍNDICE DA DATA ANTIGA NO ARRAY
  -- ============================================================
  v_index_data := NULL;
  IF v_datas_array IS NOT NULL AND array_length(v_datas_array, 1) IS NOT NULL THEN
    FOR i IN 1..array_length(v_datas_array, 1) LOOP
      IF v_datas_array[i] = v_data_convertida_antiga THEN
        v_index_data := i;
        EXIT;
      END IF;
    END LOOP;
  END IF;

  -- Se data não encontrada, retornar erro
  IF v_index_data IS NULL THEN
    RETURN json_build_object(
      'sucesso', FALSE,
      'mensagem', 'Data não encontrada nos registros.',
      'debug', json_build_object(
        'data_procurada', v_data_convertida_antiga,
        'datas_existentes', v_datas_array
      )
    );
  END IF;

  -- ============================================================
  -- PASSO 7: SUBSTITUIR DATA ANTIGA PELA NOVA NO ARRAY
  -- ============================================================
  v_datas_array[v_index_data] := v_data_convertida_nova;

  -- ============================================================
  -- PASSO 8: ATUALIZAR HORÁRIOS SE FORNECIDOS
  -- ============================================================
  IF p_horarios_novos IS NOT NULL AND v_index_data <= array_length(v_horarios_array, 1) THEN
    v_horarios_array[v_index_data] := p_horarios_novos;
  END IF;

  -- ============================================================
  -- PASSO 9: ATUALIZAR NA TABELA arch_de_contx
  -- Reconstruir a string com as datas/horários atualizados
  -- NOTA: Atualiza TODAS as linhas (deveria ser apenas 1)
  -- ============================================================
  UPDATE arch_de_contx
  SET 
    datas = TRIM(array_to_string(v_datas_array, ', ')),
    horarios = TRIM(array_to_string(v_horarios_array, ' / '))
  WHERE 1=1;

  -- ============================================================
  -- PASSO 5: RETORNAR SUCESSO
  -- ============================================================
  RETURN json_build_object(
    'sucesso', TRUE,
    'mensagem', 'Data atualizada com sucesso!',
    'data_antiga', v_data_convertida_antiga,
    'data_nova', v_data_convertida_nova,
    'registros_atualizados', v_registros_atualizados,
    'timestamp', NOW()
  );

EXCEPTION WHEN OTHERS THEN
  -- Se houver qualquer erro, retornar detalhes
  RETURN json_build_object(
    'sucesso', FALSE,
    'mensagem', 'Erro ao processar atualização: ' || SQLERRM
  );
END;
$$;

-- ============================================================
-- GRANT DE PERMISSÕES PARA atualizar_data_por_admin
-- ============================================================
GRANT EXECUTE ON FUNCTION atualizar_data_por_admin(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

-- ============================================================
-- FUNÇÃO: gerenciar_servicos_clinica
-- ============================================================
-- Descrição: Função com SECURITY DEFINER para gerenciar serviços da clínica
-- (adicionar, editar ou remover) com validação de credenciais do admin
-- Atualiza tanto arch_de_contx quanto todas as linhas de cpxm
-- ============================================================

CREATE OR REPLACE FUNCTION gerenciar_servicos_clinica(
  p_nome_usuario TEXT,
  p_senha_usuario TEXT,
  p_acao TEXT,
  p_servico_anterior TEXT,
  p_servico_novo TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_validacao BOOLEAN;
  v_servicos_atuais TEXT;
  v_servicos_array TEXT[];
  v_index_servico INT;
  v_resultado_acao TEXT;
  v_servicos_cpxm TEXT;
  v_servicos_cpxm_array TEXT[];
  v_servicos_cpxm_novo TEXT;
  v_registros_atualizados INT := 0;
  v_servicos_temp TEXT[];
  v_row RECORD;
BEGIN
  -- ============================================================
  -- PASSO 1: VALIDAR CREDENCIAIS DO ADMINISTRADOR
  -- ============================================================
  SELECT EXISTS(
    SELECT 1 FROM admin
    WHERE nome = p_nome_usuario
    AND senha = p_senha_usuario
  ) INTO v_validacao;

  -- Se não for um admin válido, retornar erro
  IF NOT v_validacao THEN
    RETURN json_build_object(
      'sucesso', FALSE,
      'mensagem', 'Credenciais inválidas. Operação negada.'
    );
  END IF;

  -- ============================================================
  -- PASSO 1B: LIMPEZA DE SEGURANÇA
  -- Se houver mais de 1 linha em arch_de_contx, manter apenas a primeira
  -- e deletar as duplicatas
  -- ============================================================
  DELETE FROM arch_de_contx
  WHERE ctid NOT IN (
    SELECT ctid FROM arch_de_contx LIMIT 1
  );

  -- ============================================================
  -- PASSO 2: BUSCAR SERVIÇOS ATUAIS DA TABELA arch_de_contx
  -- Se não existir registro, criar um vazio automaticamente
  -- IMPORTANTE: arch_de_contx deve ter apenas 1 linha sempre!
  -- ============================================================
  SELECT servicos INTO v_servicos_atuais
  FROM arch_de_contx
  LIMIT 1;

  -- Se não houver dados, criar um registro vazio
  IF v_servicos_atuais IS NULL THEN
    -- Verificar se realmente não há linhas (evita duplicatas)
    IF (SELECT COUNT(*) FROM arch_de_contx) = 0 THEN
      INSERT INTO arch_de_contx (datas, horarios, servicos)
      VALUES ('', '', '');
    END IF;
    
    v_servicos_atuais := '';
  END IF;

  -- ============================================================
  -- PASSO 3: CONVERTER STRING EM ARRAY
  -- Serviços separados por VÍRGULA (,)
  -- ============================================================
  v_servicos_array := COALESCE(string_to_array(v_servicos_atuais, ','), ARRAY[]::TEXT[]);
  
  -- Remover espaços em branco de cada elemento
  IF v_servicos_array IS NOT NULL AND array_length(v_servicos_array, 1) IS NOT NULL THEN
    FOR i IN 1..array_length(v_servicos_array, 1) LOOP
      v_servicos_array[i] := TRIM(v_servicos_array[i]);
    END LOOP;
  END IF;

  -- ============================================================
  -- PASSO 4: EXECUTAR AÇÃO SOLICITADA
  -- ============================================================

  -- AÇÃO: ADICIONAR NOVO SERVIÇO
  IF p_acao = 'adicionar' THEN
    -- Verificar se o serviço já existe
    IF v_servicos_array IS NOT NULL AND array_length(v_servicos_array, 1) IS NOT NULL THEN
      FOR i IN 1..array_length(v_servicos_array, 1) LOOP
        IF LOWER(v_servicos_array[i]) = LOWER(TRIM(p_servico_novo)) THEN
          RETURN json_build_object(
            'sucesso', FALSE,
            'mensagem', 'Este serviço já está cadastrado.'
          );
        END IF;
      END LOOP;
    END IF;

    -- Adicionar novo serviço apenas em arch_de_contx
    v_servicos_array := array_append(v_servicos_array, TRIM(p_servico_novo));
    v_resultado_acao := 'Serviço adicionado com sucesso!';

  -- AÇÃO: EDITAR SERVIÇO
  ELSIF p_acao = 'editar' THEN
    -- Encontrar índice do serviço anterior
    v_index_servico := NULL;
    IF v_servicos_array IS NOT NULL AND array_length(v_servicos_array, 1) IS NOT NULL THEN
      FOR i IN 1..array_length(v_servicos_array, 1) LOOP
        IF LOWER(v_servicos_array[i]) = LOWER(TRIM(p_servico_anterior)) THEN
          v_index_servico := i;
          EXIT;
        END IF;
      END LOOP;
    END IF;

    -- Se serviço não encontrado, retornar erro
    IF v_index_servico IS NULL THEN
      RETURN json_build_object(
        'sucesso', FALSE,
        'mensagem', 'Serviço não encontrado para edição.'
      );
    END IF;

    -- Verificar se o novo nome já existe
    IF LOWER(TRIM(p_servico_novo)) != LOWER(TRIM(p_servico_anterior)) THEN
      IF v_servicos_array IS NOT NULL AND array_length(v_servicos_array, 1) IS NOT NULL THEN
        FOR i IN 1..array_length(v_servicos_array, 1) LOOP
          IF LOWER(v_servicos_array[i]) = LOWER(TRIM(p_servico_novo)) THEN
            RETURN json_build_object(
              'sucesso', FALSE,
              'mensagem', 'Este novo nome de serviço já está cadastrado.'
            );
          END IF;
        END LOOP;
      END IF;
    END IF;

    -- Editar serviço em arch_de_contx
    v_servicos_array[v_index_servico] := TRIM(p_servico_novo);
    
    -- Atualizar em todas as linhas de cpxm
    FOR v_row IN SELECT servicos FROM cpxm WHERE servicos IS NOT NULL LOOP
      v_servicos_cpxm := v_row.servicos;
      
      IF v_servicos_cpxm IS NOT NULL AND v_servicos_cpxm != '' THEN
        -- Converter string de serviços em array
        v_servicos_cpxm_array := COALESCE(string_to_array(v_servicos_cpxm, ','), ARRAY[]::TEXT[]);
        
        -- Remover espaços em branco e substituir quando encontrado
        IF v_servicos_cpxm_array IS NOT NULL AND array_length(v_servicos_cpxm_array, 1) IS NOT NULL THEN
          FOR i IN 1..array_length(v_servicos_cpxm_array, 1) LOOP
            v_servicos_cpxm_array[i] := TRIM(v_servicos_cpxm_array[i]);
            
            -- Se encontrar o serviço anterior, substituir pelo novo
            IF LOWER(v_servicos_cpxm_array[i]) = LOWER(TRIM(p_servico_anterior)) THEN
              v_servicos_cpxm_array[i] := TRIM(p_servico_novo);
            END IF;
          END LOOP;
        END IF;
        
        -- Reconstruir string e atualizar
        v_servicos_cpxm_novo := TRIM(array_to_string(v_servicos_cpxm_array, ', '));
        UPDATE cpxm SET servicos = v_servicos_cpxm_novo WHERE servicos = v_servicos_cpxm;
        
        IF FOUND THEN
          v_registros_atualizados := v_registros_atualizados + 1;
        END IF;
      END IF;
    END LOOP;
    
    v_resultado_acao := 'Serviço atualizado com sucesso!';

  -- AÇÃO: REMOVER SERVIÇO
  ELSIF p_acao = 'remover' THEN
    -- Encontrar índice do serviço a remover
    v_index_servico := NULL;
    IF v_servicos_array IS NOT NULL AND array_length(v_servicos_array, 1) IS NOT NULL THEN
      FOR i IN 1..array_length(v_servicos_array, 1) LOOP
        IF LOWER(v_servicos_array[i]) = LOWER(TRIM(p_servico_anterior)) THEN
          v_index_servico := i;
          EXIT;
        END IF;
      END LOOP;
    END IF;

    -- Se serviço não encontrado, retornar erro
    IF v_index_servico IS NULL THEN
      RETURN json_build_object(
        'sucesso', FALSE,
        'mensagem', 'Serviço não encontrado para remoção.'
      );
    END IF;

    -- Remover serviço de arch_de_contx
    v_servicos_array := v_servicos_array[:v_index_servico-1] || v_servicos_array[v_index_servico+1:];
    
    -- Remover de cpxm APENAS para datas no futuro
    FOR v_row IN SELECT servicos, data FROM cpxm WHERE servicos IS NOT NULL LOOP
      v_servicos_cpxm := v_row.servicos;
      
      -- Verificar se a data está no futuro (convertendo DD/MM/YYYY para DATE)
      IF v_row.data ~ '^\d{2}/\d{2}/\d{4}$' THEN
        IF TO_DATE(v_row.data, 'DD/MM/YYYY') > CURRENT_DATE THEN
          -- Data está no futuro, remover o serviço
          IF v_servicos_cpxm IS NOT NULL AND v_servicos_cpxm != '' THEN
            -- Converter string de serviços em array
            v_servicos_cpxm_array := COALESCE(string_to_array(v_servicos_cpxm, ','), ARRAY[]::TEXT[]);
            v_servicos_temp := ARRAY[]::TEXT[];
            
            -- Remover espaços em branco e filtrar o serviço a remover
            IF v_servicos_cpxm_array IS NOT NULL AND array_length(v_servicos_cpxm_array, 1) IS NOT NULL THEN
              FOR i IN 1..array_length(v_servicos_cpxm_array, 1) LOOP
                v_servicos_cpxm_array[i] := TRIM(v_servicos_cpxm_array[i]);
                
                -- Se não for o serviço a remover, manter no array
                IF LOWER(v_servicos_cpxm_array[i]) != LOWER(TRIM(p_servico_anterior)) THEN
                  v_servicos_temp := array_append(v_servicos_temp, v_servicos_cpxm_array[i]);
                END IF;
              END LOOP;
            END IF;
            
            -- Reconstruir string e atualizar
            IF array_length(v_servicos_temp, 1) IS NOT NULL AND array_length(v_servicos_temp, 1) > 0 THEN
              v_servicos_cpxm_novo := TRIM(array_to_string(v_servicos_temp, ', '));
            ELSE
              v_servicos_cpxm_novo := '';
            END IF;
            
            UPDATE cpxm SET servicos = v_servicos_cpxm_novo WHERE servicos = v_servicos_cpxm AND data = v_row.data;
            
            IF FOUND THEN
              v_registros_atualizados := v_registros_atualizados + 1;
            END IF;
          END IF;
        END IF;
      END IF;
    END LOOP;

    -- Remover serviço da tabela servicos_tempo
    DELETE FROM servicos_tempo
    WHERE LOWER(TRIM(servico)) = LOWER(TRIM(p_servico_anterior));
    
    v_resultado_acao := 'Serviço removido com sucesso!';

  ELSE
    RETURN json_build_object(
      'sucesso', FALSE,
      'mensagem', 'Ação não reconhecida. Use: adicionar, editar ou remover.'
    );
  END IF;

  -- ============================================================
  -- PASSO 5: ATUALIZAR NA TABELA arch_de_contx
  -- Reconstruir a string com os serviços atualizados
  -- NOTA: Atualiza TODAS as linhas (deveria ser apenas 1)
  -- ============================================================
  UPDATE arch_de_contx
  SET servicos = TRIM(array_to_string(v_servicos_array, ', '))
  WHERE 1=1;

  -- ============================================================
  -- PASSO 6: RETORNAR SUCESSO
  -- ============================================================
  RETURN json_build_object(
    'sucesso', TRUE,
    'mensagem', v_resultado_acao,
    'acao', p_acao,
    'registros_cpxm_atualizados', COALESCE(v_registros_atualizados, 0),
    'timestamp', NOW()
  );

EXCEPTION WHEN OTHERS THEN
  -- Se houver qualquer erro, retornar detalhes
  RETURN json_build_object(
    'sucesso', FALSE,
    'mensagem', 'Erro ao processar operação: ' || SQLERRM
  );
END;
$$;

-- ============================================================
-- GRANT DE PERMISSÕES PARA gerenciar_servicos_clinica
-- ============================================================
GRANT EXECUTE ON FUNCTION gerenciar_servicos_clinica(TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

-- ============================================================
-- FUNÇÃO: gerenciar_tempo_servicos
-- ============================================================
-- Descrição: Função com SECURITY DEFINER para gerenciar duração 
-- de serviços na tabela servicos_tempo (adicionar, editar ou remover)
-- com validação de credenciais do admin
-- ============================================================

CREATE OR REPLACE FUNCTION gerenciar_tempo_servicos(
  p_nome_usuario TEXT,
  p_senha_usuario TEXT,
  p_acao TEXT,
  p_servico_nome TEXT,
  p_servico_anterior TEXT,
  p_duracao_minutos INT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_validacao BOOLEAN;
  v_servico_existe BOOLEAN;
  v_duracao_anterior INT;
  v_resultado_acao TEXT;
BEGIN
  -- ============================================================
  -- PASSO 1: VALIDAR CREDENCIAIS DO ADMINISTRADOR
  -- ============================================================
  SELECT EXISTS(
    SELECT 1 FROM admin
    WHERE nome = p_nome_usuario
    AND senha = p_senha_usuario
  ) INTO v_validacao;

  -- Se não for um admin válido, retornar erro
  IF NOT v_validacao THEN
    RETURN json_build_object(
      'sucesso', FALSE,
      'mensagem', 'Credenciais inválidas. Operação negada.'
    );
  END IF;

  -- ============================================================
  -- PASSO 2: EXECUTAR AÇÃO SOLICITADA
  -- ============================================================

  -- AÇÃO: ADICIONAR NOVO SERVIÇO COM DURAÇÃO
  IF p_acao = 'adicionar' THEN
    -- Validar duração
    IF p_duracao_minutos IS NULL OR p_duracao_minutos <= 0 THEN
      RETURN json_build_object(
        'sucesso', FALSE,
        'mensagem', 'A duração deve ser maior que 0 minutos.'
      );
    END IF;

    -- Verificar se o serviço já existe
    SELECT EXISTS(
      SELECT 1 FROM servicos_tempo
      WHERE LOWER(TRIM(servico)) = LOWER(TRIM(p_servico_nome))
    ) INTO v_servico_existe;

    IF v_servico_existe THEN
      RETURN json_build_object(
        'sucesso', FALSE,
        'mensagem', 'Este serviço já está cadastrado e possui duração definida.'
      );
    END IF;

    -- Inserir novo serviço com duração
    INSERT INTO servicos_tempo (servico, duracao_minuto)
    VALUES (TRIM(p_servico_nome), p_duracao_minutos);

    v_resultado_acao := 'Serviço e duração adicionados com sucesso!';

  -- AÇÃO: EDITAR DURAÇÃO DO SERVIÇO
  ELSIF p_acao = 'editar' THEN
    -- Validar duração
    IF p_duracao_minutos IS NULL OR p_duracao_minutos <= 0 THEN
      RETURN json_build_object(
        'sucesso', FALSE,
        'mensagem', 'A duração deve ser maior que 0 minutos.'
      );
    END IF;

    -- Atualizar duração do serviço
    UPDATE servicos_tempo
    SET duracao_minuto = p_duracao_minutos
    WHERE LOWER(TRIM(servico)) = LOWER(TRIM(p_servico_anterior));

    -- Se nenhuma linha foi atualizada, inserir novo registro
    IF NOT FOUND THEN
      BEGIN
        INSERT INTO servicos_tempo (servico, duracao_minuto)
        VALUES (TRIM(p_servico_anterior), p_duracao_minutos);
      EXCEPTION WHEN unique_violation THEN
        -- Se houver conflito de chave única, atualizar novamente
        UPDATE servicos_tempo
        SET duracao_minuto = p_duracao_minutos
        WHERE LOWER(TRIM(servico)) = LOWER(TRIM(p_servico_anterior));
      END;
    END IF;

    v_resultado_acao := 'Duração do serviço atualizada com sucesso!';

  -- AÇÃO: REMOVER SERVIÇO (e sua duração)
  ELSIF p_acao = 'remover' THEN
    DELETE FROM servicos_tempo
    WHERE LOWER(TRIM(servico)) = LOWER(TRIM(p_servico_anterior));

    IF NOT FOUND THEN
      RETURN json_build_object(
        'sucesso', FALSE,
        'mensagem', 'Serviço não encontrado na tabela de tempos.'
      );
    END IF;

    v_resultado_acao := 'Serviço removido da tabela de tempos!';

  -- AÇÃO: OBTER DURAÇÃO DO SERVIÇO
  ELSIF p_acao = 'obter' THEN
    SELECT duracao_minuto INTO v_duracao_anterior
    FROM servicos_tempo
    WHERE LOWER(TRIM(servico)) = LOWER(TRIM(p_servico_anterior));

    IF v_duracao_anterior IS NULL THEN
      -- Retornar 0 ou valor padrão se serviço não tiver duração registrada
      RETURN json_build_object(
        'sucesso', TRUE,
        'mensagem', 'Serviço encontrado.',
        'duracao_minutos', 0
      );
    END IF;

    RETURN json_build_object(
      'sucesso', TRUE,
      'mensagem', 'Duração obtida com sucesso.',
      'duracao_minutos', v_duracao_anterior
    );

  ELSE
    RETURN json_build_object(
      'sucesso', FALSE,
      'mensagem', 'Ação não reconhecida. Use: adicionar, editar, remover ou obter.'
    );
  END IF;

  -- ============================================================
  -- RETORNAR SUCESSO
  -- ============================================================
  RETURN json_build_object(
    'sucesso', TRUE,
    'mensagem', v_resultado_acao,
    'acao', p_acao,
    'timestamp', NOW()
  );

EXCEPTION WHEN OTHERS THEN
  -- Se houver qualquer erro, retornar detalhes
  RETURN json_build_object(
    'sucesso', FALSE,
    'mensagem', 'Erro ao processar operação: ' || SQLERRM
  );
END;
$$;

-- ============================================================
-- GRANT DE PERMISSÕES PARA gerenciar_tempo_servicos
-- ============================================================
GRANT EXECUTE ON FUNCTION gerenciar_tempo_servicos(TEXT, TEXT, TEXT, TEXT, TEXT, INT) TO anon, authenticated;

-- ============================================================
-- FUNÇÃO: adicionar_data_horario_por_admin
-- ============================================================
-- Descrição: Função com SECURITY DEFINER para adicionar novas datas
-- e horários com validação de credenciais do admin
-- Registra em arch_de_contx (datas e horários) e cpxm (serviços)
-- ============================================================

CREATE OR REPLACE FUNCTION adicionar_data_horario_por_admin(
  p_nome_usuario TEXT,
  p_senha_usuario TEXT,
  p_data_nova TEXT,
  p_horarios_novos TEXT,
  p_servicos TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_validacao BOOLEAN;
  v_datas_atualizadas TEXT;
  v_horarios_atualizados TEXT;
  v_datas_array TEXT[];
  v_horarios_array TEXT[];
  v_data_convertida TEXT;
  v_partes TEXT[];
  v_data_ja_existe BOOLEAN;
BEGIN
  -- ============================================================
  -- PASSO 1: VALIDAR CREDENCIAIS DO ADMINISTRADOR
  -- ============================================================
  SELECT EXISTS(
    SELECT 1 FROM admin
    WHERE nome = p_nome_usuario
    AND senha = p_senha_usuario
  ) INTO v_validacao;

  -- Se não for um admin válido, retornar erro
  IF NOT v_validacao THEN
    RETURN json_build_object(
      'sucesso', FALSE,
      'mensagem', 'Credenciais inválidas. Operação negada.'
    );
  END IF;

  -- ============================================================
  -- PASSO 1B: LIMPEZA DE SEGURANÇA
  -- Se houver mais de 1 linha em arch_de_contx, manter apenas a primeira
  -- e deletar as duplicatas
  -- ============================================================
  DELETE FROM arch_de_contx
  WHERE ctid NOT IN (
    SELECT ctid FROM arch_de_contx LIMIT 1
  );

  -- ============================================================
  -- PASSO 2: CONVERTER DATA (YYYY-MM-DD → DD/MM/YYYY)
  -- ============================================================
  IF p_data_nova ~ '^\d{4}-\d{2}-\d{2}$' THEN
    v_partes := string_to_array(p_data_nova, '-');
    v_data_convertida := v_partes[3] || '/' || v_partes[2] || '/' || v_partes[1];
  ELSE
    v_data_convertida := p_data_nova;
  END IF;

  -- ============================================================
  -- PASSO 3: BUSCAR DADOS ATUAIS DA TABELA arch_de_contx
  -- IMPORTANTE: arch_de_contx deve ter apenas 1 linha sempre!
  -- ============================================================
  SELECT datas, horarios INTO v_datas_atualizadas, v_horarios_atualizados
  FROM arch_de_contx
  LIMIT 1;

  -- Se não houver dados, criar um registro vazio automaticamente
  IF v_datas_atualizadas IS NULL THEN
    -- Verificar se realmente não há linhas (evita duplicatas)
    IF (SELECT COUNT(*) FROM arch_de_contx) = 0 THEN
      INSERT INTO arch_de_contx (datas, horarios, servicos)
      VALUES ('', '', '');
    END IF;
    
    -- Sempre fazer uma nova seleção após garantir existência
    SELECT datas, horarios INTO v_datas_atualizadas, v_horarios_atualizados
    FROM arch_de_contx
    LIMIT 1;
    
    -- Se ainda for NULL, criar as strings vazias
    v_datas_atualizadas := COALESCE(v_datas_atualizadas, '');
    v_horarios_atualizados := COALESCE(v_horarios_atualizados, '');
  END IF;

  -- ============================================================
  -- PASSO 4: CONVERTER STRINGS EM ARRAYS
  -- Datas: separadas por VÍRGULA (,)
  -- Horários: BARRA (/) separa datas, VÍRGULA (,) separa intervalos
  -- ============================================================
  v_datas_array := COALESCE(string_to_array(v_datas_atualizadas, ','), ARRAY[]::TEXT[]);
  v_horarios_array := COALESCE(string_to_array(v_horarios_atualizados, '/'), ARRAY[]::TEXT[]);
  
  -- Remover espaços em branco de cada elemento
  IF v_datas_array IS NOT NULL AND array_length(v_datas_array, 1) IS NOT NULL THEN
    FOR i IN 1..array_length(v_datas_array, 1) LOOP
      v_datas_array[i] := TRIM(v_datas_array[i]);
      IF v_horarios_array IS NOT NULL AND i <= array_length(v_horarios_array, 1) THEN
        v_horarios_array[i] := TRIM(v_horarios_array[i]);
      END IF;
    END LOOP;
  END IF;

  -- ============================================================
  -- PASSO 5: VERIFICAR SE DATA JÁ EXISTE
  -- ============================================================
  v_data_ja_existe := FALSE;
  IF v_datas_array IS NOT NULL AND array_length(v_datas_array, 1) IS NOT NULL THEN
    FOR i IN 1..array_length(v_datas_array, 1) LOOP
      IF v_datas_array[i] = v_data_convertida THEN
        v_data_ja_existe := TRUE;
        EXIT;
      END IF;
    END LOOP;
  END IF;

  IF v_data_ja_existe THEN
    RETURN json_build_object(
      'sucesso', FALSE,
      'mensagem', 'Esta data já está cadastrada. Use a função de atualizar para modificar.'
    );
  END IF;

  -- ============================================================
  -- PASSO 6: ADICIONAR NOVA DATA E HORÁRIO AOS ARRAYS
  -- ============================================================
  v_datas_array := array_append(v_datas_array, v_data_convertida);
  v_horarios_array := array_append(v_horarios_array, TRIM(p_horarios_novos));

  -- ============================================================
  -- PASSO 7: REGISTRAR EM cpxm (SERVIÇOS)
  -- ============================================================
  INSERT INTO cpxm (data, servicos)
  VALUES (v_data_convertida, COALESCE(TRIM(p_servicos), ''))
  ON CONFLICT (data) 
  DO UPDATE SET servicos = COALESCE(TRIM(p_servicos), '');

  -- ============================================================
  -- PASSO 8: ATUALIZAR NA TABELA arch_de_contx
  -- Reconstruir strings com separadores corretos
  -- Datas: vírgula, Horários: barra
  -- NOTA: Atualiza TODAS as linhas (deveria ser apenas 1)
  -- ============================================================
  UPDATE arch_de_contx
  SET 
    datas = TRIM(array_to_string(v_datas_array, ', ')),
    horarios = TRIM(array_to_string(v_horarios_array, ' / '))
  WHERE 1=1;

  -- ============================================================
  -- PASSO 9: RETORNAR SUCESSO
  -- ============================================================
  RETURN json_build_object(
    'sucesso', TRUE,
    'mensagem', 'Data e horário registrados com sucesso!',
    'data_adicionada', v_data_convertida,
    'horarios_adicionados', p_horarios_novos,
    'timestamp', NOW()
  );

EXCEPTION WHEN OTHERS THEN
  -- Se houver qualquer erro, retornar detalhes
  RETURN json_build_object(
    'sucesso', FALSE,
    'mensagem', 'Erro ao processar adição: ' || SQLERRM
  );
END;
$$;

-- ============================================================
-- GRANT DE PERMISSÕES PARA adicionar_data_horario_por_admin
-- ============================================================
GRANT EXECUTE ON FUNCTION adicionar_data_horario_por_admin(TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

-- ============================================================
-- FIM DO SCRIPT
-- ============================================================
-- Depois de executar este script, você poderá chamar as funções
-- a partir do cliente JavaScript assim:
-- 
-- Para ADICIONAR:
-- const { data, error } = await _supabase.rpc('adicionar_data_horario_por_admin', {
--   p_nome_usuario: usuarioLogado,
--   p_senha_usuario: senhaUsuario,
--   p_data_nova: dataNovaISO,
--   p_horarios_novos: '08:00-12:00, 14:00-18:00',
--   p_servicos: 'Limpeza, Polimento'
-- });
--
-- Para EXCLUIR:
-- const { data, error } = await _supabase.rpc('excluir_data_por_admin', {
--   p_nome_usuario: usuarioLogado,
--   p_senha_usuario: senhaUsuario,
--   p_data_exclusao: dataParaExcluir
-- });
--
-- Para ATUALIZAR:
-- const { data, error } = await _supabase.rpc('atualizar_data_por_admin', {
--   p_nome_usuario: usuarioLogado,
--   p_senha_usuario: senhaUsuario,
--   p_data_antiga: dataAntigaISO,
--   p_data_nova: dataNovaISO,
--   p_horarios_novos: 'HH:MM-HH:MM, HH:MM-HH:MM',
--   p_servicos_novos: 'Nome do Serviço'
-- });
--
-- Para GERENCIAR SERVIÇOS:
-- const { data, error } = await _supabase.rpc('gerenciar_servicos_clinica', {
--   p_nome_usuario: usuarioLogado,
--   p_senha_usuario: senhaUsuario,
--   p_acao: 'adicionar',                    // ou 'editar' ou 'remover'
--   p_servico_anterior: '',                // obrigatório para 'editar' e 'remover'
--   p_servico_novo: 'Nome do Novo Serviço' // obrigatório para 'adicionar' e 'editar'
-- });
--
-- Para GERENCIAR DURAÇÃO DE SERVIÇOS:
-- const { data, error } = await _supabase.rpc('gerenciar_tempo_servicos', {
--   p_nome_usuario: usuarioLogado,
--   p_senha_usuario: senhaUsuario,
--   p_acao: 'adicionar',          // ou 'editar', 'remover' ou 'obter'
--   p_servico_nome: 'Limpeza',    // nome do serviço (obrigatório para 'adicionar')
--   p_servico_anterior: 'Limpeza', // nome anterior do serviço (obrigatório para 'editar', 'remover' e 'obter')
--   p_duracao_minutos: 30         // duração em minutos (obrigatório para 'adicionar' e 'editar', deve ser > 0)
-- });
