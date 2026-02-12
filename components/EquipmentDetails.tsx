import React, { useState, useEffect } from 'react';
import { Equipment, EquipmentStatus, CalibrationRecord, ViewState } from '../types';
import { StorageService } from '../services/storage';
import { ArrowLeft, Save, Trash2, History, PlusCircle, Printer, AlertTriangle, Gauge, Loader2, Filter, Pencil, PlayCircle } from 'lucide-react';

interface EquipmentDetailsProps {
  equipmentId: string;
  setView: (view: ViewState) => void;
}

export const EquipmentDetails: React.FC<EquipmentDetailsProps> = ({ equipmentId, setView }) => {
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [history, setHistory] = useState<CalibrationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filterYear, setFilterYear] = useState<string>('all');
  const [isNew, setIsNew] = useState(false);

  useEffect(() => {
    const loadDetails = async () => {
        setLoading(true);
        const list = await StorageService.getEquipment();
        const found = list.find(e => e.id === equipmentId);
        if (found) {
          setEquipment(found);
          const calHistory = await StorageService.getCalibrations(found.id);
          setHistory(calHistory);
          // Simple check: if tag is still default, it's likely a fresh creation
          if (found.tag === 'NOVO-000') setIsNew(true);
        }
        setLoading(false);
    };
    loadDetails();
  }, [equipmentId]);

  const handleSave = async (andCalibrate: boolean = false) => {
    if (equipment) {
      setSaving(true);
      await StorageService.saveEquipment(equipment);
      setSaving(false);
      
      if (andCalibrate) {
        setView({ type: 'NEW_CALIBRATION', equipmentId: equipment.id });
      } else {
        alert('Equipamento salvo com sucesso!');
        setIsNew(false); // No longer considered "new" after first save
      }
    }
  };

  const handleDelete = async () => {
    if (confirm('Tem certeza que deseja excluir este equipamento?')) {
      await StorageService.deleteEquipment(equipmentId);
      setView({ type: 'DASHBOARD' });
    }
  };

  const handleChange = (field: keyof Equipment, value: string) => {
    if (equipment) {
      setEquipment({ ...equipment, [field]: value });
    }
  };

  // Logic for filtering history
  const availableYears = Array.from(new Set(history.map(c => c.date.split('-')[0]))).sort().reverse();
  
  const filteredHistory = filterYear === 'all' 
    ? history 
    : history.filter(h => h.date.startsWith(filterYear));

  if (loading || !equipment) return <div className="p-8 flex items-center gap-2"><Loader2 className="animate-spin"/> Carregando...</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button 
          onClick={() => setView({ type: 'DASHBOARD' })}
          className="p-2 hover:bg-white rounded-full transition-colors"
        >
          <ArrowLeft size={24} className="text-slate-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            {equipment.tag} 
            <span className="text-slate-400 font-normal text-lg">| {equipment.name}</span>
          </h1>
        </div>
        <div className="ml-auto flex gap-2">
          <button 
            onClick={handleDelete}
            className="p-2 text-red-500 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-200 transition-colors"
            title="Excluir"
          >
            <Trash2 size={20} />
          </button>
          
          <button 
            onClick={() => handleSave(false)}
            disabled={saving}
            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm disabled:opacity-50"
          >
            <Save size={18} />
            <span className="hidden md:inline">Salvar</span>
          </button>

          <button 
            onClick={() => handleSave(true)}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm disabled:opacity-50"
          >
            {saving ? <Loader2 className="animate-spin" size={18} /> : <PlayCircle size={18} />}
            <span>Salvar e Calibrar</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Equipment Form */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <span className="w-1 h-6 bg-blue-500 rounded-full"></span>
              Dados Cadastrais
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputGroup label="Tag / Identificação" value={equipment.tag} onChange={(v) => handleChange('tag', v)} />
              <InputGroup label="Nome do Equipamento" value={equipment.name} onChange={(v) => handleChange('name', v)} />
              
              <InputGroup label="Fabricante" value={equipment.manufacturer} onChange={(v) => handleChange('manufacturer', v)} />
              <InputGroup label="Modelo" value={equipment.model} onChange={(v) => handleChange('model', v)} />
              
              <InputGroup label="Número de Série" value={equipment.serialNumber} onChange={(v) => handleChange('serialNumber', v)} />
              <InputGroup label="Localização" value={equipment.location} onChange={(v) => handleChange('location', v)} />

              <div className="md:col-span-2 border-t border-slate-100 my-2"></div>

              <InputGroup label="Faixa de Medição" value={equipment.range} onChange={(v) => handleChange('range', v)} />
              <InputGroup label="Resolução" value={equipment.resolution} onChange={(v) => handleChange('resolution', v)} />
              <InputGroup label="Critério de Aceitação (Tolerância)" value={equipment.accuracy} onChange={(v) => handleChange('accuracy', v)} fullWidth />
              
              <InputGroup label="Fornecedor / Laboratório" value={equipment.supplier || ''} onChange={(v) => handleChange('supplier', v)} fullWidth placeholder="Empresa responsável pela calibração externa" />

              {/* Specific Fields for Valves */}
              <div className="md:col-span-2 bg-slate-50 p-4 rounded-lg border border-slate-100 mt-2">
                <h4 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
                  <Gauge size={14} /> 
                  Especificações de Válvulas / Pressão
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InputGroup 
                    label="Pressão de Abertura (Set Pressure)" 
                    value={equipment.openingPressure || ''} 
                    onChange={(v) => handleChange('openingPressure', v)} 
                    placeholder="Ex: 10.5 bar"
                  />
                  <InputGroup 
                    label="Pressão de Fechamento (Blowdown)" 
                    value={equipment.closingPressure || ''} 
                    onChange={(v) => handleChange('closingPressure', v)} 
                    placeholder="Ex: 9.8 bar"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1 mt-2">
                <label className="text-xs font-semibold text-slate-500 uppercase">Status</label>
                <select 
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  value={equipment.status}
                  onChange={(e) => handleChange('status', e.target.value as any)}
                >
                  {Object.values(EquipmentStatus).map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              
              <InputGroup 
                type="date"
                label="Próxima Calibração" 
                value={equipment.nextCalibrationDate} 
                onChange={(v) => handleChange('nextCalibrationDate', v)} 
              />
            </div>
          </div>
        </div>

        {/* Right Column: Calibration Actions & History */}
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-6 rounded-xl text-white shadow-lg">
            <h3 className="text-lg font-bold mb-2">Ações Rápidas</h3>
            <p className="text-blue-100 text-sm mb-6">Registre uma nova calibração ou emita certificados.</p>
            
            <button 
              onClick={() => setView({ type: 'NEW_CALIBRATION', equipmentId: equipment.id })}
              className="w-full bg-white text-blue-700 font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2 hover:bg-blue-50 transition-colors shadow-sm mb-3"
            >
              <PlusCircle size={20} />
              Nova Calibração
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
             <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                  <History size={18} className="text-slate-400" />
                  Histórico
                </h3>
                {availableYears.length > 0 && (
                  <div className="flex items-center gap-1">
                     <Filter size={14} className="text-slate-400"/>
                     <select 
                        className="text-xs border border-slate-200 rounded p-1 bg-white text-slate-600 outline-none focus:border-blue-500"
                        value={filterYear}
                        onChange={(e) => setFilterYear(e.target.value)}
                     >
                        <option value="all">Todos os Anos</option>
                        {availableYears.map(year => (
                           <option key={year} value={year}>{year}</option>
                        ))}
                     </select>
                  </div>
                )}
             </div>
             <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                {filteredHistory.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-sm">
                    {filterYear !== 'all' ? `Nenhuma calibração em ${filterYear}.` : 'Nenhuma calibração registrada.'}
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {filteredHistory.map(cal => (
                      <div key={cal.id} className="p-4 hover:bg-slate-50 transition-colors">
                        <div className="flex justify-between items-start mb-1">
                           <span className="font-mono text-sm text-slate-600">{new Date(cal.date).toLocaleDateString('pt-BR')}</span>
                           <StatusBadge result={cal.result} />
                        </div>
                        <div className="text-xs text-slate-500 mb-3">Tec: {cal.technician}</div>
                        <div className="flex gap-2">
                            <button 
                              onClick={() => setView({ type: 'VIEW_REPORT', calibrationId: cal.id })}
                              className="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1 bg-blue-50 px-2 py-1 rounded border border-blue-100"
                            >
                              <Printer size={12} />
                              Certificado
                            </button>
                            <button 
                              onClick={() => setView({ type: 'EDIT_CALIBRATION', equipmentId: equipment.id, calibrationId: cal.id })}
                              className="text-xs font-medium text-slate-600 hover:text-slate-800 flex items-center gap-1 bg-slate-100 px-2 py-1 rounded border border-slate-200"
                              title="Editar Calibração"
                            >
                              <Pencil size={12} />
                              Editar
                            </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const InputGroup = ({ label, value, onChange, type = "text", fullWidth = false, placeholder = "" }: any) => (
  <div className={`flex flex-col gap-1 ${fullWidth ? 'md:col-span-2' : ''}`}>
    <label className="text-xs font-semibold text-slate-500 uppercase">{label}</label>
    <input 
      type={type} 
      value={value} 
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-slate-700"
    />
  </div>
);

const StatusBadge = ({ result }: { result: string }) => {
  const colors = result === 'Aprovado' 
    ? 'bg-green-100 text-green-700' 
    : result === 'Reprovado' 
      ? 'bg-red-100 text-red-700' 
      : 'bg-yellow-100 text-yellow-700';
  
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${colors}`}>
      {result}
    </span>
  );
