// Importar el cliente de Supabase JS para usarlo en el servidor
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
    // 1. Verificar el método de la solicitud
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        const { email, metaData } = await req.json();

        // 2. Validación de datos mínimos
        if (!email || !metaData) {
            return new Response(JSON.stringify({ error: 'Missing email or subscription metadata.' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        
        // 3. Inicialización del Cliente Admin (USANDO VARIABLES DE ENTORNO SEGURAS)
        // La Service Role Key se obtiene de una variable de entorno segura.
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

        if (!supabaseUrl || !serviceRoleKey) {
            return new Response(JSON.stringify({ error: 'Server configuration error: Keys not found.' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        });
        
        // 4. Ejecución de la lógica de invitación
        const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
            // Usamos la URL de redirección segura
            redirectTo: 'https://carloslplorusso.github.io/portalinbdepro/dashboard.html',
            data: metaData,
        });

        if (error) throw error;
        
        // 5. Respuesta exitosa
        return new Response(JSON.stringify({ success: true, user: data.user }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('Edge Function Error:', error);
        return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
});