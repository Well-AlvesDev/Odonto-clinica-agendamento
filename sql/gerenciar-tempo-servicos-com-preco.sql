-- ============================================================
-- FUNÇÃO SQL COM SECURITY DEFINER PARA GERENCIAR SERVIÇOS COM PREÇO
-- ============================================================
-- Execute este script no Supabase SQL Editor
-- URL: https://app.supabase.com/project/[seu-projeto]/sql/new
-- 
-- Esta função SUBSTITUI a função anterior gerenciar_tempo_servicos
-- Agora ela também gerencia o campo 'price' na tabela 'servicos_tempo'
-- ============================================================

-- ============================================================
-- FUNÇÃO: gerenciar_tempo_servicos (versão aprimorada com preço)
-- ============================================================
-- Descrição: Função com SECURITY DEFINER para gerenciar duração 
-- e preço de serviços na tabela servicos_tempo (adicionar, editar ou remover)
-- com validação de credenciais do admin
--
-- Parâmetros:
--   p_nome_usuario: Nome do usuário admin
--   p_senha_usuario: Senha do usuário admin
--   p_acao: 'adicionar', 'editar', 'remover' ou 'obter'
--   p_servico_nome: Nome do serviço (para ações de adição)
--   p_servico_anterior: Nome do serviço anterior (para edição/exclusão/consulta)
--   p_duracao_minutos: Duração em minutos do serviço
--   p_preco: Preço do serviço (NOVO PARÂMETRO)
-- ============================================================

CREATE OR REPLACE FUNCTION gerenciar_tempo_servicos(
  p_nome_usuario TEXT,
  p_senha_usuario TEXT,
  p_acao TEXT,
  p_servico_nome TEXT,
  p_servico_anterior TEXT,
  p_duracao_minutos INT,
  p_preco NUMERIC DEFAULT NULL
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
  v_preco_anterior NUMERIC;
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

  -- AÇÃO: ADICIONAR NOVO SERVIÇO COM DURAÇÃO E PREÇO
  IF p_acao = 'adicionar' THEN
    -- Validar duração
    IF p_duracao_minutos IS NULL OR p_duracao_minutos <= 0 THEN
      RETURN json_build_object(
        'sucesso', FALSE,
        'mensagem', 'A duração deve ser maior que 0 minutos.'
      );
    END IF;

    -- Validar preço (se fornecido)
    IF p_preco IS NOT NULL AND p_preco < 0 THEN
      RETURN json_build_object(
        'sucesso', FALSE,
        'mensagem', 'O preço não pode ser negativo.'
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

    -- Inserir novo serviço com duração e preço
    INSERT INTO servicos_tempo (servico, duracao_minuto, price)
    VALUES (TRIM(p_servico_nome), p_duracao_minutos, COALESCE(p_preco, 0));

    v_resultado_acao := 'Serviço, duração e preço adicionados com sucesso!';

  -- AÇÃO: EDITAR DURAÇÃO E PREÇO DO SERVIÇO
  ELSIF p_acao = 'editar' THEN
    -- Validar duração
    IF p_duracao_minutos IS NULL OR p_duracao_minutos <= 0 THEN
      RETURN json_build_object(
        'sucesso', FALSE,
        'mensagem', 'A duração deve ser maior que 0 minutos.'
      );
    END IF;

    -- Validar preço (se fornecido)
    IF p_preco IS NOT NULL AND p_preco < 0 THEN
      RETURN json_build_object(
        'sucesso', FALSE,
        'mensagem', 'O preço não pode ser negativo.'
      );
    END IF;

    -- Verificar se há preço para atualizar
    IF p_preco IS NOT NULL THEN
      -- Atualizar tanto duração quanto preço
      UPDATE servicos_tempo
      SET 
        duracao_minuto = p_duracao_minutos,
        price = p_preco
      WHERE LOWER(TRIM(servico)) = LOWER(TRIM(p_servico_anterior));
    ELSE
      -- Atualizar apenas duração (mantém preço anterior)
      UPDATE servicos_tempo
      SET duracao_minuto = p_duracao_minutos
      WHERE LOWER(TRIM(servico)) = LOWER(TRIM(p_servico_anterior));
    END IF;

    -- Se nenhuma linha foi atualizada, inserir novo registro
    IF NOT FOUND THEN
      BEGIN
        INSERT INTO servicos_tempo (servico, duracao_minuto, price)
        VALUES (TRIM(p_servico_anterior), p_duracao_minutos, COALESCE(p_preco, 0));
      EXCEPTION WHEN unique_violation THEN
        -- Se houver conflito de chave única, atualizar novamente
        IF p_preco IS NOT NULL THEN
          UPDATE servicos_tempo
          SET 
            duracao_minuto = p_duracao_minutos,
            price = p_preco
          WHERE LOWER(TRIM(servico)) = LOWER(TRIM(p_servico_anterior));
        ELSE
          UPDATE servicos_tempo
          SET duracao_minuto = p_duracao_minutos
          WHERE LOWER(TRIM(servico)) = LOWER(TRIM(p_servico_anterior));
        END IF;
      END;
    END IF;

    v_resultado_acao := 'Duração e preço do serviço atualizado com sucesso!';

  -- AÇÃO: REMOVER SERVIÇO (e sua duração/preço)
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

  -- AÇÃO: OBTER DURAÇÃO E PREÇO DO SERVIÇO
  ELSIF p_acao = 'obter' THEN
    SELECT duracao_minuto, COALESCE(price, 0) 
    INTO v_duracao_anterior, v_preco_anterior
    FROM servicos_tempo
    WHERE LOWER(TRIM(servico)) = LOWER(TRIM(p_servico_anterior));

    IF v_duracao_anterior IS NULL THEN
      -- Retornar valores padrão se serviço não tiver duração registrada
      RETURN json_build_object(
        'sucesso', TRUE,
        'mensagem', 'Serviço encontrado.',
        'duracao_minutos', 0,
        'preco', 0
      );
    END IF;

    RETURN json_build_object(
      'sucesso', TRUE,
      'mensagem', 'Duração e preço obtidos com sucesso.',
      'duracao_minutos', v_duracao_anterior,
      'preco', v_preco_anterior
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
GRANT EXECUTE ON FUNCTION gerenciar_tempo_servicos(TEXT, TEXT, TEXT, TEXT, TEXT, INT, NUMERIC) 
  TO anon, authenticated;

-- ============================================================
-- DOCUMENTAÇÃO DE USO - EXEMPLOS EM JAVASCRIPT
-- ============================================================
-- 
-- 1. ADICIONAR NOVO SERVIÇO COM PREÇO:
-- ----------------------------------------
-- const { data, error } = await _supabase.rpc('gerenciar_tempo_servicos', {
--   p_nome_usuario: 'admin_user',
--   p_senha_usuario: 'senha123',
--   p_acao: 'adicionar',
--   p_servico_nome: 'Limpeza',
--   p_servico_anterior: '',
--   p_duracao_minutos: 30,
--   p_preco: 50.00
-- });
-- 
-- 2. ATUALIZAR SERVIÇO COM PREÇO:
-- -------------​---------------------
-- const { data, error } = await _supabase.rpc('gerenciar_tempo_servicos', {
--   p_nome_usuario: 'admin_user',
--   p_senha_usuario: 'senha123',
--   p_acao: 'editar',
--   p_servico_nome: '',
--   p_servico_anterior: 'Limpeza',
--   p_duracao_minutos: 45,
--   p_preco: 60.00
-- });
--
-- 3. OBTER DURAÇÃO E PREÇO DO SERVIÇO:
-- -----------------------------------
-- const { data, error } = await _supabase.rpc('gerenciar_tempo_servicos', {
--   p_nome_usuario: 'admin_user',
--   p_senha_usuario: 'senha123',
--   p_acao: 'obter',
--   p_servico_nome: '',
--   p_servico_anterior: 'Limpeza',
--   p_duracao_minutos: 0
-- });
-- 
-- Resposta: { sucesso: true, duracao_minutos: 45, preco: 60.00 }
-- 
-- ============================================================
