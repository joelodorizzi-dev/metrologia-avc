import React, { useState, useEffect } from 'react';
import { CalibrationRecord, Equipment, MeasurementPoint, MeasurementGroup, ViewState } from '../types';
import { StorageService } from '../services/storage';
import { GeminiService } from '../services/gemini';
import { auth } from '../services/firebase';
import { ArrowLeft, Save, Plus, Trash, Wand2, Calculator, ChevronDown, ChevronUp, Info, Loader2, Layers, X } from 'lucide-react';

interface CalibrationFormProps {
  equipmentId: string;
  calibrationId?: string; // Optional: If present, we are editing
  setView: (view: ViewState) => void;
}

export const CalibrationForm: React.FC<CalibrationFormProps> = ({ equipmentId, calibrationId, setView }) => {
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [calculatorTargetGroup, setCalculatorTargetGroup] = useState<string>('');
  
  // Uncertainty Calculator State
  const [calcParams, setCalcParams] = useState({
    standardUncertainty: 0.00,
    resolution: 0.00,
    kFactor: 2
  });

  const [record, setRecord] = useState<CalibrationRecord>({
    id: Date.now().toString(),
    equipmentId,
    date: new Date().toISOString().split('T')[0],
    technician: '',
    temperature: 20,
    humidity: 50,
    standardUsed: '',
    measurements: [], // Legacy
    measurementGroups: [], // New Support
    result: 'Aprovado',
    notes: '',
    aiAnalysis: ''
  });

  useEffect(() => {
    const init = async () => {
        setLoadingData(true);
        
        // Load Equipment
        const list = await StorageService.getEquipment();
        const eq = list.find(e => e.id === equipmentId);
        if (eq) {
          setEquipment(eq);
          const resMatch = eq.resolution?.match(/[\d\.]+/);
          const resVal = resMatch ? parseFloat(resMatch[0]) : 0;
          setCalcParams(prev => ({ ...prev, resolution: resVal }));
        }

        // Load Calibration (if editing) OR Set User (if new)
        if (calibrationId) {
            const existingRecord = await StorageService.getCalibrationById(calibrationId);
            if (existingRecord) {
                // Migration Logic: If old record without groups, create a default group
                if (!existingRecord.measurementGroups || existingRecord.measurementGroups.length === 0) {
                    existingRecord.measurementGroups = [{
                        id: 'default',
                        name: 'Dados de Medição',
                        measurements: existingRecord.measurements || []
                    }];
                }
                setRecord(existingRecord);
            } else {
                alert("Calibração não encontrada.");
                setView({ type: 'DASHBOARD' });
            }
        } else {
            // New Record - Set Technician from logged user
            const currentUser = auth.currentUser;
            
            // INITIALIZE GROUPS BASED ON EQUIPMENT CONFIG
            let initialGroups: MeasurementGroup[] = [];
            
            if (eq && eq.defaultTestGroups && eq.defaultTestGroups.length > 0) {
               initialGroups = eq.defaultTestGroups.map((name, idx) => ({
                   id: `${Date.now()}-${idx}`,
                   name: name,
                   measurements: []
               }));
            } else {
               initialGroups = [{
                  id: Date.now().toString(),
                  name: 'Teste Padrão',
                  measurements: []
               }];
            }

            setRecord(prev => ({ 
                ...prev, 
                technician: currentUser?.displayName || 'Técnico',
                measurementGroups: initialGroups
            }));
        }
        setLoadingData(false);
    };
    init();
  }, [equipmentId, calibrationId]);

  // --- Group Management ---

  const addGroup = () => {
    const newGroup: MeasurementGroup = {
        id: Date.now().toString(),
        name: `Teste ${record.measurementGroups!.length + 1}`,
        measurements: []
    };
    setRecord(prev => ({
        ...prev,
        measurementGroups: [...(prev.measurementGroups || []), newGroup]
    }));
  };

  const removeGroup = (groupId: string) => {
    if ((record.measurementGroups?.length || 0) <= 1) {
        alert("É necessário pelo menos um grupo de medição.");
        return;
    }
    if (confirm("Deseja remover este grupo de testes e todas as suas medições?")) {
        setRecord(prev => ({
            ...prev,
            measurementGroups: prev.measurementGroups?.filter(g => g.id !== groupId)
        }));
    }
  };

  const updateGroupName = (groupId: string, newName: string) => {
    setRecord(prev => ({
        ...prev,
        measurementGroups: prev.measurementGroups?.map(g => 
            g.id === groupId ? { ...g, name: newName } : g
        )
    }));
  };

  // --- Measurement Management ---

  const addMeasurementRow = (groupId: string) => {
    const newPoint: MeasurementPoint = {
      id: Date.now().toString() + Math.random(),
      referenceValue: 0,
      measuredValue: 0,
      error: 0,
      uncertainty: 0
    };
    setRecord(prev => ({
        ...prev,
        measurementGroups: prev.measurementGroups?.map(g => 
            g.id === groupId ? { ...g, measurements: [...g.measurements, newPoint] } : g
        )
    }));
  };

  const removeMeasurementRow = (groupId: string, pointId: string) => {
    setRecord(prev => ({
        ...prev,
        measurementGroups: prev.measurementGroups?.map(g => 
            g.id === groupId ? { ...g, measurements: g.measurements.filter(m => m.id !== pointId) } : g
        )
    }));
  };

  const updateMeasurement = (groupId: string, pointId: string, field: keyof MeasurementPoint, value: number) => {
    setRecord(prev => ({
        ...prev,
        measurementGroups: prev.measurementGroups?.map(g => {
            if (g.id !== groupId) return g;
            return {
                ...g,
                measurements: g.measurements.map(m => {
                    if (m.id === pointId) {
                        const updated = { ...m, [field]: value };
                        if (field === 'referenceValue' || field === 'measuredValue') {
                            updated.error = parseFloat((updated.measuredValue - updated.referenceValue).toFixed(4));
                        }
                        return updated;
                    }
                    return m;
                })
            };
        })
    }));
  };

  const calculateUncertainty = () => {
    if (!calculatorTargetGroup && calculatorTargetGroup !== 'all') {
        alert("Selecione qual grupo receberá o cálculo.");
        return;
    }

    const u_std = calcParams.standardUncertainty / calcParams.kFactor;
    const u_res = calcParams.resolution / Math.sqrt(12);
    const u_combined = Math.sqrt(Math.pow(u_std, 2) + Math.pow(u_res, 2));
    const U_final = u_combined * calcParams.kFactor; 
    const formattedU = parseFloat(U_final.toFixed(4));

    setRecord(prev => ({
      ...prev,
      measurementGroups: prev.measurementGroups?.map(g => {
          if (calculatorTargetGroup !== 'all' && g.id !== calculatorTargetGroup) return g;
          return {
              ...g,
              measurements: g.measurements.map(m => ({ ...m, uncertainty: formattedU }))
          };
      })
    }));
    
    const targetName = calculatorTargetGroup === 'all' ? "TODOS os grupos" : "o grupo selecionado";
    alert(`Incerteza calculada: ${formattedU}. Aplicada a ${targetName}.`);
  };

  const handleAIAnalysis = async () => {
    if (!equipment) return;
    setLoadingAI(true);
    // Flatten measurements for AI context, keeping group info
    const analysis = await GeminiService.analyzeCalibration(equipment, record);
    setRecord(prev => ({ ...prev, aiAnalysis: analysis, notes: prev.notes ? prev.notes + '\n\n' + analysis : analysis }));
    setLoadingAI(false);
  };

  const handleSave = async () => {
    setSaving(true);
    // Ensure legacy measurements field is populated with a flat list for backward compatibility if needed,
    // or just leave it empty. We will prioritize measurementGroups.
    // Let's flatten all measurements into the legacy field just in case some other view relies on it.
    const allMeasurements = record.measurementGroups?.flatMap(g => g.measurements) || [];
    const recordToSave = { ...record, measurements: allMeasurements };
    
    await StorageService.saveCalibration(recordToSave);
    setSaving(false);
    alert('Calibração salva com sucesso!');
    setView({ type: 'VIEW_REPORT', calibrationId: record.id });
  };

  // Helper to get max values across all groups
  const allPoints = record.measurementGroups?.flatMap(g => g.measurements) || [];
  const maxError = allPoints.reduce((max, m) => Math.max(max, Math.abs(m.error)), 0);
  const maxUncertainty = allPoints.reduce((max, m) => Math.max(max, m.uncertainty || 0), 0);
  const calculatedResultValue = Math.sqrt(Math.pow(maxError, 2) + Math.pow(maxUncertainty, 2)).toFixed(4);

  if (loadingData || !equipment) return <div className="p-8 flex items-center gap-2"><Loader2 className="animate-spin"/> Carregando formulário...</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto pb-20">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => setView({ type: 'EQUIPMENT_DETAILS', equipmentId })} className="p-2 hover:bg-slate-100 rounded-full">
          <ArrowLeft size={24} />
        </button>
        <div>
           <h1 className="text-2xl font-bold text-slate-800">
             {calibrationId ? 'Editar Calibração' : 'Nova Calibração'}: <span className="text-blue-600">{equipment.tag}</span>
           </h1>
           <div className="text-xs text-slate-500 mt-1">
             Cálculo de Aprovação: <span className="font-mono bg-slate-100 px-1 rounded">√(Erro² + Incerteza²)</span>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Environment & Metadata */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm lg:col-span-1 space-y-4 h-fit">
          <h3 className="font-semibold text-slate-700 mb-2 border-b pb-2">Dados do Processo</h3>
          
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Data</label>
            <input type="date" value={record.date} onChange={e => setRecord({...record, date: e.target.value})} className="w-full p-2 border rounded text-sm" />
          </div>
          
          <div className="grid grid-cols-2 gap-2">
             <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Temp (°C)</label>
                <input type="number" value={record.temperature} onChange={e => setRecord({...record, temperature: parseFloat(e.target.value)})} className="w-full p-2 border rounded text-sm" />
             </div>
             <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Umid. (%)</label>
                <input type="number" value={record.humidity} onChange={e => setRecord({...record, humidity: parseFloat(e.target.value)})} className="w-full p-2 border rounded text-sm" />
             </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Técnico</label>
            <input type="text" value={record.technician} onChange={e => setRecord({...record, technician: e.target.value})} className="w-full p-2 border rounded text-sm" />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Padrão Utilizado</label>
            <input type="text" placeholder="Ex: Bloco Padrão #123" value={record.standardUsed} onChange={e => setRecord({...record, standardUsed: e.target.value})} className="w-full p-2 border rounded text-sm" />
          </div>

          {/* Result Preview Box */}
          <div className="bg-slate-50 p-4 rounded border border-slate-200 mt-6">
            <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Máximos Globais</h4>
            <div className="flex justify-between text-sm mb-1">
               <span className="text-slate-600">Maior Erro:</span>
               <span className="font-mono font-bold">{maxError.toFixed(4)}</span>
            </div>
            <div className="flex justify-between text-sm mb-1">
               <span className="text-slate-600">Incerteza Max:</span>
               <span className="font-mono font-bold">{maxUncertainty.toFixed(4)}</span>
            </div>
            <div className="border-t border-slate-200 my-2"></div>
            <div className="flex justify-between items-center">
               <span className="text-xs font-bold text-slate-700">VALOR CALCULADO:</span>
               <span className="font-mono text-xl font-bold text-blue-600">{calculatedResultValue}</span>
            </div>
          </div>
        </div>

        {/* Measurements Groups */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm lg:col-span-2 flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
              <Layers size={18} className="text-blue-500"/>
              Grupos de Medição
            </h3>
            
            <div className="flex gap-2">
               <button 
                 onClick={() => setShowCalculator(!showCalculator)}
                 className="text-xs bg-purple-50 text-purple-700 border border-purple-200 px-3 py-1 rounded hover:bg-purple-100 font-medium flex items-center gap-1"
               >
                 <Calculator size={14} /> 
                 {showCalculator ? 'Ocultar Calculadora' : 'Calcular Incerteza'}
               </button>
               <button onClick={addGroup} className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 font-medium flex items-center gap-1">
                 <Plus size={16} /> Novo Grupo
               </button>
            </div>
          </div>

          {/* Uncertainty Calculator Panel */}
          {showCalculator && (
            <div className="mb-6 bg-purple-50 p-4 rounded-lg border border-purple-100">
               <h4 className="text-sm font-bold text-purple-800 mb-3 flex items-center gap-2">
                 Assistente de Incerteza (Tipo A + B)
               </h4>
               <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                  <div className="md:col-span-1">
                    <label className="text-[10px] font-bold text-purple-600 uppercase">Aplicar em:</label>
                    <select 
                      className="w-full p-2 text-sm border border-purple-200 rounded"
                      value={calculatorTargetGroup}
                      onChange={e => setCalculatorTargetGroup(e.target.value)}
                    >
                        <option value="">Selecione...</option>
                        <option value="all">TODOS os Grupos</option>
                        {record.measurementGroups?.map(g => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-purple-600 uppercase">Incerteza Padrão</label>
                    <input 
                      type="number" step="any"
                      className="w-full p-2 text-sm border border-purple-200 rounded"
                      value={calcParams.standardUncertainty}
                      onChange={e => setCalcParams({...calcParams, standardUncertainty: parseFloat(e.target.value)})}
                      placeholder="Do certificado"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-purple-600 uppercase">Resolução Equip.</label>
                    <input 
                      type="number" step="any"
                      className="w-full p-2 text-sm border border-purple-200 rounded"
                      value={calcParams.resolution}
                      onChange={e => setCalcParams({...calcParams, resolution: parseFloat(e.target.value)})}
                    />
                  </div>
                  <button 
                    onClick={calculateUncertainty}
                    className="bg-purple-600 text-white p-2 rounded text-sm font-bold hover:bg-purple-700"
                  >
                    Calcular
                  </button>
               </div>
            </div>
          )}

          {/* Groups List */}
          <div className="space-y-6">
            {record.measurementGroups?.map((group, groupIndex) => (
                <div key={group.id} className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="bg-slate-50 p-3 flex justify-between items-center border-b border-slate-200">
                        <div className="flex items-center gap-2 flex-1">
                            <span className="text-xs font-bold text-slate-400">#{groupIndex + 1}</span>
                            <input 
                                type="text"
                                className="bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none font-semibold text-slate-700 px-1"
                                value={group.name}
                                onChange={(e) => updateGroupName(group.id, e.target.value)}
                                placeholder="Nome do Teste (Ex: Tração)"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={() => addMeasurementRow(group.id)} className="text-xs bg-white border border-slate-300 text-slate-600 px-2 py-1 rounded hover:bg-slate-50 flex items-center gap-1">
                                <Plus size={12} /> Ponto
                            </button>
                            <button onClick={() => removeGroup(group.id)} className="text-slate-400 hover:text-red-500 p-1" title="Remover Grupo">
                                <X size={16} />
                            </button>
                        </div>
                    </div>
                    
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                        <thead className="bg-white text-slate-500 text-xs uppercase">
                            <tr>
                            <th className="p-2 text-left w-12 border-b">#</th>
                            <th className="p-2 text-left border-b">V. Padrão</th>
                            <th className="p-2 text-left border-b">V. Medido</th>
                            <th className="p-2 text-left font-bold text-slate-700 bg-slate-50 border-b">Erro</th>
                            <th className="p-2 text-left text-purple-700 bg-purple-50/50 border-b">Incerteza</th>
                            <th className="p-2 w-8 border-b"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {group.measurements.map((m, idx) => (
                            <tr key={m.id}>
                                <td className="p-2 text-center text-slate-400 text-xs">{idx + 1}</td>
                                <td className="p-2">
                                <input 
                                    type="number" step="any"
                                    className="w-24 p-1 border border-slate-300 rounded focus:border-blue-500 outline-none"
                                    value={m.referenceValue}
                                    onChange={(e) => updateMeasurement(group.id, m.id, 'referenceValue', parseFloat(e.target.value))}
                                />
                                </td>
                                <td className="p-2">
                                <input 
                                    type="number" step="any"
                                    className="w-24 p-1 border border-slate-300 rounded focus:border-blue-500 outline-none"
                                    value={m.measuredValue}
                                    onChange={(e) => updateMeasurement(group.id, m.id, 'measuredValue', parseFloat(e.target.value))}
                                />
                                </td>
                                <td className="p-2 font-mono font-bold text-slate-700 bg-slate-50">
                                {m.error}
                                </td>
                                <td className="p-2 bg-purple-50/30">
                                <input 
                                    type="number" step="any"
                                    className="w-24 p-1 border border-purple-200 bg-white rounded focus:border-purple-500 outline-none text-purple-700 font-medium"
                                    value={m.uncertainty || 0}
                                    onChange={(e) => updateMeasurement(group.id, m.id, 'uncertainty', parseFloat(e.target.value))}
                                />
                                </td>
                                <td className="p-2 text-center">
                                <button onClick={() => removeMeasurementRow(group.id, m.id)} className="text-slate-400 hover:text-red-500">
                                    <Trash size={14} />
                                </button>
                                </td>
                            </tr>
                            ))}
                            {group.measurements.length === 0 && (
                            <tr>
                                <td colSpan={6} className="p-4 text-center text-slate-400 italic text-xs">
                                Nenhum ponto neste grupo.
                                </td>
                            </tr>
                            )}
                        </tbody>
                        </table>
                    </div>
                </div>
            ))}
          </div>
        </div>

        {/* Results & AI */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm lg:col-span-3 space-y-4">
           <div className="flex justify-between items-center border-b border-slate-100 pb-2">
             <h3 className="font-semibold text-slate-700">Conclusão</h3>
             <button 
                onClick={handleAIAnalysis}
                disabled={loadingAI || allPoints.length === 0}
                className="bg-purple-100 text-purple-700 px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-purple-200 disabled:opacity-50 transition-colors"
             >
               <Wand2 size={16} />
               {loadingAI ? 'Analisando...' : 'Gerar Análise IA'}
             </button>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Status Final</label>
                <select 
                  className="w-full p-2 border border-slate-200 rounded mb-4"
                  value={record.result}
                  onChange={(e: any) => setRecord({...record, result: e.target.value})}
                >
                  <option value="Aprovado">Aprovado</option>
                  <option value="Aprovado com Restrições">Aprovado com Restrições</option>
                  <option value="Reprovado">Reprovado</option>
                </select>

                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Observações</label>
                <textarea 
                  className="w-full p-3 border border-slate-200 rounded h-32 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  value={record.notes}
                  onChange={(e) => setRecord({...record, notes: e.target.value})}
                  placeholder="Parecer técnico..."
                ></textarea>
             </div>
             
             <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                <h4 className="text-sm font-bold text-slate-700 mb-2">IA Metrologista</h4>
                {record.aiAnalysis ? (
                  <div className="text-sm text-slate-700 italic bg-white p-3 rounded border border-slate-200 shadow-sm">
                    "{record.aiAnalysis}"
                  </div>
                ) : (
                  <div className="text-sm text-slate-400 italic">
                    A IA analisará todos os grupos de medição para sugerir o resultado.
                  </div>
                )}
             </div>
           </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 flex justify-end gap-4 z-50 md:pl-72">
        <button onClick={() => setView({ type: 'EQUIPMENT_DETAILS', equipmentId })} className="px-6 py-2 text-slate-600 font-medium">Cancelar</button>
        <button 
          onClick={handleSave} 
          disabled={saving}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-lg flex items-center gap-2 disabled:opacity-50"
        >
          {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} 
          <span>{saving ? 'Salvando...' : calibrationId ? 'Atualizar Calibração' : 'Finalizar Calibração'}</span>
        </button>
      </div>
    </div>
  );
};