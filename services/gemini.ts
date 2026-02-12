import { GoogleGenAI } from "@google/genai";
import { CalibrationRecord, Equipment } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const GeminiService = {
  analyzeCalibration: async (equipment: Equipment, record: CalibrationRecord): Promise<string> => {
    if (!apiKey) return "API Key não configurada. Impossível gerar análise.";

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
      
      Analise os dados de calibração abaixo de forma técnica e impessoal:
      
      Equipamento: ${equipment.name} (${equipment.manufacturer} ${equipment.model})
      Tag: ${equipment.tag}
      Exatidão/Critério: ${equipment.accuracy}
      Resolução: ${equipment.resolution}
      
      Dados da Calibração:
      Data: ${record.date}
      Temperatura: ${record.temperature}°C
      Umidade: ${record.humidity}%
      
      Medições (Padrão vs Medido):
      ${measurementsText}
      
      INSTRUÇÕES OBRIGATÓRIAS:
      1. Analise se o 'Erro Combinado' ultrapassa os critérios de exatidão (se informados) EM CADA GRUPO DE TESTE.
      2. Forneça um parecer técnico objetivo indicando conformidade ou não.
      3. O TEXTO DEVE INICIAR EXATAMENTE COM: "PARECER GERADO POR IA:".
      4. Use frases impessoais como "A análise indica...", "Observa-se que...", "Os resultados demonstram...".
      5. Se houver múltiplos grupos (ex: Tração e Compressão), cite especificamente qual passou ou falhou.
      
      Responda em Português do Brasil.
    `;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });
      return response.text || "Não foi possível gerar a análise.";
    } catch (error) {
      console.error("Erro na análise Gemini:", error);
      return "Erro ao conectar com serviço de IA.";
    }
  }
};