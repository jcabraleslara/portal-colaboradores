/**
 * Utilidad para convertir números a letras en español
 * Portal de Colaboradores GESTAR SALUD IPS
 */

const UNIDADES = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve']
const ESPECIALES = ['diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve']
const DECENAS = ['', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa']
const CENTENAS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos']

/**
 * Convierte un número entero (0-999999) a su representación en letras en español
 * @param numero - Número a convertir
 * @returns Texto en español (ej: 30 -> "treinta", 180 -> "ciento ochenta")
 */
export function numeroALetras(numero: number): string {
    if (numero < 0 || numero > 999999 || !Number.isInteger(numero)) {
        return 'número inválido'
    }

    if (numero === 0) return 'cero'
    if (numero === 100) return 'cien'

    let resultado = ''

    // Miles
    if (numero >= 1000) {
        const miles = Math.floor(numero / 1000)
        if (miles === 1) {
            resultado += 'mil '
        } else {
            resultado += convertirCentenas(miles) + ' mil '
        }
        numero = numero % 1000
    }

    // Centenas, decenas y unidades
    if (numero > 0) {
        resultado += convertirCentenas(numero)
    }

    return resultado.trim()
}

/**
 * Convierte un número de 1-999 a letras
 */
function convertirCentenas(numero: number): string {
    if (numero === 0) return ''
    if (numero === 100) return 'cien'

    let resultado = ''

    // Centenas
    if (numero >= 100) {
        resultado += CENTENAS[Math.floor(numero / 100)] + ' '
        numero = numero % 100
    }

    // Decenas y unidades
    if (numero > 0) {
        resultado += convertirDecenas(numero)
    }

    return resultado.trim()
}

/**
 * Convierte un número de 1-99 a letras
 */
function convertirDecenas(numero: number): string {
    if (numero === 0) return ''

    // 1-9
    if (numero < 10) {
        return UNIDADES[numero]
    }

    // 10-19
    if (numero < 20) {
        return ESPECIALES[numero - 10]
    }

    // 20-29 (caso especial: veinti-)
    if (numero < 30) {
        if (numero === 20) return 'veinte'
        return 'veinti' + UNIDADES[numero - 20]
    }

    // 30-99
    const decena = Math.floor(numero / 10)
    const unidad = numero % 10

    if (unidad === 0) {
        return DECENAS[decena]
    }

    return DECENAS[decena] + ' y ' + UNIDADES[unidad]
}

export default numeroALetras
