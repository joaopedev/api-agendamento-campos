import { UserModel, SchedulingModel, Cras, HTTP_ERRORS, Status, TipoUsuario, BloqueioAgendamentoModel } from './../models/model';
import { Usuario } from "./usuario";
import { validate as isUUID } from 'uuid';
import { parseISO, isEqual } from 'date-fns';
import DbInstance from '../connectionManager';
import { Knex } from 'knex';

export class Scheduling {

    public static async getSchedules(): Promise<SchedulingModel[]> {
        const knex = DbInstance.getInstance();

        let agendamentos: SchedulingModel[] = await knex("scheduling").select("*").orderBy("id");
        if(!agendamentos || agendamentos.length <= 0) throw new Error("Náo há nenhum agendamento disponível!");

        return agendamentos;
    }

    public static async getSchedulesByCras(cras: number): Promise<SchedulingModel[]> {
        const knex = DbInstance.getInstance();

        let agendamentos: SchedulingModel[] = await knex("scheduling").select("*").where("cras", cras).orderBy("id");
        if(!agendamentos || agendamentos.length <= 0) throw new Error(`Náo há nenhum agendamento para o Cras de ${Cras[cras]}!`);

        return agendamentos;
    }

    public static async getScheduleById(id: string, trx?: Knex.Transaction): Promise<SchedulingModel> {
        const query = trx ? trx('scheduling') : DbInstance.getInstance()('scheduling');

        let agendamento: SchedulingModel = await query.select("*").where("id", id).first();
        if(!agendamento) throw new Error("Náo há nenhum agendamento disponível!");

        return agendamento;
    }

    public static async getScheduleByUserId(usuario_id: string): Promise<SchedulingModel[]> {
        if(!isUUID(usuario_id)) throw new Error('ID de usuário inválido!');
        const knex = DbInstance.getInstance();

        let agendamentos: SchedulingModel[] = await knex("scheduling").select("*").where("usuario_id", usuario_id).orderBy("id");
        if(!agendamentos || agendamentos.length <= 0) throw new Error("Náo há nenhum agendamento para este usuário!");

        return agendamentos;
    }

    private static async isSchedulingUserConflict(usuario_id: string, data_hora: Date, trx?: Knex.Transaction): Promise<boolean> {
        // Converter a data para o formato YYYY-MM-DD
        const newDataHora = new Date(data_hora);
        const data_hora_iso = newDataHora.toISOString().substring(0, 10);
        
        const query = trx ? trx('scheduling') : DbInstance.getInstance()('scheduling');

        try {
            
            const existingScheduling = await query
              .where('usuario_id', usuario_id)
              .whereRaw('DATE(data_hora) = ?', [data_hora_iso])
              .andWhere('status', Status.pendente)
              .first();
          
            return !!existingScheduling;
        } catch (error) {
            console.error('Erro ao executar a consulta:', error);
            throw new Error('Erro ao executar a consulta no agendamento do usuário!.');
        }
    }

    private static async isSchedulingDayConflict(cras: Cras, data_hora: Date, trx?: Knex.Transaction): Promise<boolean> {
        // Converter a data para o formato YYYY-MM-DD
        const newDataHora = new Date(data_hora);
        const data_hora_iso = newDataHora.toISOString().substring(0, 10);
         // Obtendo a hora da data
        const hora = newDataHora.getHours();

        const query = trx ? trx('scheduling') : DbInstance.getInstance()('scheduling');

        try {
            
            const numAgendamentos = await query
            .where('cras', cras)
            .whereRaw('DATE(data_hora) = ?', [data_hora_iso]) // Filtra pela data
            .whereRaw('EXTRACT(HOUR FROM data_hora) = ?', [hora]) // Filtra pela hora
            .andWhere('status', Status.pendente)
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
        
        const knex = DbInstance.getInstance();
        const trx = await knex.transaction();

        try {

            await this.verificaDataHoraAgendamento(agendamento, false, trx); 

            await trx("scheduling").insert(agendamento);
            trx.commit();

            return agendamento;
          
        } catch (error) {
            trx.rollback();
            throw error;
        }
    }

    public static async updateSchedule(agendamento: SchedulingModel): Promise<SchedulingModel> {
        if (!agendamento.id) throw new Error("Id de agendamento inválido!");

        const knex = DbInstance.getInstance();
        const trx = await knex.transaction();

        try {

            let agendamentoBanco = await this.getScheduleById(agendamento.id, trx);

            if (!agendamentoBanco) throw new Error("Esse agendamento não existe!");

            if (agendamentoBanco.status == Status.realizado || agendamentoBanco.status == Status.ausente) {
                const erro = agendamento.status == Status.realizado ? "Ausente" : "Realizado";             
                throw new Error(`O serviço para esse agendamento já foi concluído devido ao seu status ${erro}!`);
            } 

            const dataFormatadaFront = new Date(agendamento.data_hora);
            const dataFormatadaBanco = new Date(agendamentoBanco.data_hora);

            if(!isEqual(dataFormatadaFront, dataFormatadaBanco)) await this.verificaDataHoraAgendamento(agendamento, true, trx);
            
            agendamentoBanco = { ...agendamentoBanco, ...agendamento };
            
            if (!agendamentoBanco.cras) throw new Error("É obrigatório escolher o cras do agendamento!");

            await trx("scheduling")
                .where("id", agendamentoBanco.id)
                .first()
                .update(agendamentoBanco);

            trx.commit();
            
            return agendamentoBanco;

        } catch (error) {
            trx.rollback();
            throw error
        }
    }

    public static async cancelaUserSchedules(usuario_id: string): Promise<boolean> {
        
        const knex = DbInstance.getInstance();
        const trx = await knex.transaction();

        try {

            const retorno = await trx("scheduling")
              .select("*")
              .where("usuario_id", usuario_id)
              .andWhere("status", Status.pendente)
              .update({ status: Status.cancelado });
        
            trx.commit();

            return !!retorno;
            
        } catch (error) {
            trx.rollback();
            throw error;
        }
    }

    private static async verificaDataHoraAgendamento(agendamento: SchedulingModel, ehUpdate: boolean, trx?: Knex.Transaction): Promise<void> {

        if(!ehUpdate) {

            let existeAgendamento = await this.isSchedulingUserConflict(agendamento.usuario_id, agendamento.data_hora, trx)
    
            if(existeAgendamento) {
                throw new Error((HTTP_ERRORS.CONFLICT, "Você já possuí agendamento para este dia!"));
            }
        }

        const NaotemVaga = await this.isSchedulingDayConflict(agendamento.cras, agendamento.data_hora, trx);

        if(NaotemVaga) {
            throw new Error("Este horário escolhido não está disponível, por favor escolha outro horário!");
        }

    }

    public static async verificaAgendamentosDataBloqueio(diaBloqueio: BloqueioAgendamentoModel, trx?: Knex.Transaction): Promise<void> {

        const newDataHora = new Date(diaBloqueio.data);
        const dataString = newDataHora.toISOString().substring(0, 10);

        // Define os intervalos de tempo com base no tipo de bloqueio
        let horaInicio: string;
        let horaFim: string;

        switch (diaBloqueio.tipo_bloqueio) {
            case 'matutino':
                horaInicio = '08';
                horaFim = '12';
                break;
            case 'vespertino':
                horaInicio = '13';
                horaFim = '17';
                break;
            case 'diario':
                horaInicio = '08';
                horaFim = '17';
                break;
            default:
                throw new Error('Tipo de bloqueio inválido');
        }

        const query = trx ? trx("scheduling") : DbInstance.getInstance()("scheduling");

        try {

            //consulta para verificar os agendamentos que se encontram conflitantes com a data de bloqueio através da horaInicio e horaFim
            const agendamentos: SchedulingModel[] = await query
              .select("*")
              .whereRaw('DATE(data_hora) = ?', [dataString])
              .andWhere('cras', diaBloqueio.cras)
              .andWhere('status', Status.pendente)
              .andWhere(builder => {
                builder
                    .whereRaw('EXTRACT(HOUR FROM data_hora) >= ?', [horaInicio])
                    .andWhereRaw('EXTRACT(HOUR FROM data_hora) <= ?', [horaFim]);
            });

            if(agendamentos.length > 0) {
                const agendamentosId: string[] = agendamentos.map((a: any) => a.id);

                if (agendamentosId.length > 0){

                    //atualiza todos os agendamentos que eram conflitantes para o status cancelado devido ao bloqueio da data
                    await query
                        .whereIn('id', agendamentosId)
                        .update({ status: Status.cancelado, description: 'Agendamento cancelado devido a bloqueio da admnistração do CRAS.' });                                           
                }

            }
                    
        } catch (error) {            
            throw new Error("Ocorreu um erro interno ao verificar os agendamentos!");
        }
    }

    //ESTÁ IMPLEMENTADO APENAS PARA SUPERADMIN, ADMINS DEVEM FAZER SOMENTE EXCLUSÃO LÓGICA COM STATUS 0 'CANCELADO'
    public static async deleteSchedule(id: string): Promise<boolean> {

        const agendamento = await this.getScheduleById(id);
        
        if(!agendamento) return false;

        const knex = DbInstance.getInstance();
        const trx = await knex.transaction();

        try {
            
            const retorno = await trx("scheduling")
              .select("scheduling")
              .where("id", id)
              .first()
              .delete();
            
            trx.commit();

            return !!retorno;
        } catch (error) {
            trx.rollback();
            throw error;
        }
    
    }

    public static async deleteUserSchedules(usuario_id: string): Promise<boolean> {

        const knex = DbInstance.getInstance();
        const trx = await knex.transaction();

        try {
            
            const retorno = await trx("scheduling")
              .select("scheduling")
              .where("usuario_id", usuario_id)
              .delete();
        
            trx.commit();

            return !!retorno;
        } catch (error) {
            trx.rollback();
            throw error;
        }
    
    }


}