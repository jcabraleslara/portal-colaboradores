import { supabase } from '@/config/supabase.config'
import { BackRadicacion } from '@/types/back.types'

// Servicio para manejar notificaciones SMS
export const smsService = {

    /**
     * Envía una notificación SMS basada en el cambio de estado de un radicado.
     * @param radicado Objeto de la radicación actual (con id del paciente).
     * @param nuevoEstado El nuevo estado que se acaba de asignar.
     */
    async enviarNotificacionEstado(radicado: BackRadicacion, nuevoEstado: string): Promise<void> {
        try {
            // Validar si el estado gatilla notificación
            if (!['Autorizado', 'Contrarreferido'].includes(nuevoEstado)) {
                return;
            }

            console.log(`[SMS] Procesando notificación para radicado ${radicado.radicado} con estado ${nuevoEstado}`);

            // 1. Obtener datos del paciente (nombre y teléfono)
            const { data: paciente, error } = await supabase
                .from('bd')
                .select('nombres, apellido1, telefono')
                .eq('id', radicado.id)
                .single();

            if (error || !paciente) {
                console.error('[SMS] No se pudo obtener datos del paciente para enviar SMS:', error);
                return;
            }

            if (!paciente.telefono) {
                console.warn('[SMS] Paciente sin teléfono registrado, no se envía SMS.');
                return;
            }

            // Validar que sea un celular válido de Colombia
            // Debe tener 10 dígitos y comenzar por 3
            const telefonoLimpio = paciente.telefono.replace(/\D/g, '');
            if (!/^3\d{9}$/.test(telefonoLimpio)) {
                console.warn(`[SMS] El número ${paciente.telefono} no es un celular válido (debe iniciar con 3 y tener 10 dígitos). No se envía SMS.`);
                return;
            }

            // 2. Construir mensaje personalizado
            // Limitar a ~160 caracteres.
            // "Hola JUAN, tu radicado XXX cambio a AUTORIZADO. Mas info: comunicate al 3336026080. Gestarsalud"
            // "Hola JUAN, tu radicado XXX cambio a AUTORIZADO. Mas info: comunicate al 3336026080. Gestarsalud"
            const nombreCorto = paciente.nombres.split(' ')[0]; // Primer nombre
            // Normalizar a ASCII pura para evitar modo UCS-2 y asegurar entrega rápida
            const nombreLimpio = nombreCorto.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

            const estadoTexto = nuevoEstado.toUpperCase();

            let mensaje = `GESTAR SALUD: Hola ${nombreLimpio}, el estado de su radicado ${radicado.radicado} ha cambiado a ${estadoTexto}. Mas info al call center 333 6026080.`;

            // Validación de seguridad para no exceder caracteres
            if (mensaje.length > 160) {
                mensaje = mensaje.substring(0, 157) + '...';
            }

            // 3. Llamar a nuestra API serverless
            // En desarrollo (Vite) la ruta es relativa si se usa proxy, o absoluta si no.
            // Asumimos que /api mapea a las funciones de Vercel o localmente configurado.
            // Si estamos en local puro sin `vercel dev`, esto fallará a menos que se apunte a prod o mock.
            // Usaremos fetch relativo '/api/sms'.

            const response = await fetch('/api/sms', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    phone: paciente.telefono,
                    message: mensaje
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('[SMS] Error al enviar SMS:', errorData);
            } else {
                console.log(`[SMS] Notificación enviada exitosamente al ${paciente.telefono}`);
            }

        } catch (error) {
            console.error('[SMS] Error inesperado en servicio de notificaciones:', error);
            // No lanzamos error para no interrumpir el flujo principal de actualización de estado
        }
    }
}
