/**
 * Utilidades para manejo de fechas
 * Portal de Colaboradores GESTAR SALUD IPS
 */

/**
 * Parsear fecha de la base de datos evitando problemas de timezone.
 * 
 * La BD devuelve fechas tipo 'date' con timestamp UTC (ej: "1986-11-01T05:00:00.000Z")
 * pero la fecha real es 1986-11-01 en timezone local.
 * 
 * Al usar `new Date()` directamente, JavaScript parsea como UTC y al mostrar en navegador
 * con timezone Colombia (UTC-5), puede mostrar un día anterior si la hora UTC es < 5:00 AM.
 * 
 * Esta función parsea la fecha directamente en timezone local, evitando desfases.
 * 
 * @param dateString - String de fecha desde DB (ISO 8601) o null
 * @returns Date object parseado en timezone local o null
 * 
 * @example
 * // Fecha de DB: "1986-11-01T05:00:00.000Z"
 * const fecha = parseDateLocal("1986-11-01T05:00:00.000Z")
 * console.log(fecha.toLocaleDateString('es-CO')) // "1/11/1986" ✅ CORRECTO
 */
export function parseDateLocal(dateString: string | null): Date | null {
    if (!dateString) return null

    // Extraer solo la parte de la fecha (YYYY-MM-DD)
    const dateOnly = dateString.split('T')[0]
    const [year, month, day] = dateOnly.split('-').map(Number)

    // Crear fecha en timezone local (mes es 0-indexed en JS)
    return new Date(year, month - 1, day)
}

/**
 * Formatear fecha a string para envío a API/DB (YYYY-MM-DD)
 * @param date - Date object
 * @returns String en formato ISO (solo fecha)
 */
export function formatDateForDB(date: Date | null): string | null {
    if (!date) return null

    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')

    return `${year}-${month}-${day}`
}

/**
 * Obtiene la fecha actual en zona horaria de Colombia (America/Bogota, GMT-5)
 * en formato YYYY-MM-DD para inputs tipo date.
 *
 * Esto evita el problema de que después de las 7pm en Colombia,
 * toISOString() retorne el día siguiente (porque convierte a UTC).
 *
 * @returns String en formato YYYY-MM-DD con la fecha actual en Colombia
 *
 * @example
 * // Si son las 10pm del 5 de febrero en Colombia (3am UTC del 6 de febrero)
 * getFechaHoyColombia() // "2026-02-05" ✅ CORRECTO
 * new Date().toISOString().split('T')[0] // "2026-02-06" ❌ INCORRECTO
 */
export function getFechaHoyColombia(): string {
    const formatter = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'America/Bogota',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    })
    return formatter.format(new Date())
}

/**
 * Obtiene el primer día del mes actual en zona horaria de Colombia
 * en formato YYYY-MM-DD.
 *
 * @returns String en formato YYYY-MM-DD con el primer día del mes actual
 */
export function getPrimerDiaMesColombia(): string {
    const hoy = new Date()
    // Obtener año y mes en zona horaria Colombia
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Bogota',
        year: 'numeric',
        month: '2-digit',
    })
    const parts = formatter.formatToParts(hoy)
    const year = parts.find(p => p.type === 'year')?.value
    const month = parts.find(p => p.type === 'month')?.value
    return `${year}-${month}-01`
}

/**
 * Obtiene el último día del mes actual en zona horaria de Colombia
 * en formato YYYY-MM-DD.
 *
 * @returns String en formato YYYY-MM-DD con el último día del mes actual
 */
export function getUltimoDiaMesColombia(): string {
    const hoy = new Date()
    // Obtener año y mes en zona horaria Colombia
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Bogota',
        year: 'numeric',
        month: '2-digit',
    })
    const parts = formatter.formatToParts(hoy)
    const year = parseInt(parts.find(p => p.type === 'year')?.value || '2026')
    const month = parseInt(parts.find(p => p.type === 'month')?.value || '1')
    // Último día del mes = día 0 del mes siguiente
    const ultimoDia = new Date(year, month, 0).getDate()
    return `${year}-${String(month).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`
}

/**
 * Calcular edad a partir de fecha de nacimiento
 * @param birthDate - Fecha de nacimiento
 * @returns Edad en años
 */
export function calcularEdad(birthDate: Date | null): number | null {
    if (!birthDate) return null

    const today = new Date()
    let age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--
    }

    return age
}
