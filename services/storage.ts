import { CalibrationRecord, Equipment, BudgetRecord } from '../types';
import { db } from './firebase';
import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  deleteDoc, 
  query, 
  where,
  updateDoc,
  limit,
  writeBatch
} from 'firebase/firestore';

const COLLECTIONS = {
  EQUIPMENT: 'equipment',
  CALIBRATIONS: 'calibrations',
  BUDGETS: 'budgets',
};

export const StorageService = {
  // --- SYSTEM ---
  checkConnection: async (): Promise<boolean> => {
    try {
      // Tenta buscar apenas 1 documento para verificar se a conexão e permissões estão ativas
      await getDocs(query(collection(db, COLLECTIONS.EQUIPMENT), limit(1)));
      return true;
    } catch (error) {
      console.error("Connection check failed:", error);
      return false;
    }
  },

  // --- EQUIPMENT ---

  getEquipment: async (): Promise<Equipment[]> => {
    try {
      const querySnapshot = await getDocs(collection(db, COLLECTIONS.EQUIPMENT));
      return querySnapshot.docs.map(doc => doc.data() as Equipment);
    } catch (error) {
      console.error("Erro ao buscar equipamentos:", error);
      throw error; // Re-throw para que a UI saiba que falhou
    }
  },

  saveEquipment: async (equipment: Equipment): Promise<void> => {
    try {
      // setDoc com merge: true atualiza se existir, cria se não existir
      await setDoc(doc(db, COLLECTIONS.EQUIPMENT, equipment.id), equipment, { merge: true });
    } catch (error) {
      console.error("Erro ao salvar equipamento:", error);
      throw error;
    }
  },

  deleteEquipment: async (id: string): Promise<void> => {
    try {
      await deleteDoc(doc(db, COLLECTIONS.EQUIPMENT, id));
    } catch (error) {
      console.error("Erro ao deletar equipamento:", error);
      throw error;
    }
  },

  // Função robusta para limpar todo o banco usando Batches Iterativos
  // Apaga em blocos pequenos (50) para evitar sobrecarga e timeouts
  clearAllEquipment: async (): Promise<void> => {
    try {
      const collectionRef = collection(db, COLLECTIONS.EQUIPMENT);
      
      while (true) {
        // Busca um lote limitado de documentos - Reduzido para 50 para estabilidade
        const q = query(collectionRef, limit(50));
        const snapshot = await getDocs(q);

        // Se não retornou nada, o banco está limpo
        if (snapshot.empty) {
          break;
        }

        const batch = writeBatch(db);
        snapshot.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });

        // Executa a exclusão deste lote e espera terminar antes de pegar o próximo
        await batch.commit();
        console.log(`Lote de ${snapshot.size} equipamentos apagado.`);
      }
    } catch (error) {
      console.error("Erro crítico ao limpar banco de dados:", error);
      throw error;
    }
  },

  // --- CALIBRATIONS ---

  getCalibrations: async (equipmentId?: string): Promise<CalibrationRecord[]> => {
    try {
      const calRef = collection(db, COLLECTIONS.CALIBRATIONS);
      let q;
      
      if (equipmentId) {
        q = query(calRef, where("equipmentId", "==", equipmentId));
      } else {
        q = query(calRef);
      }

      const querySnapshot = await getDocs(q);
      const records = querySnapshot.docs.map(doc => doc.data() as CalibrationRecord);
      
      // Ordenação no cliente para garantir histórico cronológico (Mais novo -> Mais antigo)
      return records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } catch (error) {
      console.error("Erro ao buscar calibrações:", error);
      return [];
    }
  },

  getCalibrationById: async (id: string): Promise<CalibrationRecord | undefined> => {
    try {
      const q = query(collection(db, COLLECTIONS.CALIBRATIONS), where("id", "==", id));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        return querySnapshot.docs[0].data() as CalibrationRecord;
      }
      return undefined;
    } catch (error) {
      console.error("Erro ao buscar calibração por ID:", error);
      return undefined;
    }
  },

  saveCalibration: async (calibration: CalibrationRecord): Promise<void> => {
    try {
      await setDoc(doc(db, COLLECTIONS.CALIBRATIONS, calibration.id), calibration, { merge: true });

      // Atualizar o equipamento com a data da última/próxima calibração
      // Precisamos primeiro buscar o equipamento
      const eqRef = doc(db, COLLECTIONS.EQUIPMENT, calibration.equipmentId);
      
      // Calculate next date (simplified logic from previous version)
      const nextDate = new Date(calibration.date);
      nextDate.setFullYear(nextDate.getFullYear() + 1);
      
      await updateDoc(eqRef, {
        lastCalibrationDate: calibration.date,
        nextCalibrationDate: nextDate.toISOString().split('T')[0]
      });

    } catch (error) {
      console.error("Erro ao salvar calibração:", error);
      throw error;
    }
  },

  // --- BUDGETS / MAINTENANCE COSTS ---

  getBudgets: async (): Promise<BudgetRecord[]> => {
    try {
      const querySnapshot = await getDocs(collection(db, COLLECTIONS.BUDGETS));
      const records = querySnapshot.docs.map(doc => doc.data() as BudgetRecord);
      // Sort by date descending
      return records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } catch (error) {
      console.error("Erro ao buscar orçamentos:", error);
      return [];
    }
  },

  saveBudget: async (budget: BudgetRecord): Promise<void> => {
    try {
      await setDoc(doc(db, COLLECTIONS.BUDGETS, budget.id), budget, { merge: true });
    } catch (error) {
      console.error("Erro ao salvar orçamento:", error);
      throw error;
    }
  },

  deleteBudget: async (id: string): Promise<void> => {
    try {
      await deleteDoc(doc(db, COLLECTIONS.BUDGETS, id));
    } catch (error) {
      console.error("Erro ao deletar orçamento:", error);
      throw error;
    }
  }
};