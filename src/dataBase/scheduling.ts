import {
  UserModel,
  SchedulingModel,
  Cras,
  HTTP_ERRORS,
  Status,
  TipoUsuario,
  BloqueioAgendamentoModel,
} from './../models/model';
import { Usuario } from './usuario';
import { validate as isUUID } from 'uuid';
import DbInstance from '../connectionManager';
import { Knex } from 'knex';
import { toZonedTime, format } from 'date-fns-tz';

export class Scheduling {
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

  private static verificaHorarioCriacao(): void {
    const localString = new Date().toLocaleString('en-US', {
      timeZone: 'America/Sao_Paulo',
    });
    const localDate = new Date(localString);

    if (isNaN(localDate.getTime())) {
      throw new Error('Erro ao calcular o horário local!');
    }

    const hourLocal = localDate.getHours(); // Horário local em 0..23
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
  // Verifica se o usuário já tem agendamento pendente no mesmo DIA local.
  // ---------------------------------------------------------------------------
  private static async isSchedulingUserConflict(
    usuario_id: any,
    dateUTC: Date,
    trx?: Knex.Transaction
  ): Promise<boolean> {
    const query = trx
      ? trx('scheduling')
      : DbInstance.getInstance()('scheduling');

    // Converte a data UTC para Data local (Brasília)
    const localString = dateUTC.toLocaleString('en-US', {
      timeZone: 'America/Sao_Paulo',
    });
    const localDate = new Date(localString);

    // Extraímos apenas a parte "yyyy-MM-dd" em local
    const dataISO = localDate.toISOString().substring(0, 10);

    try {
      // Para comparar no Postgres, convertemos data_hora (que está em UTC)
      // para o horário de Brasília na cláusula "AT TIME ZONE 'America/Sao_Paulo'"
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
  // Verifica se o slot (dia/hora) atingiu (6 * nºFuncionários), em horário local.
  // ---------------------------------------------------------------------------
  private static async isSlotFull(
    cras: Cras,
    dateUTC: Date,
    trx?: Knex.Transaction
  ): Promise<boolean> {
    const knexOrTrx = trx || DbInstance.getInstance();
    const timeZone = 'America/Sao_Paulo';

    // 1) Converte data UTC para horário de São Paulo
    const zonedDate = toZonedTime(dateUTC, timeZone);

    // 2) Formata a data e a hora local
    const dataISO = format(zonedDate, 'yyyy-MM-dd', { timeZone });
    const horaMinuto = format(zonedDate, 'HH:mm', { timeZone });
    const hourLocal = Number(format(zonedDate, 'HH', { timeZone }));

    try {
      // 3) Consulta no banco para contar agendamentos pendentes no mesmo dia e hora
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

      // 4) Pega todos os funcionários do CRAS
      const todos: UserModel[] = await Usuario.getFuncionariosByCras(cras);
      const funcionariosTipo2 = todos.filter(
        user => user.tipo_usuario === TipoUsuario.admin
      );

      if (funcionariosTipo2.length <= 0) {
        throw new Error(
          'O CRAS informado é inválido ou não possuí funcionários cadastrados!'
        );
      }

      // 5) Calcula o limite com base no horário e no CRAS
      let limiteSlot = 6 * funcionariosTipo2.length; // Limite padrão

      // Reduz o limite para 2 por funcionário no período da tarde (apenas para CRAS 5 e 6)
      if (cras === 5 && hourLocal >= 13 && hourLocal < 17) {
        limiteSlot = 2 * funcionariosTipo2.length;
      }

      const isFull = totalAgendados >= limiteSlot;
      return isFull;
    } catch (error) {
      console.error('Erro ao verificar slot:', error);
      throw new Error('Erro ao executar a consulta de slot!');
    }
  }

  // ---------------------------------------------------------------------------
  // Checa se o horário local de Brasília está entre 09:00 e 23:59.
  // ---------------------------------------------------------------------------
  private static checaHorarioLocalPermitido(dateUTC: Date): void {
    const localString = dateUTC.toLocaleString('en-US', {
      timeZone: 'America/Sao_Paulo',
    });
    const localDate = new Date(localString);
    if (isNaN(localDate.getTime())) {
      throw new Error('Falha ao converter data para fuso horário local!');
    }

    const hourLocal = localDate.getHours(); // 0..23
    if (hourLocal < 8 || hourLocal >= 16) {
      throw new Error(
        'Agendamentos somente entre 08:00 e 16:00 (horário local)!'
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Limita o agendamento para HOJE até a sexta da PRÓXIMA semana,
  // e bloqueia quartas(3), sábados(6) e domingos(0), tudo com base no horário local.
  // ---------------------------------------------------------------------------
  private static verificaLimiteAteProximaSexta(dateUTC: Date): void {
    // 1) Converte param para local
    const localString = dateUTC.toLocaleString('en-US', {
      timeZone: 'America/Sao_Paulo',
    });
    const dataEscolhida = new Date(localString);

    // 2) Pegamos "hoje" local
    const hojeString = new Date().toLocaleString('en-US', {
      timeZone: 'America/Sao_Paulo',
    });
    const hoje = new Date(hojeString);

    // Se dataEscolhida < hoje => erro
    if (dataEscolhida < hoje) {
      throw new Error('Não é possível agendar no passado!');
    }

    // Bloqueia quartas(3), sábados(6), domingos(0)
    const diaAg = dataEscolhida.getDay();
    if (diaAg === 0 || diaAg === 3 || diaAg === 6) {
      throw new Error('Não é possível agendar para este dia da semana');
    }

    // Calcula a sexta da PRÓXIMA semana em local time
    const dayNow = hoje.getDay(); // 0..6
    let offset = 12 - dayNow; // se dayNow=3 => offset=9 => +9 dias

    if (offset < 0) {
      // se estiver no fim de semana, ajusta
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
  // Força o horário local para 09h ou 13h, então converte de volta para UTC.
  // ---------------------------------------------------------------------------
  private static forcarSlotManhaOuTarde(dateUTC: Date): Date {
    // 1) Converte a data UTC para local
    const localString = dateUTC.toLocaleString('en-US', {
      timeZone: 'America/Sao_Paulo',
    });
    const localDate = new Date(localString);

    if (isNaN(localDate.getTime())) {
      throw new Error('Data/hora inválida!');
    }

    // Se hora < 12 => força 08:00; senão => força 13:00
    const hour = localDate.getHours();
    if (hour < 12) {
      localDate.setHours(8, 0, 0, 0);
    } else {
      localDate.setHours(13, 0, 0, 0);
    }

    // 2) Converte novamente para UTC
    return new Date(localDate.getTime());
  }

  // ---------------------------------------------------------------------------
  // Cria um agendamento (salva no DB em UTC).
  // ---------------------------------------------------------------------------
  public static async createSchedule(
    agendamento: SchedulingModel
  ): Promise<SchedulingModel> {
    if (!agendamento) {
      throw new Error('Agendamento inválido!');
    }

    // Verifica se a criação do agendamento está dentro do horário permitido
    this.verificaHorarioCriacao();

    const knex = DbInstance.getInstance();
    const trx = await knex.transaction();

    try {
      const usuario = await Usuario.getUserById(agendamento.usuario_id, trx);
      if (!usuario) {
        throw new Error('Usuário não encontrado!');
      }

      // 1) Sempre checa se o horário local do agendamento é válido
      this.checaHorarioLocalPermitido(agendamento.data_hora);

      if (usuario.tipo_usuario === TipoUsuario.comum) {
        // Regras específicas para usuários comuns
        this.verificaLimiteAteProximaSexta(agendamento.data_hora);

        const dataCorrigida = this.forcarSlotManhaOuTarde(
          agendamento.data_hora
        );

        const conflito = await this.isSchedulingUserConflict(
          usuario.id,
          dataCorrigida,
          trx
        );
        if (conflito) {
          throw new Error('Você já possuí agendamento pendente para este dia!');
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
        // Tipo 2/3: Sem restrição de datas, mas força slot local
        const dataCorrigida = this.forcarSlotManhaOuTarde(
          agendamento.data_hora
        );
        agendamento.data_hora = dataCorrigida;
      }

      await trx('scheduling').insert(agendamento);
      await trx.commit();
      return agendamento;
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Atualiza um agendamento
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

      // Ver se data/hora mudou
      const oldDataISO = new Date(agendamentoBanco.data_hora).toISOString();
      const newDataISO = new Date(agendamento.data_hora).toISOString();
      const mudouDataHora = oldDataISO !== newDataISO;

      // Checa se o dono do agendamento é tipo 1
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
          agendamentoBanco = { ...agendamentoBanco, ...agendamento };
        }
      } else {
        // Tipo 2/3 => sem restrição de datas, mas forçamos 09h/13h
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
  // Verifica se existe bloqueio de agendamento para data/hora local
  // ---------------------------------------------------------------------------
  public static async verificaBloqueioAgendamento(
    agendamento: SchedulingModel,
    trx?: Knex.Transaction
  ): Promise<boolean> {
    const query = trx
      ? trx('bloqueio_agendamento')
      : DbInstance.getInstance()('bloqueio_agendamento');

    // 1) Converte a data UTC para local
    const localString = agendamento.data_hora.toLocaleString('en-US', {
      timeZone: 'America/Sao_Paulo',
    });
    const localDate = new Date(localString);

    // Dia "yyyy-mm-dd" local
    const dataString = localDate.toISOString().substring(0, 10);

    // Hora e duração (em local time)
    const horaInicio = localDate.getHours();
    const duracao = agendamento.duracao_atendimento || 60;
    const horaFim = horaInicio + Math.floor(duracao / 60);

    // 2) No DB, se o campo "data" de bloqueio também for UTC, convertemos:
    //    'DATE("data" AT TIME ZONE 'America/Sao_Paulo') = ?'
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

      // Verifica se o horário local do agendamento conflita com o bloqueio
      if (
        (horaInicio >= horaBloqueioInicio && horaInicio < horaBloqueioFim) ||
        (horaFim > horaBloqueioInicio && horaFim <= horaBloqueioFim) ||
        (horaInicio <= horaBloqueioInicio && horaFim >= horaBloqueioFim)
      ) {
        return true; // Bloqueado
      }
    }
    return false;
  }

  // ---------------------------------------------------------------------------
  // Se houver bloqueio, cancela agendamentos pendentes no período/local.
  // ---------------------------------------------------------------------------
  public static async verificaAgendamentosDataBloqueio(
    diaBloqueio: BloqueioAgendamentoModel,
    trx?: Knex.Transaction
  ): Promise<void> {
    // newDataHora: assumindo que 'diaBloqueio.data' está em UTC
    const newDataHora = new Date(diaBloqueio.data);
    const localString = newDataHora.toLocaleString('en-US', {
      timeZone: 'America/Sao_Paulo',
    });
    const localDate = new Date(localString);

    // Data local "yyyy-mm-dd"
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
      // Precisamos comparar data_hora em UTC com local = dataString
      // e também ver se a hora local está entre [horaInicio, horaFim].
      const agendamentos: SchedulingModel[] = await query
        .select('*')
        .whereRaw(`DATE(data_hora AT TIME ZONE 'America/Sao_Paulo') = ?`, [
          dataString,
        ])
        .andWhere('cras', diaBloqueio.cras)
        .andWhere('status', Status.pendente)
        .andWhere(builder => {
          // Aqui usamos EXTRACT com AT TIME ZONE
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
          // atualiza todos para cancelado
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
  // Exclusão física do agendamento (apenas para superadmin).
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
  // Deleta todos os agendamentos de um usuário (exclusão física).
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
