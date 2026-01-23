/**
 * Tipos para el módulo de Radicación de Casos (Back Office)
 * Portal de Colaboradores GESTAR SALUD IPS
 */

// Tipos de solicitud disponibles
export type TipoSolicitudBack =
    | 'Auditoría Médica'
    | 'Solicitud de Historia Clínica'
    | 'Ajuste de Ordenamiento'
    | 'Renovación de prequirúrgicos'
    | 'Gestión de Mipres'
    | 'Activación de Ruta'

// Estados del radicado con colores semaforizados
export type EstadoRadicado =
    | 'Pendiente'        // Rojo
    | 'Contrarreferido'  // Negro
    | 'Devuelto'         // Amarillo
    | 'Gestionado'       // Azul suave
    | 'Autorizado'       // Verde
    | 'Enrutado'         // Azul
    | 'En espera'        // Naranja
    | 'Rechazado'        // Rojo oscuro

// Opciones de direccionamiento
export type Direccionamiento =
    | 'Médico Experto'
    | 'Médico Especialista'
    | 'Nueva EPS'

// Especialidades para Auditoría Médica
export type EspecialidadAuditoria =
    | 'Medicina Interna'
    | 'Dermatología'
    | 'Ortopedia'
    | 'Urología'
    | 'Otorrinolaringología'
    | 'Reumatología'

// Radicación transformada (camelCase) para el frontend
export interface BackRadicacion {
    radicado: string
    radicador: string
    emailRadicador: string | null
    cargoRadicador: string | null
    id: string
    especialidad: string | null
    ordenador: string | null
    observaciones: string | null
    tipoSolicitud: TipoSolicitudBack
    soportes: string[] | null
    estadoRadicado: EstadoRadicado
    direccionamiento: Direccionamiento | null
    respuestaBack: string | null
    createdAt: Date
    updatedAt: Date
}

export interface BackRadicacionRaw {
    radicado: string
    radicador: string
    correo_radicador?: string | null // Campo inferido
    id: string
    especialidad: string | null
    ordenador: string | null
    observaciones: string | null
    tipo_solicitud: string
    soportes: string[] | null
    estado_radicado: string
    direccionamiento: string | null
    respuesta_back: string | null
    created_at: string
    updated_at: string
}

// Datos para crear una nueva radicación
export interface CrearRadicacionData {
    radicador: string
    id: string
    tipoSolicitud: TipoSolicitudBack
    especialidad?: EspecialidadAuditoria
    ordenador?: string
    observaciones?: string
    archivos?: File[]
}

// Datos para crear un afiliado nuevo en bd
export interface CrearAfiliadoData {
    tipoId: string
    id: string
    nombres: string
    apellido1: string
    apellido2?: string
    sexo?: string
    direccion?: string
    telefono?: string
    fechaNacimiento?: string // formato YYYY-MM-DD
    municipio?: string // código DANE 3 dígitos
    departamento?: string // código DANE 2 dígitos
    regimen?: string
    ipsPrimaria?: string
    tipoCotizante?: string
    eps?: string
}

// Configuración de colores para estados
export const ESTADO_COLORES: Record<EstadoRadicado, { bg: string; text: string; border: string }> = {
    'Pendiente': { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' },
    'Contrarreferido': { bg: 'bg-gray-800', text: 'text-white', border: 'border-gray-900' },
    'Devuelto': { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300' },
    'Gestionado': { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
    'Autorizado': { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300' },
    'Enrutado': { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300' },
    'En espera': { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300' },
    'Rechazado': { bg: 'bg-rose-100', text: 'text-rose-800', border: 'border-rose-300' },
}

// Lista de ordenadores predefinidos
export const ORDENADORES_LISTA = [
    'ALEX MANUEL SIERRA HERNANDEZ',
    'ALEXANDER DEL CRISTO ALMANZA HOYOS',
    'ALFONSO JOSE AYUS DURAN',
    'ANDREA ATENCIO SOTO',
    'ANGIE PAOLA CASTILLO DIAZ',
    'ANGGIE DANIELA TABALRES ORTIZ',
    'ART MEDICA SAS',
    'AURA MARIA DEL CARMEN MEDINA ROJAS',
    'BERNARDO JOSE GONZALEZ PEREZ',
    'CAMILA ANDREA SANTERO RAMIREZ',
    'CARLOS ANDRES BELTRAN FORERO',
    'CLAUDIA MERCEDES JARAMILLO RODRIGUEZ',
    'CLINICA CENTRAL OHL',
    'CLINICA MATERNO INFANTIL CASA DEL NIÑO',
    'CLINICA MONTERIA',
    'CLINIICA IMAT',
    'DAMOSALUD',
    'EDGARDO NICOLAS GUZMAN PINEDA',
    'ESE CAMU CANALETE',
    'ESE CAMU COTORRA',
    'ESE CAMU EL PRADO',
    'ESE CAMU LOS CORDOBAS',
    'ESE CAMU SAN PELAYO',
    'ESE CAMU PUERTO ESCONDIDO',
    'ESE HOSPITAL SAGRADO CORAZON DE JESUS VALENCIA',
    'ESE HOSPITAL SAN FRANCISCO CIENAGA DE ORO',
    'ESE HOSPITAL SAN JOSE DE TIERRALTA',
    'ESE HOSPITAL SANDIEGO DE CERETE',
    'ESE HOSPITAL SANDIEGO SAN CARLOS',
    'ESE VIDASINU',
    'FUNCRIT',
    'FUNDASOLIDARIA',
    'FUNDACION AMIGOS DE LA SALUD',
    'GERARDO JOSE DE LA OSSA CAUSIL',
    'HILDA CRISTINA SERRANO POLO',
    'INDULFO JOSE ZAPATA SUAREZ',
    'INTERMEDIOS',
    'JHONATTAN CABRALES LARA',
    'JHONNY MANUEL MERCADO PAEZ',
    'JOSE LUIS LOZANO DURAN',
    'JOSE MARIA BEHAINE MONTES',
    'JUAN GABRIEL BUELVAS GOMEZ',
    'JULIO CESAR VILLALOBOS COMAS',
    'JULIO ELIAS AGAMEZ ARAUJO',
    'JULIO JOSE BELLO POVEA',
    'LEIDYS SUSANA DORADO PEREZ',
    'LUCENA SALAS QUINTERO',
    'LUIS ARTURO PAYARES QUESSEP',
    'LUIS EDUARDO RUEDA FONSECA',
    'MARIA CAMILA PERTUZ JIMENEZ',
    'MARIELA DE JESUS ESPITIA SOTO',
    'NATALIA MEDINA DIAZ',
    'RAUL ANDRES PEREZ TABOADA',
    'RUBEN BANDA RAMOS',
    'SALUD TIERRALTA IPS SAS',
    'SALUMED LTDA',
    'SEBASTIAN RAFAEL MENDOZA CABANA',
    'SILVIANA GARRIDO CABRERA',
    'SOLUCIONES EN SALUD IPS',
    'VIVIR CON SALUD',
    'YANDITH YANETH MUSKUS TOBIAS',
    'YAQUELIN TIRADO DIAZ',
    'ZULEIKA MAJORIE OJEDA PINTO',
] as const

// Tipos de solicitud para el dropdown
export const TIPOS_SOLICITUD_LISTA: TipoSolicitudBack[] = [
    'Auditoría Médica',
    'Solicitud de Historia Clínica',
    'Ajuste de Ordenamiento',
    'Renovación de prequirúrgicos',
    'Gestión de Mipres',
    'Activación de Ruta',
]

// Especialidades para el dropdown
export const ESPECIALIDADES_LISTA: EspecialidadAuditoria[] = [
    'Medicina Interna',
    'Dermatología',
    'Ortopedia',
    'Urología',
    'Otorrinolaringología',
    'Reumatología',
]

// ========================================
// LISTAS PARA FORMULARIO DE AFILIADO
// ========================================

// Opciones de sexo
export const SEXO_LISTA = [
    { value: 'M', label: 'Masculino' },
    { value: 'F', label: 'Femenino' },
] as const

// Opciones de régimen
export const REGIMEN_LISTA = [
    { value: 'CONTRIBUTIVO', label: 'Contributivo' },
    { value: 'SUBSIDIADO', label: 'Subsidiado' },
] as const

// Opciones de tipo de cotizante
export const TIPO_COTIZANTE_LISTA = [
    { value: 'COTIZANTE', label: 'Cotizante' },
    { value: 'BENEFICIARIO', label: 'Beneficiario' },
] as const

// Municipios de Córdoba con código DANE
export const MUNICIPIOS_CORDOBA = [
    { codigo: '068', nombre: 'AYAPEL', departamento: '23' },
    { codigo: '079', nombre: 'BUENAVISTA', departamento: '23' },
    { codigo: '090', nombre: 'CANALETE', departamento: '23' },
    { codigo: '162', nombre: 'CERETE', departamento: '23' },
    { codigo: '168', nombre: 'CHIMA', departamento: '23' },
    { codigo: '182', nombre: 'CHINU', departamento: '23' },
    { codigo: '189', nombre: 'CIENAGA DE ORO', departamento: '23' },
    { codigo: '300', nombre: 'COTORRA', departamento: '23' },
    { codigo: '350', nombre: 'LA APARTADA', departamento: '23' },
    { codigo: '417', nombre: 'LORICA', departamento: '23' },
    { codigo: '419', nombre: 'LOS CORDOBAS', departamento: '23' },
    { codigo: '464', nombre: 'MOMIL', departamento: '23' },
    { codigo: '466', nombre: 'MONTELIBANO', departamento: '23' },
    { codigo: '001', nombre: 'MONTERIA', departamento: '23' },
    { codigo: '500', nombre: 'MOÑITOS', departamento: '23' },
    { codigo: '555', nombre: 'PLANETA RICA', departamento: '23' },
    { codigo: '570', nombre: 'PUEBLO NUEVO', departamento: '23' },
    { codigo: '574', nombre: 'PUERTO ESCONDIDO', departamento: '23' },
    { codigo: '580', nombre: 'PUERTO LIBERTADOR', departamento: '23' },
    { codigo: '586', nombre: 'PURISIMA', departamento: '23' },
    { codigo: '660', nombre: 'SAHAGUN', departamento: '23' },
    { codigo: '670', nombre: 'SAN ANDRES DE SOTAVENTO', departamento: '23' },
    { codigo: '672', nombre: 'SAN ANTERO', departamento: '23' },
    { codigo: '675', nombre: 'SAN BERNARDO DEL VIENTO', departamento: '23' },
    { codigo: '678', nombre: 'SAN CARLOS', departamento: '23' },
    { codigo: '682', nombre: 'SAN JOSE DE URE', departamento: '23' },
    { codigo: '686', nombre: 'SAN PELAYO', departamento: '23' },
    { codigo: '807', nombre: 'TIERRALTA', departamento: '23' },
    { codigo: '815', nombre: 'TUCHIN', departamento: '23' },
    { codigo: '855', nombre: 'VALENCIA', departamento: '23' },
] as const

// Lista de IPS primarias disponibles
export const IPS_PRIMARIA_LISTA = [
    'CAMI LTDA',
    'CLINICA BIJAO IPS LTDA',
    'CLINICA LA TRINIDAD I.P.S. LTDA LORICA',
    'DAMOSALUD  LTDA',
    'E.A.T. CENTRO MEDICO SANTA MARIA I.P.S.',
    'E.A.T. VIVIR CON SALUD I.P.S.',
    'EMPRESA SOCIAL DEL ESTADO CAMU DEL PRADO',
    'E.S.E. CENTRO DE SALUD DE COTORRA',
    'ESE HOSPITAL SAN JOSE DE CANALETE',
    'ESE  SANTA TERESITA DE LORICA',
    'FAMI SALUD I.P.S. LTDA',
    'GESTAR SALUD DE COLOMBIA CERETE CONTRIBU',
    'GESTAR SALUD DE COLOMBIA CERETE CONTRIBUTIVO',
    'GESTAR SALUD DE COLOMBIA IPS S.A.S.',
    'GESTAR SALUD DE COLOMBIA IPS S.A.S.- CIENAGA DE ORO',
    'GRUPO SALUD CORDOBA LIMITADA',
    'IPS FUNDACION PANZENU',
    'I.P.S. SALUMED CHINU',
    'I.P.S. SALUMED LTDA',
    'I.P.S SOLOSALUD JD S.A.S',
    'I.P.S. UNIDAD MEDICA REGIONAL LIMITADA',
    'SALUD TIERRALTA I.P.S. S.A.S.',
    'SOLOSALUD IPS SAN BERNARDO S.A.S.',
    'SOLUCIONES EN SALUD IPS',
    'SUBSIDIADO-CENTRO DE SALUD DE CHIMA',
    'SUBSIDIADO-CLINICA BIJAO IPS LTDA',
    'SUBSIDIADO-EMPRESA SOCIAL DEL ESTADO CAMU MOÑITOS',
    'SUBSIDIADO-EMPRESA SOCIAL DEL ESTADO VIDASINU',
    'SUBSIDIADO-E.S.E. CAMU BUENAVISTA',
    'SUBSIDIADO-E.S.E. CAMU CORNELIO VALDELAMAR PEÑA - PUERTO ESCONDIDO',
    'SUBSIDIADO-E.S.E. CAMU DE CANALETE',
    'SUBSIDIADO-E.S.E. CAMU DE MOMIL',
    'SUBSIDIADO-E.S.E. CAMU DE PURISIMA',
    'SUBSIDIADO-ESE CAMU DIVINO NIÑO',
    'SUBSIDIADO-E.S.E. CAMU EL PRADO',
    'SUBSIDIADO-E.S.E CAMU IRIS LOPEZ DURAN - E.S.E. CAMU DE SAN ANTERO',
    'SUBSIDIADO-E.S.E. C.A.M.U. LA APARTADA',
    'SUBSIDIADO-E.S.E. CAMU LOS CORDOBAS',
    'SUBSIDIADO-E.S.E. CAMU PUEBLO NUEVO',
    'SUBSIDIADO-ESE CAMU SAN PELAYO - PUESTO DE SALUD DE BUENOS AIRES',
    'SUBSIDIADO-E.S.E. CAMU SAN RAFAEL DE SAHAGUN',
    'SUBSIDIADO-E.S.E. CAMU SANTA TERESITA',
    'SUBSIDIADO-E.S.E. HOSPITAL MONTELIBANO',
    'SUBSIDIADO-ESE HOSPITAL SAGRADO CORAZON DE JESUS',
    'SUBSIDIADO-E.S.E. HOSPITAL SANDIEGO SAN CARLOS',
    'SUBSIDIADO-ESE HOSPITAL SAN FRANCISCO',
    'SUBSIDIADO-E.S.E. HOSPITAL SAN JOSE DE SAN BERNARDO DEL VIENTO',
    'SUBSIDIADO-E.S.E. HOSPITAL SAN JOSE DE TIERRALTA',
    'SUBSIDIADO-E.S.E. HOSPITAL SAN NICOLAS',
    'SUBSIDIADO-E.S.E. HOSPITAL SAN RAFAEL DE CHINU',
    'SUBSIDIADO-FUNDACION SOLIDARIA FUNDASOLIDARIA I.P.S.',
    'SUBSIDIADO-HOSPITAL SAN JORGE',
    'SUBSIDIADO-INSTITUCIÓN PRESTADORA DE SERVICIOS DE SALUD INDÍGENA MANEXKA IPS-I',
    'SUBSIDIADO-INSTITUCION PRESTADORA DE SERVICIOS DE SALUD MANEXKA IPSI SEDE MOMIL',
    'SUBSIDIADO-MEDISALUD MONTERIA SAS SEDE MEXION SALUS IPS',
    'SUBSIDIADO-SALUD TIERRALTA IPS SAS',
    'TODO SALUD I.P.S. LTDA',
    'UNION TEMPORAL NUEVA SALUD - CLINICA DEL PILAR LORICA',
    'UNION TEMPORAL NUEVA SALUD - MEDICINA INTEGRAL S.A MONTELIBANO',
    'UNION TEMPORAL NUEVA SALUD - MEDICINA INTEGRAL S.A PLANETA RICA',
    'UT INTEGRAL  - SAHAGUN',
    'U.T. SOLUCIONES INTEGRALES - MEDICINA INTEGRAL S.A. - TR1',
    'VS UAB SINU CENTRO',
] as const

// Lista de EPS
export const EPS_LISTA = [
    'NUEVA EPS',
    'SALUD TOTAL',
] as const

// ========================================
// TIPOS PARA GESTIÓN BACK Y AUDITORÍA
// ========================================

// Radicación extendida con datos del paciente (para lista de gestión)
export interface BackRadicacionExtendido extends BackRadicacion {
    nombreRadicador?: string | null
    paciente: {
        nombres: string
        apellido1: string
        apellido2: string | null
        tipoId: string
        telefono: string | null
        municipio: string | null
        direccion: string | null
        ipsPrimaria: string | null
        email: string | null
        eps: string | null
    } | null
}

// Filtros para búsqueda de casos
export interface FiltrosCasosBack {
    busqueda?: string
    tipoSolicitud?: TipoSolicitudBack | null
    especialidad?: string | null
    estadoRadicado?: EstadoRadicado | 'Todos'
    fechaInicio?: string
    fechaFin?: string
    sortField?: 'radicado' | 'id' | 'tipo_solicitud' | 'especialidad' | 'estado_radicado' | 'created_at'
    sortOrder?: 'asc' | 'desc'
}

// Conteos para las cards de estadísticas
export interface ConteosCasosBack {
    porTipoSolicitud: { tipo: string; cantidad: number }[]
    porEspecialidad: { especialidad: string; cantidad: number }[]
}

// Respuesta cruda extendida de Supabase con join a bd
export interface BackRadicacionRawExtendido extends BackRadicacionRaw {
    bd: {
        nombres: string
        apellido1: string
        apellido2: string | null
        tipo_id: string
        telefono: string | null
        municipio: string | null
        direccion: string | null
        ips_primaria: string | null
        email: string | null
    } | null
}

// Colores para cards de tipo de solicitud
export const TIPO_SOLICITUD_COLORES: Record<string, { bg: string; text: string; border: string; icon: string }> = {
    'Auditoría Médica': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', icon: 'Stethoscope' },
    'Solicitud de Historia Clínica': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: 'BookOpen' },
    'Ajuste de Ordenamiento': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', icon: 'FileEdit' },
    'Renovación de prequirúrgicos': { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', icon: 'Activity' },
    'Gestión de Mipres': { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', icon: 'Zap' },
    'Activación de Ruta': { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200', icon: 'Route' },
}

// Colores para cards de especialidad
export const ESPECIALIDAD_COLORES: Record<string, { bg: string; text: string; border: string }> = {
    'Medicina Interna': { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
    'Dermatología': { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200' },
    'Ortopedia': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
    'Urología': { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' },
    'Otorrinolaringología': { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
    'Reumatología': { bg: 'bg-lime-50', text: 'text-lime-700', border: 'border-lime-200' },
}

// Lista de estados para filtros
export const ESTADOS_RADICADO_LISTA: (EstadoRadicado | 'Todos')[] = [
    'Pendiente',
    'Contrarreferido',
    'Devuelto',
    'Gestionado',
    'Autorizado',
    'Enrutado',
    'En espera',
    'Rechazado',
    'Todos',
]

// Opciones de direccionamiento para el dropdown
export const DIRECCIONAMIENTO_LISTA: Direccionamiento[] = [
    'Médico Experto',
    'Médico Especialista',
    'Nueva EPS',
]

// ========================================
// TIPOS PARA CONTRARREFERENCIA CON IA
// ========================================

/**
 * Resultado de generación de contrarreferencia automática
 */
export interface ContrarreferenciaResult {
    success: boolean
    texto?: string
    error?: string
    metodo?: 'vectorizado' | 'vectorizado-on-fly' | 'cache'
    tiempoMs?: number
    retryAfter?: number  // Segundos a esperar antes de reintentar (para error 429)
}
