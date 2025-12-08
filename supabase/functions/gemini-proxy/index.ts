// Importar librerías necesarias
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'; 
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// Asegúrese de que no haya ninguna línea de importación que apunte a "deno.com"

// La URL del endpoint de la API de Gemini (debe ser la URL real de la API de Google)
// Si esta URL es incorrecta o apunta a un recurso interno de deno.com, también debe corregirse.
const GEMINI_API_ENDPOINT = "https://api.gemini.com/v1/models/generateContent"; 

serve(async (req) => {
    
    // Configuración CORS para la respuesta (permite cualquier origen '*')
    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Authorization, X-Client-Info, Content-Type",
        "Content-Type": "application/json"
    };
    
    // 1. Manejo de la solicitud Preflight (OPTIONS)
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            status: 204, // No Content
            headers: corsHeaders,
        });
    }

    try {
        const { prompt } = await req.json();
        // ... (resto de la lógica)
        
        // 2. Llamada a la API de Gemini
        const apiKey = Deno.env.get("GEMINI_API_KEY");

        if (!apiKey) {
            console.error("GEMINI_API_KEY not found in environment variables.");
             return new Response(JSON.stringify({ error: 'Server configuration error: AI key is missing.' }), {
                status: 500,
                headers: corsHeaders,
            });
        }
        
        const geminiResponse = await fetch(GEMINI_API_ENDPOINT, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`,
            },
            body: JSON.stringify({ 
                model: "gemini-2.5-flash", 
                contents: [{ parts: [{ text: prompt }] }],
            }),
        });

        const geminiData = await geminiResponse.json();

        // 3. Respuesta con datos de Gemini
        return new Response(JSON.stringify(geminiData), {
            status: geminiResponse.status,
            headers: corsHeaders,
        });

    } catch (error) {
        console.error("Error processing request:", error.message);
        // Devolver un error 500 con los encabezados CORS
        return new Response(JSON.stringify({ 
            error: 'Failed to process AI request.', 
            details: error.message 
        }), {
            status: 500,
            headers: corsHeaders,
        });
    }
});