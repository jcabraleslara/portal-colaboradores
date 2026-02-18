/**
 * Tipos para Módulo Anexo 8
 * Portal de Colaboradores GESTAR SALUD IPS
 * 
 * Recetario Oficial para Medicamentos de Control Especial (FNE)
 */

// ========================================
// CONSTANTES DE MEDICAMENTOS Y FORMAS
// ========================================

/**
 * Lista de medicamentos de control especial permitidos
 */
export const MEDICAMENTOS_CONTROLADOS = [
    'Alprazolam',
    'Bromazepam',
    'Buprenorfina',
    'Clobazam',
    'Clonazepam',
    'Clozapina',
    'Diazepam',
    'Eszopiclona',
    'Fentanilo',
    'Fenobarbital',
    'Hidrato de Cloral',
    'Hidromorfona',
    'Ketamina',
    'Lisdexanfetamina',
    'Lorazepam',
    'Meperidina',
    'Metadona',
    'Metilfenidato',
    'Mexazolam',
    'Midazolam',
    'Morfina',
    'Oxicodona',
    'Primidona',
    'Propofol',
    'Remifentanilo',
    'Tapentadol',
    'Tetrahidrocannabinol',
    'Tiopental sódico',
    'Triazolam',
    'Zolpidem',
    'Zopiclona'
] as const

export type MedicamentoControlado = typeof MEDICAMENTOS_CONTROLADOS[number]

/**
 * Formas farmacéuticas disponibles
 */
export const FORMAS_FARMACEUTICAS = [
    'Cápsula de liberación prolongada',
    'Jarabe',
    'Parche Transdérmico',
    'Polvo para reconstituir',
    'Solución Inyectable',
    'Solución Nasal',
    'Solución Oral',
    'Solución para pulverización bucal',
    'Tableta',
    'Tableta Sublingual'
] as const

export type FormaFarmaceutica = typeof FORMAS_FARMACEUTICAS[number]

/**
 * Tipos de régimen de afiliación
 */
export const REGIMENES = ['Subsidiado', 'Contributivo', 'Vinculado'] as const
export type Regimen = typeof REGIMENES[number]

// ========================================
// INTERFACES DE DATOS
// ========================================

/**
 * Registro completo de la tabla anexo_8
 */
export interface Anexo8Record {
    id: string
    numero_recetario: string

    // Datos paciente
    paciente_documento: string
    paciente_tipo_id: string
    paciente_nombres: string
    paciente_apellido1: string
    paciente_apellido2: string | null
    paciente_edad: number | null
    paciente_genero: 'F' | 'M' | null
    paciente_telefono: string | null
    paciente_municipio: string | null
    paciente_direccion: string | null
    paciente_departamento: string | null
    paciente_regimen: Regimen | null
    paciente_eps: string | null

    // Datos medicamento
    medicamento_nombre: MedicamentoControlado
    medicamento_concentracion: string | null
    medicamento_forma_farmaceutica: FormaFarmaceutica
    medicamento_dosis_via: string | null
    cantidad_numero: number
    cantidad_letras: string

    // Diagnóstico
    diagnostico_cie10: string | null
    diagnostico_descripcion: string | null

    // Datos médico
    medico_id: string | null
    medico_tipo_doc: string
    medico_documento: string
    medico_nombres: string
    medico_especialidad: string | null
    medico_ciudad: string | null
    medico_firma_url: string | null

    // Fechas
    fecha_prescripcion: string
    fecha_generacion: string

    // Posfechado
    mes_posfechado: number
    total_meses_formula: number
    formula_padre_id: string | null

    // PDF
    pdf_url: string | null
    pdf_nombre: string | null

    // Metadata
    generado_por: string
    created_at: string
    updated_at: string
}

/**
 * Datos para crear un nuevo Anexo 8 (sin campos autogenerados)
 */
export interface Anexo8CreateData {
    // Datos paciente
    paciente_documento: string
    paciente_tipo_id: string
    paciente_nombres: string
    paciente_apellido1: string
    paciente_apellido2?: string | null
    paciente_edad?: number | null
    paciente_genero?: 'F' | 'M' | null
    paciente_telefono?: string | null
    paciente_municipio?: string | null
    paciente_direccion?: string | null
    paciente_departamento?: string | null
    paciente_regimen?: Regimen | null
    paciente_eps?: string | null

    // Datos medicamento
    medicamento_nombre: MedicamentoControlado
    medicamento_concentracion?: string | null
    medicamento_forma_farmaceutica: FormaFarmaceutica
    medicamento_dosis_via?: string | null
    cantidad_numero: number
    cantidad_letras: string

    // Diagnóstico
    diagnostico_cie10?: string | null
    diagnostico_descripcion?: string | null

    // Datos médico
    medico_id?: string | null
    medico_tipo_doc?: string
    medico_documento: string
    medico_nombres: string
    medico_especialidad?: string | null
    medico_ciudad?: string | null
    medico_firma_url?: string | null

    // Fechas
    fecha_prescripcion: string

    // Posfechado
    mes_posfechado?: number
    total_meses_formula?: number
    formula_padre_id?: string | null

    // PDF
    pdf_url?: string | null
    pdf_nombre?: string | null

    // Metadata
    generado_por: string
}

/**
 * Datos del formulario de entrada (UI)
 */
export interface Anexo8FormData {
    // Paciente seleccionado
    pacienteDocumento: string

    // Medicamento
    medicamentoNombre: MedicamentoControlado | ''
    concentracion: string
    formaFarmaceutica: FormaFarmaceutica | ''
    dosisVia: string
    cantidadNumero: number | ''

    // Diagnóstico
    diagnosticoCie10: string
    diagnosticoDescripcion: string

    // Médico (ID del usuario portal)
    medicoId: string

    // Configuración
    fechaPrescripcion: string // YYYY-MM-DD
    mesesFormula: number // 1-6
}

/**
 * Datos del médico para el formulario
 */
export interface MedicoData {
    id: string
    documento: string
    nombreCompleto: string
    especialidad: string | null
    ciudad: string | null
    firmaUrl: string | null
}

/**
 * Respuesta del OCR
 */
export interface Anexo8OcrResult {
    // Paciente
    pacienteDocumento?: string
    pacienteTipoId?: string
    pacienteNombres?: string
    pacienteApellido1?: string
    pacienteApellido2?: string
    pacienteEdad?: number
    pacienteGenero?: 'F' | 'M'

    // Medicamento
    medicamentoNombre?: string
    concentracion?: string
    formaFarmaceutica?: string
    dosisVia?: string
    cantidadNumero?: number
    diasTratamiento?: number

    // Cálculo de meses
    cantidadPorMes?: number
    mesesTratamiento?: number

    // Diagnóstico
    diagnosticoCie10?: string
    diagnosticoDescripcion?: string

    // Médico
    medicoNombre?: string
    medicoDocumento?: string
    medicoRegistro?: string

    // Confianza del OCR
    confidence: number
}

/**
 * Filtros para historial de Anexos
 */
export interface Anexo8Filtros {
    pacienteDocumento?: string
    medicoId?: string
    medicoNombres?: string
    fechaDesde?: string
    fechaHasta?: string
    medicamento?: MedicamentoControlado | string
}
