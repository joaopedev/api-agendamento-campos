import { UserModel, SchedulingModel, Cras, HTTP_ERRORS, Status } from './../models/model';
import { knex } from "../connectDB";
import { Usuario } from "./usuario";
import { validate as isUUID } from 'uuid';

export class Scheduling {

    public static async getSchedules(): Promise<SchedulingModel[]> {
        let agendamentos: SchedulingModel[] = await knex("scheduling").select("*").orderBy("id");
        if(!agendamentos || agendamentos.length <= 0) throw new Error("Náo há nenhum agendamento disponível!");

        return agendamentos;
    }

    public static async getSchedulesByCras(cras: number): Promise<SchedulingModel[]> {
        let agendamentos: SchedulingModel[] = await knex("scheduling").select("*").where("cras", cras).orderBy("id");
        if(!agendamentos || agendamentos.length <= 0) throw new Error(`Náo há nenhum agendamento para o Cras de ${Cras[cras]}!`);

        return agendamentos;
    }

    public static async getScheduleById(id: string): Promise<SchedulingModel> {
        if(!isUUID(id)) throw new Error('ID de agendamento inválido!');

        let agendamento: SchedulingModel = await knex("scheduling").select("*").where("id", id).first();
        if(!agendamento) throw new Error("Náo há nenhum agendamento disponível!");

        return agendamento;
    }

    public static async getScheduleByUserId(usuario_id: string): Promise<SchedulingModel[]> {
        let agendamentos: SchedulingModel[] = await knex("scheduling").select("*").where("usuario_id", usuario_id).orderBy("id");
        if(!agendamentos || agendamentos.length <= 0) throw new Error("Náo há nenhum agendamento para este usuário!");

        return agendamentos;
    }

    private static async isSchedulingUserConflict(usuario_id: string, data_hora: Date): Promise<boolean> {
        // Converter a data para o formato YYYY-MM-DD
        const data_hora_iso = data_hora.toISOString().substring(0, 10);
        try {
            
            const existingScheduling = await knex('scheduling')
              .where('usuario_id', usuario_id)
              .whereRaw('DATE(data_hora) = ?', [data_hora_iso])
              .first();
          
            return !!existingScheduling;
        } catch (error) {
            console.error('Erro ao executar a consulta:', error);
            throw new Error('Erro ao executar a consulta no agendamento do usuário!.');
        }
    }

    private static async isSchedulingDayConflict(cras: Cras, data_hora: Date): Promise<boolean> {
        // Converter a data para o formato YYYY-MM-DD
        const data_hora_iso = data_hora.toISOString().substring(0, 10);
         // Obtendo a hora da data
        const hora = data_hora.getHours();

        try {
            
            const numAgendamentos = await knex('scheduling')
            .where('cras', cras)
            .whereRaw('DATE(data_hora) = ?', [data_hora_iso]) // Filtra pela data
            .whereRaw('EXTRACT(HOUR FROM data_hora) = ?', [hora]) // Filtra pela hora
            .count({ count: '*' })
            .first();
    
            if (numAgendamentos === undefined) {
                throw new Error('Erro ao contar agendamentos.');
            }
    
            const numAgendamentosCount = parseInt(String(numAgendamentos.count));
            const funcionarios: UserModel[] = await Usuario.getFuncionariosByCras(cras);
            if (!funcionarios || funcionarios.length <= 0) throw new Error('O cras informado é inválido ou não possuí funcionários cadastrados!');


            return numAgendamentosCount >= funcionarios.length;

        } catch (error) {
            console.error('Erro ao executar a consulta:', error);
            throw new Error('Erro ao executar a consulta no agendamento para a data informada!.');
        }
    }

    public static async createSchedule(agendamento: SchedulingModel): Promise<SchedulingModel> {
        if (!agendamento) throw new Error("Agendamento inválido!");
   
        try {

            let existeAgendamento = await this.isSchedulingUserConflict(agendamento.usuario_id, agendamento.data_hora)

            if(existeAgendamento) {
                throw new Error((HTTP_ERRORS.CONFLICT, "Você já possuí agendamento para este dia!"));
            }

            const NaotemVaga = await this.isSchedulingDayConflict(agendamento.cras, agendamento.data_hora);

            if(NaotemVaga) {
                throw new Error("Este horário escolhido não está disponível, por favor escolha outro horário!");
            }

            await knex("scheduling").insert(agendamento);
            return agendamento;
          
        } catch (error) {
            throw error;
        }
    }

    public static async updateSchedule(agendamento: SchedulingModel): Promise<SchedulingModel> {
        if (!agendamento.id) throw new Error("Id de agendamento inválido!");
        
        if (agendamento.status == Status.realizado || agendamento.status == Status.ausente) {
            const erro = agendamento.status == Status.realizado ? "Ausente" : "Realizado";             
            throw new Error(`O serviço para esse agendamento já foi concluído devido ao seu status ${erro}!`);
        } 

        try {

            let agendamentoBanco = await this.getScheduleById(agendamento.id);
            if (!agendamentoBanco) throw new Error("Esse agendamento não existe!");
            
            agendamentoBanco = { ...agendamentoBanco, ...agendamento };
            
            if (!agendamentoBanco.cras) throw new Error("É obrigatório escolher o cras do agendamento!");

            await knex("scheduling")
                .where("id", agendamentoBanco.id)
                .first()
                .update(agendamentoBanco);

            return agendamentoBanco;

        } catch (error) {
            throw error
        }
    }

    //ESTÁ IMPLEMENTADO PORÉM NÃO DEVE SER USADO POR ENQUANTO, SOMENTE EXCLUSÃO LÓGICA NO BANCO COM STATUS 0 'CANCELADO'
    public static async deleteSchedule(id: string): Promise<boolean> {

        if(!isUUID(id)) throw new Error('ID de agendamento inválido!');

        const agendamento = await this.getScheduleById(id);
        
        if(!agendamento) return false;

        try {
            
            const retorno = await knex("scheduling")
              .select("scheduling")
              .where("id", id)
              .first()
              .delete();
        
            return !!retorno;
        } catch (error) {
            throw error;
        }
    
    }

    public static async deleteUserSchedules(agendamentos: SchedulingModel[]): Promise<boolean> {

        try {
            
            const retorno = await knex("scheduling")
              .select("scheduling")
              .where("usuario_id", agendamentos[0].usuario_id)
              .delete();
        
            return !!retorno;
        } catch (error) {
            throw error;
        }
    
    }


}