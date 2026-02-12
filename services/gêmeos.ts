import { GoogleGenAI } from "@google/genai";
import { CalibrationRecord, Equipment } from "../types";

// Captura a chave. No Vite, usamos import.meta.env, mas o vite.config.ts define process.env para compatibilidade
const apiKey = process.env.API_KEY || '';

// Log de diagnóstico para ajudar a verificar se o Netlify injetou a variável corretamente
if (!apiKey) {
    console.warn("⚠️ AVISO: A API_KEY do Gemini NÃO foi detectada. Verifique 'Site Configuration > Environment Variables' no Netlify.");
} else {
    // Log seguro (apenas os primeiros 4 caracteres)
    console.log(`✅ Google Gemini API: Chave detectada com sucesso (${apiKey.substring(0, 4)}...).`);
}

const ai = new GoogleGenAI({ apiKey });

export const GeminiService = {
  analyzeCalibration: async (equipment: Equipment, record: CalibrationRecord): Promise<string> => {
    if (!apiKey) {
        return "ERRO DE CONFIGURAÇÃO: A Chave da API (API_KEY) não foi encontrada. Por favor, adicione-a nas variáveis de ambiente do Netlify e faça um novo deploy (Clear cache).";
    }

    // Construção da string de medições suportando múltiplos grupos
    let measurementsText = "";
    
    if (record.measurementGroups && record.measurementGroups.length > 0) {
        measurementsText = record.measurementGroups.map(group => {
            return `GRUPO DE TESTE: ${group.name}\n` + 
            group.measurements.map(m => {
                const combined = Math.sqrt(Math.pow(m.error, 2) + Math.pow(m.uncertainty || 0, 2)).toFixed(4);
                return `- Padrão: ${m.referenceValue}, Medido: ${m.measuredValue}, Erro: ${m.error}, Incerteza: ${m.uncertainty}, Erro Combinado (√(E²+U²)): ${combined}`;
            }).join('\n');
        }).join('\n\n');
    } else {
        // Fallback para legacy
        measurementsText = record.measurements.map(m => {
            const combined = Math.sqrt(Math.pow(m.error, 2) + Math.pow(m.uncertainty || 0, 2)).toFixed(4);
            return `- Padrão: ${m.referenceValue}, Medido: ${m.measuredValue}, Erro: ${m.error}, Incerteza: ${m.uncertainty}, Erro Combinado (√(E²+U²)): ${combined}`;
        }).join('\n');
    }

    const prompt = `
      VOCÊ É UMA INTELIGÊNCIA ARTIFICIAL (IA) DO SISTEMA METROLOGIA AVC.
      NÃO atue como engenheiro, técnico ou humano. NÃO use primeira pessoa (ex: "Eu analisei", "Minha opinião").
      
      Tarefa: Analisar os dados de calibração abaixo e fornecer um parecer técnico objetivo e formal.
      
      EQUIPAMENTO:
      - Tag: ${equipment.tag}
      - Nome: ${equipment.name}
      - Faixa: ${equipment.range}
      - Resolução: ${equipment.resolution}
      - Critério de Aceitação (Tolerância): ${equipment.accuracy}

      DADOS DA CALIBRAÇÃO (Medições Realizadas):
      ${measurementsText}

      INSTRUÇÕES:
      1. Compare os erros encontrados e a incerteza com o critério de aceitação (se houver).
      2. Se não houver critério claro, analise a consistência dos erros.
      3. Verifique se há tendências (ex: erros crescentes).
      4. Conclua se o equipamento parece apto para uso ou requer ajuste.
      5. Seja breve (máximo 4 linhas).
      6. Se houver erro muito grande (outlier), aponte.

      Parecer Técnico:
    `;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-latest',
        contents: prompt,
      });
      
      return response.text || "Não foi possível gerar a análise.";
    } catch (error: any) {
      console.error("Erro na API Gemini:", error);
      return `Erro ao consultar IA: ${error.message || 'Verifique a conexão ou a API Key.'}`;
    }
  }
};
