SET session_replication_role = replica;

--
-- PostgreSQL database dump
--

-- \restrict 1mMZsrdbBtYgSZf94fn1nIMqDeCXr5Qr1snBQrqBtM9mJyD0xL6majCVzv9sVcf

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

INSERT INTO "auth"."audit_log_entries" ("instance_id", "id", "payload", "created_at", "ip_address") VALUES
	('00000000-0000-0000-0000-000000000000', 'c21808fd-29f1-4f60-b0dc-b33143436786', '{"action":"user_signedup","actor_id":"164218f9-1ef1-474c-baa7-419d613e358d","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"team","traits":{"provider":"email"}}', '2026-01-25 10:11:45.085772+00', ''),
	('00000000-0000-0000-0000-000000000000', '545abb8d-c7cd-448c-9ed9-68fdccc44a87', '{"action":"login","actor_id":"164218f9-1ef1-474c-baa7-419d613e358d","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2026-01-25 10:11:45.094012+00', ''),
	('00000000-0000-0000-0000-000000000000', '2035dc6e-c27e-41f2-96ee-4ab71dcc0331', '{"action":"user_repeated_signup","actor_id":"164218f9-1ef1-474c-baa7-419d613e358d","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"user","traits":{"provider":"email"}}', '2026-01-25 10:17:56.87286+00', ''),
	('00000000-0000-0000-0000-000000000000', '69956450-ccee-4102-b58a-e9c89ce47edf', '{"action":"user_repeated_signup","actor_id":"164218f9-1ef1-474c-baa7-419d613e358d","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"user","traits":{"provider":"email"}}', '2026-01-25 10:18:10.102097+00', ''),
	('00000000-0000-0000-0000-000000000000', '9b04e8d9-86a1-482d-a4e6-48035dc34095', '{"action":"user_deleted","actor_id":"00000000-0000-0000-0000-000000000000","actor_username":"service_role","actor_via_sso":false,"log_type":"team","traits":{"user_email":"eitan2007@gmail.com","user_id":"164218f9-1ef1-474c-baa7-419d613e358d","user_phone":""}}', '2026-01-25 10:18:27.192935+00', ''),
	('00000000-0000-0000-0000-000000000000', '1cd06eff-151f-47fc-a1f4-af4c3ed4c150', '{"action":"user_signedup","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"team","traits":{"provider":"email"}}', '2026-01-25 10:18:51.759813+00', ''),
	('00000000-0000-0000-0000-000000000000', 'e0ab9a9e-c837-4d7d-b47e-5c3e79774bea', '{"action":"login","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2026-01-25 10:18:51.767812+00', ''),
	('00000000-0000-0000-0000-000000000000', '2317d51a-e0e5-4b6b-8593-5382605b8dac', '{"action":"user_signedup","actor_id":"00000000-0000-0000-0000-000000000000","actor_username":"service_role","actor_via_sso":false,"log_type":"team","traits":{"provider":"email","user_email":"admin@test.com","user_id":"e63870e8-7e6b-4d89-b481-57420171b43c","user_phone":""}}', '2026-01-25 10:28:25.831174+00', ''),
	('00000000-0000-0000-0000-000000000000', 'c0008de0-21fc-4882-8954-5355f245cbfa', '{"action":"user_signedup","actor_id":"00000000-0000-0000-0000-000000000000","actor_username":"service_role","actor_via_sso":false,"log_type":"team","traits":{"provider":"email","user_email":"user@test.com","user_id":"75d43a9c-61d7-4dd8-9175-8ad3aa226def","user_phone":""}}', '2026-01-25 10:28:25.932198+00', ''),
	('00000000-0000-0000-0000-000000000000', 'c23184fb-bde8-4951-ab59-b371919bb2dd', '{"action":"user_signedup","actor_id":"00000000-0000-0000-0000-000000000000","actor_username":"service_role","actor_via_sso":false,"log_type":"team","traits":{"provider":"email","user_email":"guest@test.com","user_id":"d78cafe6-1983-4c21-90a2-5033f5cffaac","user_phone":""}}', '2026-01-25 10:28:26.013784+00', ''),
	('00000000-0000-0000-0000-000000000000', '6ce811ac-b240-460c-9a61-09793e0257da', '{"action":"login","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2026-01-25 10:36:52.025832+00', ''),
	('00000000-0000-0000-0000-000000000000', '860f6b88-af0b-4d35-9fda-67dbd142c109', '{"action":"login","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2026-01-25 11:02:21.272031+00', ''),
	('00000000-0000-0000-0000-000000000000', 'd56075ac-d78a-4962-ad3b-2e6c364bb84e', '{"action":"user_modified","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron1","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"user"}', '2026-01-25 11:02:43.57881+00', ''),
	('00000000-0000-0000-0000-000000000000', '14fe2745-3e58-46a1-ba37-10ef08aca4e2', '{"action":"user_modified","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron1","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"user"}', '2026-01-25 11:30:11.265129+00', ''),
	('00000000-0000-0000-0000-000000000000', '21d0b4b4-a1c2-422d-afde-27ee10054e7a', '{"action":"user_modified","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"user"}', '2026-01-25 11:30:22.008696+00', ''),
	('00000000-0000-0000-0000-000000000000', '7a35879a-7f82-40b3-8a95-6fb67e09e149', '{"action":"user_modified","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"user"}', '2026-01-25 11:31:00.550666+00', ''),
	('00000000-0000-0000-0000-000000000000', '38ac85ed-5cad-4774-a781-ae5a74935be0', '{"action":"logout","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"account"}', '2026-01-25 11:31:07.958866+00', ''),
	('00000000-0000-0000-0000-000000000000', 'b32886ad-8454-4249-89bf-6cb276aca1a9', '{"action":"login","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2026-01-25 11:34:49.772033+00', ''),
	('00000000-0000-0000-0000-000000000000', '8e73b0a2-caa6-45cb-81fa-46aba882433c', '{"action":"logout","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"account"}', '2026-01-25 11:34:58.46095+00', ''),
	('00000000-0000-0000-0000-000000000000', 'e8e9c36f-a83d-4ee1-8d24-4ce52b376887', '{"action":"login","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2026-01-25 11:37:08.931148+00', ''),
	('00000000-0000-0000-0000-000000000000', '2641ccbf-c088-44eb-b570-38eb534ec283', '{"action":"logout","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"account"}', '2026-01-25 11:37:21.68478+00', ''),
	('00000000-0000-0000-0000-000000000000', '2de0bbf8-0bfc-4545-a728-51bbba63da35', '{"action":"login","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2026-01-25 11:38:04.164024+00', ''),
	('00000000-0000-0000-0000-000000000000', 'da55944f-2a69-44dd-a858-de415114a444', '{"action":"logout","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"account"}', '2026-01-25 11:38:29.336959+00', ''),
	('00000000-0000-0000-0000-000000000000', 'd402e3bc-9cae-4d63-91d1-757be2dfa85f', '{"action":"login","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2026-01-25 11:41:39.140294+00', ''),
	('00000000-0000-0000-0000-000000000000', '5a277261-78cd-4232-b28e-35084c4918b5', '{"action":"logout","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"account"}', '2026-01-25 11:55:04.714899+00', ''),
	('00000000-0000-0000-0000-000000000000', '2ebed704-ff82-4dd8-9ca0-500463d64d60', '{"action":"login","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2026-01-25 11:55:42.629779+00', ''),
	('00000000-0000-0000-0000-000000000000', 'dc545f36-7b67-4ac8-b2af-60e3180acc78', '{"action":"logout","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"account"}', '2026-01-25 11:55:45.927754+00', ''),
	('00000000-0000-0000-0000-000000000000', 'c4b7f1b0-bb51-4a2e-bba6-9a91a0a017a9', '{"action":"login","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2026-01-25 11:56:00.094806+00', ''),
	('00000000-0000-0000-0000-000000000000', '31d5805a-f1de-4960-ae7a-dcee1eb0496d', '{"action":"logout","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"account"}', '2026-01-25 11:56:07.243282+00', ''),
	('00000000-0000-0000-0000-000000000000', 'cda250bb-19be-4ff2-b9f7-d07eefc0061b', '{"action":"login","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2026-01-25 11:56:24.285437+00', ''),
	('00000000-0000-0000-0000-000000000000', '3e3643cf-7ad9-4dd1-bd49-6681de8787cb', '{"action":"logout","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"account"}', '2026-01-25 11:56:54.810018+00', ''),
	('00000000-0000-0000-0000-000000000000', '2f95cf5b-3508-41da-9259-4338d1a718cd', '{"action":"login","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2026-01-25 11:57:21.39117+00', ''),
	('00000000-0000-0000-0000-000000000000', 'bea53256-44c6-47fa-b130-c7a093914495', '{"action":"logout","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"account"}', '2026-01-25 11:57:25.865707+00', ''),
	('00000000-0000-0000-0000-000000000000', '1b02fb44-00e4-41e6-83a5-913409954d02', '{"action":"login","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2026-01-25 11:57:35.525544+00', ''),
	('00000000-0000-0000-0000-000000000000', '5a108086-7dad-4ef6-b88a-6893846f20b9', '{"action":"logout","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"account"}', '2026-01-25 11:57:44.404052+00', ''),
	('00000000-0000-0000-0000-000000000000', '2d3df4dd-011a-41ed-a7b6-cea64deb16e1', '{"action":"login","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2026-01-25 11:58:21.925477+00', ''),
	('00000000-0000-0000-0000-000000000000', '51156d4d-ce56-49d2-a7d6-bfca89eaa6a5', '{"action":"logout","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"account"}', '2026-01-25 11:58:25.811242+00', ''),
	('00000000-0000-0000-0000-000000000000', '9e41f44c-4ef9-480c-af49-d0864a823124', '{"action":"user_signedup","actor_id":"f361ab72-98ea-4b20-b4c1-f583ad7450db","actor_name":"avatars","actor_username":"ester1347@gmail.com","actor_via_sso":false,"log_type":"team","traits":{"provider":"email"}}', '2026-01-25 11:59:02.04111+00', ''),
	('00000000-0000-0000-0000-000000000000', '9c487040-b967-4d4c-9448-eb1a4a2ff6c9', '{"action":"login","actor_id":"f361ab72-98ea-4b20-b4c1-f583ad7450db","actor_name":"avatars","actor_username":"ester1347@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2026-01-25 11:59:02.048249+00', ''),
	('00000000-0000-0000-0000-000000000000', '1443ee44-52c1-4881-b65e-4ccfab918992', '{"action":"logout","actor_id":"f361ab72-98ea-4b20-b4c1-f583ad7450db","actor_name":"avatars","actor_username":"ester1347@gmail.com","actor_via_sso":false,"log_type":"account"}', '2026-01-25 11:59:05.856182+00', ''),
	('00000000-0000-0000-0000-000000000000', 'a668c5e7-8c4f-4682-b4d1-46cf0fbc992e', '{"action":"login","actor_id":"f361ab72-98ea-4b20-b4c1-f583ad7450db","actor_name":"avatars","actor_username":"ester1347@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2026-01-25 11:59:19.460035+00', ''),
	('00000000-0000-0000-0000-000000000000', '6002284c-3c55-4363-b371-8c0da3da41da', '{"action":"logout","actor_id":"f361ab72-98ea-4b20-b4c1-f583ad7450db","actor_name":"avatars","actor_username":"ester1347@gmail.com","actor_via_sso":false,"log_type":"account"}', '2026-01-25 11:59:23.519743+00', ''),
	('00000000-0000-0000-0000-000000000000', '97e68065-20e2-4218-9615-693abde274b4', '{"action":"login","actor_id":"f361ab72-98ea-4b20-b4c1-f583ad7450db","actor_name":"avatars","actor_username":"ester1347@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2026-01-25 12:01:14.349737+00', ''),
	('00000000-0000-0000-0000-000000000000', '8ae75620-fa87-4931-b838-a56757dc497e', '{"action":"logout","actor_id":"f361ab72-98ea-4b20-b4c1-f583ad7450db","actor_name":"avatars","actor_username":"ester1347@gmail.com","actor_via_sso":false,"log_type":"account"}', '2026-01-25 12:01:17.712891+00', ''),
	('00000000-0000-0000-0000-000000000000', '121a5ad3-8376-4f0a-bfc7-73041949947d', '{"action":"login","actor_id":"f361ab72-98ea-4b20-b4c1-f583ad7450db","actor_name":"avatars","actor_username":"ester1347@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2026-01-25 12:01:28.101409+00', ''),
	('00000000-0000-0000-0000-000000000000', 'effb9555-f53b-440e-8d6c-e7eb1d78fb5d', '{"action":"logout","actor_id":"f361ab72-98ea-4b20-b4c1-f583ad7450db","actor_name":"avatars","actor_username":"ester1347@gmail.com","actor_via_sso":false,"log_type":"account"}', '2026-01-25 12:01:31.799718+00', ''),
	('00000000-0000-0000-0000-000000000000', 'fc939be6-6729-4862-ad0f-0f806c2e4132', '{"action":"login","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2026-01-25 12:01:45.564269+00', ''),
	('00000000-0000-0000-0000-000000000000', '69ccdeaa-35d4-4c56-991f-0d6ff09c456d', '{"action":"logout","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"account"}', '2026-01-25 12:01:49.430743+00', ''),
	('00000000-0000-0000-0000-000000000000', '2bfda941-11c6-4389-9dc3-3b41df54f484', '{"action":"login","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2026-01-25 12:03:04.046081+00', ''),
	('00000000-0000-0000-0000-000000000000', 'e3cc2d66-55d5-4af1-8a3b-db2b11b40e81', '{"action":"logout","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"account"}', '2026-01-25 12:03:08.977165+00', ''),
	('00000000-0000-0000-0000-000000000000', '60ce9f9e-fd0c-4c69-becf-02bff26e47fc', '{"action":"login","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2026-01-25 12:07:31.422444+00', ''),
	('00000000-0000-0000-0000-000000000000', '60ca69b8-bbe4-4331-a709-51825093f99b', '{"action":"login","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2026-01-25 12:11:57.381094+00', ''),
	('00000000-0000-0000-0000-000000000000', '8c827f39-1314-489d-9d23-a4f399a58dd5', '{"action":"logout","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"account"}', '2026-01-25 12:22:46.527712+00', ''),
	('00000000-0000-0000-0000-000000000000', 'cfc868ff-4e66-4fd5-9965-80c67a901b5b', '{"action":"login","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2026-01-25 12:22:57.955909+00', ''),
	('00000000-0000-0000-0000-000000000000', 'c2ce4943-ab1f-42c1-9435-73ad281c3d31', '{"action":"login","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2026-01-25 13:12:06.624817+00', ''),
	('00000000-0000-0000-0000-000000000000', '68be6bcf-6a52-4c62-b2d3-8c12816e9bf5', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-25 14:11:29.382003+00', ''),
	('00000000-0000-0000-0000-000000000000', '18221023-edbc-4986-92ea-54d0b1b53ccc', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-25 14:11:29.382743+00', ''),
	('00000000-0000-0000-0000-000000000000', 'd380c6af-0267-4572-a626-20e14e39feb9', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-25 15:11:37.548745+00', ''),
	('00000000-0000-0000-0000-000000000000', '103fb866-bdbb-47e6-a0cc-e13088226b36', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-25 15:11:37.549625+00', ''),
	('00000000-0000-0000-0000-000000000000', 'e668c51f-ee5f-49d3-9dcf-434bda864963', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-25 16:09:58.41482+00', ''),
	('00000000-0000-0000-0000-000000000000', '40726c71-9416-4374-8764-87eda741f433', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-25 16:09:58.415324+00', ''),
	('00000000-0000-0000-0000-000000000000', '0f3c63af-09ec-4e31-aa1e-bcd755ed8166', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-25 19:40:27.280073+00', ''),
	('00000000-0000-0000-0000-000000000000', '4cff2d85-c422-47ed-ac1f-ce66abc50074', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-25 19:40:27.280536+00', ''),
	('00000000-0000-0000-0000-000000000000', '2dd741ba-3d45-4d47-ac16-b044a87cb9e3', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-25 20:38:54.741862+00', ''),
	('00000000-0000-0000-0000-000000000000', '39bb9f6f-ef78-4b62-84bf-6732bfa0b74d', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-25 20:38:54.742447+00', ''),
	('00000000-0000-0000-0000-000000000000', 'bec2883a-b2db-4232-84a8-4c5d017baf39', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-25 21:37:25.20462+00', ''),
	('00000000-0000-0000-0000-000000000000', '94228e2f-bc7d-4283-beac-d44e6c0e91d9', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-25 21:37:25.205152+00', ''),
	('00000000-0000-0000-0000-000000000000', 'c834aac0-30d3-4beb-b7ce-b40c78a5680c', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-25 22:35:29.816336+00', ''),
	('00000000-0000-0000-0000-000000000000', 'af4722fd-ffb0-4c79-b92d-b08295740aff', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-25 22:35:29.816803+00', ''),
	('00000000-0000-0000-0000-000000000000', '0e7a572e-d9ee-4ecb-bbe7-6b85ae5eb807', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-26 07:30:16.570875+00', ''),
	('00000000-0000-0000-0000-000000000000', '76c26f2c-4947-4921-b4e1-616aff6f1af9', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-26 07:30:16.572178+00', ''),
	('00000000-0000-0000-0000-000000000000', 'c3ebde7a-6662-419f-b2f4-96a5128bfcfa', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-26 09:00:27.864449+00', ''),
	('00000000-0000-0000-0000-000000000000', 'c854a1b0-bbbd-44ec-940b-ca2ec258a9e1', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-26 09:00:27.865051+00', ''),
	('00000000-0000-0000-0000-000000000000', 'c03df7ce-c230-473e-8dd7-082e9268f008', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-26 10:04:17.794724+00', ''),
	('00000000-0000-0000-0000-000000000000', '2b807e22-46b5-4e15-98eb-013a73f8d8cf', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-26 10:04:17.795279+00', ''),
	('00000000-0000-0000-0000-000000000000', 'b17e3d83-2c22-45f3-96eb-3756f4e04c5e', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-26 11:04:11.54669+00', ''),
	('00000000-0000-0000-0000-000000000000', '565975b5-59be-4c10-b714-83a964eaf59e', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-26 11:04:11.547195+00', ''),
	('00000000-0000-0000-0000-000000000000', '99aa3829-c06b-4250-a324-671df9dae2ee', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-26 12:02:35.64317+00', ''),
	('00000000-0000-0000-0000-000000000000', 'b3f0a319-ad02-4875-8757-6bf84ade5132', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-26 12:02:35.643682+00', ''),
	('00000000-0000-0000-0000-000000000000', '22fd27d0-33c7-4100-94ae-cbc4d8799726', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-26 13:04:55.074482+00', ''),
	('00000000-0000-0000-0000-000000000000', 'd864d31c-797e-487d-bc0f-a7f9769d20fb', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-26 13:04:55.074977+00', ''),
	('00000000-0000-0000-0000-000000000000', '12fc2ba0-6f15-4160-b76f-6fefdb9cc890', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-26 14:03:32.125718+00', ''),
	('00000000-0000-0000-0000-000000000000', 'd80c59a4-fb36-4b79-8d3f-fc3fbbce2445', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-26 14:03:32.126575+00', ''),
	('00000000-0000-0000-0000-000000000000', 'd845df55-0dd2-4826-b7d2-94d72bcd35f5', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-26 15:05:12.223591+00', ''),
	('00000000-0000-0000-0000-000000000000', '18bc3ccc-9d3e-4c74-b13b-d29613124831', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-26 15:05:12.224257+00', ''),
	('00000000-0000-0000-0000-000000000000', '5ec988bf-295a-472e-8a4a-bfc5df95d257', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-26 16:03:39.406835+00', ''),
	('00000000-0000-0000-0000-000000000000', '9c26d2bc-eae0-48b3-84b2-3b89a66aca0d', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-26 16:03:39.407652+00', ''),
	('00000000-0000-0000-0000-000000000000', 'ca421f4f-d2b3-4c76-937a-ad39b63b7941', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-26 17:02:06.962071+00', ''),
	('00000000-0000-0000-0000-000000000000', 'b8f51f56-ea44-4610-a397-0842d07bc3d4', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-26 17:02:06.963044+00', ''),
	('00000000-0000-0000-0000-000000000000', 'c10fc587-e7ec-4896-bf41-d819c8b88e31', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-26 18:00:06.960249+00', ''),
	('00000000-0000-0000-0000-000000000000', '2582862b-d45f-41e9-a922-9cf3b933e8f6', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-26 18:00:06.96075+00', ''),
	('00000000-0000-0000-0000-000000000000', '9d2ae40a-0dbd-4fdb-94d8-8dc428a0db7a', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-26 18:58:06.964634+00', ''),
	('00000000-0000-0000-0000-000000000000', '28940dc0-51b6-493a-a451-d5a844d20afc', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-26 18:58:06.965143+00', ''),
	('00000000-0000-0000-0000-000000000000', '90ea3b7d-81fe-4ebe-af54-2c253d50bf19', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-26 20:00:40.101987+00', ''),
	('00000000-0000-0000-0000-000000000000', 'cd3d7aee-5325-4a9e-947f-ec9621473838', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-26 20:00:40.102539+00', ''),
	('00000000-0000-0000-0000-000000000000', 'fde51751-9e57-4bed-8246-c7c37489ebc5', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-26 21:02:36.074102+00', ''),
	('00000000-0000-0000-0000-000000000000', 'e547badc-252c-40fd-a7a9-a8083fdd2bad', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-26 21:02:36.074579+00', ''),
	('00000000-0000-0000-0000-000000000000', '19ed63d4-28e4-4278-88bc-ddc641d9da48', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-26 22:01:09.448995+00', ''),
	('00000000-0000-0000-0000-000000000000', '9162c4ec-c42f-4b88-be63-aaab903d2c54', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-26 22:01:09.449523+00', ''),
	('00000000-0000-0000-0000-000000000000', 'b409f616-c24c-4fad-8f6e-f6843ef9033f', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-26 23:00:33.448327+00', ''),
	('00000000-0000-0000-0000-000000000000', '4606fa63-9d12-4191-94f1-70ab9225534f', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-26 23:00:33.449544+00', ''),
	('00000000-0000-0000-0000-000000000000', '41cc8eab-f0e9-48fb-abc1-08307d2e8382', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-27 05:54:24.354819+00', ''),
	('00000000-0000-0000-0000-000000000000', 'db3ac310-8bb9-45fd-8d50-f29ba3e10147', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-27 05:54:24.355477+00', ''),
	('00000000-0000-0000-0000-000000000000', '16ce5567-0db7-436d-b984-0cc1d0d6fe3b', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-27 06:53:36.181942+00', ''),
	('00000000-0000-0000-0000-000000000000', 'fdb349db-ff90-445c-ba74-6c2aea26005f', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-27 06:53:36.182613+00', ''),
	('00000000-0000-0000-0000-000000000000', 'b2169882-c56a-4bb7-9a01-514d96b1af4e', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-27 07:52:00.090168+00', ''),
	('00000000-0000-0000-0000-000000000000', 'c8f3c301-9dce-4380-8777-387f67165dec', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-27 07:52:00.090644+00', ''),
	('00000000-0000-0000-0000-000000000000', 'fc2a1d51-049a-4daf-9b1c-de8daec713b8', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-27 08:50:00.074351+00', ''),
	('00000000-0000-0000-0000-000000000000', '76331b43-e0af-4e01-9142-967b91f7ab68', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-27 08:50:00.074846+00', ''),
	('00000000-0000-0000-0000-000000000000', 'fa1a3379-337c-48ea-8536-fc43b7875354', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-27 09:48:00.091434+00', ''),
	('00000000-0000-0000-0000-000000000000', '6bb9c028-fd19-4598-9dd3-304898a23206', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-27 09:48:00.091888+00', ''),
	('00000000-0000-0000-0000-000000000000', 'c1203149-9006-4ef9-a5d4-7f0e9dbfdf5c', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-27 10:46:00.081629+00', ''),
	('00000000-0000-0000-0000-000000000000', '2cbf0e1a-a50e-4158-8e3d-0c6a9894d67f', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-27 10:46:00.082096+00', ''),
	('00000000-0000-0000-0000-000000000000', '0e4ae17d-5c99-4211-8f24-0019c4411575', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-27 11:44:32.253339+00', ''),
	('00000000-0000-0000-0000-000000000000', '1d3f63f8-6111-4c8d-9821-3ef31aff7de3', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-27 11:44:32.254137+00', ''),
	('00000000-0000-0000-0000-000000000000', 'f8e915e1-cae6-43ae-8803-df9deb3c968b', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-27 12:42:47.058977+00', ''),
	('00000000-0000-0000-0000-000000000000', '99c21113-3f83-4a92-b014-54b071f14f79', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-27 12:42:47.059689+00', ''),
	('00000000-0000-0000-0000-000000000000', '5ad46240-dc58-478b-a2bd-15f0ab861403', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-27 13:41:24.08558+00', ''),
	('00000000-0000-0000-0000-000000000000', 'a6ea2d21-5037-4d76-b6df-15da5f253f6f', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-27 13:41:24.086689+00', ''),
	('00000000-0000-0000-0000-000000000000', 'baffd247-0073-4d3e-aa0d-a65f86b5efdc', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-27 14:39:29.498466+00', ''),
	('00000000-0000-0000-0000-000000000000', 'd300206e-70aa-4a7f-bbaf-f30b806140f2', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-27 14:39:29.498997+00', ''),
	('00000000-0000-0000-0000-000000000000', 'd0770254-e653-4cff-8567-1c71be496593', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-27 16:08:00.84674+00', ''),
	('00000000-0000-0000-0000-000000000000', '38ea5dc6-a3bd-41f8-abca-e5e347e0a658', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-27 16:08:00.847304+00', ''),
	('00000000-0000-0000-0000-000000000000', '6599358e-7897-4b1c-ae38-f08f47f34df2', '{"action":"login","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2026-01-27 16:20:44.727918+00', ''),
	('00000000-0000-0000-0000-000000000000', '41c1dd80-6453-4fae-9005-f6ef882aaa65', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-27 17:40:47.33759+00', ''),
	('00000000-0000-0000-0000-000000000000', '6a6cf9bd-f0f8-4552-b8c2-b121c1e1ae8a', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-27 17:40:47.33816+00', ''),
	('00000000-0000-0000-0000-000000000000', 'f08a421d-2ef8-4b1d-8b82-46d83c8d9e77', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-27 17:41:46.057318+00', ''),
	('00000000-0000-0000-0000-000000000000', 'bf0285c9-d6c5-4e12-9a56-cb6721ebf0a5', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-27 17:41:46.057804+00', ''),
	('00000000-0000-0000-0000-000000000000', '049df791-9e78-4a9a-a73e-9bee814b0e9b', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-27 19:59:52.068423+00', ''),
	('00000000-0000-0000-0000-000000000000', '75f75283-3794-4e13-b821-cd17422a89b1', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-27 19:59:52.068981+00', ''),
	('00000000-0000-0000-0000-000000000000', '52e6a586-6524-416a-b517-d875bdb37fb3', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-27 21:12:43.652912+00', ''),
	('00000000-0000-0000-0000-000000000000', '3bdef298-6e36-4c65-83f5-675575f0aeca', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-27 21:12:43.653358+00', ''),
	('00000000-0000-0000-0000-000000000000', 'a3cf670e-c269-4a79-86e9-368029cb807c', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-27 22:11:26.810336+00', ''),
	('00000000-0000-0000-0000-000000000000', '84983666-87f4-4b1a-8eb8-d19569b7f57e', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-27 22:11:26.810849+00', ''),
	('00000000-0000-0000-0000-000000000000', '30bb7d1a-4b85-42e3-ba3f-fbdbb29dafd3', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-27 23:11:57.168082+00', ''),
	('00000000-0000-0000-0000-000000000000', '68222fe5-79d9-4608-a4d4-c14c42035883', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-27 23:11:57.168574+00', ''),
	('00000000-0000-0000-0000-000000000000', 'e304ea1a-9fde-45b0-a470-deab361eadb6', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-28 00:13:07.067326+00', ''),
	('00000000-0000-0000-0000-000000000000', '6c0bb187-9786-4ebf-ab63-6eaede39864d', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-28 00:13:07.067869+00', '');


--
-- Data for Name: flow_state; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: users; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."users" ("instance_id", "id", "aud", "role", "email", "encrypted_password", "email_confirmed_at", "invited_at", "confirmation_token", "confirmation_sent_at", "recovery_token", "recovery_sent_at", "email_change_token_new", "email_change", "email_change_sent_at", "last_sign_in_at", "raw_app_meta_data", "raw_user_meta_data", "is_super_admin", "created_at", "updated_at", "phone", "phone_confirmed_at", "phone_change", "phone_change_token", "phone_change_sent_at", "email_change_token_current", "email_change_confirm_status", "banned_until", "reauthentication_token", "reauthentication_sent_at", "is_sso_user", "deleted_at", "is_anonymous") VALUES
	('00000000-0000-0000-0000-000000000000', 'f9423574-1219-4040-8687-d009f0ad403c', 'authenticated', 'authenticated', 'eitan2007@gmail.com', '$2a$10$KoANX9FOLIlRzszLdkzebuju7.ZwIQzrzg9dolda6jDG8uHenXGqW', '2026-01-25 10:18:51.760164+00', NULL, '', NULL, '', NULL, '', '', NULL, '2026-01-27 16:20:44.728668+00', '{"role": "ADMIN", "provider": "email", "providers": ["email"]}', '{"sub": "f9423574-1219-4040-8687-d009f0ad403c", "email": "eitan2007@gmail.com", "full_name": "Eitan baron", "avatar_url": "http://127.0.0.1:54321/storage/v1/object/public/avatars/f9423574-1219-4040-8687-d009f0ad403c/1769340658869.jpg", "email_verified": true, "phone_verified": false}', NULL, '2026-01-25 10:18:51.755362+00', '2026-01-28 00:13:07.069249+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', 'e63870e8-7e6b-4d89-b481-57420171b43c', 'authenticated', 'authenticated', 'admin@test.com', '$2a$10$D.ylmYzyKBo62zsA0quO/OBBS/9jHlF3k86b8Zx6OSi0nkkpnTJri', '2026-01-25 10:28:25.831978+00', NULL, '', NULL, '', NULL, '', '', NULL, NULL, '{"role": "ADMIN", "provider": "email", "providers": ["email"]}', '{"full_name": "admin", "email_verified": true}', NULL, '2026-01-25 10:28:25.828126+00', '2026-01-25 10:28:25.832458+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', '75d43a9c-61d7-4dd8-9175-8ad3aa226def', 'authenticated', 'authenticated', 'user@test.com', '$2a$10$pHCRFLRZ/8PzHzkxjAMq1e9QMPciqYzFZV4CPof8A9X8gE8kL4F4u', '2026-01-25 10:28:25.932882+00', NULL, '', NULL, '', NULL, '', '', NULL, NULL, '{"role": "USER", "provider": "email", "providers": ["email"]}', '{"full_name": "user", "email_verified": true}', NULL, '2026-01-25 10:28:25.929416+00', '2026-01-25 10:28:25.933268+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', 'd78cafe6-1983-4c21-90a2-5033f5cffaac', 'authenticated', 'authenticated', 'guest@test.com', '$2a$10$nSyTPiioVkgwFFl/kYo7yuk9eJldVNPSAomgZC1LG5WnuTj6XRzm.', '2026-01-25 10:28:26.014461+00', NULL, '', NULL, '', NULL, '', '', NULL, NULL, '{"role": "GUEST", "provider": "email", "providers": ["email"]}', '{"full_name": "guest", "email_verified": true}', NULL, '2026-01-25 10:28:26.011021+00', '2026-01-25 10:28:26.014842+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', 'f361ab72-98ea-4b20-b4c1-f583ad7450db', 'authenticated', 'authenticated', 'ester1347@gmail.com', '$2a$10$6/4mRnuSXcbXk1gzqh9z7OkCE3sn720f7K.8UR.mgnqjM2Zc3y08a', '2026-01-25 11:59:02.041454+00', NULL, '', NULL, '', NULL, '', '', NULL, '2026-01-25 12:01:28.102197+00', '{"role": "USER", "provider": "email", "providers": ["email"]}', '{"sub": "f361ab72-98ea-4b20-b4c1-f583ad7450db", "email": "ester1347@gmail.com", "full_name": "avatars", "email_verified": true, "phone_verified": false}', NULL, '2026-01-25 11:59:02.036108+00', '2026-01-25 12:01:28.103952+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false);


--
-- Data for Name: identities; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."identities" ("provider_id", "user_id", "identity_data", "provider", "last_sign_in_at", "created_at", "updated_at", "id") VALUES
	('f9423574-1219-4040-8687-d009f0ad403c', 'f9423574-1219-4040-8687-d009f0ad403c', '{"sub": "f9423574-1219-4040-8687-d009f0ad403c", "email": "eitan2007@gmail.com", "full_name": "Eitan baron", "email_verified": false, "phone_verified": false}', 'email', '2026-01-25 10:18:51.758572+00', '2026-01-25 10:18:51.758589+00', '2026-01-25 10:18:51.758589+00', '77d8bd7a-f3dc-474c-8183-c4ba3f68ebf9'),
	('e63870e8-7e6b-4d89-b481-57420171b43c', 'e63870e8-7e6b-4d89-b481-57420171b43c', '{"sub": "e63870e8-7e6b-4d89-b481-57420171b43c", "email": "admin@test.com", "email_verified": false, "phone_verified": false}', 'email', '2026-01-25 10:28:25.830504+00', '2026-01-25 10:28:25.830542+00', '2026-01-25 10:28:25.830542+00', 'c8768d7b-b9ba-4922-b65a-c082a253b37d'),
	('75d43a9c-61d7-4dd8-9175-8ad3aa226def', '75d43a9c-61d7-4dd8-9175-8ad3aa226def', '{"sub": "75d43a9c-61d7-4dd8-9175-8ad3aa226def", "email": "user@test.com", "email_verified": false, "phone_verified": false}', 'email', '2026-01-25 10:28:25.931556+00', '2026-01-25 10:28:25.931581+00', '2026-01-25 10:28:25.931581+00', '10f2730b-0c31-45c0-9c82-72f47e6bde45'),
	('d78cafe6-1983-4c21-90a2-5033f5cffaac', 'd78cafe6-1983-4c21-90a2-5033f5cffaac', '{"sub": "d78cafe6-1983-4c21-90a2-5033f5cffaac", "email": "guest@test.com", "email_verified": false, "phone_verified": false}', 'email', '2026-01-25 10:28:26.013269+00', '2026-01-25 10:28:26.013288+00', '2026-01-25 10:28:26.013288+00', '7bff2220-73d5-4633-af27-b422f4fdbf83'),
	('f361ab72-98ea-4b20-b4c1-f583ad7450db', 'f361ab72-98ea-4b20-b4c1-f583ad7450db', '{"sub": "f361ab72-98ea-4b20-b4c1-f583ad7450db", "email": "ester1347@gmail.com", "full_name": "avatars", "email_verified": false, "phone_verified": false}', 'email', '2026-01-25 11:59:02.039935+00', '2026-01-25 11:59:02.039954+00', '2026-01-25 11:59:02.039954+00', '1b221c09-5154-4646-892b-7042704939b3');


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
	('11d455f1-b204-4b33-b08b-e0ce83064fa5', 'f9423574-1219-4040-8687-d009f0ad403c', '2026-01-25 12:22:57.956774+00', '2026-01-25 12:22:57.956774+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '172.18.0.1', NULL, NULL, NULL, NULL, NULL),
	('34a6c2d8-3d14-4dd8-9eff-3470bfb7237a', 'f9423574-1219-4040-8687-d009f0ad403c', '2026-01-27 16:20:44.728709+00', '2026-01-27 17:40:47.34049+00', NULL, 'aal1', NULL, '2026-01-27 17:40:47.340453', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '172.18.0.1', NULL, NULL, NULL, NULL, NULL),
	('6e1d0f69-de36-4278-bb06-ea0dfbac5880', 'f9423574-1219-4040-8687-d009f0ad403c', '2026-01-25 13:12:06.626417+00', '2026-01-28 00:13:07.070103+00', NULL, 'aal1', NULL, '2026-01-28 00:13:07.070061', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '172.18.0.1', NULL, NULL, NULL, NULL, NULL);


--
-- Data for Name: mfa_amr_claims; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."mfa_amr_claims" ("session_id", "created_at", "updated_at", "authentication_method", "id") VALUES
	('11d455f1-b204-4b33-b08b-e0ce83064fa5', '2026-01-25 12:22:57.959126+00', '2026-01-25 12:22:57.959126+00', 'password', 'cd181765-dd1c-41b0-a861-6551d8bab334'),
	('6e1d0f69-de36-4278-bb06-ea0dfbac5880', '2026-01-25 13:12:06.631086+00', '2026-01-25 13:12:06.631086+00', 'password', 'ba720b80-4115-4431-b712-b78f2543aaaf'),
	('34a6c2d8-3d14-4dd8-9eff-3470bfb7237a', '2026-01-27 16:20:44.730832+00', '2026-01-27 16:20:44.730832+00', 'password', '168ac9e3-a09f-4cc9-9199-f0daf7c6e862');


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
	('00000000-0000-0000-0000-000000000000', 23, 'k2fak66y3xed', 'f9423574-1219-4040-8687-d009f0ad403c', false, '2026-01-25 12:22:57.957875+00', '2026-01-25 12:22:57.957875+00', NULL, '11d455f1-b204-4b33-b08b-e0ce83064fa5'),
	('00000000-0000-0000-0000-000000000000', 24, 'vfhxwmukeylw', 'f9423574-1219-4040-8687-d009f0ad403c', true, '2026-01-25 13:12:06.628389+00', '2026-01-25 14:11:29.38315+00', NULL, '6e1d0f69-de36-4278-bb06-ea0dfbac5880'),
	('00000000-0000-0000-0000-000000000000', 25, 'abmrmrsnsqkn', 'f9423574-1219-4040-8687-d009f0ad403c', true, '2026-01-25 14:11:29.384241+00', '2026-01-25 15:11:37.550017+00', 'vfhxwmukeylw', '6e1d0f69-de36-4278-bb06-ea0dfbac5880'),
	('00000000-0000-0000-0000-000000000000', 26, '7onndzmtsybr', 'f9423574-1219-4040-8687-d009f0ad403c', true, '2026-01-25 15:11:37.550632+00', '2026-01-25 16:09:58.415599+00', 'abmrmrsnsqkn', '6e1d0f69-de36-4278-bb06-ea0dfbac5880'),
	('00000000-0000-0000-0000-000000000000', 27, 'ufie3hwhzioz', 'f9423574-1219-4040-8687-d009f0ad403c', true, '2026-01-25 16:09:58.415932+00', '2026-01-25 19:40:27.280852+00', '7onndzmtsybr', '6e1d0f69-de36-4278-bb06-ea0dfbac5880'),
	('00000000-0000-0000-0000-000000000000', 28, 'tyeftbnyhwko', 'f9423574-1219-4040-8687-d009f0ad403c', true, '2026-01-25 19:40:27.281197+00', '2026-01-25 20:38:54.742741+00', 'ufie3hwhzioz', '6e1d0f69-de36-4278-bb06-ea0dfbac5880'),
	('00000000-0000-0000-0000-000000000000', 29, 'ofpdctlsogjl', 'f9423574-1219-4040-8687-d009f0ad403c', true, '2026-01-25 20:38:54.743117+00', '2026-01-25 21:37:25.205445+00', 'tyeftbnyhwko', '6e1d0f69-de36-4278-bb06-ea0dfbac5880'),
	('00000000-0000-0000-0000-000000000000', 30, '2iirfr5zuez6', 'f9423574-1219-4040-8687-d009f0ad403c', true, '2026-01-25 21:37:25.205803+00', '2026-01-25 22:35:29.817078+00', 'ofpdctlsogjl', '6e1d0f69-de36-4278-bb06-ea0dfbac5880'),
	('00000000-0000-0000-0000-000000000000', 31, 'hd4gjgnitt66', 'f9423574-1219-4040-8687-d009f0ad403c', true, '2026-01-25 22:35:29.817427+00', '2026-01-26 07:30:16.572576+00', '2iirfr5zuez6', '6e1d0f69-de36-4278-bb06-ea0dfbac5880'),
	('00000000-0000-0000-0000-000000000000', 32, 'bw5iouokyoze', 'f9423574-1219-4040-8687-d009f0ad403c', true, '2026-01-26 07:30:16.572962+00', '2026-01-26 09:00:27.865511+00', 'hd4gjgnitt66', '6e1d0f69-de36-4278-bb06-ea0dfbac5880'),
	('00000000-0000-0000-0000-000000000000', 33, 'ejh2p2xagye5', 'f9423574-1219-4040-8687-d009f0ad403c', true, '2026-01-26 09:00:27.866057+00', '2026-01-26 10:04:17.79562+00', 'bw5iouokyoze', '6e1d0f69-de36-4278-bb06-ea0dfbac5880'),
	('00000000-0000-0000-0000-000000000000', 34, '3wajqzeeooad', 'f9423574-1219-4040-8687-d009f0ad403c', true, '2026-01-26 10:04:17.79597+00', '2026-01-26 11:04:11.547479+00', 'ejh2p2xagye5', '6e1d0f69-de36-4278-bb06-ea0dfbac5880'),
	('00000000-0000-0000-0000-000000000000', 35, 'tfhwoswlg2zp', 'f9423574-1219-4040-8687-d009f0ad403c', true, '2026-01-26 11:04:11.547815+00', '2026-01-26 12:02:35.643962+00', '3wajqzeeooad', '6e1d0f69-de36-4278-bb06-ea0dfbac5880'),
	('00000000-0000-0000-0000-000000000000', 36, 'ksqbv2uhjqmp', 'f9423574-1219-4040-8687-d009f0ad403c', true, '2026-01-26 12:02:35.644324+00', '2026-01-26 13:04:55.075297+00', 'tfhwoswlg2zp', '6e1d0f69-de36-4278-bb06-ea0dfbac5880'),
	('00000000-0000-0000-0000-000000000000', 37, 'rfvwvuke5uil', 'f9423574-1219-4040-8687-d009f0ad403c', true, '2026-01-26 13:04:55.075669+00', '2026-01-26 14:03:32.127079+00', 'ksqbv2uhjqmp', '6e1d0f69-de36-4278-bb06-ea0dfbac5880'),
	('00000000-0000-0000-0000-000000000000', 38, 'n5dogntpzg55', 'f9423574-1219-4040-8687-d009f0ad403c', true, '2026-01-26 14:03:32.127584+00', '2026-01-26 15:05:12.224515+00', 'rfvwvuke5uil', '6e1d0f69-de36-4278-bb06-ea0dfbac5880'),
	('00000000-0000-0000-0000-000000000000', 39, '5ecpspric3mf', 'f9423574-1219-4040-8687-d009f0ad403c', true, '2026-01-26 15:05:12.224951+00', '2026-01-26 16:03:39.408253+00', 'n5dogntpzg55', '6e1d0f69-de36-4278-bb06-ea0dfbac5880'),
	('00000000-0000-0000-0000-000000000000', 40, 'qnqqq7wa2uiz', 'f9423574-1219-4040-8687-d009f0ad403c', true, '2026-01-26 16:03:39.408797+00', '2026-01-26 17:02:06.963421+00', '5ecpspric3mf', '6e1d0f69-de36-4278-bb06-ea0dfbac5880'),
	('00000000-0000-0000-0000-000000000000', 41, '3trigilybki4', 'f9423574-1219-4040-8687-d009f0ad403c', true, '2026-01-26 17:02:06.963777+00', '2026-01-26 18:00:06.961031+00', 'qnqqq7wa2uiz', '6e1d0f69-de36-4278-bb06-ea0dfbac5880'),
	('00000000-0000-0000-0000-000000000000', 42, 's7privwhf6o6', 'f9423574-1219-4040-8687-d009f0ad403c', true, '2026-01-26 18:00:06.961347+00', '2026-01-26 18:58:06.965528+00', '3trigilybki4', '6e1d0f69-de36-4278-bb06-ea0dfbac5880'),
	('00000000-0000-0000-0000-000000000000', 43, 'y55ouqkut222', 'f9423574-1219-4040-8687-d009f0ad403c', true, '2026-01-26 18:58:06.965979+00', '2026-01-26 20:00:40.102914+00', 's7privwhf6o6', '6e1d0f69-de36-4278-bb06-ea0dfbac5880'),
	('00000000-0000-0000-0000-000000000000', 44, '6kxqufkvvqwh', 'f9423574-1219-4040-8687-d009f0ad403c', true, '2026-01-26 20:00:40.103375+00', '2026-01-26 21:02:36.074896+00', 'y55ouqkut222', '6e1d0f69-de36-4278-bb06-ea0dfbac5880'),
	('00000000-0000-0000-0000-000000000000', 45, 'f5xqxjowobeh', 'f9423574-1219-4040-8687-d009f0ad403c', true, '2026-01-26 21:02:36.075291+00', '2026-01-26 22:01:09.449831+00', '6kxqufkvvqwh', '6e1d0f69-de36-4278-bb06-ea0dfbac5880'),
	('00000000-0000-0000-0000-000000000000', 46, '47b3kcywocz7', 'f9423574-1219-4040-8687-d009f0ad403c', true, '2026-01-26 22:01:09.45017+00', '2026-01-26 23:00:33.449978+00', 'f5xqxjowobeh', '6e1d0f69-de36-4278-bb06-ea0dfbac5880'),
	('00000000-0000-0000-0000-000000000000', 47, 'acl6o6tzkszp', 'f9423574-1219-4040-8687-d009f0ad403c', true, '2026-01-26 23:00:33.450369+00', '2026-01-27 05:54:24.355856+00', '47b3kcywocz7', '6e1d0f69-de36-4278-bb06-ea0dfbac5880'),
	('00000000-0000-0000-0000-000000000000', 48, 'ugkahoqlnhww', 'f9423574-1219-4040-8687-d009f0ad403c', true, '2026-01-27 05:54:24.356297+00', '2026-01-27 06:53:36.183115+00', 'acl6o6tzkszp', '6e1d0f69-de36-4278-bb06-ea0dfbac5880'),
	('00000000-0000-0000-0000-000000000000', 49, 'kunnn7eey7ef', 'f9423574-1219-4040-8687-d009f0ad403c', true, '2026-01-27 06:53:36.183697+00', '2026-01-27 07:52:00.090908+00', 'ugkahoqlnhww', '6e1d0f69-de36-4278-bb06-ea0dfbac5880'),
	('00000000-0000-0000-0000-000000000000', 50, 'siep42vf6q3c', 'f9423574-1219-4040-8687-d009f0ad403c', true, '2026-01-27 07:52:00.091275+00', '2026-01-27 08:50:00.075118+00', 'kunnn7eey7ef', '6e1d0f69-de36-4278-bb06-ea0dfbac5880'),
	('00000000-0000-0000-0000-000000000000', 51, 'vqrspda6oiql', 'f9423574-1219-4040-8687-d009f0ad403c', true, '2026-01-27 08:50:00.075524+00', '2026-01-27 09:48:00.092172+00', 'siep42vf6q3c', '6e1d0f69-de36-4278-bb06-ea0dfbac5880'),
	('00000000-0000-0000-0000-000000000000', 52, 'rkwcfzuf3ctc', 'f9423574-1219-4040-8687-d009f0ad403c', true, '2026-01-27 09:48:00.092532+00', '2026-01-27 10:46:00.082392+00', 'vqrspda6oiql', '6e1d0f69-de36-4278-bb06-ea0dfbac5880'),
	('00000000-0000-0000-0000-000000000000', 53, 'qcqgtdt64rfh', 'f9423574-1219-4040-8687-d009f0ad403c', true, '2026-01-27 10:46:00.082741+00', '2026-01-27 11:44:32.254488+00', 'rkwcfzuf3ctc', '6e1d0f69-de36-4278-bb06-ea0dfbac5880'),
	('00000000-0000-0000-0000-000000000000', 54, '7yg6mjxnc5ae', 'f9423574-1219-4040-8687-d009f0ad403c', true, '2026-01-27 11:44:32.254888+00', '2026-01-27 12:42:47.060114+00', 'qcqgtdt64rfh', '6e1d0f69-de36-4278-bb06-ea0dfbac5880'),
	('00000000-0000-0000-0000-000000000000', 55, 'sa2lwcvrmju5', 'f9423574-1219-4040-8687-d009f0ad403c', true, '2026-01-27 12:42:47.060638+00', '2026-01-27 13:41:24.087014+00', '7yg6mjxnc5ae', '6e1d0f69-de36-4278-bb06-ea0dfbac5880'),
	('00000000-0000-0000-0000-000000000000', 56, '4s7xrokndpky', 'f9423574-1219-4040-8687-d009f0ad403c', true, '2026-01-27 13:41:24.087342+00', '2026-01-27 14:39:29.49929+00', 'sa2lwcvrmju5', '6e1d0f69-de36-4278-bb06-ea0dfbac5880'),
	('00000000-0000-0000-0000-000000000000', 57, '72r4rqjum2za', 'f9423574-1219-4040-8687-d009f0ad403c', true, '2026-01-27 14:39:29.499635+00', '2026-01-27 16:08:00.847631+00', '4s7xrokndpky', '6e1d0f69-de36-4278-bb06-ea0dfbac5880'),
	('00000000-0000-0000-0000-000000000000', 59, 'wfp2gkkmjt5q', 'f9423574-1219-4040-8687-d009f0ad403c', true, '2026-01-27 16:20:44.729785+00', '2026-01-27 17:40:47.338588+00', NULL, '34a6c2d8-3d14-4dd8-9eff-3470bfb7237a'),
	('00000000-0000-0000-0000-000000000000', 60, 'zp52rglixae5', 'f9423574-1219-4040-8687-d009f0ad403c', false, '2026-01-27 17:40:47.338963+00', '2026-01-27 17:40:47.338963+00', 'wfp2gkkmjt5q', '34a6c2d8-3d14-4dd8-9eff-3470bfb7237a'),
	('00000000-0000-0000-0000-000000000000', 58, '7m4ko74kch47', 'f9423574-1219-4040-8687-d009f0ad403c', true, '2026-01-27 16:08:00.84793+00', '2026-01-27 17:41:46.058129+00', '72r4rqjum2za', '6e1d0f69-de36-4278-bb06-ea0dfbac5880'),
	('00000000-0000-0000-0000-000000000000', 61, 'sfjueurddalq', 'f9423574-1219-4040-8687-d009f0ad403c', true, '2026-01-27 17:41:46.058491+00', '2026-01-27 19:59:52.069284+00', '7m4ko74kch47', '6e1d0f69-de36-4278-bb06-ea0dfbac5880'),
	('00000000-0000-0000-0000-000000000000', 62, 'crita4kdw4tf', 'f9423574-1219-4040-8687-d009f0ad403c', true, '2026-01-27 19:59:52.069643+00', '2026-01-27 21:12:43.653659+00', 'sfjueurddalq', '6e1d0f69-de36-4278-bb06-ea0dfbac5880'),
	('00000000-0000-0000-0000-000000000000', 63, 'ns3o3i5bfmfv', 'f9423574-1219-4040-8687-d009f0ad403c', true, '2026-01-27 21:12:43.653981+00', '2026-01-27 22:11:26.81115+00', 'crita4kdw4tf', '6e1d0f69-de36-4278-bb06-ea0dfbac5880'),
	('00000000-0000-0000-0000-000000000000', 64, 'zopgswaegd3h', 'f9423574-1219-4040-8687-d009f0ad403c', true, '2026-01-27 22:11:26.811525+00', '2026-01-27 23:11:57.168891+00', 'ns3o3i5bfmfv', '6e1d0f69-de36-4278-bb06-ea0dfbac5880'),
	('00000000-0000-0000-0000-000000000000', 65, 'wbnqh27avtnf', 'f9423574-1219-4040-8687-d009f0ad403c', true, '2026-01-27 23:11:57.169258+00', '2026-01-28 00:13:07.068223+00', 'zopgswaegd3h', '6e1d0f69-de36-4278-bb06-ea0dfbac5880'),
	('00000000-0000-0000-0000-000000000000', 66, 'fyefsmrqyydz', 'f9423574-1219-4040-8687-d009f0ad403c', false, '2026-01-28 00:13:07.068619+00', '2026-01-28 00:13:07.068619+00', 'wbnqh27avtnf', '6e1d0f69-de36-4278-bb06-ea0dfbac5880');


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

SELECT pg_catalog.setval('"auth"."refresh_tokens_id_seq"', 66, true);


--
-- PostgreSQL database dump complete
--

-- \unrestrict 1mMZsrdbBtYgSZf94fn1nIMqDeCXr5Qr1snBQrqBtM9mJyD0xL6majCVzv9sVcf

RESET ALL;
