---
description: "Schema completo de base de datos Supabase: 31 tablas, volumetría, estructuras, índices, RPCs, JOINs frecuentes, patrones de búsqueda optimizada y ejecución via MCP"
user-invocable: false
---

# Skill: Supabase Data Lookup

Referencia completa del esquema de base de datos Supabase para buscar datos de forma optimizada usando MCP Cloud (`execute_sql`). Usa esta guia cuando el usuario pida consultar, buscar o analizar datos del Portal Colaboradores.

---

## 1. Resumen del Esquema

**31 tablas base + 1 vista** en schema `public`. Extensiones activas: `pg_trgm`, `unaccent`, `vector`, `pg_cron`, `pg_net`.

### Volumetria (filas estimadas)

| Tabla | ~Filas | Descripcion |
|-------|--------|-------------|
| `bd` | 1,941,144 | **Tabla maestra de afiliados** (mas grande) |
| `citas` | 891,979 | Agenda de citas medicas |
| `imagenes` | 142,327 | Imagenes diagnosticas (mamografias, etc.) |
| `back` | 18,246 | Radicados de gestion Back Office |
| `medicamentos` | 15,067 | Catalogo de medicamentos (MAPIISS) |
| `cie10` | 12,572 | Catalogo diagnosticos CIE-10 |
| `cups` | 9,527 | Catalogo procedimientos CUPS |
| `incapacidades` | 6,109 | Incapacidades medicas |
| `demanda_inducida` | 6,089 | Gestiones de demanda inducida |
| `soportes_facturacion` | 3,862 | Soportes de facturacion |
| `cirugias` | 2,308 | Registro de cirugias |
| `contactos` | 1,404 | Directorio de contactos |
| `divipola` | 1,122 | Catalogo municipios DIVIPOLA |
| `od` | 1,061 | Salud oral (odontologia) |
| `pdf_embeddings` | 826 | Embeddings de PDFs para RAG |
| `usuarios_portal` | 452 | Usuarios del portal |
| `red` | 251 | Red de prestadores (IPS) |
| `anexo_8` | 243 | Formulas Anexo 8 (medicamentos) |
| `query_history` | 132 | Historial de queries |
| `import_history` | 110 | Historial de importaciones |
| `config_rutas_emails` | 87 | Config rutas email por EPS |
| `import_jobs` | 77 | Jobs de importacion |
| `recobros` | 56 | Recobros medicos |
| `divipola_dep` | 33 | Catalogo departamentos |
| `sede_labs` | 17 | Sedes de laboratorio |
| `tipoid` | 10 | Tipos de identificacion |
| `labs` | 0 | Laboratorios (vacia) |
| `gest` | 0 | Gestantes (vacia) |
| `res202` | 0 | Resolucion 202 (vacia) |
| `ordenamientos` | 0 | Ordenamientos medicos (vacia) |
| `cervix` | 0 | Tamizaje cervix (vacia) |

**Vista:**
- `afiliados` = SELECT de `bd` + columna calculada `edad` (EXTRACT year FROM age(fecha_nacimiento))

---

## 2. Estructuras de Tablas Principales

### bd (Tabla maestra de afiliados) - PK: (tipo_id, id)
```
tipo_id text NOT NULL        -- Tipo documento (CC, TI, CE, etc.)
id text NOT NULL             -- Numero de identificacion
apellido1 text               -- Primer apellido
apellido2 text               -- Segundo apellido
nombres text                 -- Nombres
sexo text                    -- M/F
direccion text
telefono text
fecha_nacimiento date
estado text                  -- Estado afiliacion (ACTIVO, RETIRADO, etc.)
municipio text
observaciones text
ips_primaria text            -- IPS asignada
tipo_cotizante text
departamento text
rango text                   -- Rango edad (ADULTO, PEDIATRICO, etc.)
email text
regimen text                 -- Regimen (CONTRIBUTIVO, SUBSIDIADO)
fuente text NOT NULL         -- Origen datos (BDUA, SIGIRES, NEPS)
updated_at timestamptz
busqueda_texto text          -- Campo de busqueda full-text (auto-generado)
eps text                     -- EPS del afiliado
```
**Indices clave:** `idx_bd_id` (id), `idx_bd_busqueda_texto_trgm` (GIN trgm), `idx_bd_ips_trgm` (GIN trgm), `idx_bd_fuente` (fuente)

### citas - PK: (id_cita)
```
id_cita text NOT NULL        -- ID unico de cita
identificacion text NOT NULL -- Documento paciente
tipo_id text                 -- Tipo documento
nombres_completos text
sexo text
edad integer
fecha_asignacion date
fecha_cita date
estado_cita text             -- ASIGNADA, CUMPLIDA, INCUMPLIDA, CANCELADA
asunto text NOT NULL         -- Motivo/tipo de cita
sede text
contrato text
medico text
especialidad text
tipo_cita text
cups text                    -- Codigo procedimiento
procedimiento text
dx1, dx2, dx3, dx4 text     -- Diagnosticos CIE-10
duracion interval
unidad_funcional text
usuario_agenda text
usuario_confirma text
updated_at timestamptz
```
**Indices clave:** `idx_citas_id_paciente` (identificacion, tipo_id), `idx_citas_fecha_cita` (fecha_cita, estado_cita), `idx_citas_medico`, `idx_citas_especialidad`, `idx_citas_sede`, `idx_citas_cups`, `idx_asunto_descripcion_trgm` (GIN trgm)

### back - PK: (radicado)
```
radicado text NOT NULL       -- Codigo radicado unico
radicador text NOT NULL      -- Nombre del radicador
id text NOT NULL             -- Documento del paciente
especialidad text
ordenador text               -- Medico que ordena
observaciones text
tipo_solicitud text NOT NULL -- Tipo de solicitud
soportes text[]              -- URLs de soportes
estado_radicado text DEFAULT 'Pendiente'
direccionamiento text
respuesta_back text
created_at timestamptz
updated_at timestamptz
correo_radicador text
ruta text                    -- Ruta de atencion
usuario_respuesta text
contrarreferencia_cache jsonb
```
**Indices clave:** `idx_back_id` (id), `idx_back_estado` (estado_radicado), `idx_back_especialidad`, `idx_back_tipo_solicitud`, `idx_back_created` (created_at DESC)

### contactos - PK: (id uuid)
```
id uuid DEFAULT gen_random_uuid()
tratamiento text             -- Dr., Dra., etc.
primer_nombre text NOT NULL
segundo_nombre text
apellidos text NOT NULL
identificacion text UNIQUE
email_personal text
empresa text
puesto text
celular_1 text
celular_2 text
fecha_nacimiento date
hoja_vida_url text
area text
email_institucional text
firma_url text
direccion text
ciudad text DEFAULT 'Monteria'
departamento text DEFAULT 'Cordoba'
pais text DEFAULT 'Colombia'
notas text
google_contact_id text
outlook_contact_id text
sync_status text DEFAULT 'pending'
last_synced_at timestamptz
sync_error text
created_at, updated_at timestamptz
```
**Indices clave:** `contactos_identificacion_unique`, `idx_contactos_nombre` (primer_nombre, apellidos), `idx_contactos_primer_nombre_trgm` (GIN), `idx_contactos_apellidos_trgm` (GIN), `idx_contactos_segundo_nombre_trgm` (GIN), `idx_contactos_celular`, `idx_contactos_email`

### usuarios_portal - PK: (id uuid)
```
id uuid DEFAULT gen_random_uuid()
contacto_id uuid -> contactos(id)
identificacion text NOT NULL UNIQUE
email_institucional text NOT NULL UNIQUE
nombre_completo text NOT NULL
rol text DEFAULT 'operativo'  -- superadmin, admin, auditor, asistencial, operativo, externo, gerencia
activo boolean DEFAULT true
last_sign_in_at timestamptz
created_by uuid -> auth.users(id)
created_at, updated_at timestamptz
```

### anexo_8 - PK: (id uuid)
```
id uuid
numero_recetario varchar UNIQUE  -- Auto-generado por trigger
paciente_documento, paciente_tipo_id, paciente_nombres, paciente_apellido1 varchar NOT NULL
paciente_apellido2, paciente_edad int, paciente_genero, paciente_telefono varchar
paciente_municipio, paciente_direccion, paciente_departamento, paciente_regimen, paciente_eps varchar
medicamento_nombre varchar NOT NULL
medicamento_concentracion, medicamento_forma_farmaceutica varchar
medicamento_dosis_via varchar
cantidad_numero int NOT NULL, cantidad_letras varchar NOT NULL
diagnostico_cie10, diagnostico_descripcion varchar
medico_id uuid -> usuarios_portal(id)
medico_documento, medico_nombres varchar NOT NULL
medico_especialidad, medico_ciudad, medico_firma_url varchar
fecha_prescripcion date NOT NULL
mes_posfechado int DEFAULT 1, total_meses_formula int DEFAULT 1
formula_padre_id uuid -> anexo_8(id)  -- Self-reference para posfechados
pdf_url, pdf_nombre varchar
generado_por varchar NOT NULL
created_at, updated_at timestamptz
```
**Indices:** `idx_anexo_8_fecha` (fecha_prescripcion DESC), `idx_anexo_8_medico`, `idx_anexo_8_paciente`, `idx_anexo_8_numero`

### soportes_facturacion - PK: (id uuid)
```
id uuid
radicado varchar UNIQUE     -- Auto-generado por trigger
fecha_radicacion timestamptz DEFAULT now()
radicador_email, radicador_nombre varchar
eps varchar NOT NULL, regimen varchar NOT NULL
servicio_prestado varchar NOT NULL
fecha_atencion date NOT NULL
tipo_id, identificacion, nombres_completos varchar
bd_id text                  -- Referencia manual a bd
estado varchar DEFAULT 'Pendiente'
observaciones_facturacion text
urls_validacion_derechos jsonb DEFAULT '[]'
urls_autorizacion, urls_soporte_clinico, urls_comprobante_recibo jsonb DEFAULT '[]'
urls_orden_medica, urls_descripcion_quirurgica, urls_registro_anestesia jsonb DEFAULT '[]'
urls_hoja_medicamentos, urls_notas_enfermeria jsonb DEFAULT '[]'
identificaciones_archivos text[] DEFAULT '{}'
created_at, updated_at timestamptz
```

### recobros - PK: (id uuid)
```
id uuid, consecutivo varchar UNIQUE
paciente_id text NOT NULL, paciente_tipo_id text, paciente_nombres text
cups_data jsonb DEFAULT '[]'    -- Array de procedimientos [{cups, descripcion, cantidad}]
justificacion text
soportes_urls jsonb DEFAULT '[]'
estado varchar DEFAULT 'Pendiente'
respuesta_auditor text
radicador_email text NOT NULL, radicador_nombre text
pdf_aprobacion_url text
created_at, updated_at timestamptz
```

### demanda_inducida - PK: (id bigint serial)
```
id bigserial
paciente_tipo_id text NOT NULL, paciente_id text NOT NULL
fecha_gestion date NOT NULL
celular text, hora_llamada time
clasificacion text NOT NULL   -- Efectiva, No efectiva, etc.
quien_recibe_llamada, relacion_usuario, texto_llamada text
actividades_realizadas, condicion_usuario, soportes_recuperados text
fecha_asignacion_cita date
departamento, municipio text
telefono_actualizado, resultado_llamada text
colaborador text NOT NULL     -- Nombre del colaborador
programa_direccionado text
created_at, updated_at timestamptz
```

### od (Salud oral) - PK: (id uuid)
```
id uuid, paciente_id text NOT NULL
fecha_registro date DEFAULT CURRENT_DATE
colaborador_email text NOT NULL, sede text NOT NULL
gestante, cronicos_hta, cronicos_dm, cronicos_erc boolean DEFAULT false
discapacidad, hemofilia, vih, cancer, menor_5_anios boolean DEFAULT false
cop_caries_no_cavitacional, cop_caries_cavitacional, cop_obturados, cop_perdidos, cop_sanos smallint DEFAULT 0
pym_control_placa, pym_sellantes, pym_fluor_barniz, pym_detartraje, pym_profilaxis, pym_educacion boolean DEFAULT false
pym_sellantes_cantidad smallint DEFAULT 2, pym_detartraje_cantidad int DEFAULT 1
tipo_consulta text
remision_especialidades boolean DEFAULT false
resina_1sup, resina_2sup, resina_3sup, ionomero_1sup, ionomero_2sup, ionomero_3sup smallint DEFAULT 0
obturacion_temporal, pulpectomia, pulpotomia smallint DEFAULT 0
terapia_conducto_tipo, terapia_conducto_raices text, terapia_conducto_cantidad smallint DEFAULT 0
exodoncia_tipo, exodoncia_raices text, exodoncia_incluido boolean DEFAULT false, exodoncia_cantidad smallint DEFAULT 0
control_postquirurgico, tratamiento_finalizado boolean DEFAULT false
created_at, updated_at timestamptz
```

### cirugias - PK: (fecha, id, cups)
```
fecha date NOT NULL, tipo_id text, id text NOT NULL
apellido1, apellido2, nombre1, nombre2 text
edad integer, contrato text
dx1 text -> cie10(cie10)
medico, especialidad, ayudante, anestesiologo text
cups text NOT NULL -> cups(cups)
sede text
updated_at timestamptz
```

### imagenes - PK: (fecha, id, cups)
```
tipo_id text, id text NOT NULL, nombres_completos text
sexo text, edad integer
cups text NOT NULL -> cups(cups)
fecha date NOT NULL
birads text                  -- Clasificacion BI-RADS para mamografias
updated_at timestamptz
```

### incapacidades - PK: (fecha, id)
```
fecha date NOT NULL, tipo_id text, id text NOT NULL
nombres_completos text, contrato text
dx1 text -> cie10(cie10)
medico, especialidad text
fecha_inicio date, fecha_fin date
dias_incapacidad integer
justificacion text
updated_at timestamptz
```

### labs - PK: (id, fecha_lab, analito) [tabla vacia]
```
cups text -> cups(cups), tipo_id text, id text NOT NULL
fecha_lab date NOT NULL, sede_codigo smallint -> sede_labs(sede_codigo)
medico text, fecha_nacimiento date, contrato text
fecha_resultado date, analito text NOT NULL
resultado text, unidades text, validado_por text, asesor text
```

### ordenamientos - PK: (fecha, id, cups) [tabla vacia]
```
fecha date NOT NULL, tipo_id text, id text NOT NULL
nombres_completos, contrato, medico, especialidad text
cups text NOT NULL -> cups(cups)
cantidad integer, servicio text
```

---

## 3. Tablas Catalogo (Lookup)

| Tabla | PK | Campos | Uso |
|-------|----|--------|-----|
| `cie10` | cie10 (text) | cie10_descripcion, st_dias_incapacidad, neps_dias_incapacidad | Diagnosticos |
| `cups` | cups (text) | descripcion, pgp_rc/rs/derm/imat (bool), cpt_cerete/monteria/cienaga (bool), contratos, observaciones, pertinencia (text[]) | Procedimientos |
| `medicamentos` | mapiiss (text) | map_descripcion, capitulo | Medicamentos MAPIISS |
| `tipoid` | afi_tid_codigo | tipo_id | Tipos documento |
| `divipola` | cod_municipio | nombre_departamento, nombre_municipio | Municipios |
| `divipola_dep` | cod_departamento | nombre_departamento | Departamentos |
| `red` | cod_hab | nombre_ips, provincia | Red prestadores |
| `sede_labs` | sede_codigo (smallint) | sede | Sedes laboratorio |

---

## 4. RPCs Disponibles (funciones llamables)

| RPC | Retorno | Uso |
|-----|---------|-----|
| `buscar_contactos(p_termino text)` | json | Busqueda fuzzy de contactos con trgm+unaccent |
| `get_dashboard_metrics()` | json | Metricas del dashboard principal |
| `get_tablero_back_stats()` | json | Estadisticas tablero back |
| `get_tablero_back_stats_dynamic(...)` | json | Estadisticas back con filtros dinamicos |
| `obtener_conteos_rutas()` | json | Conteos por ruta de atencion |
| `obtener_radicadores_unicos()` | record | Lista de radicadores unicos |
| `get_unique_colaboradores()` | text | Colaboradores unicos de demanda_inducida |
| `get_unique_programas()` | text | Programas unicos de demanda_inducida |
| `ejecutar_query(sql text)` | jsonb | Ejecutar SQL dinamico (admin) |
| `exec_sql(sql text)` | json | Ejecutar SQL (admin) |
| `get_user_profile_by_email(email text)` | record | Perfil usuario por email |
| `update_last_login(email text)` | void | Actualizar ultimo login |
| `search_pdf_embeddings(...)` | record | Busqueda semantica en PDFs |
| `upsert_bd_batch(data jsonb)` | jsonb | Upsert masivo en bd |
| `marcar_huerfanos_bd()` | jsonb | Marcar registros huerfanos |
| `importar_cirugias(data jsonb)` | jsonb | Importar cirugias batch |
| `importar_imagenes(data jsonb)` | jsonb | Importar imagenes batch |
| `importar_incapacidades(data jsonb)` | jsonb | Importar incapacidades batch |
| `importar_ordenamientos(data jsonb)` | jsonb | Importar ordenamientos batch |
| `check_is_admin()` | boolean | Verifica si usuario es admin |
| `trigger_import_bd_neps()` | jsonb | Disparar importacion NEPS |

---

## 5. Patrones de Busqueda Optimizada

### Buscar paciente por identificacion (MAS COMUN)
```sql
-- Busqueda exacta (usa indice btree idx_bd_id)
SELECT * FROM bd WHERE id = '123456789';

-- Con tipo de documento
SELECT * FROM bd WHERE tipo_id = 'CC' AND id = '123456789';

-- Todo sobre un paciente: usar vista afiliados (incluye edad calculada)
SELECT * FROM afiliados WHERE id = '123456789';
```

### Busqueda fuzzy por nombre (usa GIN trgm)
```sql
-- Busqueda en campo busqueda_texto (optimizado con trgm)
SELECT tipo_id, id, nombres, apellido1, apellido2, ips_primaria, estado
FROM bd
WHERE busqueda_texto % 'JUAN PEREZ'
ORDER BY similarity(busqueda_texto, 'JUAN PEREZ') DESC
LIMIT 20;
```

### Buscar contacto (usa RPC optimizada)
```sql
SELECT buscar_contactos('Juan');
```

### Historico clinico de paciente
```sql
-- Citas de un paciente (usa idx_citas_id_paciente)
SELECT fecha_cita, asunto, estado_cita, medico, cups, dx1
FROM citas
WHERE identificacion = '123456789'
ORDER BY fecha_cita DESC;

-- Incapacidades (usa idx_incapacidades_id)
SELECT fecha, dx1, medico, fecha_inicio, fecha_fin, dias_incapacidad
FROM incapacidades WHERE id = '123456789' ORDER BY fecha DESC;

-- Cirugias (usa idx_cirugias_id)
SELECT fecha, cups, dx1, medico, especialidad, sede
FROM cirugias WHERE id = '123456789' ORDER BY fecha DESC;

-- Imagenes diagnosticas
SELECT fecha, cups, birads FROM imagenes WHERE id = '123456789' ORDER BY fecha DESC;
```

### Gestion Back Office
```sql
-- Radicados de un paciente
SELECT radicado, tipo_solicitud, especialidad, estado_radicado, created_at
FROM back WHERE id = '123456789' ORDER BY created_at DESC;

-- Radicados por estado
SELECT * FROM back WHERE estado_radicado = 'Pendiente' ORDER BY created_at DESC LIMIT 50;

-- Estadisticas generales del back
SELECT get_tablero_back_stats();
```

### Anexo 8 (Formulas medicas)
```sql
-- Formulas de un paciente
SELECT numero_recetario, medicamento_nombre, cantidad_numero,
       fecha_prescripcion, medico_nombres
FROM anexo_8
WHERE paciente_documento = '123456789'
ORDER BY fecha_prescripcion DESC;
```

### Soportes de facturacion
```sql
-- Por paciente
SELECT radicado, eps, servicio_prestado, fecha_atencion, estado
FROM soportes_facturacion
WHERE identificacion = '123456789' ORDER BY fecha_radicacion DESC;

-- Por estado
SELECT * FROM soportes_facturacion
WHERE estado = 'Pendiente' ORDER BY fecha_radicacion DESC LIMIT 50;
```

### Recobros
```sql
SELECT consecutivo, paciente_nombres, cups_data, estado, created_at
FROM recobros ORDER BY created_at DESC;
```

### Demanda inducida
```sql
-- Por paciente
SELECT fecha_gestion, clasificacion, colaborador, programa_direccionado
FROM demanda_inducida
WHERE paciente_id = '123456789' ORDER BY fecha_gestion DESC;

-- Por colaborador
SELECT * FROM demanda_inducida WHERE colaborador = 'NOMBRE COLABORADOR';
```

### Salud oral
```sql
-- Registros de un paciente
SELECT fecha_registro, sede, tipo_consulta, cop_caries_cavitacional,
       pym_detartraje, tratamiento_finalizado
FROM od WHERE paciente_id = '123456789' ORDER BY fecha_registro DESC;
```

### Catalogos
```sql
-- Buscar diagnostico CIE-10 (trgm fuzzy)
SELECT cie10, cie10_descripcion FROM cie10
WHERE cie10_descripcion % 'hipertension'
ORDER BY similarity(cie10_descripcion, 'hipertension') DESC LIMIT 10;

-- Buscar procedimiento CUPS (trgm fuzzy)
SELECT cups, descripcion FROM cups
WHERE descripcion % 'consulta medicina general'
ORDER BY similarity(descripcion, 'consulta medicina general') DESC LIMIT 10;

-- Buscar medicamento
SELECT mapiiss, map_descripcion FROM medicamentos
WHERE map_descripcion ILIKE '%metformina%' LIMIT 10;
```

### Usuarios del portal
```sql
SELECT nombre_completo, email_institucional, rol, activo
FROM usuarios_portal WHERE activo = true ORDER BY nombre_completo;
```

---

## 6. Relaciones y JOINs Frecuentes

```sql
-- Paciente bd + sus citas (JOIN por id)
SELECT b.nombres, b.apellido1, c.fecha_cita, c.asunto, c.estado_cita
FROM bd b JOIN citas c ON b.id = c.identificacion
WHERE b.id = '123456789' ORDER BY c.fecha_cita DESC;

-- Cita con descripcion CUPS y CIE-10
SELECT c.fecha_cita, c.asunto, cu.descripcion AS procedimiento_desc,
       ci.cie10_descripcion AS diagnostico_desc
FROM citas c
LEFT JOIN cups cu ON c.cups = cu.cups
LEFT JOIN cie10 ci ON c.dx1 = ci.cie10
WHERE c.identificacion = '123456789';

-- Cirugias con descripcion CUPS + CIE-10
SELECT cr.fecha, cu.descripcion, ci.cie10_descripcion, cr.medico
FROM cirugias cr
LEFT JOIN cups cu ON cr.cups = cu.cups
LEFT JOIN cie10 ci ON cr.dx1 = ci.cie10
WHERE cr.id = '123456789';

-- Back con datos paciente
SELECT b.radicado, b.tipo_solicitud, b.estado_radicado, b.especialidad,
       bd.nombres, bd.apellido1, bd.ips_primaria
FROM back b LEFT JOIN bd ON b.id = bd.id
WHERE b.radicado = 'RAD-2024-001';

-- Labs con sede y CUPS
SELECT l.fecha_lab, l.analito, l.resultado, l.unidades,
       s.sede, cu.descripcion
FROM labs l
LEFT JOIN sede_labs s ON l.sede_codigo = s.sede_codigo
LEFT JOIN cups cu ON l.cups = cu.cups
WHERE l.id = '123456789';

-- Anexo 8 con datos de medico usuario_portal
SELECT a.numero_recetario, a.medicamento_nombre, a.cantidad_numero,
       u.nombre_completo AS medico, u.email_institucional
FROM anexo_8 a
LEFT JOIN usuarios_portal u ON a.medico_id = u.id
WHERE a.paciente_documento = '123456789';
```

---

## 7. Tips de Performance

1. **bd es enorme (1.9M filas)**: SIEMPRE filtrar por `id` (btree) o `busqueda_texto` (trgm). NUNCA `SELECT *` sin WHERE.
2. **citas tiene 891K filas**: Filtrar por `identificacion` + `tipo_id` (indice compuesto) o `fecha_cita` + `estado_cita`.
3. **Busqueda fuzzy**: Usar operador `%` (similarity) en campos con indice GIN trgm: `busqueda_texto` (bd), `asunto` (citas), `cie10_descripcion` (cie10), `descripcion` (cups), `primer_nombre`/`apellidos` (contactos).
4. **Paginacion**: Usar `LIMIT` + `OFFSET` o cursor-based con `created_at`.
5. **Conteos**: Para tablas grandes, usar `SELECT count(*)` con filtro o `pg_stat_user_tables.n_live_tup` para estimado rapido.
6. **JOINs con catalogos**: `cups`, `cie10`, `medicamentos` son tablas pequenas, JOIN es eficiente.
7. **Columnas JSONB**: `cups_data` (recobros), `soportes_urls`, `urls_*` (soportes_facturacion) - usar operadores `->`, `->>`, `@>`.
8. **Fechas**: La mayoria de tablas clinicas tienen `fecha` (date) para filtro temporal. Back usa `created_at` (timestamptz).

---

## 8. Ejecucion via MCP

Para ejecutar consultas, usar la herramienta `mcp__claude_ai_Supabase__execute_sql`:

```
mcp__claude_ai_Supabase__execute_sql({ query: "SELECT ..." })
```

Para RPCs:
```
mcp__claude_ai_Supabase__execute_sql({ query: "SELECT buscar_contactos('Juan')" })
```

**IMPORTANTE**: Siempre usar `LIMIT` en tablas grandes. Si el resultado excede el maximo de tokens, reducir campos o agregar filtros.
