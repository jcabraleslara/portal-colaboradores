/**
 * Componente Plantilla Anexo 8
 * Recetario Oficial para Medicamentos de Control Especial
 * Portal de Colaboradores GESTAR SALUD IPS
 * 
 * Este componente renderiza el formulario Anexo 8 en HTML que luego
 * se convierte a PDF usando html2pdf.js
 */

import './Anexo8Template.css'
import { Anexo8Record } from '@/types/anexo8.types'

// Escudo de Colombia desde carpeta public
const escudoColombia = '/templates/escudo_colombia.jpg'

interface Anexo8TemplateProps {
    data: Anexo8Record
    tipo: 'original' | 'copia'
}

/**
 * Renderiza una sola sección del Anexo 8 (Original o Copia)
 */
function Anexo8Seccion({ data, tipo }: Anexo8TemplateProps) {
    // Extraer fecha
    const [anio, mes, dia] = data.fecha_prescripcion.split('-')

    // Separar nombres del médico
    const medicoNombresArr = data.medico_nombres.split(' ')
    // Asumir formato: APELLIDO1 APELLIDO2 NOMBRE1 NOMBRE2
    const medicoApellido1 = medicoNombresArr[0] || ''
    const medicoApellido2 = medicoNombresArr[1] || ''
    const medicoNombres = medicoNombresArr.slice(2).join(' ') || medicoNombresArr.slice(1).join(' ')

    return (
        <div className="anexo8-seccion">
            {/* ENCABEZADO */}
            <div className="anexo8-header">
                <div className="anexo8-escudo">
                    <img src={escudoColombia} alt="Escudo Colombia" />
                </div>
                <div className="anexo8-titulo-container">
                    <div className="anexo8-titulo-linea1">República de Colombia</div>
                    <div className="anexo8-titulo-linea2">U.A.E. Fondo Nacional de Estupefacientes</div>
                    <div className="anexo8-titulo-linea3">Ministerio de la Protección Social</div>
                    <div className="anexo8-anexo-numero">ANEXO No. 8</div>
                </div>
            </div>

            {/* RECETARIO + Nº */}
            <div className="anexo8-recetario-row">
                <div className="anexo8-recetario-titulo">
                    RECETARIO OFICIAL PARA MEDICAMENTOS DE CONTROL ESPECIAL
                </div>
                <div className="anexo8-numero-recetario">
                    Nº <span className="anexo8-numero-valor">{data.numero_recetario}</span>
                </div>
            </div>

            {/* 1. PACIENTE + FECHA */}
            <div className="anexo8-paciente-header">
                <span className="anexo8-seccion-titulo">1. PACIENTE</span>
                <div className="anexo8-fecha-container">
                    <div className="anexo8-fecha-item">
                        <span className="anexo8-fecha-label">Fecha</span>
                    </div>
                    <div className="anexo8-fecha-item">
                        <span className="anexo8-fecha-label">Día</span>
                        <span className="anexo8-fecha-value">{dia}</span>
                    </div>
                    <div className="anexo8-fecha-item">
                        <span className="anexo8-fecha-label">Mes</span>
                        <span className="anexo8-fecha-value">{mes}</span>
                    </div>
                    <div className="anexo8-fecha-item anexo8-anio">
                        <span className="anexo8-fecha-label">Año</span>
                        <span className="anexo8-fecha-value">{anio}</span>
                    </div>
                </div>
            </div>

            {/* Nombres del Paciente */}
            <div className="anexo8-row">
                <div className="anexo8-cell anexo8-cell-primer-apellido">
                    <span className="anexo8-cell-label">Primer Apellido</span>
                    <span className="anexo8-cell-value">{data.paciente_apellido1}</span>
                </div>
                <div className="anexo8-cell anexo8-cell-segundo-apellido">
                    <span className="anexo8-cell-label">Segundo Apellido</span>
                    <span className="anexo8-cell-value">{data.paciente_apellido2 || ''}</span>
                </div>
                <div className="anexo8-cell anexo8-cell-nombres">
                    <span className="anexo8-cell-label">Nombres</span>
                    <span className="anexo8-cell-value">{data.paciente_nombres}</span>
                </div>
            </div>

            {/* Documento, Edad, Género */}
            <div className="anexo8-doc-row">
                <div className="anexo8-doc-label">Documento de Identificación</div>
                <div className="anexo8-doc-tipos">
                    <div className="anexo8-doc-tipo">
                        <div className={`anexo8-checkbox ${data.paciente_tipo_id === 'TI' ? 'checked' : ''}`} />
                        <span>TI</span>
                    </div>
                    <div className="anexo8-doc-tipo">
                        <div className={`anexo8-checkbox ${data.paciente_tipo_id === 'CC' ? 'checked' : ''}`} />
                        <span>CC</span>
                    </div>
                    <div className="anexo8-doc-tipo">
                        <div className={`anexo8-checkbox ${!['TI', 'CC'].includes(data.paciente_tipo_id) ? 'checked' : ''}`} />
                        <span>Otro:</span>
                    </div>
                </div>
                <div className="anexo8-doc-numero">
                    <span className="anexo8-cell-label">Número</span>
                    <span className="anexo8-cell-value">{data.paciente_documento}</span>
                </div>
                <div className="anexo8-edad">
                    <span className="anexo8-cell-label">Edad</span>
                    <span className="anexo8-cell-value">{data.paciente_edad || ''}</span>
                </div>
                <div className="anexo8-genero">
                    <span className="anexo8-cell-label">Género</span>
                    <div className="anexo8-genero-item">
                        <div className={`anexo8-checkbox ${data.paciente_genero === 'F' ? 'checked' : ''}`} />
                        <span>F</span>
                    </div>
                    <div className="anexo8-genero-item">
                        <div className={`anexo8-checkbox ${data.paciente_genero === 'M' ? 'checked' : ''}`} />
                        <span>M</span>
                    </div>
                </div>
            </div>

            {/* Teléfono, Municipio, Dirección, Departamento */}
            <div className="anexo8-row">
                <div className="anexo8-cell anexo8-cell-telefono">
                    <span className="anexo8-cell-label">Teléfono</span>
                    <span className="anexo8-cell-value">{data.paciente_telefono || ''}</span>
                </div>
                <div className="anexo8-cell anexo8-cell-municipio">
                    <span className="anexo8-cell-label">Municipio</span>
                    <span className="anexo8-cell-value">{data.paciente_municipio || ''}</span>
                </div>
                <div className="anexo8-cell anexo8-cell-direccion">
                    <span className="anexo8-cell-label">Dirección de Residencia</span>
                    <span className="anexo8-cell-value">{data.paciente_direccion || ''}</span>
                </div>
                <div className="anexo8-cell anexo8-cell-depto">
                    <span className="anexo8-cell-label">Departamento</span>
                    <span className="anexo8-cell-value">{data.paciente_departamento || 'CÓRDOBA'}</span>
                </div>
            </div>

            {/* Afiliación SGSSS */}
            <div className="anexo8-afiliacion-row">
                <div className="anexo8-afiliacion-label">Afiliación al SGSSS</div>
                <div className="anexo8-afiliacion-opciones">
                    <div className="anexo8-afiliacion-item">
                        <div className={`anexo8-checkbox ${data.paciente_regimen === 'Subsidiado' ? 'checked' : ''}`} />
                        <span>Subsidiado</span>
                    </div>
                    <div className="anexo8-afiliacion-item">
                        <div className={`anexo8-checkbox ${data.paciente_regimen === 'Contributivo' ? 'checked' : ''}`} />
                        <span>Contributivo</span>
                    </div>
                    <div className="anexo8-afiliacion-item">
                        <div className={`anexo8-checkbox ${data.paciente_regimen === 'Vinculado' ? 'checked' : ''}`} />
                        <span>Vinculado</span>
                    </div>
                </div>
                <div className="anexo8-eps-container">
                    <span className="anexo8-eps-label">EPS</span>
                    <span className="anexo8-eps-value">{data.paciente_eps || ''}</span>
                </div>
            </div>

            {/* 2. MEDICAMENTOS */}
            <div className="anexo8-medicamentos-header">2. MEDICAMENTOS</div>

            {/* Encabezados tabla medicamentos */}
            <div className="anexo8-medicamentos-labels">
                <div className="anexo8-med-cell anexo8-med-nombre">Nombre Genérico</div>
                <div className="anexo8-med-cell anexo8-med-concentracion">Concentración</div>
                <div className="anexo8-med-cell anexo8-med-forma">
                    <span>Forma</span>
                    <span>farmacéutica</span>
                </div>
                <div className="anexo8-med-cell anexo8-med-dosis">
                    <span>Dosis / Vía de</span>
                    <span>Administración</span>
                </div>
                <div className="anexo8-med-cell anexo8-med-cantidad">
                    <div className="anexo8-med-cantidad-header">
                        <span>Cantidad Prescrita</span>
                        <div className="anexo8-med-cantidad-sub">
                            <span className="anexo8-med-cantidad-numeros">En Números</span>
                            <span className="anexo8-med-cantidad-letras">Letras</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Datos del medicamento */}
            <div className="anexo8-medicamentos-data">
                <div className="anexo8-med-data-cell anexo8-med-nombre">{data.medicamento_nombre}</div>
                <div className="anexo8-med-data-cell anexo8-med-concentracion">{data.medicamento_concentracion || ''}</div>
                <div className="anexo8-med-data-cell anexo8-med-forma">{data.medicamento_forma_farmaceutica}</div>
                <div className="anexo8-med-data-cell anexo8-med-dosis">{data.medicamento_dosis_via || ''}</div>
                <div className="anexo8-med-data-cell anexo8-med-cantidad">
                    <span style={{ fontWeight: 'bold', marginRight: '8px' }}>{data.cantidad_numero}</span>
                    <span>{data.cantidad_letras}</span>
                </div>
            </div>

            {/* Diagnóstico */}
            <div className="anexo8-diagnostico-row">
                <div className="anexo8-diagnostico-label">Diagnóstico</div>
                <div className="anexo8-diagnostico-value">
                    {data.diagnostico_cie10 && `${data.diagnostico_cie10} - `}{data.diagnostico_descripcion || ''}
                </div>
            </div>

            {/* 3. PROFESIONAL */}
            <div className="anexo8-profesional-header">3. PROFESIONAL</div>

            {/* Tipo médico */}
            <div className="anexo8-medico-tipo-row">
                <div className="anexo8-medico-tipo-label">Médico</div>
                <div className="anexo8-medico-tipos">
                    <div className="anexo8-medico-tipo-item">
                        <div className={`anexo8-checkbox ${data.medico_tipo === 'General' ? 'checked' : ''}`} />
                        <span>General</span>
                    </div>
                    <div className="anexo8-medico-tipo-item">
                        <div className={`anexo8-checkbox ${data.medico_tipo === 'Especializado' ? 'checked' : ''}`} />
                        <span>Especializado</span>
                    </div>
                </div>
                <div className="anexo8-especialidad-container">
                    <span className="anexo8-especialidad-label">Especialidad, cuál:</span>
                    <span className="anexo8-especialidad-value">{data.medico_especialidad || ''}</span>
                </div>
            </div>

            {/* Nombres médico */}
            <div className="anexo8-medico-nombres-row">
                <div className="anexo8-cell anexo8-cell-medico-apellido1">
                    <span className="anexo8-cell-label">Primer Apellido</span>
                    <span className="anexo8-cell-value">{medicoApellido1}</span>
                </div>
                <div className="anexo8-cell anexo8-cell-medico-apellido2">
                    <span className="anexo8-cell-label">Segundo Apellido</span>
                    <span className="anexo8-cell-value">{medicoApellido2}</span>
                </div>
                <div className="anexo8-cell anexo8-cell-medico-nombres">
                    <span className="anexo8-cell-label">Nombres</span>
                    <span className="anexo8-cell-value">{medicoNombres}</span>
                </div>
            </div>

            {/* Documento y Resolución médico */}
            <div className="anexo8-medico-doc-row">
                <div className="anexo8-cell anexo8-cell-medico-tipodoc">
                    <span className="anexo8-cell-label">CC</span>
                </div>
                <div className="anexo8-cell anexo8-cell-medico-doc">
                    <span className="anexo8-cell-label">Documento de Identidad</span>
                    <span className="anexo8-cell-value">{data.medico_documento}</span>
                </div>
                <div className="anexo8-cell anexo8-cell-resolucion">
                    <span className="anexo8-cell-label">Resolución profesión N.º</span>
                    <span className="anexo8-cell-value">{data.medico_documento}</span>
                </div>
                <div className="anexo8-cell anexo8-cell-firma">
                    <span className="anexo8-cell-label">Firma</span>
                    {/* Espacio para firma */}
                </div>
            </div>

            {/* Institución */}
            <div className="anexo8-institucion-row">
                <div className="anexo8-cell anexo8-cell-institucion">
                    <span className="anexo8-cell-label">Institución donde labora</span>
                    <span className="anexo8-cell-value">GESTAR SALUD DE COLOMBIA IPS</span>
                </div>
                <div className="anexo8-cell anexo8-cell-direccion-inst">
                    <span className="anexo8-cell-label">Dirección</span>
                    <span className="anexo8-cell-value">{data.medico_direccion || 'CRA 6 N 65 24'}</span>
                </div>
                <div className="anexo8-cell anexo8-cell-ciudad">
                    <span className="anexo8-cell-label">Ciudad</span>
                    <span className="anexo8-cell-value">{data.medico_ciudad || 'MONTERÍA'}</span>
                </div>
                <div className="anexo8-cell anexo8-cell-tel">
                    <span className="anexo8-cell-label">Teléfono</span>
                    <span className="anexo8-cell-value">{data.medico_telefono || '3103157229'}</span>
                </div>
            </div>

            {/* Marca de tipo */}
            {tipo === 'copia' && (
                <div style={{
                    textAlign: 'center',
                    fontSize: '7px',
                    color: '#666',
                    padding: '2px',
                    background: '#f5f5f5'
                }}>
                    COPIA
                </div>
            )}
        </div>
    )
}

/**
 * Componente principal que renderiza Original + Copia
 */
export interface Anexo8TemplateFullProps {
    data: Anexo8Record
}

export function Anexo8Template({ data }: Anexo8TemplateFullProps) {
    return (
        <div className="anexo8-container" id="anexo8-pdf-content">
            {/* Original */}
            <Anexo8Seccion data={data} tipo="original" />

            {/* Línea de corte */}
            <div className="anexo8-separador" />

            {/* Copia */}
            <Anexo8Seccion data={data} tipo="copia" />
        </div>
    )
}

export default Anexo8Template
