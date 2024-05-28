import { UserModel, SchedulingModel, Cras, HTTP_ERRORS } from './../models/model';
import { knex } from "../connectDB";
import { Usuario } from "./usuario";
import createError from "http-errors";

export class Scheduling {

    public static async getSchedules(): Promise<SchedulingModel[]> {
        let agendamentos = await knex("scheduling").select("*").orderBy("id");

        return agendamentos;
    }

    public static async getSchedulesByCras(cras: Cras): Promise<SchedulingModel[]> {
        let agendamentos = await knex("scheduling").select("*").where("cras", cras).orderBy("id");
        
        return agendamentos;
    }

    public static async getScheduleById(id: string): Promise<SchedulingModel> {
        let agendamento = await knex("scheduling").select("*").where("id", id).first();

        return agendamento;
    }

    public static async getScheduleByUserId(usuarioId: string): Promise<SchedulingModel> {
        let agendamento = await knex("scheduling").select("*").where("usuarioId", usuarioId).first();

        return agendamento;
    }

    private static async isSchedulingUserConflict(usuarioId: string, data_hora: Date): Promise<boolean> {
        const existingScheduling = await knex('schedules')
          .where('usuarioId', usuarioId)
          .whereRaw('DATE(data_hora) = ?', [data_hora.toISOString().substring(0, 10)])
          .first();
      
        return !!existingScheduling;
    }

    private static async isSchedulingDayConflict(cras: Cras, data_hora: Date): Promise<boolean> {
        const numAgendamentos = await knex('schedules')
        .where('cras', cras)
        .whereRaw('DATE(data_hora) = ?', [data_hora.toISOString().substring(0, 10)]) // Filtrar pela data
        .whereRaw('HOUR(data_hora) = ?', [data_hora.getHours()]) // Filtrar pela hora
        .count('* as count')
        .first();

        if (numAgendamentos === undefined) {
            throw new Error('Erro ao contar agendamentos.');
        }

        const numAgendamentosCount = parseInt(String(numAgendamentos.count));
        const funcionarios: UserModel[] = await Usuario.getFuncionariosByCras(cras);
      
        return numAgendamentosCount >= funcionarios.length;
    }

    public static async createSchedule(agendamento: SchedulingModel): Promise<SchedulingModel> {
        if (!agendamento) throw new Error("Agendamento inválido!");
   
        try {

            let existeAgendamento = await this.isSchedulingUserConflict(agendamento.usuarioId, agendamento.data_hora)

            if(existeAgendamento) {
                throw new Error((HTTP_ERRORS.CONFLICT, "Você já possuí agendamento para este dia!"));
            }

            const temVaga = await this.isSchedulingDayConflict(agendamento.cras, agendamento.data_hora);

            if(temVaga) {
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

        try {

            let agendamentoBanco = await this.getScheduleById(agendamento.id);
            if (!agendamentoBanco) throw new Error("Esse agendamento não existe!");

            agendamentoBanco = { ...agendamentoBanco, ...agendamento };

            await knex("scheduling")
                .where("id", agendamentoBanco.id)
                .first()
                .update(agendamentoBanco);

            return agendamentoBanco;

        } catch (error) {
            throw error
        }
    }

    public static async deleteSchedule(id: string): Promise<boolean> {
        const agendamento = await this.getScheduleById(id);
        if(!agendamento) return false;
    
        const retorno = await knex("scheduling")
          .select("usuarios")
          .where("id", id)
          .first()
          .delete();
    
        return !!retorno;
      }


}