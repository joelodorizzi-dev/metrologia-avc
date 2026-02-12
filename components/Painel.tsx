import React, { useState, useEffect, useRef } from 'react';
import { Equipment, EquipmentStatus, ViewState } from '../types';
import { StorageService } from '../services/storage';
import { Search, Plus, Filter, MoreVertical, Calendar, Upload, Loader2, AlertTriangle, RefreshCcw, Bell, Mail, AlertCircle, CheckCircle2, Download, Trash2, ArrowRight } from 'lucide-react';
import * as XLSX from 'xlsx';

interface DashboardProps {
  setView: (view: ViewState) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ setView }) => {
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [importProgress, setImportProgress] = useState(''); // Estado para mostrar progresso da importação
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados para Alertas
  const [expiredList, setExpiredList] = useState<Equipment[]>([]);
  const [warningList, setWarningList] = useState<Equipment[]>([]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await StorageService.getEquipment();
      setEquipmentList(data);
      checkCalibrationStatus(data);
    } catch (err: any) {
      console.error(err);
      if (err.code === 'permission-denied' || err.code === 'unavailable') {
        setError('Erro de permissão ou conexão. Verifique se o Banco de Dados Firestore foi criado no painel do Firebase.');
      } else {
        setError('Não foi possível carregar os dados. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const checkCalibrationStatus = (data: Equipment[]) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expired: Equipment[] = [];
    const warning: Equipment[] = [];

    data.forEach(eq => {
      if (eq.status !== EquipmentStatus.ACTIVE) return; // Ignora inativos/descartados

      const nextCal = new Date(eq.nextCalibrationDate);
      // Ajuste de fuso horário simples para comparação de data
      const nextCalTime = nextCal.getTime() + (nextCal.getTimezoneOffset() * 60000); 
      
      const diffTime = nextCalTime - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        expired.push(eq);
      } else if (diffDays <= 30) {
        warning.push(eq);
      }
    });

    setExpiredList(expired);
    setWarningList(warning);
  };

  const getRowStyle = (eq: Equipment) => {
    if (eq.status !== EquipmentStatus.ACTIVE) return '';

    const today = new Date();
    const nextCal = new Date(eq.nextCalibrationDate);
    const diffTime = nextCal.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'bg-red-50 hover:bg-red-100 border-l-4 border-l-red-500';
    if (diffDays <= 30) return 'bg-yellow-50 hover:bg-yellow-100 border-l-4 border-l-yellow-500';
    return 'hover:bg-blue-50 border-l-4 border-l-transparent';
  };

  const getCalibrationStatusLabel = (dateStr: string) => {
    const today = new Date();
    const nextCal = new Date(dateStr);
    const diffTime = nextCal.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return <span className="text-red-600 font-bold text-xs flex items-center gap-1"><AlertCircle size={12}/> Vencido ({Math.abs(diffDays)} dias)</span>;
    if (diffDays <= 30) return <span className="text-yellow-600 font-bold text-xs flex items-center gap-1"><AlertTriangle size={12}/> Vence em {diffDays} dias</span>;
    return <span className="text-green-600 text-xs flex items-center gap-1"><CheckCircle2 size={12}/> Em dia</span>;
  };

  const sendEmailAlert = () => {
    const subject = "ALERTA: Equipamentos com Calibração Vencida - Metrologia AVC";
    let body = "Os seguintes equipamentos necessitam de atenção imediata:\n\n";

    if (expiredList.length > 0) {
      body += "--- VENCIDOS ---\n";
      expiredList.forEach(e => {
        body += `[${e.tag}] ${e.name} - Venceu em: ${new Date(e.nextCalibrationDate).toLocaleDateString('pt-BR')}\n`;
      });
      body += "\n";
    }

    if (warningList.length > 0) {
      body += "--- PRÓXIMOS DO VENCIMENTO (30 Dias) ---\n";
      warningList.forEach(e => {
        body += `[${e.tag}] ${e.name} - Vence em: ${new Date(e.nextCalibrationDate).toLocaleDateString('pt-BR')}\n`;
      });
    }

    body += "\nFavor providenciar a calibração.";

    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  };

  const filteredList = equipmentList.filter(e => 
    e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.tag.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.manufacturer.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (e.supplier && e.supplier.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleRowClick = (id: string) => {
    setView({ type: 'EQUIPMENT_DETAILS', equipmentId: id });
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleExportClick = () => {
    if (filteredList.length === 0) {
      alert("Nenhum equipamento para exportar.");
      return;
    }

    // Mapear apenas os dados relevantes para orçamento
    const dataToExport = filteredList.map(item => ({
      'Tag': item.tag,
      'Descrição': item.name,
      'Fabricante': item.manufacturer,
      'Modelo': item.model,
      'Fornecedor': item.supplier || '',
      'Nº Série': item.serialNumber,
      'Faixa de Medição': item.range,
      'Resolução': item.resolution,
      'Critério de Aceitação': item.accuracy,
      'Próx. Calibração': item.nextCalibrationDate,
      'Status': item.status
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Equipamentos para Orçamento");
    XLSX.writeFile(wb, "lista_equipamentos_orcamento.xlsx");
  };

  const handleClearAll = async () => {
    const confirmMsg = "ATENÇÃO: Você tem certeza que deseja APAGAR TODOS os equipamentos?\n\nEssa ação é irreversível.";
    if (confirm(confirmMsg)) {
        setLoading(true);
        setImportProgress('Apagando banco de dados...');
        try {
            await StorageService.clearAllEquipment();
            await loadData();
            alert("Banco de dados limpo com sucesso!");
        } catch (e: any) {
            console.error(e);
            alert(`O processo foi interrompido ou falhou: ${e.message}\n\nDICA: Para apagar muitos dados, acesse o Console do Firebase > Firestore > Excluir Coleção 'equipment'.`);
        } finally {
            setLoading(false);
            setImportProgress('');
        }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        
        // CORREÇÃO: Usar raw: false força a leitura do que está EXIBIDO no Excel (texto).
        // Isso preserva símbolos como "±", "+/-" e formatações de data.
        const data = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
        
        processImportedData(data);
      } catch (err) {
        console.error(err);
        alert("Erro ao ler arquivo Excel. Verifique o formato.");
        setLoading(false);
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const findColumnValue = (row: any, potentialNames: string[]) => {
    const rowKeys = Object.keys(row);
    
    // Normalização Agressiva:
    // 1. Minúsculas e trim
    // 2. Remove acentos (NFD)
    // 3. Remove TUDO que não for letra ou número (ignora parênteses, +, -, espaços, pontos)
    const normalize = (str: string) => 
      str.toLowerCase()
         .trim()
         .normalize("NFD")
         .replace(/[\u0300-\u036f]/g, "")
         .replace(/[^a-z0-9]/g, "");

    for (const name of potentialNames) {
      const target = normalize(name);
      
      // MUDANÇA IMPORTANTE: Usamos .includes() em vez de ===
      // Se a coluna na planilha for "Valor Tolerancia (mm)", normalizada vira "valortoleranciamm"
      // Se procurarmos por "tolerancia", vai dar match!
      const foundKey = rowKeys.find(key => normalize(key).includes(target));
      
      if (foundKey) return row[foundKey];
    }
    return '';
  };

  const processImportedData = async (data: any[]) => {
    setLoading(true);
    setImportProgress('Analisando planilha...');
    
    let importedCount = 0;
    const equipmentMap = new Map<string, Equipment>();
    let lastValidTag = '';

    // Pass 1: Aggregate rows into equipment objects
    // Handles "Fill Down" logic for merged cells
    data.forEach((row: any, index) => {
      let tag = findColumnValue(row, ['codigo', 'tag', 'id', 'identificacao']);
      
      // Logic for Merged Cells: If TAG is missing but we have a previous tag, assume it's a continuation
      // Convert to string to ensure checks work correctly
      const tagStr = String(tag || '').trim();
      
      if (tagStr === '' && lastValidTag) {
          tag = lastValidTag;
      } else if (tagStr !== '') {
          lastValidTag = tagStr;
          tag = tagStr;
      } else {
          // If no tag at all and no previous tag, generate a temp one
          tag = `IMP-${Date.now()}-${index}`;
          lastValidTag = tag;
      }

      const cleanTag = String(tag).trim().replace(/[^a-zA-Z0-9-_]/g, '_').toUpperCase();
      const docId = cleanTag;

      // Identify specific test name for this row
      let testName = findColumnValue(row, ['tipo', 'ensaio', 'grandeza', 'complemento', 'subtipo']) || 
                     findColumnValue(row, ['faixa', 'range']);
      
      // Clean up test name
      testName = String(testName || '').trim();
      if (!testName) testName = `Teste ${index + 1}`;

      if (equipmentMap.has(docId)) {
          // Existing equipment: Add this row as a new Test Group
          const eq = equipmentMap.get(docId)!;
          if (!eq.defaultTestGroups) eq.defaultTestGroups = [];
          
          // Avoid duplicate group names
          if (!eq.defaultTestGroups.includes(testName)) {
              eq.defaultTestGroups.push(testName);
          }
      } else {
          // New Equipment
          const name = findColumnValue(row, ['descricao', 'nome', 'equipamento', 'instrumento']) || 'Sem Nome';
          const manufacturer = findColumnValue(row, ['marca', 'fabricante']) || '';
          const model = findColumnValue(row, ['modelo']) || '';
          const serialNumber = findColumnValue(row, ['serie', 'serial', 'sn']) || '';
          const range = findColumnValue(row, ['faixa', 'range', 'capacidade']) || '';
          const resolution = findColumnValue(row, ['resolucao']) || '';
          const location = findColumnValue(row, ['localizacao', 'setor', 'area']) || '';
          
          // Expanded list for Accuracy/Acceptance Criteria
          // Agora usamos raízes de palavras para facilitar o 'match' parcial
          const accuracy = findColumnValue(row, [
              'criterio', 
              'tolerancia', 
              'tol',
              'erro', 
              'ema',
              'exatidao', 
              'classe', 
              'accuracy', 
              'limite'
          ]) || '';
          
          const supplier = findColumnValue(row, ['fornecedor', 'laboratorio', 'calibrado']) || '';
          const openingP = findColumnValue(row, ['abertura', 'pressure']);
          const closingP = findColumnValue(row, ['fechamento', 'blowdown']);
          
          let nextCalRaw = findColumnValue(row, ['proxima', 'vencimento', 'validade']);
          let nextCal = '';

          // Tratamento de Data melhorado para raw: false (texto)
          if (!nextCalRaw) {
              const today = new Date();
              today.setFullYear(today.getFullYear() + 1);
              nextCal = today.toISOString().split('T')[0];
          } else {
             // Tenta limpar e converter
             const dateStr = String(nextCalRaw).trim();
             
             // Caso 1: Formato Brasileiro DD/MM/AAAA
             if (dateStr.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
                 const parts = dateStr.split('/');
                 nextCal = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
             } 
             // Caso 2: ISO YYYY-MM-DD
             else if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                 nextCal = dateStr;
             }
             // Caso 3: Excel Serial Number (se escapar do raw: false ou planilha mista)
             else if (!isNaN(Number(dateStr)) && Number(dateStr) > 20000) {
                 const date = new Date((Number(dateStr) - (25567 + 2)) * 86400 * 1000);
                 nextCal = date.toISOString().split('T')[0];
             }
             // Fallback
             else {
                 const today = new Date();
                 today.setFullYear(today.getFullYear() + 1);
                 nextCal = today.toISOString().split('T')[0];
             }
          }

          const newEq: Equipment = {
            id: docId, 
            tag: String(tag),
            name: String(name),
            manufacturer: String(manufacturer),
            model: String(model),
            serialNumber: String(serialNumber),
            range: String(range),
            resolution: String(resolution),
            accuracy: String(accuracy), 
            location: String(location),
            supplier: String(supplier),
            status: EquipmentStatus.ACTIVE,
            nextCalibrationDate: nextCal,
            createdAt: new Date().toISOString(),
            openingPressure: String(openingP),
            closingPressure: String(closingP),
            defaultTestGroups: [testName]
          };

          equipmentMap.set(docId, newEq);
      }
    });
    
    // Pass 2: Save to Firestore using BATCHES to avoid browser/network freeze
    const allEquipments = Array.from(equipmentMap.values());
    const total = allEquipments.length;
    const BATCH_SIZE = 20; // Lote pequeno para garantir estabilidade

    try {
        for (let i = 0; i < total; i += BATCH_SIZE) {
            const chunk = allEquipments.slice(i, i + BATCH_SIZE);
            
            // Clean up unnecessary default groups
            chunk.forEach(eq => {
               if (eq.defaultTestGroups?.length === 1 && eq.defaultTestGroups[0].startsWith('Teste ')) {
                  delete eq.defaultTestGroups; 
               }
            });

            await Promise.all(chunk.map(eq => StorageService.saveEquipment(eq)));
            
            importedCount += chunk.length;
            setImportProgress(`Processando ${Math.min(i + BATCH_SIZE, total)} de ${total} equipamentos...`);
        }

        await loadData();
        alert(`${importedCount} equipamentos processados com sucesso!`);
    } catch (e: any) {
        console.error(e);
        alert("Erro ao salvar dados. Verifique sua conexão e tente novamente.");
    } finally {
        setLoading(false);
        setImportProgress('');
    }
  };

  const handleNewEquipment = async () => {
    setLoading(true);
    const newId = Date.now().toString();
    const newEq: Equipment = {
        id: newId,
        tag: 'NOVO-000',
        name: 'Novo Equipamento',
        manufacturer: '',
        model: '',
        serialNumber: '',
        range: '',
        resolution: '',
        accuracy: '',
        location: '',
        status: EquipmentStatus.ACTIVE,
        nextCalibrationDate: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString()
    };
    try {
      await StorageService.saveEquipment(newEq);
      setLoading(false);
      setView({ type: 'EQUIPMENT_DETAILS', equipmentId: newId });
    } catch (e: any) {
      alert("Erro ao criar: " + e.message);
      setLoading(false);
    }
  };

  return (
    <div className="p-6 h-full flex flex-col bg-slate-50">
      <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xlsx, .xls, .csv" className="hidden" />

      {/* HEADER WITH TITLE & ACTION BUTTONS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Metrologia AVC</h2>
          <p className="text-slate-500 text-sm mt-1">Gestão de Calibração e Manutenção.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
            <button 
              onClick={handleClearAll}
              disabled={loading}
              className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-3 py-2 rounded-lg flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
              title="Apagar TODOS os equipamentos"
            >
              <Trash2 size={18} />
            </button>
            <button 
              onClick={handleImportClick}
              disabled={loading}
              className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
            >
              <Upload size={18} />
              <span className="hidden md:inline">Importar</span>
            </button>
            <button 
              onClick={handleExportClick}
              disabled={loading}
              className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
            >
              <Download size={18} />
              <span className="hidden md:inline">Exportar Excel</span>
            </button>
            <button 
              onClick={handleNewEquipment}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
            >
              <Plus size={18} />
              <span className="hidden md:inline">Novo Equipamento</span>
              <span className="md:hidden">Novo</span>
            </button>
        </div>
      </div>

      {/* STEP-BY-STEP GUIDE */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div 
            onClick={handleNewEquipment}
            className="bg-blue-50 border border-blue-100 p-4 rounded-xl cursor-pointer hover:shadow-md transition-shadow group relative overflow-hidden"
        >
            <div className="absolute right-0 top-0 opacity-10 -mr-4 -mt-4 text-blue-600">
                <Plus size={100} />
            </div>
            <h3 className="text-sm font-bold text-blue-800 uppercase mb-1 flex items-center gap-2">
                <span className="bg-blue-200 text-blue-800 w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
                Cadastrar
            </h3>
            <p className="text-xs text-blue-600 mb-2">Clique para adicionar um equipamento.</p>
            <span className="text-xs font-semibold text-blue-700 flex items-center gap-1 group-hover:underline">
                Criar Novo <ArrowRight size={12}/>
            </span>
        </div>

        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl relative overflow-hidden">
            <h3 className="text-sm font-bold text-slate-700 uppercase mb-1 flex items-center gap-2">
                <span className="bg-slate-200 text-slate-700 w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                Calibrar
            </h3>
            <p className="text-xs text-slate-500">
                Selecione um equipamento na lista abaixo e clique em <span className="font-semibold text-slate-700">"Nova Calibração"</span>.
            </p>
        </div>

        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl relative overflow-hidden">
             <h3 className="text-sm font-bold text-slate-700 uppercase mb-1 flex items-center gap-2">
                <span className="bg-slate-200 text-slate-700 w-6 h-6 rounded-full flex items-center justify-center text-xs">3</span>
                Certificar
            </h3>
            <p className="text-xs text-slate-500">
                Após salvar, o sistema gera o certificado e a IA analisa os resultados automaticamente.
            </p>
        </div>
      </div>

      {/* Alert Banner */}
      {(expiredList.length > 0 || warningList.length > 0) && (
        <div className="mb-6 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col md:flex-row">
          <div className={`p-4 flex items-center justify-center ${expiredList.length > 0 ? 'bg-red-500' : 'bg-yellow-500'}`}>
             <Bell className="text-white" size={24} />
          </div>
          <div className="p-4 flex-1 flex flex-col md:flex-row justify-between items-center gap-4">
             <div>
                <h3 className="font-bold text-slate-800">Atenção Necessária</h3>
                <div className="flex gap-4 mt-1 text-sm">
                   {expiredList.length > 0 && <span className="text-red-600 font-semibold">{expiredList.length} Equipamentos Vencidos</span>}
                   {warningList.length > 0 && <span className="text-yellow-600 font-semibold">{warningList.length} A vencer em 30 dias</span>}
                </div>
             </div>
             <button 
               onClick={sendEmailAlert}
               className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm transition-colors"
             >
               <Mail size={16} />
               Notificar Responsável por E-mail
             </button>
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-t-xl border border-slate-200 flex gap-4 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por tag, nome, fornecedor ou serial..." 
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg border border-slate-200">
          <Filter size={18} />
        </button>
      </div>

      {/* Main Table */}
      <div className="flex-1 bg-white border-x border-b border-slate-200 rounded-b-xl overflow-hidden shadow-sm flex flex-col">
        {loading ? (
            <div className="flex-1 flex items-center justify-center flex-col gap-2 text-slate-400">
                <Loader2 size={32} className="animate-spin text-blue-500" />
                <p>{importProgress || 'Carregando dados...'}</p>
            </div>
        ) : error ? (
            <div className="flex-1 flex items-center justify-center flex-col gap-4 text-slate-500 p-8 text-center">
                <AlertTriangle size={48} className="text-red-500" />
                <div className="max-w-md">
                  <h3 className="text-lg font-bold text-slate-800 mb-2">Erro de Conexão</h3>
                  <p className="mb-4">{error}</p>
                  <button onClick={loadData} className="mx-auto flex items-center gap-2 text-blue-600 hover:underline">
                    <RefreshCcw size={16} /> Tentar Novamente
                  </button>
                </div>
            </div>
        ) : (
        <div className="overflow-auto custom-scrollbar flex-1">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-100 sticky top-0 z-10">
              <tr>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">Tag</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">Equipamento</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 hidden md:table-cell">Fabricante / Modelo</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 hidden lg:table-cell">Faixa</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">Próx. Calibração</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-center">Status</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredList.map((item) => (
                <tr 
                  key={item.id} 
                  onClick={() => handleRowClick(item.id)}
                  className={`cursor-pointer transition-colors group ${getRowStyle(item)}`}
                >
                  <td className="p-4 font-mono text-sm text-blue-600 font-medium">{item.tag}</td>
                  <td className="p-4 text-sm text-slate-700 font-medium">
                     {item.name}
                     {item.supplier && <div className="text-xs text-slate-400 mt-1">Forn: {item.supplier}</div>}
                  </td>
                  <td className="p-4 text-sm text-slate-500 hidden md:table-cell">{item.manufacturer} {item.model}</td>
                  <td className="p-4 text-sm text-slate-500 font-mono hidden lg:table-cell">{item.range}</td>
                  <td className="p-4 text-sm text-slate-500">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-slate-400" />
                        {new Date(item.nextCalibrationDate).toLocaleDateString('pt-BR')}
                      </div>
                      {item.status === EquipmentStatus.ACTIVE && getCalibrationStatusLabel(item.nextCalibrationDate)}
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${item.status === EquipmentStatus.ACTIVE ? 'bg-white border-slate-200 text-slate-600' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <MoreVertical size={16} className="text-slate-400 opacity-0 group-hover:opacity-100" />
                  </td>
                </tr>
              ))}
              {filteredList.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-400">
                    Nenhum equipamento encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        )}
        
        <div className="p-3 border-t border-slate-200 bg-slate-50 text-xs text-slate-500 flex justify-between items-center">
          <span>Mostrando {filteredList.length} registros</span>
          <div className="flex gap-2">
            <button className="px-2 py-1 hover:bg-white rounded border border-transparent hover:border-slate-300">Anterior</button>
            <button className="px-2 py-1 hover:bg-white rounded border border-transparent hover:border-slate-300">Próximo</button>
          </div>
        </div>
      </div>
    </div>
  );
};
