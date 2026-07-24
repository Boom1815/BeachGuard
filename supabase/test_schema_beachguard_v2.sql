-- ═══════════════════════════════════════════════════════════════════
-- TEST DU SCHÉMA (v2 — corrigé) — à exécuter APRÈS schema_beachguard.sql
-- Simule 2 inscriptions et vérifie que tout s'enchaîne correctement.
-- Ne modifie rien de permanent : tout est nettoyé à la fin.
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  v_payer_id uuid := gen_random_uuid();
  v_contact_id uuid := gen_random_uuid();
  v_still_unlinked boolean;
  v_relation_count int;
begin

  -- 1. Simule l'inscription du "payant" (déclenche le trigger profiles)
  insert into auth.users (id, phone, aud, role)
  values (v_payer_id, '+32470000001', 'authenticated', 'authenticated');

  -- 2. Vérifie que le profil a bien été créé automatiquement
  if not exists (select 1 from public.profiles where id = v_payer_id) then
    raise exception 'ÉCHEC : le profil du payant n''a pas été créé automatiquement';
  end if;
  raise notice 'OK : profil auto-créé pour le payant';

  -- 3. Le payant ajoute un proche AVANT que ce proche ait un compte
  insert into public.relations (payer_id, contact_phone)
  values (v_payer_id, '+32470000002');

  select r.contact_user_id is null into strict v_still_unlinked
  from public.relations r
  where r.payer_id = v_payer_id;

  if not v_still_unlinked then
    raise exception 'ÉCHEC : contact_user_id devrait être NULL avant l''inscription du contact';
  end if;
  raise notice 'OK : relation créée, contact_user_id est bien NULL (pas encore inscrit)';

  -- 4. Le proche s'inscrit à son tour (déclenche le trigger de liaison)
  insert into auth.users (id, phone, aud, role)
  values (v_contact_id, '+32470000002', 'authenticated', 'authenticated');

  -- 5. Vérifie que la relation a été liée automatiquement
  select count(*) into v_relation_count
  from public.relations r
  where r.payer_id = v_payer_id and r.contact_user_id = v_contact_id;

  if v_relation_count != 1 then
    raise exception 'ÉCHEC : la relation n''a pas été liée automatiquement à l''inscription du contact';
  end if;
  raise notice 'OK : relation liée automatiquement dès l''inscription du contact — le système fonctionne';

  -- 6. Nettoyage complet (rien ne reste en base après ce test)
  delete from auth.users where id in (v_payer_id, v_contact_id);

  raise notice '✓ TOUS LES TESTS SONT PASSÉS';

end $$;
