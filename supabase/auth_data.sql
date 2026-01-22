SET session_replication_role = replica;

--
-- PostgreSQL database dump
--

-- \restrict yBzn1VM9nhpIakn0diVsIFWrNQlOJ9pMROCQRuhIxM4TfA8DFdTTtmxyhkAZAHh

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: audit_log_entries; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: flow_state; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: users; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."users" ("instance_id", "id", "aud", "role", "email", "encrypted_password", "email_confirmed_at", "invited_at", "confirmation_token", "confirmation_sent_at", "recovery_token", "recovery_sent_at", "email_change_token_new", "email_change", "email_change_sent_at", "last_sign_in_at", "raw_app_meta_data", "raw_user_meta_data", "is_super_admin", "created_at", "updated_at", "phone", "phone_confirmed_at", "phone_change", "phone_change_token", "phone_change_sent_at", "email_change_token_current", "email_change_confirm_status", "banned_until", "reauthentication_token", "reauthentication_sent_at", "is_sso_user", "deleted_at", "is_anonymous") VALUES
	('00000000-0000-0000-0000-000000000000', '41e0e764-20ff-4cf3-8b9c-c03b327ce9cf', 'authenticated', 'authenticated', 'eitan2007@gmail.com', '$2a$10$8gqIOB.pmDGAvd3yXvio5e1WztudjRKp13nnpHoP3FH4x3aJMvp1C', '2026-01-13 07:41:26.175469+00', NULL, '', '2026-01-13 07:40:59.197516+00', '', NULL, '', '', NULL, '2026-01-21 23:25:18.251121+00', '{"provider": "email", "providers": ["email"]}', '{"sub": "41e0e764-20ff-4cf3-8b9c-c03b327ce9cf", "email": "eitan2007@gmail.com", "full_name": "Test User", "email_verified": true, "phone_verified": false}', NULL, '2026-01-13 07:40:59.167995+00', '2026-01-21 23:25:18.287994+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false);


--
-- Data for Name: identities; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."identities" ("provider_id", "user_id", "identity_data", "provider", "last_sign_in_at", "created_at", "updated_at", "id") VALUES
	('41e0e764-20ff-4cf3-8b9c-c03b327ce9cf', '41e0e764-20ff-4cf3-8b9c-c03b327ce9cf', '{"sub": "41e0e764-20ff-4cf3-8b9c-c03b327ce9cf", "email": "eitan2007@gmail.com", "full_name": "Test User", "email_verified": true, "phone_verified": false}', 'email', '2026-01-13 07:40:59.187008+00', '2026-01-13 07:40:59.187064+00', '2026-01-13 07:40:59.187064+00', 'd72abff3-9df1-4805-8228-0285bd32a350');


--
-- Data for Name: instances; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_clients; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sessions; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."sessions" ("id", "user_id", "created_at", "updated_at", "factor_id", "aal", "not_after", "refreshed_at", "user_agent", "ip", "tag", "oauth_client_id", "refresh_token_hmac_key", "refresh_token_counter", "scopes") VALUES
	('27340346-0e10-4565-bffc-34044ea545a6', '41e0e764-20ff-4cf3-8b9c-c03b327ce9cf', '2026-01-21 22:55:44.962418+00', '2026-01-21 22:55:44.962418+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36', '176.230.215.46', NULL, NULL, NULL, NULL, NULL),
	('bf3c8b58-8799-40f3-afd4-ae91a0334638', '41e0e764-20ff-4cf3-8b9c-c03b327ce9cf', '2026-01-21 23:25:18.252343+00', '2026-01-21 23:25:18.252343+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36', '176.230.215.46', NULL, NULL, NULL, NULL, NULL);


--
-- Data for Name: mfa_amr_claims; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."mfa_amr_claims" ("session_id", "created_at", "updated_at", "authentication_method", "id") VALUES
	('27340346-0e10-4565-bffc-34044ea545a6', '2026-01-21 22:55:44.964765+00', '2026-01-21 22:55:44.964765+00', 'password', 'efff0a9a-5d01-44ad-aa47-ea15cdd9c3da'),
	('bf3c8b58-8799-40f3-afd4-ae91a0334638', '2026-01-21 23:25:18.291286+00', '2026-01-21 23:25:18.291286+00', 'password', '2ab54e8d-ea8c-4087-8c0b-aa86ad8772b3');


--
-- Data for Name: mfa_factors; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: mfa_challenges; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_authorizations; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_client_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_consents; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: one_time_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."refresh_tokens" ("instance_id", "id", "token", "user_id", "revoked", "created_at", "updated_at", "parent", "session_id") VALUES
	('00000000-0000-0000-0000-000000000000', 152, 'fijqpmoney36', '41e0e764-20ff-4cf3-8b9c-c03b327ce9cf', false, '2026-01-21 22:55:44.963531+00', '2026-01-21 22:55:44.963531+00', NULL, '27340346-0e10-4565-bffc-34044ea545a6'),
	('00000000-0000-0000-0000-000000000000', 153, 'cywgxp5ceaky', '41e0e764-20ff-4cf3-8b9c-c03b327ce9cf', false, '2026-01-21 23:25:18.262982+00', '2026-01-21 23:25:18.262982+00', NULL, 'bf3c8b58-8799-40f3-afd4-ae91a0334638');


--
-- Data for Name: sso_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: saml_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: saml_relay_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sso_domains; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE SET; Schema: auth; Owner: supabase_auth_admin
--

SELECT pg_catalog.setval('"auth"."refresh_tokens_id_seq"', 153, true);


--
-- PostgreSQL database dump complete
--

-- \unrestrict yBzn1VM9nhpIakn0diVsIFWrNQlOJ9pMROCQRuhIxM4TfA8DFdTTtmxyhkAZAHh

RESET ALL;
