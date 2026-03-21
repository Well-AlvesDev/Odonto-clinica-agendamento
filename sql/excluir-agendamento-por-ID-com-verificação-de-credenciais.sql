-- remove versões antigas e ambíguas
drop function if exists public.excluir_agendamento_uuid(uuid, text, text);
drop function if exists public.excluir_agendamento(uuid, text, text);

-- cria uma versão correta que reaproveita a própria lógica de login
create or replace function public.excluir_agendamento_uuid(
    p_id uuid,
    p_nome text,
    p_senha text
) returns jsonb
language plpgsql
security definer
as $$
declare
    v_login record;
begin
    -- chama a função de login; ela retorna um record com coluna "sucesso"
    select *
      into v_login
      from public.validar_login_admin(p_nome, p_senha)
      limit 1;

    if not v_login.sucesso then
        return jsonb_build_object('sucesso', false, 'mensagem', v_login.mensagem);
    end if;

    delete from agendamento
     where id = p_id;

    return jsonb_build_object('sucesso', true);
end;
$$;