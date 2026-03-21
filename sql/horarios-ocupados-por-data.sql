DROP FUNCTION IF EXISTS buscar_horarios_ocupados();

CREATE OR REPLACE FUNCTION buscar_horarios_ocupados()
RETURNS TABLE(data TEXT, horarios_ocupados TEXT[]) 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public 
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.data,
    ARRAY_AGG(DISTINCT 
      CASE 
        WHEN s.duracao_minuto IS NOT NULL THEN
          TO_CHAR(a.horario::TIME, 'HH24:MI') || '-' || 
          TO_CHAR(a.horario::TIME + (s.duracao_minuto::TEXT || ' minutes')::INTERVAL, 'HH24:MI')
        ELSE
          a.horario || '-' || a.horario
      END
      ORDER BY 
      CASE 
        WHEN s.duracao_minuto IS NOT NULL THEN
          TO_CHAR(a.horario::TIME, 'HH24:MI') || '-' || 
          TO_CHAR(a.horario::TIME + (s.duracao_minuto::TEXT || ' minutes')::INTERVAL, 'HH24:MI')
        ELSE
          a.horario || '-' || a.horario
      END
    ) as horarios_ocupados
  FROM agendamento a
  LEFT JOIN servicos_tempo s ON 
    LOWER(TRIM(TRANSLATE(s.servico, 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucaaaaaeeeeiiiiooooouuuuc'))) = 
    LOWER(TRIM(TRANSLATE(a.servico, 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucaaaaaeeeeiiiiooooouuuuc')))
  WHERE a.horario IS NOT NULL AND a.horario != ''
  GROUP BY a.data
  ORDER BY a.data;
END;
$$;