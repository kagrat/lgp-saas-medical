--
-- PostgreSQL database dump
--

\restrict rnvgGwMgFDh5XsbOs7l89EeLmXL9wv1NWTWTcwjJ9r0bmWPDlG5JWoypJ4N2cWl

-- Dumped from database version 18.6 (Debian 18.6-1.pgdg13+2)
-- Dumped by pg_dump version 18.6

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
-- Name: appointmentstatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.appointmentstatus AS ENUM (
    'CONFIRMED',
    'CANCELLED',
    'COMPLETED',
    'NO_SHOW',
    'ARRIVED'
);


ALTER TYPE public.appointmentstatus OWNER TO postgres;

--
-- Name: deliverymode; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.deliverymode AS ENUM (
    'PICKUP',
    'DELIVERY'
);


ALTER TYPE public.deliverymode OWNER TO postgres;

--
-- Name: documenttype; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.documenttype AS ENUM (
    'PRESCRIPTION',
    'LAB_RESULT',
    'CONSULTATION_NOTE',
    'CERTIFICATE',
    'OTHER',
    'DAILY_PROGRESS_NOTE',
    'NURSING_NOTE'
);


ALTER TYPE public.documenttype OWNER TO postgres;

--
-- Name: establishmenttype; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.establishmenttype AS ENUM (
    'HOPITAL',
    'CLINIQUE',
    'PHARMACIE',
    'laboratoire',
    'LABORATOIRE'
);


ALTER TYPE public.establishmenttype OWNER TO postgres;

--
-- Name: labteststatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.labteststatus AS ENUM (
    'REQUESTED',
    'SAMPLE_COLLECTED',
    'IN_PROGRESS',
    'VALIDATED',
    'DELIVERED',
    'CANCELLED'
);


ALTER TYPE public.labteststatus OWNER TO postgres;

--
-- Name: messagesenderrole; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.messagesenderrole AS ENUM (
    'PATIENT',
    'STAFF'
);


ALTER TYPE public.messagesenderrole OWNER TO postgres;

--
-- Name: reservationstatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.reservationstatus AS ENUM (
    'PENDING',
    'READY',
    'DELIVERED',
    'CANCELLED',
    'confirmed',
    'preparing',
    'out_for_delivery',
    'CONFIRMED',
    'PREPARING',
    'OUT_FOR_DELIVERY',
    'AWAITING_CONFIRMATION'
);


ALTER TYPE public.reservationstatus OWNER TO postgres;

--
-- Name: subscriptionstatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.subscriptionstatus AS ENUM (
    'ACTIVE',
    'SUSPENDED',
    'TRIAL'
);


ALTER TYPE public.subscriptionstatus OWNER TO postgres;

--
-- Name: userrole; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.userrole AS ENUM (
    'SUPER_ADMIN',
    'ESTABLISHMENT_ADMIN',
    'DOCTOR',
    'SECRETARY',
    'PHARMACIST',
    'PATIENT',
    'lab_technician',
    'LAB_TECHNICIAN',
    'NURSE',
    'RECEPTIONIST',
    'ACCOUNTANT',
    'HR_MANAGER'
);


ALTER TYPE public.userrole OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admission_transfers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.admission_transfers (
    id uuid NOT NULL,
    admission_id uuid NOT NULL,
    from_department_id uuid,
    to_department_id uuid,
    from_room_id uuid,
    to_room_id uuid,
    transferred_by_user_id uuid NOT NULL,
    note text,
    created_at timestamp without time zone
);


ALTER TABLE public.admission_transfers OWNER TO postgres;

--
-- Name: admissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.admissions (
    id uuid NOT NULL,
    establishment_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    admitting_doctor_id uuid NOT NULL,
    department_id uuid,
    room_id uuid,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    diagnosis text,
    admission_date timestamp without time zone NOT NULL,
    expected_discharge_date timestamp without time zone,
    actual_discharge_date timestamp without time zone,
    discharge_summary text,
    created_at timestamp without time zone
);


ALTER TABLE public.admissions OWNER TO postgres;

--
-- Name: appointments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.appointments (
    id uuid NOT NULL,
    establishment_id uuid NOT NULL,
    doctor_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    scheduled_at timestamp without time zone NOT NULL,
    duration_minutes integer,
    status public.appointmentstatus,
    notes text,
    created_at timestamp without time zone
);


ALTER TABLE public.appointments OWNER TO postgres;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_logs (
    id uuid NOT NULL,
    user_id uuid,
    establishment_id uuid,
    action character varying(200) NOT NULL,
    details text,
    created_at timestamp without time zone
);


ALTER TABLE public.audit_logs OWNER TO postgres;

--
-- Name: departments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.departments (
    id uuid NOT NULL,
    establishment_id uuid NOT NULL,
    name character varying(150) NOT NULL,
    head_user_id uuid,
    created_at timestamp without time zone
);


ALTER TABLE public.departments OWNER TO postgres;

--
-- Name: dependents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.dependents (
    id uuid NOT NULL,
    patient_id uuid NOT NULL,
    full_name character varying(200) NOT NULL,
    relation_type character varying(50) NOT NULL,
    date_of_birth date
);


ALTER TABLE public.dependents OWNER TO postgres;

--
-- Name: doctor_absences; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.doctor_absences (
    id uuid NOT NULL,
    doctor_id uuid NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    reason character varying(300)
);


ALTER TABLE public.doctor_absences OWNER TO postgres;

--
-- Name: doctor_availabilities; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.doctor_availabilities (
    id uuid NOT NULL,
    doctor_id uuid NOT NULL,
    day_of_week integer NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    slot_duration_minutes integer
);


ALTER TABLE public.doctor_availabilities OWNER TO postgres;

--
-- Name: doctor_reviews; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.doctor_reviews (
    id uuid NOT NULL,
    doctor_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    rating integer NOT NULL,
    comment text,
    created_at timestamp without time zone
);


ALTER TABLE public.doctor_reviews OWNER TO postgres;

--
-- Name: doctors; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.doctors (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    establishment_id uuid NOT NULL,
    specialty character varying(100) NOT NULL,
    consultation_price double precision NOT NULL,
    bio text,
    photo_url character varying(500),
    is_active boolean
);


ALTER TABLE public.doctors OWNER TO postgres;

--
-- Name: equipment; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.equipment (
    id uuid NOT NULL,
    establishment_id uuid NOT NULL,
    name character varying(200) NOT NULL,
    status character varying(50) NOT NULL,
    notes text,
    department_id uuid,
    category character varying(100),
    last_maintenance_date date,
    next_maintenance_date date
);


ALTER TABLE public.equipment OWNER TO postgres;

--
-- Name: establishments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.establishments (
    id uuid NOT NULL,
    name character varying(200) NOT NULL,
    type public.establishmenttype NOT NULL,
    city character varying(100) NOT NULL,
    address character varying(300),
    latitude double precision,
    longitude double precision,
    subscription_status public.subscriptionstatus,
    is_active boolean,
    created_at timestamp without time zone
);


ALTER TABLE public.establishments OWNER TO postgres;

--
-- Name: inventory_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.inventory_items (
    id uuid NOT NULL,
    establishment_id uuid NOT NULL,
    name character varying(200) NOT NULL,
    category character varying(100),
    quantity integer DEFAULT 0 NOT NULL,
    unit character varying(30),
    alert_threshold integer DEFAULT 5 NOT NULL,
    created_at timestamp without time zone
);


ALTER TABLE public.inventory_items OWNER TO postgres;

--
-- Name: invoice_line_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.invoice_line_items (
    id uuid NOT NULL,
    invoice_id uuid NOT NULL,
    description character varying(300) NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    unit_price double precision DEFAULT 0 NOT NULL
);


ALTER TABLE public.invoice_line_items OWNER TO postgres;

--
-- Name: invoices; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.invoices (
    id uuid NOT NULL,
    establishment_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    issued_by_user_id uuid NOT NULL,
    invoice_number character varying(50) NOT NULL,
    status character varying(20) DEFAULT 'issued'::character varying NOT NULL,
    total_amount double precision DEFAULT 0 NOT NULL,
    notes text,
    issued_at timestamp without time zone,
    due_date timestamp without time zone,
    appointment_id uuid,
    admission_id uuid
);


ALTER TABLE public.invoices OWNER TO postgres;

--
-- Name: lab_test_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lab_test_requests (
    id uuid NOT NULL,
    establishment_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    test_name character varying(200) NOT NULL,
    sample_type character varying(100),
    status public.labteststatus,
    scheduled_sample_at timestamp without time zone,
    results_text text,
    lab_technician_note text,
    created_at timestamp without time zone,
    sample_collected_at timestamp without time zone,
    results_validated_at timestamp without time zone,
    referred_by_establishment_id uuid,
    referred_by_doctor_id uuid
);


ALTER TABLE public.lab_test_requests OWNER TO postgres;

--
-- Name: leave_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.leave_requests (
    id uuid NOT NULL,
    establishment_id uuid NOT NULL,
    user_id uuid NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    reason character varying(500),
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    reviewed_by_user_id uuid,
    reviewed_at timestamp without time zone,
    review_note character varying(300),
    created_at timestamp without time zone
);


ALTER TABLE public.leave_requests OWNER TO postgres;

--
-- Name: medical_documents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.medical_documents (
    id uuid NOT NULL,
    appointment_id uuid,
    patient_id uuid NOT NULL,
    doctor_id uuid,
    establishment_id uuid NOT NULL,
    document_type public.documenttype NOT NULL,
    title character varying(200) NOT NULL,
    content text NOT NULL,
    created_at timestamp without time zone,
    admission_id uuid,
    author_user_id uuid
);


ALTER TABLE public.medical_documents OWNER TO postgres;

--
-- Name: messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.messages (
    id uuid NOT NULL,
    patient_id uuid NOT NULL,
    establishment_id uuid NOT NULL,
    sender_role public.messagesenderrole NOT NULL,
    sender_name character varying(200) NOT NULL,
    content text NOT NULL,
    created_at timestamp without time zone,
    doctor_id uuid
);


ALTER TABLE public.messages OWNER TO postgres;

--
-- Name: notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notifications (
    id uuid NOT NULL,
    establishment_id uuid NOT NULL,
    user_id uuid,
    notification_type character varying(30) DEFAULT 'info'::character varying NOT NULL,
    title character varying(200) NOT NULL,
    message text NOT NULL,
    is_read boolean DEFAULT false,
    created_at timestamp without time zone
);


ALTER TABLE public.notifications OWNER TO postgres;

--
-- Name: opening_hours; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.opening_hours (
    id uuid NOT NULL,
    establishment_id uuid NOT NULL,
    day_of_week integer NOT NULL,
    open_time time without time zone NOT NULL,
    close_time time without time zone NOT NULL
);


ALTER TABLE public.opening_hours OWNER TO postgres;

--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.password_reset_tokens (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_hash character varying(64) NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    used boolean DEFAULT false,
    created_at timestamp without time zone
);


ALTER TABLE public.password_reset_tokens OWNER TO postgres;

--
-- Name: patient_record_shares; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.patient_record_shares (
    id uuid NOT NULL,
    patient_id uuid NOT NULL,
    from_doctor_id uuid NOT NULL,
    to_doctor_id uuid NOT NULL,
    note text,
    created_at timestamp without time zone
);


ALTER TABLE public.patient_record_shares OWNER TO postgres;

--
-- Name: patients; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.patients (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    dossier_number character varying(50) NOT NULL,
    date_of_birth date
);


ALTER TABLE public.patients OWNER TO postgres;

--
-- Name: payments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payments (
    id uuid NOT NULL,
    invoice_id uuid NOT NULL,
    amount double precision NOT NULL,
    payment_method character varying(30) NOT NULL,
    reference character varying(100),
    recorded_by_user_id uuid NOT NULL,
    paid_at timestamp without time zone
);


ALTER TABLE public.payments OWNER TO postgres;

--
-- Name: pharmacy_order_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pharmacy_order_items (
    id uuid NOT NULL,
    reservation_id uuid NOT NULL,
    medication_id uuid NOT NULL,
    quantity integer NOT NULL,
    confirmed_quantity integer,
    confirmed_unit_price double precision
);


ALTER TABLE public.pharmacy_order_items OWNER TO postgres;

--
-- Name: pharmacy_reservation_status_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pharmacy_reservation_status_history (
    id uuid NOT NULL,
    reservation_id uuid NOT NULL,
    status public.reservationstatus NOT NULL,
    note text,
    changed_by_user_id uuid,
    created_at timestamp without time zone
);


ALTER TABLE public.pharmacy_reservation_status_history OWNER TO postgres;

--
-- Name: pharmacy_reservations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pharmacy_reservations (
    id uuid NOT NULL,
    establishment_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    delivery_mode public.deliverymode,
    status public.reservationstatus,
    created_at timestamp without time zone,
    estimated_ready_at timestamp without time zone,
    pharmacist_note text
);


ALTER TABLE public.pharmacy_reservations OWNER TO postgres;

--
-- Name: pharmacy_stock; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pharmacy_stock (
    id uuid NOT NULL,
    establishment_id uuid NOT NULL,
    reference character varying(50) NOT NULL,
    medication_name character varying(200) NOT NULL,
    category character varying(100),
    quantity integer,
    alert_threshold integer,
    unit_price double precision
);


ALTER TABLE public.pharmacy_stock OWNER TO postgres;

--
-- Name: platform_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.platform_settings (
    key character varying(100) NOT NULL,
    value text
);


ALTER TABLE public.platform_settings OWNER TO postgres;

--
-- Name: purchase_orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.purchase_orders (
    id uuid NOT NULL,
    establishment_id uuid NOT NULL,
    supplier_id uuid NOT NULL,
    inventory_item_id uuid,
    description character varying(300) NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    ordered_by_user_id uuid NOT NULL,
    ordered_at timestamp without time zone,
    received_at timestamp without time zone
);


ALTER TABLE public.purchase_orders OWNER TO postgres;

--
-- Name: reference_values; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.reference_values (
    id uuid NOT NULL,
    establishment_id uuid NOT NULL,
    test_name character varying(200) NOT NULL,
    unit character varying(50),
    min_value double precision,
    max_value double precision,
    notes text
);


ALTER TABLE public.reference_values OWNER TO postgres;

--
-- Name: rooms; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.rooms (
    id uuid NOT NULL,
    establishment_id uuid NOT NULL,
    name character varying(200) NOT NULL,
    room_type character varying(100),
    capacity integer,
    department_id uuid
);


ALTER TABLE public.rooms OWNER TO postgres;

--
-- Name: services; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.services (
    id uuid NOT NULL,
    establishment_id uuid NOT NULL,
    name character varying(200) NOT NULL,
    price double precision NOT NULL,
    duration_minutes integer,
    description text
);


ALTER TABLE public.services OWNER TO postgres;

--
-- Name: shifts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.shifts (
    id uuid NOT NULL,
    establishment_id uuid NOT NULL,
    user_id uuid NOT NULL,
    department_id uuid,
    shift_date date NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    notes character varying(300),
    created_by_user_id uuid NOT NULL
);


ALTER TABLE public.shifts OWNER TO postgres;

--
-- Name: staff_profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.staff_profiles (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    department_id uuid,
    position_title character varying(150),
    hire_date date,
    contract_type character varying(50),
    license_number character varying(100),
    created_at timestamp without time zone
);


ALTER TABLE public.staff_profiles OWNER TO postgres;

--
-- Name: suppliers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.suppliers (
    id uuid NOT NULL,
    establishment_id uuid NOT NULL,
    name character varying(200) NOT NULL,
    contact_phone character varying(30),
    contact_email character varying(255),
    notes text
);


ALTER TABLE public.suppliers OWNER TO postgres;

--
-- Name: support_messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.support_messages (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    sender_role character varying(20) NOT NULL,
    sender_name character varying(200) NOT NULL,
    content text NOT NULL,
    created_at timestamp without time zone
);


ALTER TABLE public.support_messages OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id uuid NOT NULL,
    establishment_id uuid,
    email character varying(255) NOT NULL,
    hashed_password character varying(255) NOT NULL,
    full_name character varying(200) NOT NULL,
    phone character varying(30),
    role public.userrole NOT NULL,
    is_active boolean,
    created_at timestamp without time zone,
    gender character varying(20),
    residence character varying(200)
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: vital_signs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.vital_signs (
    id uuid NOT NULL,
    admission_id uuid NOT NULL,
    recorded_by_user_id uuid NOT NULL,
    recorded_at timestamp without time zone,
    temperature_celsius double precision,
    blood_pressure character varying(20),
    pulse_bpm integer,
    respiratory_rate integer,
    notes text
);


ALTER TABLE public.vital_signs OWNER TO postgres;

--
-- Data for Name: admission_transfers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.admission_transfers (id, admission_id, from_department_id, to_department_id, from_room_id, to_room_id, transferred_by_user_id, note, created_at) FROM stdin;
\.


--
-- Data for Name: admissions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.admissions (id, establishment_id, patient_id, admitting_doctor_id, department_id, room_id, status, diagnosis, admission_date, expected_discharge_date, actual_discharge_date, discharge_summary, created_at) FROM stdin;
\.


--
-- Data for Name: appointments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.appointments (id, establishment_id, doctor_id, patient_id, scheduled_at, duration_minutes, status, notes, created_at) FROM stdin;
ef93761e-f19b-4713-bd46-ed447125de5b	46694505-c4b9-4ab1-9900-de3663ec1d6e	cd7273b1-7381-4d84-b82a-e2f2c3d31629	47e6fc86-47cf-4c69-b3b7-492286674b5a	2026-08-13 09:00:00	30	COMPLETED	\N	2026-08-12 22:29:34.609891
15f0b7bd-b8a2-4187-b6c1-90c45452d5ba	809e2ffc-6f82-426c-9a2a-56023fd30d47	071735a8-d8be-4a20-bee1-5c9648fc68b9	d8f55300-df71-4eea-8d87-d43301ae1638	2026-08-17 16:00:00	30	ARRIVED	\N	2026-08-15 18:34:35.100854
b13917ba-9ee7-4644-9cb8-191f7b586815	46694505-c4b9-4ab1-9900-de3663ec1d6e	9d861422-4a77-4b50-852d-2e975e61accd	00ae470c-26a8-4992-8d50-9339aa8e5a70	2026-08-20 09:30:00	30	COMPLETED	\N	2026-08-19 16:46:48.18428
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.audit_logs (id, user_id, establishment_id, action, details, created_at) FROM stdin;
b8bd2e85-f867-4162-8b58-0b9e2025e320	688763fc-0d35-4e97-8d09-d5a55639c4e7	\N	login	Connexion de admin@lgp.com	2026-08-04 00:34:07.351915
19ce0e2b-9308-4c50-a279-7924441ec5c8	688763fc-0d35-4e97-8d09-d5a55639c4e7	\N	login	Connexion de admin@lgp.com	2026-08-04 10:53:47.564389
4f46f0f5-6e00-43af-82f6-001d3cc7fc68	688763fc-0d35-4e97-8d09-d5a55639c4e7	\N	login	Connexion de admin@lgp.com	2026-08-04 12:31:42.132969
865fa6e5-4be7-427d-a2e3-a93e2902cd03	688763fc-0d35-4e97-8d09-d5a55639c4e7	46694505-c4b9-4ab1-9900-de3663ec1d6e	create_establishment	Creation de fautin-cliniq	2026-08-04 12:32:27.427946
f1cd33ee-760e-46fa-96ec-6be6a760a108	688763fc-0d35-4e97-8d09-d5a55639c4e7	809e2ffc-6f82-426c-9a2a-56023fd30d47	create_establishment	Creation de Parmacie-Janvier	2026-08-04 12:36:46.226438
9b7c889e-78a1-49d2-b9c3-55719bb91490	688763fc-0d35-4e97-8d09-d5a55639c4e7	31f98de2-3365-434c-ba6c-16a4337272e9	create_establishment	Creation de Saint Jean	2026-08-04 12:41:19.103933
5ad0663f-b14e-4517-be28-e83f3bc2c401	938e437c-866e-4719-b098-6d5fd8a5ebd2	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de faustin@lgp.com	2026-08-04 14:44:37.410443
d4edad2c-7fb0-4e59-a3dd-8937202c1f3f	c588c4e7-a4bd-43fd-8b7f-d7bf27b9ffc4	809e2ffc-6f82-426c-9a2a-56023fd30d47	login	Connexion de janvier@lgp.com	2026-08-04 15:23:42.502636
1bfeaf1c-53f3-4790-a6b3-254f03f9e1ec	688763fc-0d35-4e97-8d09-d5a55639c4e7	\N	login	Connexion de admin@lgp.com	2026-08-04 16:10:42.798238
56a4f133-692d-4aef-a810-b0d69496df0d	688763fc-0d35-4e97-8d09-d5a55639c4e7	\N	login	Connexion de admin@lgp.com	2026-08-04 17:02:00.949818
3f614f13-bc49-477d-87b1-a73dd2c73518	688763fc-0d35-4e97-8d09-d5a55639c4e7	\N	login	Connexion de admin@lgp.com	2026-08-04 17:06:34.379002
3a587b0f-f79d-43d0-8e64-c9a978d74492	688763fc-0d35-4e97-8d09-d5a55639c4e7	31f98de2-3365-434c-ba6c-16a4337272e9	suspend_establishment	Statut mis a jour: is_active=False	2026-08-04 17:06:39.974683
3e492bdd-de00-4287-b8d0-aa382ac816f2	688763fc-0d35-4e97-8d09-d5a55639c4e7	31f98de2-3365-434c-ba6c-16a4337272e9	reactivate_establishment	Statut mis a jour: is_active=True	2026-08-04 17:06:46.425415
c9aecaa4-be99-4864-94f2-7db9b79cc922	938e437c-866e-4719-b098-6d5fd8a5ebd2	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de faustin@lgp.com	2026-08-04 17:21:03.04687
2a99e4a3-fda9-4c07-aaa6-8ce7101fc89a	c588c4e7-a4bd-43fd-8b7f-d7bf27b9ffc4	809e2ffc-6f82-426c-9a2a-56023fd30d47	login	Connexion de janvier@lgp.com	2026-08-04 17:23:56.894368
a89ef0a5-e3d7-45b0-9571-375dd762e0d2	938e437c-866e-4719-b098-6d5fd8a5ebd2	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de faustin@lgp.com	2026-08-04 17:40:34.761012
783a97b4-e304-4fc6-93ae-022f48bc3508	688763fc-0d35-4e97-8d09-d5a55639c4e7	\N	login	Connexion de admin@lgp.com	2026-08-05 00:46:03.310291
cddbb591-a578-422b-9656-93e2a3d42574	688763fc-0d35-4e97-8d09-d5a55639c4e7	\N	login	Connexion de admin@lgp.com	2026-08-05 09:22:29.376953
a478bf2c-6e63-4fac-9fd6-690d9cb9cf49	938e437c-866e-4719-b098-6d5fd8a5ebd2	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de faustin@lgp.com	2026-08-05 09:25:07.15098
0b0286b4-e495-41d5-b61c-84dddc33a3f2	688763fc-0d35-4e97-8d09-d5a55639c4e7	\N	login	Connexion de admin@lgp.com	2026-08-05 16:25:21.477714
65fc4c9e-3322-4da9-9364-0892422f6478	688763fc-0d35-4e97-8d09-d5a55639c4e7	\N	login	Connexion de admin@lgp.com	2026-08-06 08:42:29.153965
2252333b-316b-42ae-9ce5-a61aa21f15b9	938e437c-866e-4719-b098-6d5fd8a5ebd2	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de faustin@lgp.com	2026-08-06 08:47:28.322419
3f4f0181-4f93-4333-b980-db54b631be9c	688763fc-0d35-4e97-8d09-d5a55639c4e7	\N	login	Connexion de admin@lgp.com	2026-08-07 23:47:27.582294
1a32648a-c244-4051-8914-4102b59e0d3a	938e437c-866e-4719-b098-6d5fd8a5ebd2	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de faustin@lgp.com	2026-08-08 00:09:25.459477
c03ae0ca-bdf2-40d0-8655-7c4b2d7a9781	688763fc-0d35-4e97-8d09-d5a55639c4e7	\N	login	Connexion de admin@lgp.com	2026-08-08 07:17:44.228566
4dbe754b-ba5f-4cc1-b8c5-22d2446bbf5f	688763fc-0d35-4e97-8d09-d5a55639c4e7	\N	login	Connexion de admin@lgp.com	2026-08-08 07:19:26.790389
b15ae65b-60f3-4fc1-ac84-f07f318e57a9	938e437c-866e-4719-b098-6d5fd8a5ebd2	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de faustin@lgp.com	2026-08-08 07:20:41.269425
148dcfc2-f094-43bf-be7c-5cec05411750	938e437c-866e-4719-b098-6d5fd8a5ebd2	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de faustin@lgp.com	2026-08-08 07:21:58.889523
dbf03cf3-6302-4912-8b4a-6dc2cf779ee9	688763fc-0d35-4e97-8d09-d5a55639c4e7	\N	login	Connexion de admin@lgp.com	2026-08-08 08:04:23.925966
423315e6-6910-4e0f-8f57-30ab3aaf0a29	688763fc-0d35-4e97-8d09-d5a55639c4e7	\N	login	Connexion de admin@lgp.com	2026-08-08 08:08:13.458691
cf36023b-cea1-4a00-930e-1bd018c7c934	688763fc-0d35-4e97-8d09-d5a55639c4e7	008c1e3e-d05e-4387-9818-e4bd1d788548	create_establishment	Creation de rapide Analasyse	2026-08-08 08:28:58.050727
7ad970f5-f36b-4168-b8bb-f0d4e190886a	688763fc-0d35-4e97-8d09-d5a55639c4e7	\N	login	Connexion de admin@lgp.com	2026-08-08 15:36:47.119478
249df4e0-df71-4efb-b677-f745016215e2	688763fc-0d35-4e97-8d09-d5a55639c4e7	\N	login	Connexion de admin@lgp.com	2026-08-08 16:06:42.941264
6787a677-0aae-49a9-8ebd-226a532680e1	688763fc-0d35-4e97-8d09-d5a55639c4e7	\N	login	Connexion de admin@lgp.com	2026-08-08 16:42:26.609376
fc3b8d41-a884-4321-8574-afcb8a754b0c	688763fc-0d35-4e97-8d09-d5a55639c4e7	\N	login	Connexion de admin@lgp.com	2026-08-09 12:24:12.615658
6c74a5d1-71ed-4c34-8028-2203b2bbc1f2	688763fc-0d35-4e97-8d09-d5a55639c4e7	\N	login	Connexion de admin@lgp.com	2026-08-09 14:47:42.912745
607b9e8a-5e8c-474b-b877-ddc96a744bd2	688763fc-0d35-4e97-8d09-d5a55639c4e7	950825b7-a8c9-4bb9-a298-2dc6069ee5ae	create_establishment	Creation de Jean Labo	2026-08-09 15:47:36.16933
93da81a0-e24f-4376-972e-4ee3239e7c34	688763fc-0d35-4e97-8d09-d5a55639c4e7	\N	login	Connexion de admin@lgp.com	2026-08-09 16:49:49.386256
adab3ef8-0428-4fec-a10a-282f6d0d3d09	688763fc-0d35-4e97-8d09-d5a55639c4e7	\N	login	Connexion de admin@lgp.com	2026-08-10 07:57:32.711633
25316ee7-f2a1-4fec-a5bd-0ee3b57e01a3	688763fc-0d35-4e97-8d09-d5a55639c4e7	\N	login	Connexion de admin@lgp.com	2026-08-10 08:03:17.951953
58a7a4ec-8895-45d1-94ac-bd922b040c52	c588c4e7-a4bd-43fd-8b7f-d7bf27b9ffc4	809e2ffc-6f82-426c-9a2a-56023fd30d47	login	Connexion de janvier@lgp.com	2026-08-10 08:05:10.847893
7c3b77bd-6ea2-4c2a-bf5e-160cab487373	938e437c-866e-4719-b098-6d5fd8a5ebd2	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de faustin@lgp.com	2026-08-10 08:08:37.089845
e9600b75-78f5-4e0e-b88a-43ec8ce2e81a	688763fc-0d35-4e97-8d09-d5a55639c4e7	\N	login	Connexion de admin@lgp.com	2026-08-10 08:09:01.15098
9a9036c1-6f29-4878-8f61-594131885fa4	688763fc-0d35-4e97-8d09-d5a55639c4e7	\N	login	Connexion de admin@lgp.com	2026-08-10 08:10:09.153898
8eb97fce-088b-42e2-9b68-1726925e092a	938e437c-866e-4719-b098-6d5fd8a5ebd2	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de faustin@lgp.com	2026-08-10 08:10:48.011952
954d8a8d-0767-49d3-bcec-36e20800fd53	688763fc-0d35-4e97-8d09-d5a55639c4e7	\N	login	Connexion de admin@lgp.com	2026-08-10 08:12:08.433868
13acbcd9-ed48-4af4-a8d3-5ced8e6d9616	938e437c-866e-4719-b098-6d5fd8a5ebd2	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de faustin@lgp.com	2026-08-10 08:13:19.208615
bb111986-ea65-4cae-a4d8-97e3418f6c6c	688763fc-0d35-4e97-8d09-d5a55639c4e7	\N	login	Connexion de admin@lgp.com	2026-08-10 08:17:17.003693
5d90e234-02ac-4108-b70c-6650d5f11d5f	688763fc-0d35-4e97-8d09-d5a55639c4e7	\N	login	Connexion de admin@lgp.com	2026-08-10 08:18:43.452382
8f91f3f1-1d31-41bf-80a6-d9fd226e5e8c	c588c4e7-a4bd-43fd-8b7f-d7bf27b9ffc4	809e2ffc-6f82-426c-9a2a-56023fd30d47	login	Connexion de janvier@lgp.com	2026-08-10 08:19:41.924626
8d5ece28-7166-4853-985b-456e3569eeac	c588c4e7-a4bd-43fd-8b7f-d7bf27b9ffc4	809e2ffc-6f82-426c-9a2a-56023fd30d47	login	Connexion de janvier@lgp.com	2026-08-10 08:25:17.165345
14c7986c-c5a5-4a34-92ca-68e29c5f348a	938e437c-866e-4719-b098-6d5fd8a5ebd2	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de faustin@lgp.com	2026-08-10 08:27:53.194727
1dea1747-1b5e-4d07-8007-6e3dbb85d40b	5c5d697b-9cff-4403-af99-372f5a1801fe	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de florentine@lgp.com	2026-08-10 08:29:13.111752
0025f7f9-54ff-49d4-9b75-5de23dfa60ca	0cf7cbb1-f966-4d0f-8591-9d3af6edad5b	\N	login	Connexion de faustinsogadji@gmail.com	2026-08-10 08:30:45.96578
a12f1083-4e6c-449d-9da9-326c37d66700	5c5d697b-9cff-4403-af99-372f5a1801fe	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de florentine@lgp.com	2026-08-10 08:40:10.880183
b2c2960c-0ff1-4d48-b8ba-a25749432ec4	c588c4e7-a4bd-43fd-8b7f-d7bf27b9ffc4	809e2ffc-6f82-426c-9a2a-56023fd30d47	login	Connexion de janvier@lgp.com	2026-08-10 08:40:20.328975
349e2413-87c8-4e59-aff5-addfc24d8b26	688763fc-0d35-4e97-8d09-d5a55639c4e7	\N	login	Connexion de admin@lgp.com	2026-08-10 08:43:34.793945
524277de-84da-44fc-96e6-52b508bc48e4	0cf7cbb1-f966-4d0f-8591-9d3af6edad5b	\N	login	Connexion de faustinsogadji@gmail.com	2026-08-10 08:44:37.137079
67c4cf04-e92a-46e4-a2a6-d308e6e49df6	938e437c-866e-4719-b098-6d5fd8a5ebd2	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de faustin@lgp.com	2026-08-10 08:45:38.976131
1191a8d1-096b-482d-a7dd-7abccd1eeaea	688763fc-0d35-4e97-8d09-d5a55639c4e7	\N	login	Connexion de admin@lgp.com	2026-08-10 08:46:07.943196
f319a01c-f3ff-4fa9-a1ea-50eebc963bc2	0dd993d8-c840-44d3-9e32-c98a8154b486	\N	login	Connexion de soggagtkohhffshh@gmail.com	2026-08-10 08:46:27.445404
09564615-a724-4f19-bd62-d6b111d245f9	c588c4e7-a4bd-43fd-8b7f-d7bf27b9ffc4	809e2ffc-6f82-426c-9a2a-56023fd30d47	login	Connexion de janvier@lgp.com	2026-08-10 08:46:32.512682
c972d6cc-e2c4-40d0-8a77-d3b3642aa5dc	0dd993d8-c840-44d3-9e32-c98a8154b486	\N	login	Connexion de soggagtkohhffshh@gmail.com	2026-08-10 08:46:49.343339
a14360e2-1f97-4e29-afd5-e31331e8d180	5c5d697b-9cff-4403-af99-372f5a1801fe	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de florentine@lgp.com	2026-08-10 08:46:59.141304
60d8b491-c78e-41a0-a298-523a0eb94788	938e437c-866e-4719-b098-6d5fd8a5ebd2	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de faustin@lgp.com	2026-08-10 08:47:25.696842
4b5fec99-47d3-4d5f-ae1a-80fe46e1f4cc	688763fc-0d35-4e97-8d09-d5a55639c4e7	\N	login	Connexion de admin@lgp.com	2026-08-10 08:47:59.499675
f997dda3-1b97-4d26-83f7-3d05cd802e7c	938e437c-866e-4719-b098-6d5fd8a5ebd2	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de faustin@lgp.com	2026-08-10 08:49:10.118918
a3387506-908c-4a21-94ad-8a6337957dfc	0cf7cbb1-f966-4d0f-8591-9d3af6edad5b	\N	login	Connexion de faustinsogadji@gmail.com	2026-08-10 08:57:55.587029
9eb63d27-7edc-4aef-bf56-eaad3887bd0f	0cf7cbb1-f966-4d0f-8591-9d3af6edad5b	\N	login	Connexion de faustinsogadji@gmail.com	2026-08-10 09:04:14.454478
e6d007c2-ff90-4f10-8beb-6ef26ca57dce	0cf7cbb1-f966-4d0f-8591-9d3af6edad5b	\N	login	Connexion de faustinsogadji@gmail.com	2026-08-10 09:05:41.166122
4bcc554a-5607-460e-a3de-09bf10b19989	938e437c-866e-4719-b098-6d5fd8a5ebd2	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de faustin@lgp.com	2026-08-10 09:40:47.55614
18b170ba-a387-473e-9b23-638ce3baa98d	938e437c-866e-4719-b098-6d5fd8a5ebd2	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de faustin@lgp.com	2026-08-10 09:18:22.940578
c857944f-facc-4418-a0c1-1200b133a12e	0cf7cbb1-f966-4d0f-8591-9d3af6edad5b	\N	login	Connexion de faustinsogadji@gmail.com	2026-08-10 09:24:37.730115
647f52bc-fe3b-4e3c-b1c6-4ad5d435cda9	688763fc-0d35-4e97-8d09-d5a55639c4e7	\N	login	Connexion de admin@lgp.com	2026-08-11 01:02:26.967041
fb995a81-5784-4fc4-bb61-b6a5346226e1	00ac7b8a-0976-4311-87c6-efa3ddbd2395	\N	login	Connexion de gratianokakpo@gmail.com	2026-08-11 01:05:43.42272
7326dd89-1aa6-4d28-b1a6-b9ed798e815a	00ac7b8a-0976-4311-87c6-efa3ddbd2395	\N	login	Connexion de gratianokakpo@gmail.com	2026-08-11 08:53:44.915808
66d1eae0-2ee3-493a-b841-cdd548ca5a30	688763fc-0d35-4e97-8d09-d5a55639c4e7	\N	login	Connexion de admin@lgp.com	2026-08-12 15:09:32.767446
7f02e278-aeff-44cc-abcb-edd9af381bb4	938e437c-866e-4719-b098-6d5fd8a5ebd2	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de faustin@lgp.com	2026-08-12 15:27:30.768
b3ba61b1-efad-472c-84f7-df336ee6bdb3	938e437c-866e-4719-b098-6d5fd8a5ebd2	46694505-c4b9-4ab1-9900-de3663ec1d6e	create_staff	Compte secretary cree: Jule	2026-08-12 15:28:59.621646
269714fe-53dd-4d5b-bdd9-3ee85fa420d8	00ac7b8a-0976-4311-87c6-efa3ddbd2395	\N	login	Connexion de gratianokakpo@gmail.com	2026-08-12 18:16:55.413122
e0e84cf9-50bf-49a7-a164-c42164041fbb	938e437c-866e-4719-b098-6d5fd8a5ebd2	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de faustin@lgp.com	2026-08-12 18:24:17.140595
f64b358f-22a6-4feb-a03d-0aa7f3a49051	938e437c-866e-4719-b098-6d5fd8a5ebd2	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de faustin@lgp.com	2026-08-12 21:46:30.766747
8c846d57-98c9-48cb-b226-27970c9a9429	938e437c-866e-4719-b098-6d5fd8a5ebd2	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de faustin@lgp.com	2026-08-12 22:23:38.515112
776d3e08-24ff-4e5f-aa39-bcd1852e5f24	00ac7b8a-0976-4311-87c6-efa3ddbd2395	\N	login	Connexion de gratianokakpo@gmail.com	2026-08-12 22:29:08.678582
f522f854-62d4-432e-97e5-e98029211c99	00ac7b8a-0976-4311-87c6-efa3ddbd2395	46694505-c4b9-4ab1-9900-de3663ec1d6e	create_appointment	RDV cree pour patient PAT-AAA0B796	2026-08-12 22:29:34.612916
da25bd67-4462-4d03-ad63-34ced0bc2bff	938e437c-866e-4719-b098-6d5fd8a5ebd2	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de faustin@lgp.com	2026-08-13 02:42:28.24149
b368bc37-43ab-4fe5-b496-3c41a77a2971	00ac7b8a-0976-4311-87c6-efa3ddbd2395	\N	login	Connexion de gratianokakpo@gmail.com	2026-08-13 02:45:03.003732
dac8a389-5509-4cb4-9104-2c937d4ba343	938e437c-866e-4719-b098-6d5fd8a5ebd2	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de faustin@lgp.com	2026-08-13 09:36:12.721277
20e1f95e-c0a3-49e0-b455-d11c27820897	688763fc-0d35-4e97-8d09-d5a55639c4e7	\N	login	Connexion de admin@lgp.com	2026-08-13 09:39:05.921015
48cdf431-6bfa-4d7a-aefa-b4ffe9f89ee2	688763fc-0d35-4e97-8d09-d5a55639c4e7	\N	login	Connexion de admin@lgp.com	2026-08-13 09:39:59.694563
b09621c7-df1a-447d-be74-379c9dfca898	c588c4e7-a4bd-43fd-8b7f-d7bf27b9ffc4	809e2ffc-6f82-426c-9a2a-56023fd30d47	login	Connexion de janvier@lgp.com	2026-08-13 09:41:01.714092
b15eceea-ee75-41a7-ba21-88f7ac8fa490	938e437c-866e-4719-b098-6d5fd8a5ebd2	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de faustin@lgp.com	2026-08-13 09:42:43.711829
1977fcfd-92ac-4108-a3d8-03ab2f5b5267	938e437c-866e-4719-b098-6d5fd8a5ebd2	46694505-c4b9-4ab1-9900-de3663ec1d6e	mark_arrived	RDV ef93761e-f19b-4713-bd46-ed447125de5b marque arrive	2026-08-13 09:42:51.823341
956caf0a-f7fa-4147-9ec6-54685e1b9407	938e437c-866e-4719-b098-6d5fd8a5ebd2	46694505-c4b9-4ab1-9900-de3663ec1d6e	complete_appointment	RDV ef93761e-f19b-4713-bd46-ed447125de5b marque termine	2026-08-13 09:42:58.105333
97d7a4f9-a818-4adf-807b-bcd661555ddb	938e437c-866e-4719-b098-6d5fd8a5ebd2	46694505-c4b9-4ab1-9900-de3663ec1d6e	create_medical_document	Document 'ordonance du 12 Aout' ajoute au dossier	2026-08-13 09:47:07.29758
94532586-31f7-43b8-af2e-2fb91d89409f	938e437c-866e-4719-b098-6d5fd8a5ebd2	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de faustin@lgp.com	2026-08-13 10:06:10.400442
2ce945a9-64f4-4a36-9b6a-15a82d8d4a04	0cf7cbb1-f966-4d0f-8591-9d3af6edad5b	\N	login	Connexion de faustinsogadji@gmail.com	2026-08-13 10:08:40.218876
0cd693b2-8aec-4fd3-9b71-cfd0a1bd777c	00ac7b8a-0976-4311-87c6-efa3ddbd2395	\N	login	Connexion de gratianokakpo@gmail.com	2026-08-13 10:10:09.156144
e73022fb-dc24-4f92-9966-6ae43dfdbdb3	688763fc-0d35-4e97-8d09-d5a55639c4e7	\N	login	Connexion de admin@lgp.com	2026-08-13 10:11:40.554957
dd4c4f35-b389-4aa9-b896-7a39deefe944	688763fc-0d35-4e97-8d09-d5a55639c4e7	\N	login	Connexion de admin@lgp.com	2026-08-13 10:16:21.741557
be5d8fb9-c660-4412-863b-d327c3e8155d	5c5d697b-9cff-4403-af99-372f5a1801fe	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de florentine@lgp.com	2026-08-13 10:29:54.95309
e97c9cb2-832b-4e4d-9c46-94a5dfd912b5	c588c4e7-a4bd-43fd-8b7f-d7bf27b9ffc4	809e2ffc-6f82-426c-9a2a-56023fd30d47	login	Connexion de janvier@lgp.com	2026-08-13 10:30:14.835088
1c1803fe-9cc3-41da-a7ba-a5a7db54f797	c588c4e7-a4bd-43fd-8b7f-d7bf27b9ffc4	809e2ffc-6f82-426c-9a2a-56023fd30d47	login	Connexion de janvier@lgp.com	2026-08-13 11:43:40.776022
a4cf1cdf-98ad-4f2e-b188-a7d23245384f	0cf7cbb1-f966-4d0f-8591-9d3af6edad5b	\N	login	Connexion de faustinsogadji@gmail.com	2026-08-13 11:44:56.812507
7e282c9b-aba8-485a-bb19-b38f548cc78e	c588c4e7-a4bd-43fd-8b7f-d7bf27b9ffc4	809e2ffc-6f82-426c-9a2a-56023fd30d47	login	Connexion de janvier@lgp.com	2026-08-13 18:09:54.023968
27e7f217-4fd7-474d-ba68-7a6614e0d0d8	938e437c-866e-4719-b098-6d5fd8a5ebd2	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de faustin@lgp.com	2026-08-13 18:10:39.952558
45f5178d-fb1f-4630-a0c7-9b85ef495455	c588c4e7-a4bd-43fd-8b7f-d7bf27b9ffc4	809e2ffc-6f82-426c-9a2a-56023fd30d47	login	Connexion de janvier@lgp.com	2026-08-13 18:12:36.137039
c51549bc-5275-42c5-a9db-04cfdcd4dada	938e437c-866e-4719-b098-6d5fd8a5ebd2	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de faustin@lgp.com	2026-08-13 18:13:24.21183
a428e4ff-8417-4d59-a821-d4a09257b87a	c588c4e7-a4bd-43fd-8b7f-d7bf27b9ffc4	809e2ffc-6f82-426c-9a2a-56023fd30d47	login	Connexion de janvier@lgp.com	2026-08-13 18:15:51.002025
7af178bd-9712-4641-a7b2-796f06c1f859	0cf7cbb1-f966-4d0f-8591-9d3af6edad5b	\N	login	Connexion de faustinsogadji@gmail.com	2026-08-13 18:21:12.983116
392544a9-3d66-4e67-8e60-8f6ecea33472	00ac7b8a-0976-4311-87c6-efa3ddbd2395	\N	login	Connexion de gratianokakpo@gmail.com	2026-08-14 06:24:54.43962
9afcda26-f74e-46ca-b899-a4b59e6d05b6	c588c4e7-a4bd-43fd-8b7f-d7bf27b9ffc4	809e2ffc-6f82-426c-9a2a-56023fd30d47	login	Connexion de janvier@lgp.com	2026-08-14 06:38:23.874056
9eb99e23-4da3-4c48-8fef-2f82dcd8a46d	688763fc-0d35-4e97-8d09-d5a55639c4e7	\N	login	Connexion de admin@lgp.com	2026-08-14 06:40:08.217911
28f923f6-a6e4-4f25-be0b-50ffa6b51d6c	0cf7cbb1-f966-4d0f-8591-9d3af6edad5b	\N	login	Connexion de faustinsogadji@gmail.com	2026-08-14 06:41:05.394927
4c4b5f05-37ff-41d5-9dc7-442d05fbd330	0dd993d8-c840-44d3-9e32-c98a8154b486	\N	login	Connexion de soggagtkohhffshh@gmail.com	2026-08-14 06:44:56.045619
e2ad2674-5e06-475a-8eb2-8c54735e7799	688763fc-0d35-4e97-8d09-d5a55639c4e7	\N	login	Connexion de admin@lgp.com	2026-08-15 06:18:57.536595
c7b87d5c-581f-447b-9f8e-077b75ea13ab	688763fc-0d35-4e97-8d09-d5a55639c4e7	1e1be1d6-ce82-4abb-9a59-752d2ca8d9fb	create_establishment	Creation de pharma guezo	2026-08-15 06:20:48.290341
30ad70af-2360-45f4-beec-de3b7f7c844c	945cc86e-d646-42c2-8cfc-1485651c7de2	1e1be1d6-ce82-4abb-9a59-752d2ca8d9fb	login	Connexion de guezo@lgp.com	2026-08-15 06:21:08.359577
6d000f34-341d-44eb-a1cd-837c45f3fa7d	688763fc-0d35-4e97-8d09-d5a55639c4e7	\N	login	Connexion de admin@lgp.com	2026-08-15 12:18:32.500634
2358463a-6644-4a59-b3eb-78eb4c285385	945cc86e-d646-42c2-8cfc-1485651c7de2	1e1be1d6-ce82-4abb-9a59-752d2ca8d9fb	login	Connexion de guezo@lgp.com	2026-08-15 12:21:25.69186
af451c58-8dec-4f69-87b9-f108e72e1f76	945cc86e-d646-42c2-8cfc-1485651c7de2	1e1be1d6-ce82-4abb-9a59-752d2ca8d9fb	login	Connexion de guezo@lgp.com	2026-08-15 14:55:28.200681
f78d6427-529c-4804-b5fb-a2f62547a01c	688763fc-0d35-4e97-8d09-d5a55639c4e7	\N	login	Connexion de admin@lgp.com	2026-08-15 14:58:10.273456
ee5270a2-ca8a-4bd2-9b8a-d3bf5e96e4bd	945cc86e-d646-42c2-8cfc-1485651c7de2	1e1be1d6-ce82-4abb-9a59-752d2ca8d9fb	login	Connexion de guezo@lgp.com	2026-08-15 14:59:44.82193
8b19d74e-f1dc-488a-b8be-6e0e2982fcc0	945cc86e-d646-42c2-8cfc-1485651c7de2	1e1be1d6-ce82-4abb-9a59-752d2ca8d9fb	login	Connexion de guezo@lgp.com	2026-08-15 15:08:28.647064
cd8aab9e-fda4-4f9e-bd8b-b1538dbf1eb5	945cc86e-d646-42c2-8cfc-1485651c7de2	1e1be1d6-ce82-4abb-9a59-752d2ca8d9fb	login	Connexion de guezo@lgp.com	2026-08-15 15:26:06.218695
c1caf880-c2fe-453e-8f97-892a8e7919f6	945cc86e-d646-42c2-8cfc-1485651c7de2	1e1be1d6-ce82-4abb-9a59-752d2ca8d9fb	login	Connexion de guezo@lgp.com	2026-08-15 15:28:46.840938
c442b986-3d23-4fef-8e75-b1ffaacc09b6	945cc86e-d646-42c2-8cfc-1485651c7de2	1e1be1d6-ce82-4abb-9a59-752d2ca8d9fb	login	Connexion de guezo@lgp.com	2026-08-15 15:37:18.730158
12ad9a47-6ba6-4cd7-8b8f-b2b0e2741e3f	938e437c-866e-4719-b098-6d5fd8a5ebd2	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de faustin@lgp.com	2026-08-15 15:39:05.398563
cfa7dfe7-b676-48fc-969f-43c7ec31fdaf	00ac7b8a-0976-4311-87c6-efa3ddbd2395	\N	login	Connexion de gratianokakpo@gmail.com	2026-08-15 16:13:48.664454
75097d30-98fb-47d6-8d00-9526bf8c61e9	00ac7b8a-0976-4311-87c6-efa3ddbd2395	\N	login	Connexion de gratianokakpo@gmail.com	2026-08-15 17:02:09.293426
9ae73152-df01-4cf8-9909-a7752bc8e09f	938e437c-866e-4719-b098-6d5fd8a5ebd2	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de faustin@lgp.com	2026-08-15 17:31:08.117513
eff26d9c-56e7-47f4-85fb-71dc4a0d1dd0	0dd993d8-c840-44d3-9e32-c98a8154b486	\N	login	Connexion de soggagtkohhffshh@gmail.com	2026-08-15 18:31:21.279535
601a5598-b19b-408f-8524-c9a4036e80b2	0dd993d8-c840-44d3-9e32-c98a8154b486	\N	login	Connexion de soggagtkohhffshh@gmail.com	2026-08-15 18:32:29.635198
b9cfca4d-17a9-4ea1-8b91-ab0056770d63	0dd993d8-c840-44d3-9e32-c98a8154b486	809e2ffc-6f82-426c-9a2a-56023fd30d47	create_appointment	RDV cree pour patient PAT-D18EB003	2026-08-15 18:34:35.10994
e3ad9947-7597-4de8-8b9c-f0739858d9ad	0cf7cbb1-f966-4d0f-8591-9d3af6edad5b	\N	login	Connexion de faustinsogadji@gmail.com	2026-08-16 07:18:37.534288
b14a201d-6051-4874-a8b7-f0683334e8cc	00ac7b8a-0976-4311-87c6-efa3ddbd2395	\N	login	Connexion de gratianokakpo@gmail.com	2026-08-16 07:27:49.657017
1a771684-c5ff-458c-bb98-d217dc5c5202	688763fc-0d35-4e97-8d09-d5a55639c4e7	\N	login	Connexion de admin@lgp.com	2026-08-16 07:31:56.765807
15f5f049-14cd-4688-bb17-10faab0938bb	938e437c-866e-4719-b098-6d5fd8a5ebd2	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de faustin@lgp.com	2026-08-16 07:35:25.602278
2e2c2554-bc8f-4ce1-ac2a-4110f823231f	688763fc-0d35-4e97-8d09-d5a55639c4e7	\N	login	Connexion de admin@lgp.com	2026-08-16 08:33:40.873369
72d89527-38cf-4e49-8c11-78f02ef92e88	938e437c-866e-4719-b098-6d5fd8a5ebd2	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de faustin@lgp.com	2026-08-16 08:34:27.029466
ed041fe3-ae58-46fc-9691-bbd416074548	b5bf3c1e-0909-4669-8824-f6ea156abba1	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de tangui@lgp.com	2026-08-16 08:37:30.763463
e00d7745-7bf7-41eb-8c3c-7996d963cb7f	688763fc-0d35-4e97-8d09-d5a55639c4e7	\N	login	Connexion de admin@lgp.com	2026-08-16 08:39:56.342358
fd166e9e-dc2a-4b5a-95e2-13791a061cbe	938e437c-866e-4719-b098-6d5fd8a5ebd2	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de faustin@lgp.com	2026-08-16 08:41:54.594757
d44c8eb7-3226-4386-a8fb-6ca661667b97	00ac7b8a-0976-4311-87c6-efa3ddbd2395	\N	login	Connexion de gratianokakpo@gmail.com	2026-08-16 09:21:16.820492
0c32e22a-b802-4eb1-976d-a74d644c097b	688763fc-0d35-4e97-8d09-d5a55639c4e7	\N	login	Connexion de admin@lgp.com	2026-08-16 09:22:14.11709
9bdc8a13-1d56-462b-a9d3-f40496eacf34	945cc86e-d646-42c2-8cfc-1485651c7de2	1e1be1d6-ce82-4abb-9a59-752d2ca8d9fb	login	Connexion de guezo@lgp.com	2026-08-16 09:23:01.138507
93734780-08b8-4024-bb29-90fb0a4cff12	00ac7b8a-0976-4311-87c6-efa3ddbd2395	1e1be1d6-ce82-4abb-9a59-752d2ca8d9fb	create_reservation	Demande 1x paracetamol	2026-08-16 09:25:58.748581
ecbcbe47-530a-4d34-a0cf-55b131e6e506	945cc86e-d646-42c2-8cfc-1485651c7de2	1e1be1d6-ce82-4abb-9a59-752d2ca8d9fb	login	Connexion de guezo@lgp.com	2026-08-16 09:30:06.087487
5b931750-5ab3-47a6-8b61-923e17341fb2	938e437c-866e-4719-b098-6d5fd8a5ebd2	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de faustin@lgp.com	2026-08-16 10:20:29.274399
82e4bf46-9e06-44ae-8489-3ba75d690a75	945cc86e-d646-42c2-8cfc-1485651c7de2	1e1be1d6-ce82-4abb-9a59-752d2ca8d9fb	login	Connexion de guezo@lgp.com	2026-08-16 10:21:46.30916
b491deda-9be3-47bf-bcab-b819e74c6e29	945cc86e-d646-42c2-8cfc-1485651c7de2	1e1be1d6-ce82-4abb-9a59-752d2ca8d9fb	login	Connexion de guezo@lgp.com	2026-08-16 10:27:18.2213
5cef6f08-d8a3-4f9e-b055-96efcf741f60	945cc86e-d646-42c2-8cfc-1485651c7de2	1e1be1d6-ce82-4abb-9a59-752d2ca8d9fb	login	Connexion de guezo@lgp.com	2026-08-16 10:54:31.628874
841b8ae1-dab5-4c44-afc9-831375229f56	0dd993d8-c840-44d3-9e32-c98a8154b486	\N	login	Connexion de soggagtkohhffshh@gmail.com	2026-08-16 15:26:09.148398
c95faa1b-98df-4f84-bc49-8873c5ce3726	0dd993d8-c840-44d3-9e32-c98a8154b486	\N	login	Connexion de soggagtkohhffshh@gmail.com	2026-08-16 15:43:20.907882
f1644a50-635f-44cd-990c-ba30bcc791b0	945cc86e-d646-42c2-8cfc-1485651c7de2	1e1be1d6-ce82-4abb-9a59-752d2ca8d9fb	login	Connexion de guezo@lgp.com	2026-08-16 20:40:49.149967
5fd107ae-ca37-4a5a-a0c4-1a304ace3a6a	688763fc-0d35-4e97-8d09-d5a55639c4e7	\N	login	Connexion de admin@lgp.com	2026-08-16 20:57:32.536326
194f31f6-1bbe-41f2-b1bb-ba298be6d8df	945cc86e-d646-42c2-8cfc-1485651c7de2	1e1be1d6-ce82-4abb-9a59-752d2ca8d9fb	login	Connexion de guezo@lgp.com	2026-08-16 21:22:07.881891
a24dbb66-b7d5-450c-9652-ba75cf49bb38	938e437c-866e-4719-b098-6d5fd8a5ebd2	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de faustin@lgp.com	2026-08-16 21:29:04.892795
63d04357-0820-411c-aa7b-ceee431bd515	62780864-f8a9-4093-a6de-97ad01e819dc	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de jacques@lgp.com	2026-08-16 21:34:25.186631
529595a4-0a74-4e9c-93ee-25f1d414208d	0dd993d8-c840-44d3-9e32-c98a8154b486	\N	login	Connexion de soggagtkohhffshh@gmail.com	2026-08-17 19:22:36.405628
b4d24154-59ca-4e29-afec-33d59372973a	0cf7cbb1-f966-4d0f-8591-9d3af6edad5b	\N	login	Connexion de faustinsogadji@gmail.com	2026-08-17 19:26:49.085284
68293171-726b-418a-85d1-2bbba445c614	938e437c-866e-4719-b098-6d5fd8a5ebd2	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de faustin@lgp.com	2026-08-17 22:20:40.006583
dbdf06be-4077-4020-b84a-f03f3742073d	62780864-f8a9-4093-a6de-97ad01e819dc	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de jacques@lgp.com	2026-08-17 22:21:38.083902
5c6f23d1-cade-4e24-8cab-bd9f994d3f4a	00ac7b8a-0976-4311-87c6-efa3ddbd2395	\N	login	Connexion de gratianokakpo@gmail.com	2026-08-17 22:23:30.981912
d78bcae2-3f48-4363-b188-29930a39e3b4	938e437c-866e-4719-b098-6d5fd8a5ebd2	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de faustin@lgp.com	2026-08-18 05:42:51.886332
c6ad09d5-d09d-4440-afd0-26409459c345	938e437c-866e-4719-b098-6d5fd8a5ebd2	46694505-c4b9-4ab1-9900-de3663ec1d6e	create_staff	Compte lab_technician cree: JUlie	2026-08-18 05:44:14.063435
9d8b6cfb-a5c8-4ee8-b276-9901b9537945	820ce384-262f-4554-b770-7ab4c6332919	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de julie@lgp.com	2026-08-18 05:45:55.243141
d48b1ba8-4482-4d22-b3ad-c94cb1473682	938e437c-866e-4719-b098-6d5fd8a5ebd2	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de faustin@lgp.com	2026-08-18 10:16:16.108528
0e518c57-30ff-4ff2-aabb-efef33aa2dc2	938e437c-866e-4719-b098-6d5fd8a5ebd2	46694505-c4b9-4ab1-9900-de3663ec1d6e	create_staff	Compte secretary cree: karli	2026-08-18 10:17:24.462142
fb35ff87-9f96-42b2-8f12-6f9bbec35750	e008cfa7-4777-4ee2-8e30-b64ec930893f	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de karli@lgp.com	2026-08-18 10:18:38.192734
8d5c8b42-0665-4042-ab2b-5fd3996395dd	e008cfa7-4777-4ee2-8e30-b64ec930893f	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de karli@lgp.com	2026-08-18 10:23:35.80961
327b65f6-be74-493d-ab0d-bb1580a9af4c	938e437c-866e-4719-b098-6d5fd8a5ebd2	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de faustin@lgp.com	2026-08-18 12:22:08.811886
8754fa58-8590-43fc-b9bb-8e7085760a51	688763fc-0d35-4e97-8d09-d5a55639c4e7	\N	login	Connexion de admin@lgp.com	2026-08-18 12:31:57.697242
8a607fdf-95fd-49cb-ad38-7a1fbb789fc1	5c5d697b-9cff-4403-af99-372f5a1801fe	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de florentine@lgp.com	2026-08-18 12:38:16.834643
7ac1866d-f4f5-4278-8185-44abce12c838	c588c4e7-a4bd-43fd-8b7f-d7bf27b9ffc4	809e2ffc-6f82-426c-9a2a-56023fd30d47	login	Connexion de janvier@lgp.com	2026-08-18 12:40:43.930941
10d13969-d393-4be2-a133-d817e5b19fd8	c588c4e7-a4bd-43fd-8b7f-d7bf27b9ffc4	809e2ffc-6f82-426c-9a2a-56023fd30d47	mark_arrived	RDV 15f0b7bd-b8a2-4187-b6c1-90c45452d5ba marque arrive	2026-08-18 12:41:29.182274
f5f84eb6-be07-49f6-a854-26113e5fa686	0cf7cbb1-f966-4d0f-8591-9d3af6edad5b	\N	login	Connexion de faustinsogadji@gmail.com	2026-08-18 12:43:45.682955
9ed001c1-1f32-4606-b610-6df742ebf9de	688763fc-0d35-4e97-8d09-d5a55639c4e7	\N	login	Connexion de admin@lgp.com	2026-08-18 12:47:35.647311
41404b23-8d53-4c91-8f57-ccc820217e60	945cc86e-d646-42c2-8cfc-1485651c7de2	1e1be1d6-ce82-4abb-9a59-752d2ca8d9fb	login	Connexion de guezo@lgp.com	2026-08-18 12:48:37.267948
35f82817-fec3-43f2-8892-e501a1d3aded	00ac7b8a-0976-4311-87c6-efa3ddbd2395	\N	login	Connexion de gratianokakpo@gmail.com	2026-08-18 12:52:42.192841
91dae7e4-e635-42a8-ba5d-b478daf5968f	945cc86e-d646-42c2-8cfc-1485651c7de2	1e1be1d6-ce82-4abb-9a59-752d2ca8d9fb	login	Connexion de guezo@lgp.com	2026-08-18 12:57:08.072892
c6ada92d-f7f2-4c59-914b-8212065f17b9	938e437c-866e-4719-b098-6d5fd8a5ebd2	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de faustin@lgp.com	2026-08-18 12:59:48.998726
6d20734b-c377-46f5-adcb-20510df05cc6	688763fc-0d35-4e97-8d09-d5a55639c4e7	\N	login	Connexion de admin@lgp.com	2026-08-18 13:03:15.957626
adeefb69-2bad-40c2-b63d-6615df2bc1a1	0cf7cbb1-f966-4d0f-8591-9d3af6edad5b	\N	login	Connexion de faustinsogadji@gmail.com	2026-08-18 17:20:23.228634
cbe0b5c4-3aaa-4d6e-bb6e-108d034fd423	00ac7b8a-0976-4311-87c6-efa3ddbd2395	\N	login	Connexion de gratianokakpo@gmail.com	2026-08-19 14:43:20.851849
9d743a1e-caee-4e7a-af4e-ea1315e11a3c	688763fc-0d35-4e97-8d09-d5a55639c4e7	\N	login	Connexion de admin@lgp.com	2026-08-19 14:44:21.371042
79b14622-2b48-4f43-a717-fd9dd3aed00c	688763fc-0d35-4e97-8d09-d5a55639c4e7	950825b7-a8c9-4bb9-a298-2dc6069ee5ae	suspend_establishment	Statut mis a jour: is_active=False	2026-08-19 14:45:13.801911
81d18bf4-303a-4ff7-906c-192254169de4	688763fc-0d35-4e97-8d09-d5a55639c4e7	\N	login	Connexion de admin@lgp.com	2026-08-19 15:15:23.385781
bf96101f-4af5-4ef6-b4ee-7dd164f45411	688763fc-0d35-4e97-8d09-d5a55639c4e7	\N	login	Connexion de admin@lgp.com	2026-08-19 15:27:16.038706
3d925fc3-9774-4fbd-9224-e7894528c03c	688763fc-0d35-4e97-8d09-d5a55639c4e7	\N	login	Connexion de admin@lgp.com	2026-08-19 15:39:27.33891
a4d13e4c-01a1-41c2-8443-3ce8e545c6cb	688763fc-0d35-4e97-8d09-d5a55639c4e7	03c05829-db0e-4228-b750-2017c8292615	create_establishment	Creation de saint abel	2026-08-19 15:41:14.89282
995836c4-1e07-46e2-aa5c-bcd952f88c8e	f502a79f-bdc8-4a5f-9bab-0f3c69430061	03c05829-db0e-4228-b750-2017c8292615	login	Connexion de abel@lgp.com	2026-08-19 15:42:50.047769
4b17fb80-5e77-4542-94f1-29da3fac5fc6	0cf7cbb1-f966-4d0f-8591-9d3af6edad5b	\N	login	Connexion de faustinsogadji@gmail.com	2026-08-19 15:47:47.31902
15daf8b2-3800-4aed-a3fb-8bad856ab1fe	0cf7cbb1-f966-4d0f-8591-9d3af6edad5b	03c05829-db0e-4228-b750-2017c8292615	create_reservation	Demande 1x dolipranne	2026-08-19 15:47:55.816372
e4f24c26-cbdb-40a4-b61b-7d78cb5a0641	f502a79f-bdc8-4a5f-9bab-0f3c69430061	03c05829-db0e-4228-b750-2017c8292615	login	Connexion de abel@lgp.com	2026-08-19 16:18:53.539391
f72a3b4d-44fb-4b5f-8ee2-dffc1eb30fe4	e21cc5ac-1cec-4409-94f4-4833e19c2e67	\N	login	Connexion de mama@lgp.com	2026-08-19 16:30:14.858323
0aa1dc65-faa6-46b7-b6e9-7cc6d0abf57b	e21cc5ac-1cec-4409-94f4-4833e19c2e67	03c05829-db0e-4228-b750-2017c8292615	create_reservation	Demande 1x dolipranne	2026-08-19 16:30:28.773295
4044ba56-1ed1-4107-bd03-4eacbab17c1e	938e437c-866e-4719-b098-6d5fd8a5ebd2	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de faustin@lgp.com	2026-08-19 16:37:47.927855
112f8919-28ec-4a19-8065-e47589ab8c1d	e21cc5ac-1cec-4409-94f4-4833e19c2e67	46694505-c4b9-4ab1-9900-de3663ec1d6e	create_appointment	RDV cree pour patient PAT-6AC23137	2026-08-19 16:46:48.188626
551952c1-7584-44da-ae0d-4113938c6d91	938e437c-866e-4719-b098-6d5fd8a5ebd2	46694505-c4b9-4ab1-9900-de3663ec1d6e	mark_arrived	RDV b13917ba-9ee7-4644-9cb8-191f7b586815 marque arrive	2026-08-19 16:56:31.404602
402c80f1-a747-4f62-8edc-3ea81e2b498c	5c5d697b-9cff-4403-af99-372f5a1801fe	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de florentine@lgp.com	2026-08-19 17:00:16.188385
15aca5ca-2eab-42fa-8ba7-6a7f429c0a59	5c5d697b-9cff-4403-af99-372f5a1801fe	46694505-c4b9-4ab1-9900-de3663ec1d6e	complete_appointment	RDV b13917ba-9ee7-4644-9cb8-191f7b586815 marque termine	2026-08-19 17:02:04.53491
cd16061d-4de6-4250-bc1a-ec5cb9a6f18f	0cf7cbb1-f966-4d0f-8591-9d3af6edad5b	\N	login	Connexion de faustinsogadji@gmail.com	2026-08-19 20:54:19.172132
7d8c5e62-0574-4880-9f52-8d3c820a572b	0cf7cbb1-f966-4d0f-8591-9d3af6edad5b	\N	login	Connexion de faustinsogadji@gmail.com	2026-08-19 21:35:49.148828
e62f66b5-7c22-479c-bd23-0ad4a4ca3888	e21cc5ac-1cec-4409-94f4-4833e19c2e67	\N	login	Connexion de mama@lgp.com	2026-08-19 21:40:54.226527
7ab92a98-a87f-4b0a-a319-7b0ecb051f2e	688763fc-0d35-4e97-8d09-d5a55639c4e7	\N	login	Connexion de admin@lgp.com	2026-08-19 21:51:43.015762
fb1caeca-3d43-46b9-8797-e50b1cae19d6	945cc86e-d646-42c2-8cfc-1485651c7de2	1e1be1d6-ce82-4abb-9a59-752d2ca8d9fb	login	Connexion de guezo@lgp.com	2026-08-19 21:52:42.464571
50e565ae-7d07-4fa2-ab2e-200610104b40	0cf7cbb1-f966-4d0f-8591-9d3af6edad5b	\N	login	Connexion de faustinsogadji@gmail.com	2026-08-19 22:16:29.743387
754d417f-85bc-4e0b-a1c9-7d30a7a096af	0cf7cbb1-f966-4d0f-8591-9d3af6edad5b	\N	login	Connexion de faustinsogadji@gmail.com	2026-08-19 22:21:17.989547
7483b13b-e6a0-436f-902e-b3d7e110814c	0dd993d8-c840-44d3-9e32-c98a8154b486	\N	login	Connexion de soggagtkohhffshh@gmail.com	2026-08-19 22:21:38.337492
0d61e51f-3be3-46b0-8688-b7c18e20baf4	0dd993d8-c840-44d3-9e32-c98a8154b486	\N	login	Connexion de soggagtkohhffshh@gmail.com	2026-08-19 22:19:10.677132
77e5e850-dfa4-4326-b91a-764777e21fbd	0cf7cbb1-f966-4d0f-8591-9d3af6edad5b	\N	login	Connexion de faustinsogadji@gmail.com	2026-08-19 22:21:09.766375
89b59c4d-5f18-452f-b315-ac84e7876d82	0cf7cbb1-f966-4d0f-8591-9d3af6edad5b	\N	login	Connexion de faustinsogadji@gmail.com	2026-08-19 22:21:09.796168
f6b1b412-67ce-439c-aa48-18fed4b7b243	868333e7-6a2f-4960-8537-d20b3c0c622c	\N	login	Connexion de yath@lgp.com	2026-08-20 00:56:13.138588
bb7c0f9c-6d66-4fe7-987d-c8e078586d23	0dd993d8-c840-44d3-9e32-c98a8154b486	\N	login	Connexion de soggagtkohhffshh@gmail.com	2026-08-20 16:15:48.000074
ff4386f2-29e5-4103-bda7-2e19361499bb	c588c4e7-a4bd-43fd-8b7f-d7bf27b9ffc4	809e2ffc-6f82-426c-9a2a-56023fd30d47	login	Connexion de janvier@lgp.com	2026-08-20 19:00:58.521009
9674cfa7-0d1d-48fe-a23b-97557341ca72	688763fc-0d35-4e97-8d09-d5a55639c4e7	\N	login	Connexion de admin@lgp.com	2026-08-20 19:04:19.962223
0ce6a208-b0b1-4803-871f-fce26224b57a	c588c4e7-a4bd-43fd-8b7f-d7bf27b9ffc4	809e2ffc-6f82-426c-9a2a-56023fd30d47	login	Connexion de janvier@lgp.com	2026-08-20 20:28:38.347927
7b4bec92-4df6-42e3-ac57-159e2a743063	c588c4e7-a4bd-43fd-8b7f-d7bf27b9ffc4	809e2ffc-6f82-426c-9a2a-56023fd30d47	login	Connexion de janvier@lgp.com	2026-08-20 20:29:12.891199
c698c81e-8d5d-4042-b9eb-d65ec054c5bb	688763fc-0d35-4e97-8d09-d5a55639c4e7	\N	login	Connexion de admin@lgp.com	2026-08-20 22:45:23.313447
a16855c2-9d16-4068-9601-c285fad2ba12	c588c4e7-a4bd-43fd-8b7f-d7bf27b9ffc4	809e2ffc-6f82-426c-9a2a-56023fd30d47	login	Connexion de janvier@lgp.com	2026-08-21 02:30:34.771079
291eb6a4-6f8e-4940-9a8b-86ef0dd1620b	c588c4e7-a4bd-43fd-8b7f-d7bf27b9ffc4	809e2ffc-6f82-426c-9a2a-56023fd30d47	login	Connexion de janvier@lgp.com	2026-08-21 02:33:31.954937
c2cb85ef-49e4-47ff-bf4c-8545993f3c14	688763fc-0d35-4e97-8d09-d5a55639c4e7	\N	login	Connexion de admin@lgp.com	2026-08-21 02:34:48.904543
bc72432d-2404-49d7-acf8-49ef3ee81009	688763fc-0d35-4e97-8d09-d5a55639c4e7	\N	login	Connexion de admin@lgp.com	2026-08-21 02:36:27.40145
9933e125-50e7-4f52-a020-426d4b985014	688763fc-0d35-4e97-8d09-d5a55639c4e7	\N	login	Connexion de admin@lgp.com	2026-08-21 02:42:01.375361
d8e96082-d9a6-4476-a2e7-c2e88c5a078b	688763fc-0d35-4e97-8d09-d5a55639c4e7	829ed990-52d2-4efe-8355-9fad3b81df54	create_establishment	Creation de Quest	2026-08-21 02:45:10.471281
c6ba658f-2ec1-49f4-b42c-985f44771a4e	fbbd966e-00ba-418a-accd-6cb962d988de	829ed990-52d2-4efe-8355-9fad3b81df54	login	Connexion de quest@lgp.com	2026-08-21 02:45:25.158861
239f3ddc-8ae4-48ca-8de7-8bd0cef0b501	c588c4e7-a4bd-43fd-8b7f-d7bf27b9ffc4	809e2ffc-6f82-426c-9a2a-56023fd30d47	login	Connexion de janvier@lgp.com	2026-08-21 02:50:52.108532
783dbba2-6411-431f-84ba-b526bbef14bc	688763fc-0d35-4e97-8d09-d5a55639c4e7	\N	login	Connexion de admin@lgp.com	2026-08-21 02:51:18.770364
e987f4c3-000d-4f01-9213-9b550ccb5f74	0dd993d8-c840-44d3-9e32-c98a8154b486	\N	login	Connexion de soggagtkohhffshh@gmail.com	2026-08-21 03:00:50.221402
406d029c-5a10-4987-b26a-4beaf81f4d8a	0dd993d8-c840-44d3-9e32-c98a8154b486	\N	login	Connexion de soggagtkohhffshh@gmail.com	2026-08-21 03:01:08.353256
677fce1e-fa88-4924-810a-16a1b250e6c4	5c5d697b-9cff-4403-af99-372f5a1801fe	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de florentine@lgp.com	2026-08-21 13:32:01.730018
27951f02-76e5-4fc2-8187-25968033a528	5c5d697b-9cff-4403-af99-372f5a1801fe	46694505-c4b9-4ab1-9900-de3663ec1d6e	create_medical_document	Document 'ythggdd' ajoute au dossier	2026-08-21 13:46:59.728477
0df7d883-f608-44aa-ad46-088f7f188d3c	e21cc5ac-1cec-4409-94f4-4833e19c2e67	\N	login	Connexion de mama@lgp.com	2026-08-21 13:50:34.777105
4a03d3aa-9a39-41a7-89a3-6fe4930e5f1f	5c5d697b-9cff-4403-af99-372f5a1801fe	46694505-c4b9-4ab1-9900-de3663ec1d6e	create_medical_document	Document ' nbb' ajoute au dossier	2026-08-21 13:56:11.769058
60abd03e-596b-4e84-85da-5cf878d99808	e21cc5ac-1cec-4409-94f4-4833e19c2e67	03c05829-db0e-4228-b750-2017c8292615	create_reservation	Demande: 4x dolipranne	2026-08-21 14:00:06.231991
ebf617a5-1ca5-415b-9c20-34dee409ecbb	938e437c-866e-4719-b098-6d5fd8a5ebd2	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de faustin@lgp.com	2026-08-21 14:19:10.518283
ab8c5c64-b12e-4d5f-b069-ea3a127c0529	820ce384-262f-4554-b770-7ab4c6332919	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de julie@lgp.com	2026-08-21 14:32:10.996965
ed46d669-b80f-4030-992a-2e6a9c9ffcd9	938e437c-866e-4719-b098-6d5fd8a5ebd2	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de faustin@lgp.com	2026-08-21 14:38:03.527238
b3588045-dddb-40b2-bf21-0201ee622f24	938e437c-866e-4719-b098-6d5fd8a5ebd2	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de faustin@lgp.com	2026-08-21 14:40:23.323964
58a986f8-f467-46a7-9a1d-a930b529a178	e008cfa7-4777-4ee2-8e30-b64ec930893f	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de karli@lgp.com	2026-08-21 14:40:55.556162
eb163f99-1d6e-4a0f-b7dd-3393f7c7f5f1	c588c4e7-a4bd-43fd-8b7f-d7bf27b9ffc4	809e2ffc-6f82-426c-9a2a-56023fd30d47	login	Connexion de janvier@lgp.com	2026-08-21 14:54:46.564971
99295d6c-fa03-4822-ac1f-79f291075ce1	c588c4e7-a4bd-43fd-8b7f-d7bf27b9ffc4	809e2ffc-6f82-426c-9a2a-56023fd30d47	login	Connexion de janvier@lgp.com	2026-08-21 15:01:11.673807
13ecee6a-2668-43a8-8943-ff83e5061d05	5c5d697b-9cff-4403-af99-372f5a1801fe	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de florentine@lgp.com	2026-08-21 15:06:07.117238
a6c2dfcd-aa70-4188-b339-0a9f32cdda97	e21cc5ac-1cec-4409-94f4-4833e19c2e67	\N	login	Connexion de mama@lgp.com	2026-08-21 15:19:28.169669
859a9d3f-1d14-4ff7-8f04-cd1bdeedded5	5c5d697b-9cff-4403-af99-372f5a1801fe	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de florentine@lgp.com	2026-08-21 15:26:19.376261
92b7bf06-0d36-48dd-802b-135a0a294c97	5c5d697b-9cff-4403-af99-372f5a1801fe	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de florentine@lgp.com	2026-08-21 15:38:52.214777
358ea125-4db4-4ea7-9d21-a5546bc36fc2	5c5d697b-9cff-4403-af99-372f5a1801fe	46694505-c4b9-4ab1-9900-de3663ec1d6e	create_medical_document	Document 'gffgff' ajoute au dossier	2026-08-21 16:06:45.802065
14d9c183-426f-49e0-be35-c542b1ca11d7	5c5d697b-9cff-4403-af99-372f5a1801fe	46694505-c4b9-4ab1-9900-de3663ec1d6e	create_medical_document	Document 'nhjhjhjjkkk' ajoute au dossier	2026-08-21 16:07:04.661189
aa75254a-d4ce-449a-bd47-47a2e44aa3b5	5c5d697b-9cff-4403-af99-372f5a1801fe	46694505-c4b9-4ab1-9900-de3663ec1d6e	create_medical_document	Document 'jbhhjhb' ajoute au dossier	2026-08-21 16:07:19.086378
b4a4604e-a2f5-4b6a-bbab-dd2f97c84da1	5c5d697b-9cff-4403-af99-372f5a1801fe	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de florentine@lgp.com	2026-08-21 16:11:33.395231
48b412e7-4c95-4d94-8115-9caebe5e0316	5c5d697b-9cff-4403-af99-372f5a1801fe	46694505-c4b9-4ab1-9900-de3663ec1d6e	create_medical_document	Document 'Medical ' ajoute au dossier	2026-08-21 16:15:01.822821
3b4ce604-ce1b-4bc5-a559-727ed09c9bc5	5c5d697b-9cff-4403-af99-372f5a1801fe	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de florentine@lgp.com	2026-08-21 16:15:32.527471
8ee03d43-6213-42a2-8de3-b6caec7db211	a60ce078-8e25-42da-8578-ebf256693e65	809e2ffc-6f82-426c-9a2a-56023fd30d47	login	Connexion de lyamdoki54@gmail.com	2026-08-21 18:53:19.999094
9019ed43-8e6b-4815-b8d3-8397025e238a	5c5d697b-9cff-4403-af99-372f5a1801fe	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de florentine@lgp.com	2026-08-21 18:59:10.650409
cdfe2e3a-e49f-4518-8e3b-262152d83cee	938e437c-866e-4719-b098-6d5fd8a5ebd2	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de faustin@lgp.com	2026-08-22 01:08:21.637447
d9d5931c-6302-4236-aeb6-da0f3563c35c	938e437c-866e-4719-b098-6d5fd8a5ebd2	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de faustin@lgp.com	2026-08-22 01:19:47.410009
ca2c81f0-5d9a-44bc-9b44-faf6c7630c2c	938e437c-866e-4719-b098-6d5fd8a5ebd2	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de faustin@lgp.com	2026-08-22 16:15:22.914914
eb297957-27be-4bb6-aed6-fc9b0a711aab	938e437c-866e-4719-b098-6d5fd8a5ebd2	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de faustin@lgp.com	2026-08-22 16:27:31.40745
2a6f1a5f-213f-4677-9ca6-9f48ae11a1c1	938e437c-866e-4719-b098-6d5fd8a5ebd2	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de faustin@lgp.com	2026-08-22 16:51:17.70838
e4b537ab-635f-4d16-a2e6-fac19d32c88f	5c5d697b-9cff-4403-af99-372f5a1801fe	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de florentine@lgp.com	2026-08-22 16:53:47.121667
6d19c4a0-fb4f-41dd-b123-e93248400d74	fbbd966e-00ba-418a-accd-6cb962d988de	829ed990-52d2-4efe-8355-9fad3b81df54	login	Connexion de quest@lgp.com	2026-08-22 20:56:22.410905
220664c1-7317-4412-8c76-7d459b3f2da8	c588c4e7-a4bd-43fd-8b7f-d7bf27b9ffc4	809e2ffc-6f82-426c-9a2a-56023fd30d47	login	Connexion de janvier@lgp.com	2026-08-22 20:58:00.091992
18c91202-445e-4815-a9cb-9d18fca8d217	c588c4e7-a4bd-43fd-8b7f-d7bf27b9ffc4	809e2ffc-6f82-426c-9a2a-56023fd30d47	login	Connexion de janvier@lgp.com	2026-08-22 21:04:15.896678
5f14194c-fd62-401c-a5d8-8337d282c771	c588c4e7-a4bd-43fd-8b7f-d7bf27b9ffc4	809e2ffc-6f82-426c-9a2a-56023fd30d47	login	Connexion de janvier@lgp.com	2026-08-22 21:17:44.68295
76e5ab9c-de01-42bc-af0c-46c45c7d7ab0	5c5d697b-9cff-4403-af99-372f5a1801fe	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de florentine@lgp.com	2026-08-22 21:18:53.839642
c149f1d6-51be-4746-b39a-cc18b97589bb	5c5d697b-9cff-4403-af99-372f5a1801fe	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de florentine@lgp.com	2026-08-22 21:20:00.984014
e03e00da-aff1-483a-8440-fe6ea9adc3ec	e21cc5ac-1cec-4409-94f4-4833e19c2e67	\N	login	Connexion de mama@lgp.com	2026-08-22 21:21:04.384214
5f4159c6-7e44-4f45-9873-6784cfc46c3c	c588c4e7-a4bd-43fd-8b7f-d7bf27b9ffc4	809e2ffc-6f82-426c-9a2a-56023fd30d47	login	Connexion de janvier@lgp.com	2026-08-22 21:26:01.050785
09fc6ae8-4a47-4673-aed7-51a4691e783b	a60ce078-8e25-42da-8578-ebf256693e65	809e2ffc-6f82-426c-9a2a-56023fd30d47	login	Connexion de lyamdoki54@gmail.com	2026-08-22 21:26:46.789429
9d870144-cf0a-44f0-a7d3-e45c3e9240f0	a60ce078-8e25-42da-8578-ebf256693e65	809e2ffc-6f82-426c-9a2a-56023fd30d47	login	Connexion de lyamdoki54@gmail.com	2026-08-22 21:27:05.875552
9b480760-c82c-4928-99ac-62aaf08fcd73	c588c4e7-a4bd-43fd-8b7f-d7bf27b9ffc4	809e2ffc-6f82-426c-9a2a-56023fd30d47	login	Connexion de janvier@lgp.com	2026-08-22 21:27:29.906863
be20aed6-3eb7-43c3-b59b-c0fa3759fcda	0dd993d8-c840-44d3-9e32-c98a8154b486	\N	login	Connexion de soggagtkohhffshh@gmail.com	2026-08-22 21:28:39.678503
1d07bf91-8a89-43f9-90fd-8e7ca52eaade	0dd993d8-c840-44d3-9e32-c98a8154b486	\N	login	Connexion de soggagtkohhffshh@gmail.com	2026-08-22 21:29:14.59879
11cdc547-ce36-40f9-ab43-47c819b985c1	5c5d697b-9cff-4403-af99-372f5a1801fe	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de florentine@lgp.com	2026-08-22 21:29:56.997982
f5942f1f-58e5-497a-a732-c96503c01d60	5c5d697b-9cff-4403-af99-372f5a1801fe	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de florentine@lgp.com	2026-08-22 21:32:37.009961
a207df83-be60-40d4-94cd-fe38586cb896	c588c4e7-a4bd-43fd-8b7f-d7bf27b9ffc4	809e2ffc-6f82-426c-9a2a-56023fd30d47	login	Connexion de janvier@lgp.com	2026-08-22 21:33:59.046824
2734b8cc-a8aa-441a-aca9-9f89b90f22a3	e008cfa7-4777-4ee2-8e30-b64ec930893f	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de karli@lgp.com	2026-08-22 21:39:22.780844
0cb161b1-bcc3-473d-bb60-41eddb22fa31	688763fc-0d35-4e97-8d09-d5a55639c4e7	\N	login	Connexion de admin@lgp.com	2026-08-22 21:46:52.956481
dfb8c398-78ae-4796-b736-edf0d725a537	5c5d697b-9cff-4403-af99-372f5a1801fe	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de florentine@lgp.com	2026-08-24 17:35:24.467317
09727bea-a4ae-4226-a21d-edec67593ffd	0cf7cbb1-f966-4d0f-8591-9d3af6edad5b	\N	login	Connexion de faustinsogadji@gmail.com	2026-08-25 13:00:45.395841
b6a83980-4040-4aea-8edc-b4f59862ec0a	e21cc5ac-1cec-4409-94f4-4833e19c2e67	\N	login	Connexion de mama@lgp.com	2026-08-25 13:01:53.926556
03b87d22-625b-4d77-8bc1-d7093c794148	938e437c-866e-4719-b098-6d5fd8a5ebd2	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de faustin@lgp.com	2026-08-26 08:57:13.454975
91e61430-cfda-40a5-ae95-185c9c7da12a	00ac7b8a-0976-4311-87c6-efa3ddbd2395	\N	login	Connexion de gratianokakpo@gmail.com	2026-08-26 09:06:12.996798
56a034fa-b602-46f6-90cf-1231b5e65d86	938e437c-866e-4719-b098-6d5fd8a5ebd2	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de faustin@lgp.com	2026-08-27 16:00:30.632422
2782f506-1795-48fb-a996-c716bb1123a5	938e437c-866e-4719-b098-6d5fd8a5ebd2	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de faustin@lgp.com	2026-08-27 16:09:15.357588
c523c5c8-8ab9-47a1-9941-99119b707382	938e437c-866e-4719-b098-6d5fd8a5ebd2	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de faustin@lgp.com	2026-08-27 16:14:05.573316
5810f5b3-1dec-49ea-ae17-d68c95f7bc61	938e437c-866e-4719-b098-6d5fd8a5ebd2	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de faustin@lgp.com	2026-08-27 16:21:35.288246
25ede84f-a1ed-4d0a-89c4-75268e796d28	938e437c-866e-4719-b098-6d5fd8a5ebd2	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de faustin@lgp.com	2026-08-27 16:34:43.956186
d5fe3cc7-7833-46a8-8fe4-3568b4b7458a	938e437c-866e-4719-b098-6d5fd8a5ebd2	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de faustin@lgp.com	2026-08-27 16:53:38.61365
4115fd9c-7d33-4444-bfed-df5207a7984d	938e437c-866e-4719-b098-6d5fd8a5ebd2	46694505-c4b9-4ab1-9900-de3663ec1d6e	create_staff	Compte accountant cree: joe	2026-08-27 17:21:39.136949
49097862-b995-4081-a0b4-d4c9f8fccba9	938e437c-866e-4719-b098-6d5fd8a5ebd2	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de faustin@lgp.com	2026-08-27 17:23:35.766466
f09f51f8-3644-473e-b68b-4bb584a68f2b	938e437c-866e-4719-b098-6d5fd8a5ebd2	46694505-c4b9-4ab1-9900-de3663ec1d6e	create_department	Departement cree: Finance	2026-08-27 17:23:59.901951
7273aefc-ed35-433d-9e26-3ab14c4d58f8	938e437c-866e-4719-b098-6d5fd8a5ebd2	46694505-c4b9-4ab1-9900-de3663ec1d6e	create_staff	Compte accountant cree: Roger	2026-08-27 17:25:13.290393
c7467b6e-ad4e-47e5-9bcf-99855a8dae43	5c5d697b-9cff-4403-af99-372f5a1801fe	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de florentine@lgp.com	2026-08-27 20:40:05.860895
39eab8fa-edce-4709-8930-e644b13b5a33	fbbd966e-00ba-418a-accd-6cb962d988de	829ed990-52d2-4efe-8355-9fad3b81df54	login	Connexion de quest@lgp.com	2026-08-27 20:41:07.658998
10b6c046-4eda-4283-b570-91a6abe323e3	c588c4e7-a4bd-43fd-8b7f-d7bf27b9ffc4	809e2ffc-6f82-426c-9a2a-56023fd30d47	login	Connexion de janvier@lgp.com	2026-08-27 20:59:01.075825
42714030-04bc-41ad-a5b2-46979a34dc37	c588c4e7-a4bd-43fd-8b7f-d7bf27b9ffc4	809e2ffc-6f82-426c-9a2a-56023fd30d47	login	Connexion de janvier@lgp.com	2026-08-27 21:00:40.258695
06fb4bdf-83f1-4e2f-81fd-f105aa7f1377	688763fc-0d35-4e97-8d09-d5a55639c4e7	\N	login	Connexion de admin@lgp.com	2026-08-27 21:01:00.470553
2822c265-f458-4267-92b6-9221f8bfa757	688763fc-0d35-4e97-8d09-d5a55639c4e7	809e2ffc-6f82-426c-9a2a-56023fd30d47	update_establishment	Modification de Janvier"Hospital	2026-08-27 21:02:17.505389
8f7b0bab-aff2-41e1-bb0b-892380fe9dcf	688763fc-0d35-4e97-8d09-d5a55639c4e7	5d0e9391-885a-4e2e-9168-1380f1e2c845	create_establishment	Creation de Lyam"Pharmacie	2026-08-27 21:06:22.845305
59a56a28-14d4-4242-8f3e-88b7ac708e1d	85b8e60f-641b-494e-a49a-09510e45b6f4	5d0e9391-885a-4e2e-9168-1380f1e2c845	login	Connexion de lpharmacie@lgp.com	2026-08-27 21:06:48.969663
22c026fc-6c4a-42d6-9281-23fe182e3dcb	fbbd966e-00ba-418a-accd-6cb962d988de	829ed990-52d2-4efe-8355-9fad3b81df54	login	Connexion de quest@lgp.com	2026-08-27 21:07:54.102904
9a940995-b025-48a8-9090-ebfa452a570c	688763fc-0d35-4e97-8d09-d5a55639c4e7	\N	login	Connexion de admin@lgp.com	2026-08-27 21:08:03.927058
0474ec1d-c7a0-481e-9b55-1efc057cd235	c588c4e7-a4bd-43fd-8b7f-d7bf27b9ffc4	809e2ffc-6f82-426c-9a2a-56023fd30d47	login	Connexion de janvier@lgp.com	2026-08-27 21:08:17.783513
4d633eae-3519-4ccb-9111-82b8b1d3bb5c	0dd993d8-c840-44d3-9e32-c98a8154b486	\N	login	Connexion de soggagtkohhffshh@gmail.com	2026-08-27 21:10:03.238002
dcbb0fe2-9d7c-45b2-8ca4-9e9daa0dc6b6	0dd993d8-c840-44d3-9e32-c98a8154b486	\N	login	Connexion de soggagtkohhffshh@gmail.com	2026-08-27 21:12:46.398818
6d341b8c-3d38-45d9-91d8-67cafa5d7248	fbbd966e-00ba-418a-accd-6cb962d988de	829ed990-52d2-4efe-8355-9fad3b81df54	login	Connexion de quest@lgp.com	2026-08-27 21:13:52.464187
22a6da60-7d05-4cf2-9f5d-a4df3707b923	0dd993d8-c840-44d3-9e32-c98a8154b486	\N	login	Connexion de soggagtkohhffshh@gmail.com	2026-08-27 21:14:48.757657
15694c89-57c5-453b-ae58-bbcb679118af	85b8e60f-641b-494e-a49a-09510e45b6f4	5d0e9391-885a-4e2e-9168-1380f1e2c845	login	Connexion de lpharmacie@lgp.com	2026-08-27 21:18:18.695684
fdf93bf5-0430-431d-89df-3572d54d248f	0dd993d8-c840-44d3-9e32-c98a8154b486	5d0e9391-885a-4e2e-9168-1380f1e2c845	create_reservation	Demande: 1x Mizagripe, 1x Paracetamole	2026-08-27 21:20:57.517982
ba3feba8-d762-408b-9e61-f0e09e8db594	0dd993d8-c840-44d3-9e32-c98a8154b486	5d0e9391-885a-4e2e-9168-1380f1e2c845	create_reservation	Demande: 1x Mizagripe, 1x Paracetamole	2026-08-27 21:21:02.90013
3f6dea68-bc57-4e9d-b3d5-0a70ce5acd5d	85b8e60f-641b-494e-a49a-09510e45b6f4	5d0e9391-885a-4e2e-9168-1380f1e2c845	login	Connexion de lpharmacie@lgp.com	2026-08-27 21:21:29.899343
88fbcf1c-0e02-4059-b705-4e464b79bad5	0dd993d8-c840-44d3-9e32-c98a8154b486	\N	login	Connexion de soggagtkohhffshh@gmail.com	2026-08-27 21:23:22.329368
7948f8b5-b969-46ef-bb40-cee7bce88296	0dd993d8-c840-44d3-9e32-c98a8154b486	\N	login	Connexion de soggagtkohhffshh@gmail.com	2026-08-27 21:24:35.405576
5e47d879-50c7-4f11-a296-56e178cb802f	0dd993d8-c840-44d3-9e32-c98a8154b486	\N	login	Connexion de soggagtkohhffshh@gmail.com	2026-08-27 21:25:32.741966
32a3f33e-70a2-4fc2-bdb4-0b30bb710609	e21cc5ac-1cec-4409-94f4-4833e19c2e67	\N	login	Connexion de mama@lgp.com	2026-08-27 21:29:58.861466
b5b0ac58-6481-42bf-95cc-2cc0a1b80af8	85b8e60f-641b-494e-a49a-09510e45b6f4	5d0e9391-885a-4e2e-9168-1380f1e2c845	login	Connexion de lpharmacie@lgp.com	2026-08-27 21:34:08.458753
b9c78fb9-b6e3-4dfa-8bec-b06a1b285055	938e437c-866e-4719-b098-6d5fd8a5ebd2	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de faustin@lgp.com	2026-08-28 07:08:21.254741
8116dfed-7a61-4d4c-85e4-9eeca92f9760	938e437c-866e-4719-b098-6d5fd8a5ebd2	46694505-c4b9-4ab1-9900-de3663ec1d6e	create_department	Departement cree: DRH	2026-08-28 07:10:02.490115
9d0e2809-fe3e-4bec-b0b8-4e08dfb85013	938e437c-866e-4719-b098-6d5fd8a5ebd2	46694505-c4b9-4ab1-9900-de3663ec1d6e	create_staff	Compte hr_manager cree: Loic	2026-08-28 07:12:14.863236
89932b5c-6557-4f99-8a75-79bdd51e5ff0	d5a3ff17-78e6-4cc0-a433-c2ac535e2fdb	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de loic@lgp.com	2026-08-28 08:04:53.397295
d801967e-2688-47b6-83b2-7470dc316df9	935c8d71-4888-43f6-b438-07cc7d8bee47	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de roger@lgp.com	2026-08-28 08:06:12.867689
dc154460-3067-495f-bcde-9726e1b244c6	d5a3ff17-78e6-4cc0-a433-c2ac535e2fdb	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de loic@lgp.com	2026-08-28 08:30:20.397241
c2f30376-d0bc-4dda-9f3b-960a505db97a	935c8d71-4888-43f6-b438-07cc7d8bee47	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de roger@lgp.com	2026-08-29 06:10:37.087682
6b65c24c-6629-41a9-917b-f440bafa1063	d5a3ff17-78e6-4cc0-a433-c2ac535e2fdb	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de loic@lgp.com	2026-08-29 06:11:51.084803
fe3d507b-7f9d-43ed-9ae1-8862766d0a11	938e437c-866e-4719-b098-6d5fd8a5ebd2	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de faustin@lgp.com	2026-08-29 06:14:09.330866
0bc627df-9821-4189-9c04-75ce1ef81654	820ce384-262f-4554-b770-7ab4c6332919	46694505-c4b9-4ab1-9900-de3663ec1d6e	login	Connexion de julie@lgp.com	2026-08-29 06:16:34.099444
\.


--
-- Data for Name: departments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.departments (id, establishment_id, name, head_user_id, created_at) FROM stdin;
5516cb2c-2370-4b92-a8bf-cc320b0715b9	46694505-c4b9-4ab1-9900-de3663ec1d6e	DRH	\N	2026-08-28 07:10:02.503628
12ab4b46-700d-4170-9729-e724ed9578bb	46694505-c4b9-4ab1-9900-de3663ec1d6e	Finance	935c8d71-4888-43f6-b438-07cc7d8bee47	2026-08-27 17:23:59.909959
\.


--
-- Data for Name: dependents; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.dependents (id, patient_id, full_name, relation_type, date_of_birth) FROM stdin;
\.


--
-- Data for Name: doctor_absences; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.doctor_absences (id, doctor_id, start_date, end_date, reason) FROM stdin;
\.


--
-- Data for Name: doctor_availabilities; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.doctor_availabilities (id, doctor_id, day_of_week, start_time, end_time, slot_duration_minutes) FROM stdin;
41c7c3d0-fd1a-411d-a997-48627a7594d6	071735a8-d8be-4a20-bee1-5c9648fc68b9	0	09:00:00	17:15:00	30
3dc7a7c3-4d47-4dae-a084-a23846cd8a67	071735a8-d8be-4a20-bee1-5c9648fc68b9	1	09:00:00	17:15:00	30
2d28825d-c9b7-45c7-adc9-79b2c91f2693	071735a8-d8be-4a20-bee1-5c9648fc68b9	3	09:00:00	17:15:00	30
b91c221b-a1f7-4cd0-8914-58b4cee15da5	071735a8-d8be-4a20-bee1-5c9648fc68b9	5	09:00:00	17:15:00	30
4a09bc1d-88dd-4a10-ae65-636bc20db361	cd7273b1-7381-4d84-b82a-e2f2c3d31629	3	09:00:00	12:00:00	20
3b661a08-9eaa-45ad-8aa3-2999a7c88e60	64ee4055-44d3-4550-81af-c51963bf2a4c	0	09:00:00	12:00:00	20
dd2f3ef5-2f67-411e-8c85-759de4f46371	64ee4055-44d3-4550-81af-c51963bf2a4c	2	09:00:00	12:00:00	20
857d0073-843f-4766-bc1b-0dbf52fa1c2f	64ee4055-44d3-4550-81af-c51963bf2a4c	5	09:00:00	12:00:00	20
e57ec4d1-6d32-44b4-839d-cae3d6b489df	9d861422-4a77-4b50-852d-2e975e61accd	3	09:00:00	23:59:00	30
\.


--
-- Data for Name: doctor_reviews; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.doctor_reviews (id, doctor_id, patient_id, rating, comment, created_at) FROM stdin;
e823d023-58d5-437b-a5c9-ffadda847b78	9d861422-4a77-4b50-852d-2e975e61accd	00ae470c-26a8-4992-8d50-9339aa8e5a70	5	Cc	2026-08-21 13:51:22.237846
\.


--
-- Data for Name: doctors; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.doctors (id, user_id, establishment_id, specialty, consultation_price, bio, photo_url, is_active) FROM stdin;
cd7273b1-7381-4d84-b82a-e2f2c3d31629	7d0aea7d-ca81-45da-9ea2-6c7b5ff310c7	46694505-c4b9-4ab1-9900-de3663ec1d6e	Gynecologue	5500	\N	\N	t
68b559de-a107-4f19-8195-f72cc7d1672e	46c6f882-b64c-469d-822d-77471ba29ff2	46694505-c4b9-4ab1-9900-de3663ec1d6e	Dentiste	6200	\N	\N	t
071735a8-d8be-4a20-bee1-5c9648fc68b9	d11244fa-3bcb-478f-85c7-957d76e650d4	809e2ffc-6f82-426c-9a2a-56023fd30d47	Cardiologue	4700	\N	\N	t
9d861422-4a77-4b50-852d-2e975e61accd	5c5d697b-9cff-4403-af99-372f5a1801fe	46694505-c4b9-4ab1-9900-de3663ec1d6e	Gynecologue	30	\N	\N	t
ef89618a-9666-4db1-bcbf-8e500665f9f1	62780864-f8a9-4093-a6de-97ad01e819dc	46694505-c4b9-4ab1-9900-de3663ec1d6e	Gynecologue	5800	\N	\N	t
64ee4055-44d3-4550-81af-c51963bf2a4c	9b1a8d30-b187-4ca2-bffe-9874335d812d	46694505-c4b9-4ab1-9900-de3663ec1d6e	Cardiologue	3654	\N	\N	t
55dc6698-8ab7-47e4-9855-606d178c01a2	390b3234-84c0-40b2-87af-391c37ad32b1	46694505-c4b9-4ab1-9900-de3663ec1d6e	Sage-femme	5000	\N	\N	t
ebe8ea8b-72fe-460b-8727-58a4ecbcea43	b5bf3c1e-0909-4669-8824-f6ea156abba1	46694505-c4b9-4ab1-9900-de3663ec1d6e	Dermatologue	2500	\N	\N	t
e92ea776-a103-4df1-b625-f5f5de2a0a7b	a60ce078-8e25-42da-8578-ebf256693e65	809e2ffc-6f82-426c-9a2a-56023fd30d47	Generaliste	2000	\N	\N	t
290cd882-31fe-4e2a-a0fa-d1e5f5cfa588	2bfd5fdf-8fb6-4d34-8948-a2f5c35f8b05	809e2ffc-6f82-426c-9a2a-56023fd30d47	Dentiste	2333	\N	\N	t
\.


--
-- Data for Name: equipment; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.equipment (id, establishment_id, name, status, notes, department_id, category, last_maintenance_date, next_maintenance_date) FROM stdin;
\.


--
-- Data for Name: establishments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.establishments (id, name, type, city, address, latitude, longitude, subscription_status, is_active, created_at) FROM stdin;
46694505-c4b9-4ab1-9900-de3663ec1d6e	fautin-cliniq	HOPITAL	Abomey-Calavi	womey,abomey-calavi	\N	\N	TRIAL	t	2026-08-04 12:32:27.202142
31f98de2-3365-434c-ba6c-16a4337272e9	Saint Jean	HOPITAL	abomey-calavi		\N	\N	TRIAL	t	2026-08-04 12:41:18.87932
008c1e3e-d05e-4387-9818-e4bd1d788548	rapide Analasyse	HOPITAL	cotonou	vedoko-marché	6.37737	2.38925	TRIAL	t	2026-08-08 08:28:57.818153
1e1be1d6-ce82-4abb-9a59-752d2ca8d9fb	pharma guezo	PHARMACIE	Coronou	vodjè	\N	\N	TRIAL	t	2026-08-15 06:20:48.060165
950825b7-a8c9-4bb9-a298-2dc6069ee5ae	Jean Labo	LABORATOIRE	Kpota	Abomey-Calavi	6.37055	2.03706	TRIAL	f	2026-08-09 15:47:35.946951
03c05829-db0e-4228-b750-2017c8292615	saint abel	PHARMACIE	tankpe		\N	\N	TRIAL	t	2026-08-19 15:41:14.670851
829ed990-52d2-4efe-8355-9fad3b81df54	Quest	LABORATOIRE	Cotonou		6.3654	2.4183	TRIAL	t	2026-08-21 02:45:10.254744
809e2ffc-6f82-426c-9a2a-56023fd30d47	Janvier"Hospital	HOPITAL	Cotonou	63,rue de l'Afrique	32	-16	TRIAL	t	2026-08-04 12:36:46.002337
5d0e9391-885a-4e2e-9168-1380f1e2c845	Lyam"Pharmacie	PHARMACIE	Godomey	312 First aid	-8	17	TRIAL	t	2026-08-27 21:06:22.642163
\.


--
-- Data for Name: inventory_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.inventory_items (id, establishment_id, name, category, quantity, unit, alert_threshold, created_at) FROM stdin;
\.


--
-- Data for Name: invoice_line_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.invoice_line_items (id, invoice_id, description, quantity, unit_price) FROM stdin;
\.


--
-- Data for Name: invoices; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.invoices (id, establishment_id, patient_id, issued_by_user_id, invoice_number, status, total_amount, notes, issued_at, due_date, appointment_id, admission_id) FROM stdin;
\.


--
-- Data for Name: lab_test_requests; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.lab_test_requests (id, establishment_id, patient_id, test_name, sample_type, status, scheduled_sample_at, results_text, lab_technician_note, created_at, sample_collected_at, results_validated_at, referred_by_establishment_id, referred_by_doctor_id) FROM stdin;
3d7ff222-dc98-4d90-8ed2-ac930cad30a3	829ed990-52d2-4efe-8355-9fad3b81df54	00ae470c-26a8-4992-8d50-9339aa8e5a70	hfgh	\N	REQUESTED	\N	\N	\N	2026-08-21 13:47:09.220638	\N	\N	46694505-c4b9-4ab1-9900-de3663ec1d6e	9d861422-4a77-4b50-852d-2e975e61accd
\.


--
-- Data for Name: leave_requests; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.leave_requests (id, establishment_id, user_id, start_date, end_date, reason, status, reviewed_by_user_id, reviewed_at, review_note, created_at) FROM stdin;
\.


--
-- Data for Name: medical_documents; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.medical_documents (id, appointment_id, patient_id, doctor_id, establishment_id, document_type, title, content, created_at, admission_id, author_user_id) FROM stdin;
ec7fe62f-3dbb-4e28-aa3a-ce63e754b97a	ef93761e-f19b-4713-bd46-ed447125de5b	47e6fc86-47cf-4c69-b3b7-492286674b5a	cd7273b1-7381-4d84-b82a-e2f2c3d31629	46694505-c4b9-4ab1-9900-de3663ec1d6e	CONSULTATION_NOTE	ordonance du 12 Aout	le patient a une anémie sevère et de manque calicium\nNB: acheter ferfordine , dicro et dormir plus	2026-08-13 09:47:07.303117	\N	\N
c11b7ac4-7041-427c-bdee-6456c844d44b	b13917ba-9ee7-4644-9cb8-191f7b586815	00ae470c-26a8-4992-8d50-9339aa8e5a70	9d861422-4a77-4b50-852d-2e975e61accd	46694505-c4b9-4ab1-9900-de3663ec1d6e	PRESCRIPTION	ythggdd	ghsghgjv	2026-08-21 13:46:59.731707	\N	\N
883fa32e-e4b0-4932-b16a-8e080ff62572	b13917ba-9ee7-4644-9cb8-191f7b586815	00ae470c-26a8-4992-8d50-9339aa8e5a70	9d861422-4a77-4b50-852d-2e975e61accd	46694505-c4b9-4ab1-9900-de3663ec1d6e	PRESCRIPTION	 nbb	jkbbgohbjnkbn	2026-08-21 13:56:11.774187	\N	\N
d682a146-f908-4f09-94e0-0e20fbf070cc	b13917ba-9ee7-4644-9cb8-191f7b586815	00ae470c-26a8-4992-8d50-9339aa8e5a70	9d861422-4a77-4b50-852d-2e975e61accd	46694505-c4b9-4ab1-9900-de3663ec1d6e	CONSULTATION_NOTE	gffgff	fccfgffh	2026-08-21 16:06:45.809878	\N	\N
462d464a-01c6-4266-956b-a584ca4fff74	b13917ba-9ee7-4644-9cb8-191f7b586815	00ae470c-26a8-4992-8d50-9339aa8e5a70	9d861422-4a77-4b50-852d-2e975e61accd	46694505-c4b9-4ab1-9900-de3663ec1d6e	PRESCRIPTION	nhjhjhjjkkk	kjbkjjj	2026-08-21 16:07:04.668897	\N	\N
ad9453d2-4b0a-427e-9af2-d25667bb10f6	b13917ba-9ee7-4644-9cb8-191f7b586815	00ae470c-26a8-4992-8d50-9339aa8e5a70	9d861422-4a77-4b50-852d-2e975e61accd	46694505-c4b9-4ab1-9900-de3663ec1d6e	OTHER	jbhhjhb	kjjkjnkl	2026-08-21 16:07:19.091819	\N	\N
e6afec28-54e9-4137-bcfb-091a60d42580	b13917ba-9ee7-4644-9cb8-191f7b586815	00ae470c-26a8-4992-8d50-9339aa8e5a70	9d861422-4a77-4b50-852d-2e975e61accd	46694505-c4b9-4ab1-9900-de3663ec1d6e	PRESCRIPTION	Medical 	Maux de tête 	2026-08-21 16:15:01.827348	\N	\N
\.


--
-- Data for Name: messages; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.messages (id, patient_id, establishment_id, sender_role, sender_name, content, created_at, doctor_id) FROM stdin;
2f1c4053-bd5c-44c4-8657-726d5d57cabb	47e6fc86-47cf-4c69-b3b7-492286674b5a	46694505-c4b9-4ab1-9900-de3663ec1d6e	PATIENT	Gratien KAKPO	Bonjour	2026-08-13 10:11:49.876111	\N
ab729fc0-38de-4bf9-9118-37ae30da417a	d8f55300-df71-4eea-8d87-d43301ae1638	809e2ffc-6f82-426c-9a2a-56023fd30d47	PATIENT	Lyam	Bom	2026-08-15 18:38:41.648547	\N
06728610-0d1e-4646-afe8-8418ecfb7fc1	d8f55300-df71-4eea-8d87-d43301ae1638	809e2ffc-6f82-426c-9a2a-56023fd30d47	PATIENT	Lyam	Bonjour Mr	2026-08-15 18:38:52.921759	\N
058491d0-6bd2-43bb-ac59-1770bd22e765	d8f55300-df71-4eea-8d87-d43301ae1638	809e2ffc-6f82-426c-9a2a-56023fd30d47	PATIENT	Lyam	Bonjour Mr	2026-08-15 18:39:08.774963	\N
444e61e4-b69c-4dc3-ab92-c21e7a157ed9	47e6fc86-47cf-4c69-b3b7-492286674b5a	46694505-c4b9-4ab1-9900-de3663ec1d6e	STAFF	Jacques 	oui comment vous allez	2026-08-17 22:22:25.771577	\N
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.notifications (id, establishment_id, user_id, notification_type, title, message, is_read, created_at) FROM stdin;
\.


--
-- Data for Name: opening_hours; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.opening_hours (id, establishment_id, day_of_week, open_time, close_time) FROM stdin;
5e9b1b4c-2c2b-4e58-bcef-4838674a88a0	1e1be1d6-ce82-4abb-9a59-752d2ca8d9fb	0	08:00:00	18:00:00
73e01b66-3c4b-4cb5-a92a-8ca3f92e0eb2	1e1be1d6-ce82-4abb-9a59-752d2ca8d9fb	1	00:00:00	00:06:00
cb3e95c9-169f-49f9-bcad-059eac4c0ab5	03c05829-db0e-4228-b750-2017c8292615	0	08:00:00	23:00:00
83541fe0-f8a9-4584-acbb-4e95ef8dd2ea	03c05829-db0e-4228-b750-2017c8292615	1	08:00:00	23:00:00
74f3534a-6424-44ec-ad2d-f5055881d38e	03c05829-db0e-4228-b750-2017c8292615	2	08:00:00	23:00:00
9a3f1c47-6aa5-4657-b4c2-6ca5e0fd91ce	03c05829-db0e-4228-b750-2017c8292615	3	08:00:00	23:00:00
cb0ecc21-e620-4827-9eae-e8393175f081	03c05829-db0e-4228-b750-2017c8292615	4	08:00:00	23:00:00
e77a21f9-566a-48c4-a0c4-64aa1e914f86	03c05829-db0e-4228-b750-2017c8292615	5	08:00:00	23:00:00
\.


--
-- Data for Name: password_reset_tokens; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.password_reset_tokens (id, user_id, token_hash, expires_at, used, created_at) FROM stdin;
\.


--
-- Data for Name: patient_record_shares; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.patient_record_shares (id, patient_id, from_doctor_id, to_doctor_id, note, created_at) FROM stdin;
\.


--
-- Data for Name: patients; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.patients (id, user_id, dossier_number, date_of_birth) FROM stdin;
47e6fc86-47cf-4c69-b3b7-492286674b5a	00ac7b8a-0976-4311-87c6-efa3ddbd2395	PAT-AAA0B796	\N
d8f55300-df71-4eea-8d87-d43301ae1638	0dd993d8-c840-44d3-9e32-c98a8154b486	PAT-D18EB003	\N
844b7e99-3c81-42ee-af78-01682dd2ba48	0cf7cbb1-f966-4d0f-8591-9d3af6edad5b	PAT-13826C6F	\N
00ae470c-26a8-4992-8d50-9339aa8e5a70	e21cc5ac-1cec-4409-94f4-4833e19c2e67	PAT-6AC23137	\N
21429d16-c3c4-448f-bf52-6abdfc389418	868333e7-6a2f-4960-8537-d20b3c0c622c	PAT-4BB9EF9A	\N
6b25852d-f59e-42fe-bdd4-e7ff4a07a945	63cf0655-1cf2-4e9b-9efc-e79d86ca842c	PAT-4C1B09FB	\N
\.


--
-- Data for Name: payments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.payments (id, invoice_id, amount, payment_method, reference, recorded_by_user_id, paid_at) FROM stdin;
\.


--
-- Data for Name: pharmacy_order_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.pharmacy_order_items (id, reservation_id, medication_id, quantity, confirmed_quantity, confirmed_unit_price) FROM stdin;
6c8def0d-b592-4fec-b416-f64c7fdbcca3	186b67f0-bd79-4639-a89a-76d253c8dc9c	6f953ea8-fb67-400e-b7e5-6299f39b3eff	2	2	500
4a7b67ec-1f89-4886-86a7-31c61272bcff	d9a5f98e-5126-43ec-8061-7e21478bedb7	6f953ea8-fb67-400e-b7e5-6299f39b3eff	1	1	500
8b15e6d3-c81b-484d-bf99-3f204b7a0249	dea18106-c2ca-4164-bc2f-14607c1ef77e	7fe67363-b3c2-4c89-97f5-389944c6a349	56	56	125
c5bb04eb-5145-4027-b847-6605e66874e8	80fb433e-f241-4bff-911f-cc61a134ba08	6f953ea8-fb67-400e-b7e5-6299f39b3eff	4	\N	\N
b75bfaf8-1432-47d5-9e58-f70271d2e036	6aacafa6-8f44-4972-a016-37f20cd506c5	9c7b8b1e-7022-4f1f-8b6f-b46a989115e9	1	1	184
d6f7a3fb-9d75-4276-b703-9e8fe83e20f1	6aacafa6-8f44-4972-a016-37f20cd506c5	11efbc87-442a-431c-a2dd-c8ea330f39a6	1	1	500
6a19046f-b970-4840-be50-68f31dec14c5	59506d56-b6b5-4d55-9424-c0b08f811f31	11efbc87-442a-431c-a2dd-c8ea330f39a6	1	1	500
71d2ab2a-b945-4d68-b632-d6f489af43ef	59506d56-b6b5-4d55-9424-c0b08f811f31	9c7b8b1e-7022-4f1f-8b6f-b46a989115e9	1	1	200
\.


--
-- Data for Name: pharmacy_reservation_status_history; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.pharmacy_reservation_status_history (id, reservation_id, status, note, changed_by_user_id, created_at) FROM stdin;
a5739fef-8a31-42b4-84e1-e498f8334c09	dea18106-c2ca-4164-bc2f-14607c1ef77e	PENDING	Commande recue, en attente de verification	00ac7b8a-0976-4311-87c6-efa3ddbd2395	2026-08-16 09:25:58.757404
bf5ac894-b100-4223-ad1a-3a2f2d6643d9	dea18106-c2ca-4164-bc2f-14607c1ef77e	AWAITING_CONFIRMATION	\N	945cc86e-d646-42c2-8cfc-1485651c7de2	2026-08-16 10:55:34.687558
22e0a7c8-3036-4085-a283-15c3b423cfd9	dea18106-c2ca-4164-bc2f-14607c1ef77e	CONFIRMED	Confirmee par le patient	00ac7b8a-0976-4311-87c6-efa3ddbd2395	2026-08-18 12:53:51.193422
d4fb10fe-2c15-4182-a694-ec1d97f2ea39	d9a5f98e-5126-43ec-8061-7e21478bedb7	PENDING	Commande recue, en attente de verification	0cf7cbb1-f966-4d0f-8591-9d3af6edad5b	2026-08-19 15:47:55.826206
2fee86e4-0b53-4824-ab7c-25fac579b3f9	d9a5f98e-5126-43ec-8061-7e21478bedb7	AWAITING_CONFIRMATION	kjhghghjkgh	f502a79f-bdc8-4a5f-9bab-0f3c69430061	2026-08-19 16:12:05.736724
9466f512-6c7f-4534-a480-302cae8437fd	d9a5f98e-5126-43ec-8061-7e21478bedb7	CONFIRMED	Confirmee par le patient	0cf7cbb1-f966-4d0f-8591-9d3af6edad5b	2026-08-19 16:13:16.707797
3d359688-5014-4fe7-a85a-03ddd2385d5c	186b67f0-bd79-4639-a89a-76d253c8dc9c	PENDING	Commande recue, en attente de verification	e21cc5ac-1cec-4409-94f4-4833e19c2e67	2026-08-19 16:30:28.776334
2a6aa4e9-6466-4701-b453-1b4d7130ff4c	186b67f0-bd79-4639-a89a-76d253c8dc9c	AWAITING_CONFIRMATION	mlkhj	f502a79f-bdc8-4a5f-9bab-0f3c69430061	2026-08-19 16:34:26.399669
2e28e5a2-029d-40e1-a649-45e1880e30f8	186b67f0-bd79-4639-a89a-76d253c8dc9c	CONFIRMED	Confirmee par le patient	e21cc5ac-1cec-4409-94f4-4833e19c2e67	2026-08-19 16:34:56.582196
7d3d8926-e972-4e25-91bc-5b399fde8cc3	80fb433e-f241-4bff-911f-cc61a134ba08	PENDING	Commande recue, en attente de verification	e21cc5ac-1cec-4409-94f4-4833e19c2e67	2026-08-21 14:00:06.243488
0ec091a0-701f-49b1-b81d-eb6cf19bd844	59506d56-b6b5-4d55-9424-c0b08f811f31	PENDING	Commande recue, en attente de verification	0dd993d8-c840-44d3-9e32-c98a8154b486	2026-08-27 21:20:57.556086
2347b93f-58f5-431e-b400-8f16f5de62cf	6aacafa6-8f44-4972-a016-37f20cd506c5	PENDING	Commande recue, en attente de verification	0dd993d8-c840-44d3-9e32-c98a8154b486	2026-08-27 21:21:02.921905
7e2559ef-4a55-46e3-a824-bcfe5d862115	6aacafa6-8f44-4972-a016-37f20cd506c5	AWAITING_CONFIRMATION	\N	85b8e60f-641b-494e-a49a-09510e45b6f4	2026-08-27 21:22:20.111778
bd43cf11-d135-4e3f-a7d7-1e3135e23d41	59506d56-b6b5-4d55-9424-c0b08f811f31	AWAITING_CONFIRMATION	\N	85b8e60f-641b-494e-a49a-09510e45b6f4	2026-08-27 21:25:02.215436
\.


--
-- Data for Name: pharmacy_reservations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.pharmacy_reservations (id, establishment_id, patient_id, delivery_mode, status, created_at, estimated_ready_at, pharmacist_note) FROM stdin;
dea18106-c2ca-4164-bc2f-14607c1ef77e	1e1be1d6-ce82-4abb-9a59-752d2ca8d9fb	47e6fc86-47cf-4c69-b3b7-492286674b5a	PICKUP	CONFIRMED	2026-08-16 09:25:58.738619	\N	\N
d9a5f98e-5126-43ec-8061-7e21478bedb7	03c05829-db0e-4228-b750-2017c8292615	844b7e99-3c81-42ee-af78-01682dd2ba48	PICKUP	CONFIRMED	2026-08-19 15:47:55.807043	\N	kjhghghjkgh
186b67f0-bd79-4639-a89a-76d253c8dc9c	03c05829-db0e-4228-b750-2017c8292615	00ae470c-26a8-4992-8d50-9339aa8e5a70	PICKUP	CONFIRMED	2026-08-19 16:30:28.769356	\N	mlkhj
80fb433e-f241-4bff-911f-cc61a134ba08	03c05829-db0e-4228-b750-2017c8292615	00ae470c-26a8-4992-8d50-9339aa8e5a70	DELIVERY	PENDING	2026-08-21 14:00:06.227961	\N	\N
6aacafa6-8f44-4972-a016-37f20cd506c5	5d0e9391-885a-4e2e-9168-1380f1e2c845	d8f55300-df71-4eea-8d87-d43301ae1638	PICKUP	AWAITING_CONFIRMATION	2026-08-27 21:21:02.892911	\N	\N
59506d56-b6b5-4d55-9424-c0b08f811f31	5d0e9391-885a-4e2e-9168-1380f1e2c845	d8f55300-df71-4eea-8d87-d43301ae1638	PICKUP	AWAITING_CONFIRMATION	2026-08-27 21:20:57.507879	\N	\N
\.


--
-- Data for Name: pharmacy_stock; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.pharmacy_stock (id, establishment_id, reference, medication_name, category, quantity, alert_threshold, unit_price) FROM stdin;
d4f7c912-c407-4620-a0ac-c3664998bc19	1e1be1d6-ce82-4abb-9a59-752d2ca8d9fb	MED-AC 9873	Cetamyl		266	10	653
7fe67363-b3c2-4c89-97f5-389944c6a349	1e1be1d6-ce82-4abb-9a59-752d2ca8d9fb	MED-AS 4356	paracetamol		44	10	125
6f953ea8-fb67-400e-b7e5-6299f39b3eff	03c05829-db0e-4228-b750-2017c8292615	dol	dolipranne		7	10	500
9c7b8b1e-7022-4f1f-8b6f-b46a989115e9	5d0e9391-885a-4e2e-9168-1380f1e2c845	Para	Paracetamole		16	10	200
11efbc87-442a-431c-a2dd-c8ea330f39a6	5d0e9391-885a-4e2e-9168-1380f1e2c845	Mizagrippe	Mizagripe		20	10	500
\.


--
-- Data for Name: platform_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.platform_settings (key, value) FROM stdin;
\.


--
-- Data for Name: purchase_orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.purchase_orders (id, establishment_id, supplier_id, inventory_item_id, description, quantity, status, ordered_by_user_id, ordered_at, received_at) FROM stdin;
\.


--
-- Data for Name: reference_values; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.reference_values (id, establishment_id, test_name, unit, min_value, max_value, notes) FROM stdin;
\.


--
-- Data for Name: rooms; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.rooms (id, establishment_id, name, room_type, capacity, department_id) FROM stdin;
\.


--
-- Data for Name: services; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.services (id, establishment_id, name, price, duration_minutes, description) FROM stdin;
\.


--
-- Data for Name: shifts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.shifts (id, establishment_id, user_id, department_id, shift_date, start_time, end_time, notes, created_by_user_id) FROM stdin;
\.


--
-- Data for Name: staff_profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.staff_profiles (id, user_id, department_id, position_title, hire_date, contract_type, license_number, created_at) FROM stdin;
39855958-cd5a-4327-917c-ebf9fac99e7d	39d1e2c4-c9b6-4fbe-ba16-98004ea7050b	\N		1983-04-27	CDI	GRIARDZ	2026-08-27 17:21:39.146477
b8c43f1d-1e1a-4440-9aeb-f5d4c32a2be1	935c8d71-4888-43f6-b438-07cc7d8bee47	\N		1986-12-27			2026-08-27 17:25:13.299285
2d6060c1-4ff4-4e50-9724-6f9875e1f7f0	d5a3ff17-78e6-4cc0-a433-c2ac535e2fdb	5516cb2c-2370-4b92-a8bf-cc320b0715b9	chef	1988-11-22	CD	GFER435	2026-08-28 07:12:14.874604
\.


--
-- Data for Name: suppliers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.suppliers (id, establishment_id, name, contact_phone, contact_email, notes) FROM stdin;
\.


--
-- Data for Name: support_messages; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.support_messages (id, user_id, sender_role, sender_name, content, created_at) FROM stdin;
e6267012-8027-488e-bae5-a78048a2ae60	00ac7b8a-0976-4311-87c6-efa3ddbd2395	user	Gratien KAKPO	Bonjour	2026-08-16 07:28:58.902689
e4275643-a038-4a6f-b1d8-aaaa5d4991d0	00ac7b8a-0976-4311-87c6-efa3ddbd2395	user	Gratien KAKPO	Je voudrais dénoncer un abu	2026-08-16 07:29:15.168997
8878eee6-6c87-43cd-a48e-cbc11b3c7dab	938e437c-866e-4719-b098-6d5fd8a5ebd2	user	Faustin	dddd	2026-08-18 12:30:26.840443
ddd9b753-7eac-42d2-a13c-d2ab66138da7	688763fc-0d35-4e97-8d09-d5a55639c4e7	user	LGP HOLDINGS	CCC	2026-08-18 12:33:32.594618
f80dd4fe-e0de-483b-bf2d-1adf2baa0924	938e437c-866e-4719-b098-6d5fd8a5ebd2	support	Support LGP HOLDINGS	DACCORS CONMPRIS	2026-08-18 12:35:08.686152
496631fd-2226-4c21-adc2-ee241f72d991	0dd993d8-c840-44d3-9e32-c98a8154b486	user	Lyam	Ccvc	2026-08-21 03:01:27.357958
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, establishment_id, email, hashed_password, full_name, phone, role, is_active, created_at, gender, residence) FROM stdin;
688763fc-0d35-4e97-8d09-d5a55639c4e7	\N	admin@lgp.com	$2b$12$SIIOGgGl4UFh8Wx.VJgVouVTJpikWYS4ACvo32oUFEaYpjcIce/3.	LGP HOLDINGS	\N	SUPER_ADMIN	t	2026-08-04 00:26:15.245365	\N	\N
938e437c-866e-4719-b098-6d5fd8a5ebd2	46694505-c4b9-4ab1-9900-de3663ec1d6e	faustin@lgp.com	$2b$12$AQaVmpZjnPLIY/RRhcXWXesfu54XDn1BIZYtiRsGZABtM7QInyJbi	Faustin	\N	ESTABLISHMENT_ADMIN	t	2026-08-04 12:32:27.437421	\N	\N
c588c4e7-a4bd-43fd-8b7f-d7bf27b9ffc4	809e2ffc-6f82-426c-9a2a-56023fd30d47	janvier@lgp.com	$2b$12$QhvUEhYnNp0SRiBA64Ifd.DACqE4dgre8Fyy2x2Nj8x71y4NlDnNy	Janvier	\N	ESTABLISHMENT_ADMIN	t	2026-08-04 12:36:46.234371	\N	\N
8b668f92-10de-4525-a8a2-ee1eb5664bd2	31f98de2-3365-434c-ba6c-16a4337272e9	stjean@lgp.com	$2b$12$yncBihOyexE8FnSQnBMi7OZA11tgxFonbijH4lZmAC/UWniwo8olu	Stjean	\N	ESTABLISHMENT_ADMIN	t	2026-08-04 12:41:19.112068	\N	\N
7d0aea7d-ca81-45da-9ea2-6c7b5ff310c7	46694505-c4b9-4ab1-9900-de3663ec1d6e	georgesagui@gmail.com	$2b$12$wOFrM5jdcHOn1LgggMjz8.kJVKfxGdNng5/JNVXLNgAOul6gAGkVq	George sagui	0128567543	DOCTOR	t	2026-08-04 15:18:39.801948	\N	\N
46c6f882-b64c-469d-822d-77471ba29ff2	46694505-c4b9-4ab1-9900-de3663ec1d6e	van@gmail.com	$2b$12$7NSK7q25Dqk5XZynAgySQuI06EGmrmR1XSu/YhLJhwhMZtxKdJKe.	Van Vikey	0196756432	DOCTOR	t	2026-08-04 15:22:25.186167	\N	\N
d11244fa-3bcb-478f-85c7-957d76e650d4	809e2ffc-6f82-426c-9a2a-56023fd30d47	gote@gmail.com	$2b$12$TvC4hrj4zN1tBS3nomyqGekxGoycuZ2vSXFI4w3XK9F0aNp/y8LAK	Zanfabt gote	0167867898	DOCTOR	t	2026-08-04 15:29:06.018229	\N	\N
00ac7b8a-0976-4311-87c6-efa3ddbd2395	\N	gratianokakpo@gmail.com	$2b$12$aecZwA8jUgtSk3eu27oJF.KeOYf/m2G8oW4cdwHZX71ukMWktvOHy	Gratien KAKPO	+2290194856898	PATIENT	t	2026-08-04 16:58:27.000937	\N	\N
3aea386e-94ab-4452-b493-7124ddbfdedb	008c1e3e-d05e-4387-9818-e4bd1d788548	labo@lgp.com	$2b$12$rkIwgR00YFN4/IT6IV.LZejUA4oK.C57VFv3Q2VWqunFN6FwgvZQK	Laborentin	\N	ESTABLISHMENT_ADMIN	t	2026-08-08 08:28:58.063221	\N	\N
48376fb0-3949-40d4-ba19-8913a290987f	950825b7-a8c9-4bb9-a298-2dc6069ee5ae	jean@lgp.com	$2b$12$nAIk1rbm3xyxeRt8ToyqdOc4tyb6xHDjExEu/MW6BJ8zS3MU/2/r6	Jean	\N	ESTABLISHMENT_ADMIN	t	2026-08-09 15:47:36.178419	\N	\N
0dd993d8-c840-44d3-9e32-c98a8154b486	\N	soggagtkohhffshh@gmail.com	$2b$12$3qVKZXcL5CsOouOMbRnMvu6CJ6CFlIyobn7s4Dqn4PU05lu5SU87a	Lyam		PATIENT	t	2026-08-10 08:17:40.138938	\N	\N
0cf7cbb1-f966-4d0f-8591-9d3af6edad5b	\N	faustinsogadji@gmail.com	$2b$12$lhNNNmC3v0NWAuYO5YJ5feBynnxMHOAAXPh5yg65tn9bfL4DPru9K	Leo leo	+2290165191887	PATIENT	t	2026-08-10 08:21:33.080311	\N	\N
5c5d697b-9cff-4403-af99-372f5a1801fe	46694505-c4b9-4ab1-9900-de3663ec1d6e	florentine@lgp.com	$2b$12$ErH17TYkyJuCiXZEBxfIYOI32B12b3.jx8LowNiLyJaG0bEzCBd2S	florentine		DOCTOR	t	2026-08-10 08:28:54.924437	\N	\N
4f41f50e-9f1b-4118-b818-960ee209c973	46694505-c4b9-4ab1-9900-de3663ec1d6e	jule@lgp.com	$2b$12$UPO1CzIOZfaaelC8TXczuOqm8BsWEApKUBu02AYsNU7axjggvgCbm	Jule	0129634576	SECRETARY	t	2026-08-12 15:28:59.631654	\N	\N
62780864-f8a9-4093-a6de-97ad01e819dc	46694505-c4b9-4ab1-9900-de3663ec1d6e	jacques@lgp.com	$2b$12$nUTr0mM64X11PpTp4Bh6tOQ/CvHtpAZXensI9O9yudPf6Mth68H5e	Jacques 	0128345678	DOCTOR	t	2026-08-12 18:29:10.36077	\N	\N
9b1a8d30-b187-4ca2-bffe-9874335d812d	46694505-c4b9-4ab1-9900-de3663ec1d6e	nada@lgp.com	$2b$12$Bc2f.xduWlcHrn5klUVdMeIP0wF7iox04iUDTMAsXDtdIVJzARhxm	NADA AKOUI	0128454356	DOCTOR	t	2026-08-12 18:31:02.212295	\N	\N
390b3234-84c0-40b2-87af-391c37ad32b1	46694505-c4b9-4ab1-9900-de3663ec1d6e	helene@lgp.com	$2b$12$BQUDmPrWv/4lklZ9PF1UCuPYRRbWFAHowScgRNI1ndsNkROOB7/sO	HELENE 	+22967787057	DOCTOR	t	2026-08-12 22:00:05.755773	\N	\N
b5bf3c1e-0909-4669-8824-f6ea156abba1	46694505-c4b9-4ab1-9900-de3663ec1d6e	tangui@lgp.com	$2b$12$Ml0WXKR9mOqF73qhw5fcpufcFjb0fqxP0SXLzc3RscfsARswgceWa	Tangui	+22967787057	DOCTOR	t	2026-08-12 22:33:15.613517	\N	\N
945cc86e-d646-42c2-8cfc-1485651c7de2	1e1be1d6-ce82-4abb-9a59-752d2ca8d9fb	guezo@lgp.com	$2b$12$QZjLbZzDkexX6x7Zqjk7e.27gUo99mFafcYzCST6l6oGKRHWXNFeq	Guezo	\N	ESTABLISHMENT_ADMIN	t	2026-08-15 06:20:48.295049	\N	\N
820ce384-262f-4554-b770-7ab4c6332919	46694505-c4b9-4ab1-9900-de3663ec1d6e	julie@lgp.com	$2b$12$caI954asvZ417oPOBCUkE.eoh9qqo80YBXPiyGYWKKFN02I59KxkG	JUlie		LAB_TECHNICIAN	t	2026-08-18 05:44:14.078785	\N	\N
e008cfa7-4777-4ee2-8e30-b64ec930893f	46694505-c4b9-4ab1-9900-de3663ec1d6e	karli@lgp.com	$2b$12$5WhRUN/5LgmAZIYElIRzju8tHPv3NHcSrYN5XpFJn8faFsXJVewmi	karli		SECRETARY	t	2026-08-18 10:17:24.470956	\N	\N
e21cc5ac-1cec-4409-94f4-4833e19c2e67	\N	mama@lgp.com	$2b$12$Dnw8ZlRbwFDv4S5O.1iHSuZwQywgJeZ38ei5dBRk8aTuTqf0shXJC	mama	20202020	PATIENT	t	2026-08-19 15:34:12.217754	\N	\N
f502a79f-bdc8-4a5f-9bab-0f3c69430061	03c05829-db0e-4228-b750-2017c8292615	abel@lgp.com	$2b$12$tW7sTmoct6YLUHcSw/9.du./QGyL0HGimo9Nfb.XTR3yCeLkxHHde	abel	\N	ESTABLISHMENT_ADMIN	t	2026-08-19 15:41:14.906355	\N	\N
868333e7-6a2f-4960-8537-d20b3c0c622c	\N	yath@lgp.com	$2b$12$mZqUGLDySyUzS5lymFHzlO16X/bJCINVy8YH0DYt1sANKNsRQFz76	yath	à&-è('"'(-	PATIENT	t	2026-08-20 00:09:16.578604	\N	\N
fbbd966e-00ba-418a-accd-6cb962d988de	829ed990-52d2-4efe-8355-9fad3b81df54	quest@lgp.com	$2b$12$YPoyNCwnpy4XruTDUrybD.dWLcFp0hMgMj7tN8lTUNoLtnat2YXjq	Quest	\N	ESTABLISHMENT_ADMIN	t	2026-08-21 02:45:10.481297	\N	\N
a60ce078-8e25-42da-8578-ebf256693e65	809e2ffc-6f82-426c-9a2a-56023fd30d47	lyamdoki54@gmail.com	$2b$12$RsoEmo3xb1wjQTf3E3BuKur5/kvVQBKt.b1J0Nx/E35hKeulLzqqq	Jean		DOCTOR	t	2026-08-21 14:58:46.674153	\N	\N
2bfd5fdf-8fb6-4d34-8948-a2f5c35f8b05	809e2ffc-6f82-426c-9a2a-56023fd30d47	mario@lgp.com	$2b$12$ejfwlz7vjBKEllq8c5Zu9Oix6Nw/8XoMhQxFeHP2Pl/kDjkbQDPg.	mario	002020202	DOCTOR	t	2026-08-21 15:03:53.882516	\N	\N
39d1e2c4-c9b6-4fbe-ba16-98004ea7050b	46694505-c4b9-4ab1-9900-de3663ec1d6e	joe@lgp.com	$2b$12$yoBcw5VfIe7L8BxkVmeB2.9AckQFFPam5XlJBsp/kfvqI2Rmw3T/a	joe	0354253436	ACCOUNTANT	t	2026-08-27 17:21:39.124343	\N	\N
935c8d71-4888-43f6-b438-07cc7d8bee47	46694505-c4b9-4ab1-9900-de3663ec1d6e	roger@lgp.com	$2b$12$rxL4P6Ql/JxJJe1EuTb2rOc6kOkU7.OCQM8m1t5VHPSwwY.Wyi.Xa	Roger		ACCOUNTANT	t	2026-08-27 17:25:13.27835	\N	\N
85b8e60f-641b-494e-a49a-09510e45b6f4	5d0e9391-885a-4e2e-9168-1380f1e2c845	lpharmacie@lgp.com	$2b$12$wmv4t59qT3RC3NjeEUqJMOWb5ZJu4MBe58jZZ0REkGuzBiiR2e1XO	LPharmacie	\N	ESTABLISHMENT_ADMIN	t	2026-08-27 21:06:22.854351	\N	\N
63cf0655-1cf2-4e9b-9efc-e79d86ca842c	\N	doki@lgp.com	$2b$12$qERR7kQtks660ywhsDmYP.EsWHkIh3MjAS1Tu5//rq0naoQIaWv8m	doki		PATIENT	t	2026-08-27 21:11:39.387417	\N	\N
d5a3ff17-78e6-4cc0-a433-c2ac535e2fdb	46694505-c4b9-4ab1-9900-de3663ec1d6e	loic@lgp.com	$2b$12$vy4YtlzmVPMBUSERqaD1NevozAIN8CNdWxv7Y.nGYWkKJyjUmDTEq	Loic		HR_MANAGER	t	2026-08-28 07:12:14.845917	\N	\N
\.


--
-- Data for Name: vital_signs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.vital_signs (id, admission_id, recorded_by_user_id, recorded_at, temperature_celsius, blood_pressure, pulse_bpm, respiratory_rate, notes) FROM stdin;
\.


--
-- Name: admission_transfers admission_transfers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admission_transfers
    ADD CONSTRAINT admission_transfers_pkey PRIMARY KEY (id);


--
-- Name: admissions admissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admissions
    ADD CONSTRAINT admissions_pkey PRIMARY KEY (id);


--
-- Name: appointments appointments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- Name: dependents dependents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dependents
    ADD CONSTRAINT dependents_pkey PRIMARY KEY (id);


--
-- Name: doctor_absences doctor_absences_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.doctor_absences
    ADD CONSTRAINT doctor_absences_pkey PRIMARY KEY (id);


--
-- Name: doctor_availabilities doctor_availabilities_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.doctor_availabilities
    ADD CONSTRAINT doctor_availabilities_pkey PRIMARY KEY (id);


--
-- Name: doctor_reviews doctor_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.doctor_reviews
    ADD CONSTRAINT doctor_reviews_pkey PRIMARY KEY (id);


--
-- Name: doctors doctors_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.doctors
    ADD CONSTRAINT doctors_pkey PRIMARY KEY (id);


--
-- Name: equipment equipment_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipment
    ADD CONSTRAINT equipment_pkey PRIMARY KEY (id);


--
-- Name: establishments establishments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.establishments
    ADD CONSTRAINT establishments_pkey PRIMARY KEY (id);


--
-- Name: inventory_items inventory_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_pkey PRIMARY KEY (id);


--
-- Name: invoice_line_items invoice_line_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoice_line_items
    ADD CONSTRAINT invoice_line_items_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: lab_test_requests lab_test_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lab_test_requests
    ADD CONSTRAINT lab_test_requests_pkey PRIMARY KEY (id);


--
-- Name: leave_requests leave_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_pkey PRIMARY KEY (id);


--
-- Name: medical_documents medical_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.medical_documents
    ADD CONSTRAINT medical_documents_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: opening_hours opening_hours_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.opening_hours
    ADD CONSTRAINT opening_hours_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);


--
-- Name: patient_record_shares patient_record_shares_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.patient_record_shares
    ADD CONSTRAINT patient_record_shares_pkey PRIMARY KEY (id);


--
-- Name: patients patients_dossier_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_dossier_number_key UNIQUE (dossier_number);


--
-- Name: patients patients_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_pkey PRIMARY KEY (id);


--
-- Name: patients patients_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_user_id_key UNIQUE (user_id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: pharmacy_order_items pharmacy_order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pharmacy_order_items
    ADD CONSTRAINT pharmacy_order_items_pkey PRIMARY KEY (id);


--
-- Name: pharmacy_reservation_status_history pharmacy_reservation_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pharmacy_reservation_status_history
    ADD CONSTRAINT pharmacy_reservation_status_history_pkey PRIMARY KEY (id);


--
-- Name: pharmacy_reservations pharmacy_reservations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pharmacy_reservations
    ADD CONSTRAINT pharmacy_reservations_pkey PRIMARY KEY (id);


--
-- Name: pharmacy_stock pharmacy_stock_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pharmacy_stock
    ADD CONSTRAINT pharmacy_stock_pkey PRIMARY KEY (id);


--
-- Name: platform_settings platform_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.platform_settings
    ADD CONSTRAINT platform_settings_pkey PRIMARY KEY (key);


--
-- Name: purchase_orders purchase_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_pkey PRIMARY KEY (id);


--
-- Name: reference_values reference_values_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reference_values
    ADD CONSTRAINT reference_values_pkey PRIMARY KEY (id);


--
-- Name: rooms rooms_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rooms
    ADD CONSTRAINT rooms_pkey PRIMARY KEY (id);


--
-- Name: services services_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_pkey PRIMARY KEY (id);


--
-- Name: shifts shifts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shifts
    ADD CONSTRAINT shifts_pkey PRIMARY KEY (id);


--
-- Name: staff_profiles staff_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_profiles
    ADD CONSTRAINT staff_profiles_pkey PRIMARY KEY (id);


--
-- Name: staff_profiles staff_profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_profiles
    ADD CONSTRAINT staff_profiles_user_id_key UNIQUE (user_id);


--
-- Name: suppliers suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);


--
-- Name: support_messages support_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.support_messages
    ADD CONSTRAINT support_messages_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: vital_signs vital_signs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vital_signs
    ADD CONSTRAINT vital_signs_pkey PRIMARY KEY (id);


--
-- Name: ix_password_reset_tokens_token_hash; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_password_reset_tokens_token_hash ON public.password_reset_tokens USING btree (token_hash);


--
-- Name: ix_users_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ix_users_email ON public.users USING btree (email);


--
-- Name: admission_transfers admission_transfers_admission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admission_transfers
    ADD CONSTRAINT admission_transfers_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id);


--
-- Name: admission_transfers admission_transfers_from_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admission_transfers
    ADD CONSTRAINT admission_transfers_from_department_id_fkey FOREIGN KEY (from_department_id) REFERENCES public.departments(id);


--
-- Name: admission_transfers admission_transfers_from_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admission_transfers
    ADD CONSTRAINT admission_transfers_from_room_id_fkey FOREIGN KEY (from_room_id) REFERENCES public.rooms(id);


--
-- Name: admission_transfers admission_transfers_to_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admission_transfers
    ADD CONSTRAINT admission_transfers_to_department_id_fkey FOREIGN KEY (to_department_id) REFERENCES public.departments(id);


--
-- Name: admission_transfers admission_transfers_to_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admission_transfers
    ADD CONSTRAINT admission_transfers_to_room_id_fkey FOREIGN KEY (to_room_id) REFERENCES public.rooms(id);


--
-- Name: admission_transfers admission_transfers_transferred_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admission_transfers
    ADD CONSTRAINT admission_transfers_transferred_by_user_id_fkey FOREIGN KEY (transferred_by_user_id) REFERENCES public.users(id);


--
-- Name: admissions admissions_admitting_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admissions
    ADD CONSTRAINT admissions_admitting_doctor_id_fkey FOREIGN KEY (admitting_doctor_id) REFERENCES public.doctors(id);


--
-- Name: admissions admissions_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admissions
    ADD CONSTRAINT admissions_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: admissions admissions_establishment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admissions
    ADD CONSTRAINT admissions_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES public.establishments(id);


--
-- Name: admissions admissions_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admissions
    ADD CONSTRAINT admissions_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: admissions admissions_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admissions
    ADD CONSTRAINT admissions_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id);


--
-- Name: appointments appointments_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.doctors(id);


--
-- Name: appointments appointments_establishment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES public.establishments(id);


--
-- Name: appointments appointments_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: audit_logs audit_logs_establishment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES public.establishments(id);


--
-- Name: audit_logs audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: departments departments_establishment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES public.establishments(id);


--
-- Name: departments departments_head_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_head_user_id_fkey FOREIGN KEY (head_user_id) REFERENCES public.users(id);


--
-- Name: dependents dependents_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dependents
    ADD CONSTRAINT dependents_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: doctor_absences doctor_absences_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.doctor_absences
    ADD CONSTRAINT doctor_absences_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.doctors(id);


--
-- Name: doctor_availabilities doctor_availabilities_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.doctor_availabilities
    ADD CONSTRAINT doctor_availabilities_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.doctors(id);


--
-- Name: doctor_reviews doctor_reviews_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.doctor_reviews
    ADD CONSTRAINT doctor_reviews_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.doctors(id);


--
-- Name: doctor_reviews doctor_reviews_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.doctor_reviews
    ADD CONSTRAINT doctor_reviews_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: doctors doctors_establishment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.doctors
    ADD CONSTRAINT doctors_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES public.establishments(id);


--
-- Name: doctors doctors_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.doctors
    ADD CONSTRAINT doctors_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: equipment equipment_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipment
    ADD CONSTRAINT equipment_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: equipment equipment_establishment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipment
    ADD CONSTRAINT equipment_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES public.establishments(id);


--
-- Name: inventory_items inventory_items_establishment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES public.establishments(id);


--
-- Name: invoice_line_items invoice_line_items_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoice_line_items
    ADD CONSTRAINT invoice_line_items_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id);


--
-- Name: invoices invoices_admission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id);


--
-- Name: invoices invoices_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id);


--
-- Name: invoices invoices_establishment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES public.establishments(id);


--
-- Name: invoices invoices_issued_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_issued_by_user_id_fkey FOREIGN KEY (issued_by_user_id) REFERENCES public.users(id);


--
-- Name: invoices invoices_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: lab_test_requests lab_test_requests_establishment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lab_test_requests
    ADD CONSTRAINT lab_test_requests_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES public.establishments(id);


--
-- Name: lab_test_requests lab_test_requests_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lab_test_requests
    ADD CONSTRAINT lab_test_requests_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: leave_requests leave_requests_establishment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES public.establishments(id);


--
-- Name: leave_requests leave_requests_reviewed_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_reviewed_by_user_id_fkey FOREIGN KEY (reviewed_by_user_id) REFERENCES public.users(id);


--
-- Name: leave_requests leave_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: medical_documents medical_documents_admission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.medical_documents
    ADD CONSTRAINT medical_documents_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id);


--
-- Name: medical_documents medical_documents_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.medical_documents
    ADD CONSTRAINT medical_documents_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id);


--
-- Name: medical_documents medical_documents_author_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.medical_documents
    ADD CONSTRAINT medical_documents_author_user_id_fkey FOREIGN KEY (author_user_id) REFERENCES public.users(id);


--
-- Name: medical_documents medical_documents_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.medical_documents
    ADD CONSTRAINT medical_documents_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.doctors(id);


--
-- Name: medical_documents medical_documents_establishment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.medical_documents
    ADD CONSTRAINT medical_documents_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES public.establishments(id);


--
-- Name: medical_documents medical_documents_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.medical_documents
    ADD CONSTRAINT medical_documents_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: messages messages_establishment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES public.establishments(id);


--
-- Name: messages messages_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: notifications notifications_establishment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES public.establishments(id);


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: opening_hours opening_hours_establishment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.opening_hours
    ADD CONSTRAINT opening_hours_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES public.establishments(id);


--
-- Name: password_reset_tokens password_reset_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: patient_record_shares patient_record_shares_from_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.patient_record_shares
    ADD CONSTRAINT patient_record_shares_from_doctor_id_fkey FOREIGN KEY (from_doctor_id) REFERENCES public.doctors(id);


--
-- Name: patient_record_shares patient_record_shares_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.patient_record_shares
    ADD CONSTRAINT patient_record_shares_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: patient_record_shares patient_record_shares_to_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.patient_record_shares
    ADD CONSTRAINT patient_record_shares_to_doctor_id_fkey FOREIGN KEY (to_doctor_id) REFERENCES public.doctors(id);


--
-- Name: patients patients_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: payments payments_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id);


--
-- Name: payments payments_recorded_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_recorded_by_user_id_fkey FOREIGN KEY (recorded_by_user_id) REFERENCES public.users(id);


--
-- Name: pharmacy_order_items pharmacy_order_items_medication_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pharmacy_order_items
    ADD CONSTRAINT pharmacy_order_items_medication_id_fkey FOREIGN KEY (medication_id) REFERENCES public.pharmacy_stock(id);


--
-- Name: pharmacy_order_items pharmacy_order_items_reservation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pharmacy_order_items
    ADD CONSTRAINT pharmacy_order_items_reservation_id_fkey FOREIGN KEY (reservation_id) REFERENCES public.pharmacy_reservations(id);


--
-- Name: pharmacy_reservation_status_history pharmacy_reservation_status_history_changed_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pharmacy_reservation_status_history
    ADD CONSTRAINT pharmacy_reservation_status_history_changed_by_user_id_fkey FOREIGN KEY (changed_by_user_id) REFERENCES public.users(id);


--
-- Name: pharmacy_reservation_status_history pharmacy_reservation_status_history_reservation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pharmacy_reservation_status_history
    ADD CONSTRAINT pharmacy_reservation_status_history_reservation_id_fkey FOREIGN KEY (reservation_id) REFERENCES public.pharmacy_reservations(id);


--
-- Name: pharmacy_reservations pharmacy_reservations_establishment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pharmacy_reservations
    ADD CONSTRAINT pharmacy_reservations_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES public.establishments(id);


--
-- Name: pharmacy_reservations pharmacy_reservations_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pharmacy_reservations
    ADD CONSTRAINT pharmacy_reservations_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: pharmacy_stock pharmacy_stock_establishment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pharmacy_stock
    ADD CONSTRAINT pharmacy_stock_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES public.establishments(id);


--
-- Name: purchase_orders purchase_orders_establishment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES public.establishments(id);


--
-- Name: purchase_orders purchase_orders_inventory_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_inventory_item_id_fkey FOREIGN KEY (inventory_item_id) REFERENCES public.inventory_items(id);


--
-- Name: purchase_orders purchase_orders_ordered_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_ordered_by_user_id_fkey FOREIGN KEY (ordered_by_user_id) REFERENCES public.users(id);


--
-- Name: purchase_orders purchase_orders_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);


--
-- Name: reference_values reference_values_establishment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reference_values
    ADD CONSTRAINT reference_values_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES public.establishments(id);


--
-- Name: rooms rooms_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rooms
    ADD CONSTRAINT rooms_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: rooms rooms_establishment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rooms
    ADD CONSTRAINT rooms_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES public.establishments(id);


--
-- Name: services services_establishment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES public.establishments(id);


--
-- Name: shifts shifts_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shifts
    ADD CONSTRAINT shifts_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id);


--
-- Name: shifts shifts_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shifts
    ADD CONSTRAINT shifts_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: shifts shifts_establishment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shifts
    ADD CONSTRAINT shifts_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES public.establishments(id);


--
-- Name: shifts shifts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shifts
    ADD CONSTRAINT shifts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: staff_profiles staff_profiles_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_profiles
    ADD CONSTRAINT staff_profiles_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: staff_profiles staff_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_profiles
    ADD CONSTRAINT staff_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: suppliers suppliers_establishment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES public.establishments(id);


--
-- Name: support_messages support_messages_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.support_messages
    ADD CONSTRAINT support_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: users users_establishment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES public.establishments(id);


--
-- Name: vital_signs vital_signs_admission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vital_signs
    ADD CONSTRAINT vital_signs_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id);


--
-- Name: vital_signs vital_signs_recorded_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vital_signs
    ADD CONSTRAINT vital_signs_recorded_by_user_id_fkey FOREIGN KEY (recorded_by_user_id) REFERENCES public.users(id);


--
-- PostgreSQL database dump complete
--

\unrestrict rnvgGwMgFDh5XsbOs7l89EeLmXL9wv1NWTWTcwjJ9r0bmWPDlG5JWoypJ4N2cWl

