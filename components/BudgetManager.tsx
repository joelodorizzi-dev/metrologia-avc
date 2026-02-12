import React, { useState, useEffect } from 'react';
import { BudgetRecord, Equipment, ViewState, BudgetEquipmentLink } from '../types';
import { StorageService } from '../services/storage';
import { Plus, Search, Filter, DollarSign, TrendingUp, Calendar, Trash2, Save, X, Loader2, AlertCircle, Layers } from 'lucide-react';
import * as XLSX from 'xlsx';

interface BudgetManagerProps {
  setView: (view: ViewState) => void;
}

export const BudgetManager: React.FC<BudgetManagerProps> = ({ setView }) => {
  const [budgets, setBudgets] = useState<BudgetRecord[]>([]);
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterYear, setFilterYear] = useState<number>(new Date().getFullYear());
  const [searchTerm, setSearchTerm] = useState('');

  // Form State
  const [newRecord, setNewRecord] = useState<Partial<BudgetRecord>>({
    date: new Date().toISOString().split('T')[0],
    status: 'Pendente',
    type: 'Calibração',
    cost: 0,
    equipments: []
  });
  
  // Auxiliary state for the multi-select dropdown in the form
  const [selectedEqId, setSelectedEqId] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
        const [eqList, budgetList] = await Promise.all([
            StorageService.getEquipment(),
            StorageService.getBudgets()
        ]);
        setEquipments(eqList);
        // Migration support: handle old records that might not have 'equipments' array
        const sanitizedBudgets = budgetList.map((b: any) => {
            if (!b.equipments && b.equipmentId) {
                return {
                    ...b,
                    equipments: [{ id: b.equipmentId, tag: b.equipmentTag, name: b.equipmentName }]
                };
            }
            return b;
        });
        setBudgets(sanitizedBudgets);
    } catch (e) {
        console.error(e);
        alert("Erro ao carregar dados financeiros.");
    } finally {
        setLoading(false);
    }
  };

  const handleAddEquipment = () => {
      if (!selectedEqId) return;
      
      // Check if already added
      if (newRecord.equipments?.some(e => e.id === selectedEqId)) {
          alert("Este equipamento já foi adicionado à lista.");
          return;
      }

      const eqFull = equipments.find(e => e.id === selectedEqId);
      if (eqFull) {
          const link: BudgetEquipmentLink = {
              id: eqFull.id,
              tag: eqFull.tag,
              name: eqFull.name
          };
          setNewRecord(prev => ({
              ...prev,
              equipments: [...(prev.equipments || []), link]
          }));
          setSelectedEqId(''); // Reset selector
      }
  };

  const handleRemoveEquipment = (idToRemove: string) => {
      setNewRecord(prev => ({
          ...prev,
          equipments: prev.equipments?.filter(e => e.id !== idToRemove)
      }));
  };

  const handleSave = async () => {
    if ((!newRecord.equipments || newRecord.equipments.length === 0) || !newRecord.provider || !newRecord.cost) {
        alert("Adicione pelo menos um equipamento, o fornecedor e o valor.");
        return;
    }

    const recordToSave: BudgetRecord = {
        id: newRecord.id || Date.now().toString(),
        equipments: newRecord.equipments,
        provider: newRecord.provider,
        date: newRecord.date || new Date().toISOString().split('T')[0],
        type: newRecord.type as any,
        cost: Number(newRecord.cost),
        status: newRecord.status as any,
        notes: newRecord.notes || ''
    };

    await StorageService.saveBudget(recordToSave);
    setShowForm(false);
    resetForm();
    loadData();
  };

  const resetForm = () => {
      setNewRecord({
        date: new Date().toISOString().split('T')[0],
        status: 'Pendente',
        type: 'Calibração',
        cost: 0,
        equipments: []
    });
    setSelectedEqId('');
  };

  const handleDelete = async (id: string) => {
    if (confirm("Deseja excluir este registro de custo?")) {
        await StorageService.deleteBudget(id);
        loadData();
    }
  };

  const handleEdit = (record: BudgetRecord) => {
      setNewRecord(record);
      setShowForm(true);
  };

  const handleExport = () => {
      const ws = XLSX.utils.json_to_sheet(filteredBudgets.map(b => ({
          'Data': new Date(b.date).toLocaleDateString('pt-BR'),
          'Equipamentos (Tags)': b.equipments.map(e => e.tag).join(', '),
          'Equipamentos (Nomes)': b.equipments.map(e => e.name).join(', '),
          'Qtd Equip.': b.equipments.length,
          'Tipo': b.type,
          'Fornecedor': b.provider,
          'Status': b.status,
          'Valor Total (R$)': b.cost,
          'Observações': b.notes
      })));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Custos Metrologia");
      XLSX.writeFile(wb, `Custos_Metrologia_${filterYear}.xlsx`);
  };

  // Filters & Calculations
  const filteredBudgets = budgets.filter(b => {
      const matchesYear = new Date(b.date).getFullYear() === filterYear;
      
      const tagsString = b.equipments.map(e => e.tag).join(' ').toLowerCase();
      const namesString = b.equipments.map(e => e.name).join(' ').toLowerCase();
      
      const matchesSearch = 
        tagsString.includes(searchTerm.toLowerCase()) ||
        namesString.includes(searchTerm.toLowerCase()) ||
        b.provider.toLowerCase().includes(searchTerm.toLowerCase());
      
      return matchesYear && matchesSearch;
  });

  const totalCost = filteredBudgets
    .filter(b => b.status === 'Concluído' || b.status === 'Aprovado')
    .reduce((acc, curr) => acc + curr.cost, 0);

  const pendingCost = filteredBudgets
    .filter(b => b.status === 'Pendente')
    .reduce((acc, curr) => acc + curr.cost, 0);

  const getStatusColor = (status: string) => {
      switch(status) {
          case 'Concluído': return 'bg-green-100 text-green-700 border-green-200';
          case 'Aprovado': return 'bg-blue-100 text-blue-700 border-blue-200';
          case 'Cancelado': return 'bg-gray-100 text-gray-500 border-gray-200';
          default: return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      }
  };

  return (
    <div className="p-6 h-full flex flex-col bg-slate-50 overflow-hidden">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <DollarSign className="text-blue-600" />
            Controle de Custos
          </h2>
          <p className="text-slate-500 text-sm mt-1">Gerencie orçamentos em lote para múltiplos equipamentos.</p>
        </div>
        <div className="flex gap-2">
            <button onClick={handleExport} className="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50">
                Exportar Relatório
            </button>
            <button onClick={() => { resetForm(); setShowForm(true); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2">
                <Plus size={18} /> Novo Registro
            </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
         <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-green-50 rounded-lg text-green-600">
                <TrendingUp size={24} />
            </div>
            <div>
                <p className="text-xs font-semibold text-slate-500 uppercase">Total Gasto ({filterYear})</p>
                <p className="text-2xl font-bold text-slate-800">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalCost)}
                </p>
            </div>
         </div>
         <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-yellow-50 rounded-lg text-yellow-600">
                <AlertCircle size={24} />
            </div>
            <div>
                <p className="text-xs font-semibold text-slate-500 uppercase">Pendente / Em Aberto</p>
                <p className="text-2xl font-bold text-slate-800">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pendingCost)}
                </p>
            </div>
         </div>
         <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
                <Calendar size={24} />
            </div>
            <div>
                <p className="text-xs font-semibold text-slate-500 uppercase">Registros no Ano</p>
                <p className="text-2xl font-bold text-slate-800">{filteredBudgets.length}</p>
            </div>
         </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-t-xl border border-slate-200 flex gap-4 items-center">
        <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
            <input 
                type="text" 
                placeholder="Buscar por tag, fornecedor..." 
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>
        <div className="flex items-center gap-2">
            <Filter size={18} className="text-slate-400" />
            <select 
                className="p-2 border border-slate-200 rounded-lg text-slate-700 bg-slate-50 outline-none focus:border-blue-500"
                value={filterYear}
                onChange={(e) => setFilterYear(Number(e.target.value))}
            >
                {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 bg-white border-x border-b border-slate-200 rounded-b-xl overflow-hidden shadow-sm flex flex-col">
          {loading ? (
             <div className="flex-1 flex justify-center items-center"><Loader2 className="animate-spin text-blue-600" /></div> 
          ) : (
            <div className="overflow-auto custom-scrollbar flex-1">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-100 sticky top-0 z-10">
                        <tr>
                            <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b">Data</th>
                            <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b">Equipamentos Vinculados</th>
                            <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b">Tipo</th>
                            <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b">Fornecedor</th>
                            <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b text-right">Valor Total</th>
                            <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b text-center">Status</th>
                            <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b w-10"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredBudgets.map(item => (
                            <tr key={item.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => handleEdit(item)}>
                                <td className="p-4 text-sm text-slate-600 font-mono">
                                    {new Date(item.date).toLocaleDateString('pt-BR')}
                                </td>
                                <td className="p-4">
                                    <div className="flex flex-col gap-1">
                                        <div className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                            <Layers size={14} className="text-blue-500"/>
                                            {item.equipments.length} Item(s)
                                        </div>
                                        <div className="text-xs text-slate-500 truncate max-w-[250px] bg-slate-100 px-2 py-1 rounded">
                                            {item.equipments.map(e => e.tag).join(', ')}
                                        </div>
                                    </div>
                                </td>
                                <td className="p-4 text-sm text-slate-600">{item.type}</td>
                                <td className="p-4 text-sm text-slate-600">{item.provider}</td>
                                <td className="p-4 text-sm font-bold text-slate-700 text-right">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.cost)}
                                </td>
                                <td className="p-4 text-center">
                                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase border ${getStatusColor(item.status)}`}>
                                        {item.status}
                                    </span>
                                </td>
                                <td className="p-4 text-right">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                                        className="text-slate-400 hover:text-red-500 transition-colors"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {filteredBudgets.length === 0 && (
                            <tr><td colSpan={7} className="p-8 text-center text-slate-400">Nenhum registro encontrado para este ano.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
          )}
      </div>

      {/* ADD/EDIT MODAL */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="bg-slate-100 p-4 border-b border-slate-200 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800">
                        {newRecord.id ? 'Editar Registro' : 'Novo Custo / Orçamento'}
                    </h3>
                    <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                    
                    {/* Multi-Select Equipment Section */}
                    <div className="bg-slate-50 p-3 rounded border border-slate-200">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Adicionar Equipamentos</label>
                        <div className="flex gap-2 mb-3">
                            <select 
                                className="flex-1 p-2 border border-slate-300 rounded text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                value={selectedEqId}
                                onChange={(e) => setSelectedEqId(e.target.value)}
                            >
                                <option value="">Selecione para adicionar...</option>
                                {equipments
                                    .filter(eq => !newRecord.equipments?.some(sel => sel.id === eq.id))
                                    .map(eq => (
                                    <option key={eq.id} value={eq.id}>{eq.tag} - {eq.name}</option>
                                ))}
                            </select>
                            <button 
                                onClick={handleAddEquipment}
                                disabled={!selectedEqId}
                                className="bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                            >
                                <Plus size={18}/>
                            </button>
                        </div>
                        
                        <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
                            {newRecord.equipments && newRecord.equipments.length > 0 ? (
                                newRecord.equipments.map(item => (
                                    <div key={item.id} className="flex justify-between items-center bg-white p-2 rounded border border-slate-200 text-sm">
                                        <div>
                                            <span className="font-mono font-bold text-blue-600 text-xs mr-2">{item.tag}</span>
                                            <span className="text-slate-600 text-xs truncate">{item.name}</span>
                                        </div>
                                        <button onClick={() => handleRemoveEquipment(item.id)} className="text-slate-400 hover:text-red-500">
                                            <X size={14} />
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <p className="text-xs text-slate-400 italic text-center py-2">Nenhum equipamento vinculado.</p>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tipo de Serviço</label>
                            <select 
                                className="w-full p-2 border border-slate-300 rounded"
                                value={newRecord.type}
                                onChange={(e: any) => setNewRecord({...newRecord, type: e.target.value})}
                            >
                                <option value="Calibração">Calibração</option>
                                <option value="Manutenção">Manutenção</option>
                                <option value="Reparo">Reparo</option>
                                <option value="Peças">Peças</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data</label>
                            <input 
                                type="date" 
                                className="w-full p-2 border border-slate-300 rounded"
                                value={newRecord.date}
                                onChange={(e) => setNewRecord({...newRecord, date: e.target.value})}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fornecedor / Laboratório</label>
                        <input 
                            type="text" 
                            className="w-full p-2 border border-slate-300 rounded"
                            placeholder="Ex: Lab XYZ"
                            value={newRecord.provider || ''}
                            onChange={(e) => setNewRecord({...newRecord, provider: e.target.value})}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Valor Total (R$)</label>
                            <input 
                                type="number" step="0.01"
                                className="w-full p-2 border border-slate-300 rounded font-bold text-slate-700"
                                value={newRecord.cost}
                                onChange={(e) => setNewRecord({...newRecord, cost: parseFloat(e.target.value)})}
                                placeholder="Custo global"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label>
                            <select 
                                className="w-full p-2 border border-slate-300 rounded font-medium"
                                value={newRecord.status}
                                onChange={(e: any) => setNewRecord({...newRecord, status: e.target.value})}
                            >
                                <option value="Pendente">Pendente</option>
                                <option value="Aprovado">Aprovado</option>
                                <option value="Concluído">Concluído (Pago)</option>
                                <option value="Cancelado">Cancelado</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Observações</label>
                        <textarea 
                            className="w-full p-2 border border-slate-300 rounded h-16 text-sm"
                            value={newRecord.notes || ''}
                            onChange={(e) => setNewRecord({...newRecord, notes: e.target.value})}
                        ></textarea>
                    </div>
                </div>

                <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
                    <button onClick={() => setShowForm(false)} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded">Cancelar</button>
                    <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white font-bold rounded hover:bg-blue-700 flex items-center gap-2">
                        <Save size={18} /> Salvar Registro
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
