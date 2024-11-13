import { Scheduling } from './scheduling';
import { BloqueioAgendamentoModel, SchedulingModel, Cras, HTTP_ERRORS, Status, TipoUsuario } from './../models/model';
import { Usuario } from "./usuario";
import { validate as isUUID } from 'uuid';
import { parseISO, isEqual } from 'date-fns';
import DbInstance from '../connectionManager';


export class BloqueioAgendamento { 

    public static async getBloqueiosAgendamento(): Promise<BloqueioAgendamentoModel[]> {
        const knex = DbInstance.getInstance();

        let diasBloqueio: BloqueioAgendamentoModel[] = await knex("bloqueio_agendamento").select("*").orderBy("id");
        if(!diasBloqueio || diasBloqueio.length <= 0) throw new Error("Náo há nenhum dia com bloqueio de agendamento!");

        return diasBloqueio;
    }

    public static async getBloqueioAgendamentoById(id: string): Promise<BloqueioAgendamentoModel> {
        const knex = DbInstance.getInstance();

        let diaBloqueio: BloqueioAgendamentoModel = await knex("bloqueio_agendamento").select("*").where("id", id).first();
        if(!diaBloqueio) throw new Error("Náo há nenhum dia com bloqueio de agendamento!");

        return diaBloqueio;
    }

    public static async getBloqueioAgendamentoByCras(cras: number): Promise<BloqueioAgendamentoModel[]> {
        const knex = DbInstance.getInstance();

        let diaBloqueio: BloqueioAgendamentoModel[] = await knex("bloqueio_agendamento").select("*").where("cras", cras).orderBy("id");
        if(!diaBloqueio) throw new Error("Náo há nenhum dia com bloqueio de agendamento!");

        return diaBloqueio;
    }

    public static async createBloqueioAgendamento(bloqueios: BloqueioAgendamentoModel[]): Promise<string[]> {
        if (!bloqueios || bloqueios.length == 0) throw new Error("Bloqueio de data inválido!");
        
        const msg:string [] = [];
        const knex = DbInstance.getInstance();
        const trx = await knex.transaction();

        try {

            for (const bloqueio of bloqueios) {
                const user = await Usuario.getUserById(bloqueio.usuario_id);
                if (user.tipo_usuario !== TipoUsuario.superAdmin) {
                    throw new Error("Você não tem permissão para bloquear datas para agendamentos!");
                }
    
                await Scheduling.verificaAgendamentosDataBloqueio(bloqueio);
    
                // Insere o bloqueio na tabela dentro da transação
                await trx("bloqueio_agendamento").insert(bloqueio);
                msg.push(`Bloqueio do tipo ${bloqueio.tipo_bloqueio} para o cras ${Cras[bloqueio.cras]} na data ${bloqueio.data.toLocaleDateString('pt-BR')}`);
            }
    
            await trx.commit();
            return msg;
        } catch (error) {
            trx.rollback();
            throw error;
        }
    }

    public static async updateBloqueioAgendamento(diaBloqueio: BloqueioAgendamentoModel): Promise<boolean> {
        if (!diaBloqueio.id) throw new Error("Id de agendamento inválido!");

        const knex = DbInstance.getInstance();
        const trx = await knex.transaction();

        try {

            let diaBloqueioBanco = await this.getBloqueioAgendamentoById(diaBloqueio.id);

            if (!diaBloqueioBanco || !diaBloqueioBanco.ativo) {
                const msgErro = diaBloqueioBanco ? "Este bloqueio já foi cancelado!" : "Esse bloqueio foi excluído ou não existe!";
                throw new Error(msgErro);
            }

            await this.verificaDataHoraBloqueioAgendamento(diaBloqueio, diaBloqueioBanco);
            
            diaBloqueioBanco = { ...diaBloqueioBanco, ...diaBloqueio };
            
            if (!diaBloqueioBanco.cras) throw new Error("É obrigatório escolher o cras para o bloqueio!");

            await trx("bloqueio_agendamento")
                .where("id", diaBloqueioBanco.id)
                .first()
                .update(diaBloqueioBanco);

            trx.commit();
            
            return !!diaBloqueioBanco;

        } catch (error) {
            trx.rollback();
            throw error
        }
    }

    private static async verificaDataHoraBloqueioAgendamento(bloqueioUpdate: BloqueioAgendamentoModel, bloqueioBanco: BloqueioAgendamentoModel ): Promise<void>{
        const dataFormatadaUpdate = new Date(bloqueioUpdate.data);
        const dataFormatadaBanco = new Date(bloqueioBanco.data);

        if(!isEqual(dataFormatadaUpdate, dataFormatadaBanco) || bloqueioUpdate.tipo_bloqueio != bloqueioBanco.tipo_bloqueio){
                
            await Scheduling.verificaAgendamentosDataBloqueio(bloqueioUpdate);
        }
    }
}