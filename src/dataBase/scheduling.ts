import {
  UserModel,
  SchedulingModel,
  Cras,
  Status,
  TipoUsuario,
  BloqueioAgendamentoModel,
} from './../models/model';
import { Usuario } from './usuario';
import { validate as isUUID } from 'uuid';
import DbInstance from '../connectionManager';
import { Knex } from 'knex';

// NEW: We import these helpers from date-fns-tz
import { toZonedTime, format } from 'date-fns-tz';

export class Scheduling {
  // ---------------------------------------------------------------------------
  // Helper to get the server's "now" in São Paulo local time
  // Heroku dynos are on UTC, so "new Date()" is UTC -> we convert to America/Sao_Paulo
  // ---------------------------------------------------------------------------
  private static getServerNowSaoPaulo(): Date {
    const serverNowUtc = new Date(); // the actual server time in UTC
    return toZonedTime(serverNowUtc, 'America/Sao_Paulo');
  }

  public static async getSchedules(): Promise<SchedulingModel[]> {
    const knex = DbInstance.getInstance();
    const agendamentos: SchedulingModel[] = await knex('scheduling')
      .select('*')
      .orderBy('id');

    if (!agendamentos || agendamentos.length <= 0) {
      throw new Error('Náo há nenhum agendamento disponível!');
    }
    return agendamentos;
  }

  // ---------------------------------------------------------------------------
  // Check if the creation is allowed based on the SERVER’s local time (São Paulo).
  // ---------------------------------------------------------------------------
  private static verificaHorarioCriacao(): void {
    // Get the server's current local time
    const localDate = Scheduling.getServerNowSaoPaulo();

    if (isNaN(localDate.getTime())) {
      throw new Error('Erro ao calcular o horário local (server time)!');
    }

    const hourLocal = localDate.getHours(); // 0..23
    // Example: limit creation to [09:00, 23:59)
    if (hourLocal < 9 || hourLocal >= 24) {
      throw new Error(
        'Agendamentos só podem ser criados entre 09:00 e 23:59 (horário local)!'
      );
    }
  }

  public static async getSchedulesByCras(
    cras: number
  ): Promise<SchedulingModel[]> {
    const knex = DbInstance.getInstance();
    const agendamentos: SchedulingModel[] = await knex('scheduling')
      .select('*')
      .where('cras', cras)
      .orderBy('id');

    if (!agendamentos || agendamentos.length <= 0) {
      throw new Error(
        `Náo há nenhum agendamento para o Cras de ${Cras[cras]}!`
      );
    }
    return agendamentos;
  }

  public static async getScheduleById(
    id: string,
    trx?: Knex.Transaction
  ): Promise<SchedulingModel> {
    const query = trx
      ? trx('scheduling')
      : DbInstance.getInstance()('scheduling');
    const agendamento: SchedulingModel = await query
      .select('*')
      .where('id', id)
      .first();

    if (!agendamento) {
      throw new Error('Náo há nenhum agendamento disponível!');
    }
    return agendamento;
  }

  public static async getScheduleByUserId(
    usuario_id: string
  ): Promise<SchedulingModel[]> {
    if (!isUUID(usuario_id)) throw new Error('ID de usuário inválido!');
    const knex = DbInstance.getInstance();
    const agendamentos: SchedulingModel[] = await knex('scheduling')
      .select('*')
      .where('usuario_id', usuario_id)
      .orderBy('id');

    if (!agendamentos || agendamentos.length <= 0) {
      throw new Error('Náo há nenhum agendamento para este usuário!');
    }
    return agendamentos;
  }

  // ---------------------------------------------------------------------------
  // Check if the user already has a pending schedule on the same LOCAL day.
  // ---------------------------------------------------------------------------
  private static async isSchedulingUserConflict(
    usuario_id: any,
    dateUTC: Date,
    trx?: Knex.Transaction
  ): Promise<boolean> {
    const query = trx
      ? trx('scheduling')
      : DbInstance.getInstance()('scheduling');

    // Convert the requested date from UTC to São Paulo local
    const localDate = toZonedTime(dateUTC, 'America/Sao_Paulo');

    // Extract "yyyy-MM-dd" local
    const dataISO = localDate.toISOString().substring(0, 10);

    try {
      // Compare in Postgres by converting "data_hora" (UTC) to local via AT TIME ZONE
      const existingScheduling = await query
        .where('usuario_id', usuario_id)
        .whereRaw(`DATE(data_hora AT TIME ZONE 'America/Sao_Paulo') = ?`, [
          dataISO,
        ])
        .andWhere('status', Status.pendente)
        .first();

      return !!existingScheduling;
    } catch (error) {
      console.error('Erro ao executar a consulta:', error);
      throw new Error(
        'Erro ao executar a consulta no agendamento do usuário!.'
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Check if the slot (day/hour) is full, in local time (São Paulo).
  // ---------------------------------------------------------------------------
  private static async isSlotFull(
    cras: Cras,
    dateUTC: Date,
    trx?: Knex.Transaction
  ): Promise<boolean> {
    const knexOrTrx = trx || DbInstance.getInstance();
    const timeZone = 'America/Sao_Paulo';

    // 1) Convert UTC -> São Paulo
    const zonedDate = toZonedTime(dateUTC, timeZone);

    // 2) Extract local date "yyyy-MM-dd" and local time "HH:mm"
    const dataISO = format(zonedDate, 'yyyy-MM-dd', { timeZone });
    const horaMinuto = format(zonedDate, 'HH:mm', { timeZone });
    const hourLocal = Number(format(zonedDate, 'HH', { timeZone }));

    try {
      // 3) Count how many pending schedules on the same local day/hour
      const countRow = await knexOrTrx('scheduling')
        .where('cras', cras)
        .andWhere('status', Status.pendente)
        .whereRaw(`DATE(data_hora AT TIME ZONE 'America/Sao_Paulo') = ?`, [
          dataISO,
        ])
        .whereRaw(
          `to_char(data_hora AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI') = ?`,
          [horaMinuto]
        )
        .count({ total: '*' })
        .first();

      const totalAgendados = Number(countRow?.total ?? 0);

      // 4) Get all employees from that CRAS
      const todos: UserModel[] = await Usuario.getFuncionariosByCras(cras);
      const funcionariosTipo2 = todos.filter(
        user => user.tipo_usuario === TipoUsuario.admin
      );

      if (funcionariosTipo2.length <= 0) {
        throw new Error(
          'O CRAS informado é inválido ou não possuí funcionários cadastrados!'
        );
      }

      // 5) Calculate the capacity limit for that slot
      let limiteSlot;

      if (hourLocal < 12) {
        // Morning slot
        limiteSlot = 8 * funcionariosTipo2.length;
      } else {
        // Afternoon slot
        limiteSlot = 4 * funcionariosTipo2.length;
      }

      // Special rule: CRAS = 5, from 13..17 limit = 2 * funcionarios
      if (cras === 5 && hourLocal >= 13 && hourLocal < 17) {
        limiteSlot = 2 * funcionariosTipo2.length;
      }

      return totalAgendados >= limiteSlot;
    } catch (error) {
      console.error('Erro ao verificar slot:', error);
      throw new Error('Erro ao executar a consulta de slot!');
    }
  }

  // ---------------------------------------------------------------------------
  // Check if the local time (São Paulo) is between 08:00 and 16:00 only.
  // ---------------------------------------------------------------------------
  private static checaHorarioLocalPermitido(dateUTC: Date): void {
    // Convert the requested scheduling date from UTC -> local
    const localDate = toZonedTime(dateUTC, 'America/Sao_Paulo');
    if (isNaN(localDate.getTime())) {
      throw new Error('Falha ao converter data para fuso horário local!');
    }

    const hourLocal = localDate.getHours(); // 0..23
    if (hourLocal < 8 || hourLocal >= 17) {
      throw new Error(
        'Agendamentos somente entre 08:00 e 16:00 (horário local)!'
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Limit scheduling from TODAY up to next Friday, block Wed(3), Sat(6), Sun(0).
  // Everything based on SERVER's local time for "today", and the param's local time for chosen date.
  // ---------------------------------------------------------------------------
  private static verificaLimiteAteProximaSexta(dateUTC: Date): void {
    // 1) Convert the chosen date from UTC -> local
    const dataEscolhida = toZonedTime(dateUTC, 'America/Sao_Paulo');

    // 2) "hoje" local from the server
    const hoje = Scheduling.getServerNowSaoPaulo();

    // If dataEscolhida < hoje => can't schedule in the past
    if (dataEscolhida < hoje) {
      throw new Error('Não é possível agendar no passado!');
    }

    // Block Wed(3), Sat(6), Sun(0)
    const diaAg = dataEscolhida.getDay();
    if (diaAg === 0 || diaAg === 3 || diaAg === 6) {
      throw new Error('Não é possível agendar para este dia da semana');
    }

    // Calculate next Friday (local)
    const dayNow = hoje.getDay(); // 0..6
    let offset = 12 - dayNow; // if dayNow=3 => offset=9 => +9 days
    if (offset < 0) {
      offset += 7;
    }
    const ultimaSexta = new Date(hoje);
    ultimaSexta.setDate(hoje.getDate() + offset);

    if (dataEscolhida > ultimaSexta) {
      throw new Error(
        'Você só pode agendar até a sexta-feira da próxima semana!'
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Force local time to either 11:00 or 16:00, then convert back to UTC in the end.
  // (You can tweak the hour logic as needed.)
  // ---------------------------------------------------------------------------
  private static forcarSlotManhaOuTarde(dateUTC: Date): Date {
    // 1) Convert from UTC to local
    const localDate = toZonedTime(dateUTC, 'America/Sao_Paulo');
    if (isNaN(localDate.getTime())) {
      throw new Error('Data/hora inválida!');
    }

    // If hour < 12 => force 11:00, else => force 16:00
    const hour = localDate.getHours();
    if (hour < 12) {
      localDate.setHours(11, 0, 0, 0);
    } else {
      localDate.setHours(16, 0, 0, 0);
    }

    // 2) Convert back to UTC (just call new Date(localDate.getTime()))
    return new Date(localDate.getTime());
  }

  // ---------------------------------------------------------------------------
  // Create a schedule (save in DB in UTC).
  // "Now" checks are always from the server time, but the date the user selected
  // is passed in UTC, then we convert to local to validate.
  // ---------------------------------------------------------------------------
  public static async createSchedule(
    agendamento: SchedulingModel
  ): Promise<SchedulingModel> {
    if (!agendamento) {
      throw new Error('Agendamento inválido!');
    }

    // Verifica se o horário de criação (no servidor) está dentro do intervalo
    this.verificaHorarioCriacao();

    const knex = DbInstance.getInstance();
    const trx = await knex.transaction();

    try {
      // 1) Obter quem será o beneficiário do agendamento (tipo 1?)
      const usuarioBeneficiario = await Usuario.getUserById(
        agendamento.usuario_id,
        trx
      );
      if (!usuarioBeneficiario) {
        throw new Error('Usuário (beneficiário) não encontrado!');
      }

      // 2) Obter quem está criando o agendamento (criador_id, que vem do front)
      const usuarioCriador = await Usuario.getUserById(
        agendamento.criador_id,
        trx
      );
      if (!usuarioCriador) {
        throw new Error('Criador do agendamento não encontrado!');
      }

      // ---------------------------------------------------------------------
      // [A] Verificar se o criador (quem está logado) só pode criar na sexta (tipo 1)
      // ou pode criar em qualquer dia (tipo 2 ou 3).
      // ---------------------------------------------------------------------

      // const agoraLocal = Scheduling.getServerNowSaoPaulo(); // dia/hora local do servidor
      // if (usuarioCriador.tipo_usuario === TipoUsuario.comum) {
      //   // Tipo 1 (comum) pode CRIAR agendamentos apenas na sexta
      //   if (agoraLocal.getDay() !== 5) {
      //     throw new Error(
      //       'Agendamentos só podem serem criados nas sextas-feiras entre 9:00 e 23:59!'
      //     );
      //   }
      // }

      // Caso seja tipo 2 ou 3, pode criar em qualquer dia, sem restrição.

      // ---------------------------------------------------------------------
      // [B] Independente de quem criou, verificar as regras de quem RECEBE (beneficiário).
      // Somente se o beneficiário for tipo 1, aplicamos regras de:
      //  - "só até próxima sexta"
      //  - "1 pendente por dia"
      //  - "slot cheio" etc.
      // ---------------------------------------------------------------------
      // Sempre checar se a data/hora para o agendamento está no horário permitido
      this.checaHorarioLocalPermitido(agendamento.data_hora);

      // Se o usuário for tipo 1, aplicamos restrições específicas:
      if (usuarioBeneficiario.tipo_usuario === TipoUsuario.comum) {
        this.verificaLimiteAteProximaSexta(agendamento.data_hora);

        const dataCorrigida = this.forcarSlotManhaOuTarde(
          agendamento.data_hora
        );

        const conflito = await this.isSchedulingUserConflict(
          usuarioBeneficiario.id,
          dataCorrigida,
          trx
        );
        if (conflito) {
          throw new Error(
            'Este usuário já possui agendamento pendente para este dia!'
          );
        }

        const slotCheio = await this.isSlotFull(
          agendamento.cras,
          dataCorrigida,
          trx
        );
        if (slotCheio) {
          throw new Error(
            'Este slot está indisponível, limite de vagas atingido!'
          );
        }

        agendamento.data_hora = dataCorrigida;
      } else {
        // Se por algum motivo um funcionário (tipo 2) fosse receber agendamento,
        // ou um admin (tipo 3) — normalmente não acontece na sua regra,
        // mas se acontecer, aqui você define se aplica alguma regra ou não.
        // Por enquanto, "forçamos" apenas para ter um horário fixo (manhã/tarde).
        const dataCorrigida = this.forcarSlotManhaOuTarde(
          agendamento.data_hora
        );
        agendamento.data_hora = dataCorrigida;
      }

      // ---------------------------------------------------------------------
      // Por fim, inserir no DB (agendamento.data_hora em UTC)
      // ---------------------------------------------------------------------
      await trx('scheduling').insert(agendamento);
      await trx.commit();
      return agendamento;
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Update a schedule
  // ---------------------------------------------------------------------------
  public static async updateSchedule(
    agendamento: SchedulingModel
  ): Promise<SchedulingModel> {
    if (!agendamento.id) throw new Error('Id de agendamento inválido!');

    const knex = DbInstance.getInstance();
    const trx = await knex.transaction();

    try {
      let agendamentoBanco = await this.getScheduleById(
        String(agendamento.id),
        trx
      );
      if (!agendamentoBanco) {
        throw new Error('Esse agendamento não existe!');
      }

      if (
        agendamentoBanco.status === Status.realizado ||
        agendamentoBanco.status === Status.ausente
      ) {
        throw new Error('Não é possível alterar um agendamento já concluído!');
      }

      // Compare old vs new date/hora
      const oldDataISO = new Date(agendamentoBanco.data_hora).toISOString();
      const newDataISO = new Date(agendamento.data_hora).toISOString();
      const mudouDataHora = oldDataISO !== newDataISO;

      // Check the user
      const usuario = await Usuario.getUserById(agendamento.usuario_id, trx);
      if (!usuario) {
        throw new Error('Usuário não encontrado!');
      }

      if (usuario.tipo_usuario === TipoUsuario.comum) {
        if (mudouDataHora) {
          this.verificaLimiteAteProximaSexta(agendamento.data_hora);

          const dataCorrigida = this.forcarSlotManhaOuTarde(
            agendamento.data_hora
          );

          const conflitoUsuario = await this.isSchedulingUserConflict(
            usuario.id,
            dataCorrigida,
            trx
          );
          if (conflitoUsuario) {
            throw new Error(
              'Você já possuí agendamento pendente para este dia!'
            );
          }

          const slotCheio = await this.isSlotFull(
            agendamento.cras,
            dataCorrigida,
            trx
          );
          if (slotCheio) {
            throw new Error(
              'Este slot está indisponível, limite de vagas atingido!'
            );
          }

          agendamentoBanco = {
            ...agendamentoBanco,
            ...agendamento,
            data_hora: dataCorrigida,
          };
        } else {
          // If the time didn't change, just merge data
          agendamentoBanco = { ...agendamentoBanco, ...agendamento };
        }
      } else {
        // Tipo 2/3 => no date restriction, but still force slot
        if (mudouDataHora) {
          const dataCorrigida = this.forcarSlotManhaOuTarde(
            agendamento.data_hora
          );
          agendamentoBanco = {
            ...agendamentoBanco,
            ...agendamento,
            data_hora: dataCorrigida,
          };
        } else {
          agendamentoBanco = { ...agendamentoBanco, ...agendamento };
        }
      }

      if (!agendamentoBanco.cras) {
        throw new Error('É obrigatório escolher o CRAS do agendamento!');
      }

      await trx('scheduling')
        .where('id', agendamentoBanco.id)
        .update(agendamentoBanco);

      await trx.commit();
      return agendamentoBanco;
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  public static async cancelaUserSchedules(
    usuario_id: string
  ): Promise<boolean> {
    const knex = DbInstance.getInstance();
    const trx = await knex.transaction();

    try {
      const retorno = await trx('scheduling')
        .where('usuario_id', usuario_id)
        .andWhere('status', Status.pendente)
        .update({ status: Status.cancelado });

      await trx.commit();
      return !!retorno;
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Check if there's a scheduling block for that local date/time
  // ---------------------------------------------------------------------------
  public static async verificaBloqueioAgendamento(
    agendamento: SchedulingModel,
    trx?: Knex.Transaction
  ): Promise<boolean> {
    const query = trx
      ? trx('bloqueio_agendamento')
      : DbInstance.getInstance()('bloqueio_agendamento');

    // Convert param UTC -> local
    const localDate = toZonedTime(agendamento.data_hora, 'America/Sao_Paulo');

    // Local "yyyy-MM-dd"
    const dataString = localDate.toISOString().substring(0, 10);

    // local hour start/end
    const horaInicio = localDate.getHours();
    const duracao = agendamento.duracao_atendimento || 60;
    const horaFim = horaInicio + Math.floor(duracao / 60);

    // Find all blocks for this CRAS that day
    const bloqueios: BloqueioAgendamentoModel[] = await query
      .where('cras', agendamento.cras)
      .andWhereRaw(`DATE("data" AT TIME ZONE 'America/Sao_Paulo') = ?`, [
        dataString,
      ])
      .andWhere('ativo', true);

    for (const bloqueio of bloqueios) {
      let horaBloqueioInicio: number;
      let horaBloqueioFim: number;

      switch (bloqueio.tipo_bloqueio) {
        case 'matutino':
          horaBloqueioInicio = 8;
          horaBloqueioFim = 12;
          break;
        case 'vespertino':
          horaBloqueioInicio = 13;
          horaBloqueioFim = 17;
          break;
        case 'diario':
          horaBloqueioInicio = 8;
          horaBloqueioFim = 17;
          break;
        default:
          throw new Error('Tipo de bloqueio inválido');
      }

      // If the schedule intersects the block window => blocked
      if (
        (horaInicio >= horaBloqueioInicio && horaInicio < horaBloqueioFim) ||
        (horaFim > horaBloqueioInicio && horaFim <= horaBloqueioFim) ||
        (horaInicio <= horaBloqueioInicio && horaFim >= horaBloqueioFim)
      ) {
        return true; // blocked
      }
    }
    return false;
  }

  // ---------------------------------------------------------------------------
  // If there's a block on a certain day, we cancel all pending schedules
  // in that day/time range for that CRAS.
  // ---------------------------------------------------------------------------
  public static async verificaAgendamentosDataBloqueio(
    diaBloqueio: BloqueioAgendamentoModel,
    trx?: Knex.Transaction
  ): Promise<void> {
    // 'diaBloqueio.data' is presumably UTC
    const newDataHora = new Date(diaBloqueio.data);
    // Convert to local
    const localDate = toZonedTime(newDataHora, 'America/Sao_Paulo');

    // Local "yyyy-mm-dd"
    const dataString = localDate.toISOString().substring(0, 10);

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

    const query = trx
      ? trx('scheduling')
      : DbInstance.getInstance()('scheduling');

    try {
      // Compare data_hora in local to dataString + hour range
      const agendamentos: SchedulingModel[] = await query
        .select('*')
        .whereRaw(`DATE(data_hora AT TIME ZONE 'America/Sao_Paulo') = ?`, [
          dataString,
        ])
        .andWhere('cras', diaBloqueio.cras)
        .andWhere('status', Status.pendente)
        .andWhere(builder => {
          builder
            .whereRaw(
              `EXTRACT(HOUR FROM data_hora AT TIME ZONE 'America/Sao_Paulo') >= ?`,
              [horaInicio]
            )
            .andWhereRaw(
              `EXTRACT(HOUR FROM data_hora AT TIME ZONE 'America/Sao_Paulo') <= ?`,
              [horaFim]
            );
        });

      if (agendamentos.length > 0) {
        const agendamentosId: string[] = agendamentos.map(a => String(a.id));
        if (agendamentosId.length > 0) {
          // Cancel all those
          await query.whereIn('id', agendamentosId).update({
            status: Status.cancelado,
            description:
              'Agendamento cancelado devido a bloqueio da administração do CRAS.',
          });
        }
      }
    } catch (error) {
      throw new Error('Ocorreu um erro interno ao verificar os agendamentos!');
    }
  }

  // ---------------------------------------------------------------------------
  // Physical deletion (superadmin only).
  // ---------------------------------------------------------------------------
  public static async deleteSchedule(id: string): Promise<boolean> {
    const agendamento = await this.getScheduleById(id);
    if (!agendamento) return false;

    const knex = DbInstance.getInstance();
    const trx = await knex.transaction();

    try {
      const retorno = await trx('scheduling').where('id', id).delete();
      await trx.commit();
      return !!retorno;
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Delete all schedules of a user (physical removal).
  // ---------------------------------------------------------------------------
  public static async deleteUserSchedules(
    usuario_id: string
  ): Promise<boolean> {
    const knex = DbInstance.getInstance();
    const trx = await knex.transaction();

    try {
      const retorno = await trx('scheduling')
        .where('usuario_id', usuario_id)
        .delete();

      await trx.commit();
      return !!retorno;
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }
}
