import React, { useEffect, useState } from 'react';
import { CalibrationRecord, Equipment, ViewState, MeasurementGroup } from '../types';
import { StorageService } from '../services/storage';
import { Printer, ArrowLeft, Loader2, Pencil } from 'lucide-react';

interface ReportViewProps {
  calibrationId: string;
  setView: (view: ViewState) => void;
}

export const ReportView: React.FC<ReportViewProps> = ({ calibrationId, setView }) => {
  const [data, setData] = useState<{ calibration: CalibrationRecord, equipment: Equipment } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadReport = async () => {
        setLoading(true);
        const calibration = await StorageService.getCalibrationById(calibrationId);
        if (calibration) {
          const eqList = await StorageService.getEquipment();
          const equipment = eqList.find(e => e.id === calibration.equipmentId);
          if (equipment) {
            // Data normalization for display: If legacy structure, convert to group
            if (!calibration.measurementGroups || calibration.measurementGroups.length === 0) {
                 calibration.measurementGroups = [{
                     id: 'legacy',
                     name: 'Dados de Medição',
                     measurements: calibration.measurements || []
                 }];
            }
            setData({ calibration, equipment });
          }
        }
        setLoading(false);
    };
    loadReport();
  }, [calibrationId]);

  if (loading) return <div className="p-8 flex items-center gap-2"><Loader2 className="animate-spin"/> Gerando relatório...</div>;
  if (!data) return <div className="p-8">Erro: Relatório não encontrado.</div>;

  const { calibration, equipment } = data;

  // Helper calculation for display
  const calculateCombinedError = (error: number, uncertainty?: number) => {
    const u = uncertainty || 0;
    return Math.sqrt(Math.pow(error, 2) + Math.pow(u, 2)).toFixed(4);
  };

  return (
    <div className="bg-slate-100 min-h-screen p-8 flex flex-col items-center">
      <div className="w-full max-w-4xl no-print mb-6 flex justify-between items-center">
        <button 
           onClick={() => setView({ type: 'EQUIPMENT_DETAILS', equipmentId: equipment.id })}
           className="flex items-center gap-2 text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft size={20} /> Voltar
        </button>
        <div className="flex gap-2">
            <button 
              onClick={() => setView({ type: 'EDIT_CALIBRATION', equipmentId: equipment.id, calibrationId: calibration.id })}
              className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm"
            >
              <Pencil size={18} /> Corrigir Relatório
            </button>
            <button 
              onClick={() => window.print()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow"
            >
              <Printer size={18} /> Imprimir Certificado
            </button>
        </div>
      </div>

      <div className="bg-white w-full max-w-[21cm] min-h-[29.7cm] p-[2cm] shadow-2xl print:shadow-none print:w-full print:max-w-none print:p-0 print:m-0 text-slate-900 leading-tight">
        
        {/* Header */}
        <div className="border-b-2 border-slate-800 pb-6 mb-6 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold uppercase tracking-widest text-slate-800">Certificado de Calibração</h1>
            <p className="text-sm text-slate-500 mt-1">CERTIFICADO Nº: {calibration.id.slice(-6).toUpperCase()}</p>
          </div>
          <div className="text-right">
            <div className="text-xl font-bold text-slate-800 uppercase">Metrologia AVC</div>
            <div className="text-xs text-slate-500">Soluções em Metrologia</div>
          </div>
        </div>

        {/* Section: Equipment Info */}
        <div className="mb-8">
          <h2 className="text-xs font-bold uppercase border-b border-slate-300 mb-3 pb-1 text-slate-500">Identificação do Instrumento</h2>
          <div className="grid grid-cols-2 gap-y-2 gap-x-8 text-sm">
             <div className="flex justify-between border-b border-dotted border-slate-200 py-1">
               <span className="font-semibold">Descrição:</span> <span>{equipment.name}</span>
             </div>
             <div className="flex justify-between border-b border-dotted border-slate-200 py-1">
               <span className="font-semibold">Fabricante:</span> <span>{equipment.manufacturer}</span>
             </div>
             <div className="flex justify-between border-b border-dotted border-slate-200 py-1">
               <span className="font-semibold">Modelo:</span> <span>{equipment.model}</span>
             </div>
             <div className="flex justify-between border-b border-dotted border-slate-200 py-1">
               <span className="font-semibold">Nº Série:</span> <span>{equipment.serialNumber}</span>
             </div>
             <div className="flex justify-between border-b border-dotted border-slate-200 py-1">
               <span className="font-semibold">Tag/ID:</span> <span>{equipment.tag}</span>
             </div>
             <div className="flex justify-between border-b border-dotted border-slate-200 py-1">
               <span className="font-semibold">Faixa:</span> <span>{equipment.range}</span>
             </div>
             <div className="flex justify-between border-b border-dotted border-slate-200 py-1">
               <span className="font-semibold">Resolução:</span> <span>{equipment.resolution}</span>
             </div>
          </div>
        </div>

        {/* Section: Calibration Data */}
        <div className="mb-8">
          <h2 className="text-xs font-bold uppercase border-b border-slate-300 mb-3 pb-1 text-slate-500">Dados da Calibração</h2>
          <div className="grid grid-cols-3 gap-4 text-sm mb-4">
             <div>
                <span className="font-semibold block text-xs text-slate-500">Data</span>
                {new Date(calibration.date).toLocaleDateString('pt-BR')}
             </div>
             <div>
                <span className="font-semibold block text-xs text-slate-500">Condições Ambientais</span>
                {calibration.temperature}°C / {calibration.humidity}% UR
             </div>
             <div>
                <span className="font-semibold block text-xs text-slate-500">Técnico</span>
                {calibration.technician}
             </div>
          </div>
           <div className="text-sm mb-4">
                <span className="font-semibold block text-xs text-slate-500">Padrão Utilizado</span>
                {calibration.standardUsed || "Não informado"}
             </div>
        </div>

        {/* Results Table - Iterating Groups */}
        <div className="mb-8">
           <h2 className="text-xs font-bold uppercase border-b border-slate-300 mb-3 pb-1 text-slate-500">Resultados da Medição</h2>
           
           {calibration.measurementGroups?.map((group, idx) => (
             <div key={group.id || idx} className="mb-6 break-inside-avoid">
               {calibration.measurementGroups!.length > 1 && (
                 <h3 className="text-sm font-bold text-slate-700 mb-2 pl-1 border-l-4 border-slate-300">
                    {group.name}
                 </h3>
               )}
               
               <table className="w-full text-sm border-collapse border border-slate-300">
                 <thead className="bg-slate-50">
                   <tr>
                     <th className="border border-slate-300 p-2 text-center w-1/5">Valor Padrão</th>
                     <th className="border border-slate-300 p-2 text-center w-1/5">Valor Indicado</th>
                     <th className="border border-slate-300 p-2 text-center w-1/5">Erro (E)</th>
                     <th className="border border-slate-300 p-2 text-center w-1/5">Incerteza (U)</th>
                     <th className="border border-slate-300 p-2 text-center bg-slate-100 font-bold w-1/5" title="Erro Combinado = √(E² + U²)">
                        √(E² + U²)
                     </th>
                   </tr>
                 </thead>
                 <tbody>
                   {group.measurements.map(m => (
                     <tr key={m.id}>
                       <td className="border border-slate-300 p-2 text-center">{m.referenceValue}</td>
                       <td className="border border-slate-300 p-2 text-center">{m.measuredValue}</td>
                       <td className="border border-slate-300 p-2 text-center">
                          {m.error > 0 ? '+' : ''}{m.error}
                       </td>
                       <td className="border border-slate-300 p-2 text-center">{m.uncertainty || '0'}</td>
                       <td className="border border-slate-300 p-2 text-center font-mono font-bold bg-slate-50">
                          {calculateCombinedError(m.error, m.uncertainty)}
                       </td>
                     </tr>
                   ))}
                   {group.measurements.length === 0 && (
                     <tr><td colSpan={5} className="p-2 text-center italic text-slate-400">Sem medições registradas.</td></tr>
                   )}
                 </tbody>
               </table>
             </div>
           ))}
        </div>

        {/* Conclusion */}
        <div className="mb-12 border border-slate-300 rounded p-4 bg-slate-50 break-inside-avoid">
           <h2 className="text-xs font-bold uppercase mb-2 text-slate-500">Observações / Análise</h2>
           <p className="text-sm text-slate-800 whitespace-pre-wrap mb-4">{calibration.notes || "Sem observações."}</p>
           
           <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-200">
             <span className="text-sm font-semibold">Resultado Final:</span>
             <span className={`text-sm font-bold uppercase px-2 py-1 rounded border ${
                calibration.result === 'Aprovado' ? 'border-green-600 text-green-700 bg-green-50' : 
                calibration.result === 'Reprovado' ? 'border-red-600 text-red-700 bg-red-50' : 'border-yellow-600 text-yellow-700 bg-yellow-50'
             }`}>
               {calibration.result}
             </span>
           </div>
        </div>

        {/* Footer Signature */}
        <div className="mt-auto grid grid-cols-2 gap-12 pt-12 break-inside-avoid">
            <div className="text-center">
              <div className="border-t border-slate-800 w-3/4 mx-auto mb-2"></div>
              <p className="text-xs font-bold uppercase">{calibration.technician}</p>
              <p className="text-[10px] text-slate-500">Técnico Responsável</p>
            </div>
            <div className="text-center">
              <div className="border-t border-slate-800 w-3/4 mx-auto mb-2"></div>
              <p className="text-xs font-bold uppercase">Gerente da Qualidade</p>
              <p className="text-[10px] text-slate-500">Aprovação</p>
            </div>
        </div>

      </div>
    </div>
  );
};