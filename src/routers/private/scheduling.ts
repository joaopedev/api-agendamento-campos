import { Application, NextFunction, Request, Response } from 'express';
import {
  HTTP_ERRORS,
  SchedulingModel,
  TipoUsuario,
  UserModel,
} from '../../models/model';
import { Usuario } from '../../dataBase/usuario';
import { body, validationResult } from 'express-validator';
import createError from 'http-errors';
import { Scheduling } from '../../dataBase/scheduling';
import { tratarErro } from '../../utils/errors';

export = (app: Application) => {
  // Listar todos os agendamentos
  app.get(
    '/private/scheduling',
    async (req: Request, res: Response, next: NextFunction) => {
      Scheduling.getSchedules()
        .then(agendamentos => {
          res.json({
            message: 'Agendamentos recuperados com sucesso.',
            agendamentos,
          });
        })
        .catch(err => {
          next(
            createError(
              HTTP_ERRORS.ERRO_INTERNO,
              err.message || 'Erro ao listar agendamentos.'
            )
          );
        });
    }
  );

  // Buscar agendamento por ID
  app.get(
    '/private/scheduling/:id',
    async (req: Request, res: Response, next: NextFunction) => {
      Scheduling.getScheduleById(req.params.id)
        .then(agendamento => {
          res.json({
            message: 'Agendamento recuperado com sucesso.',
            agendamento,
          });
        })
        .catch(err => {
          next(
            createError(
              HTTP_ERRORS.REGISTRO_NAO_ENCONTRADO,
              err.message || 'Agendamento não encontrado.'
            )
          );
        });
    }
  );

  // Buscar agendamentos por ID de usuário
  app.get(
    '/private/userScheduling/:userId',
    async (req: Request, res: Response, next: NextFunction) => {
      Scheduling.getScheduleByUserId(req.params.userId)
        .then(agendamentos => {
          res.json({
            message: 'Agendamentos do usuário recuperados com sucesso.',
            agendamentos,
          });
        })
        .catch(err => {
          next(
            createError(
              HTTP_ERRORS.VALIDACAO_DE_DADOS,
              err.message || 'Erro ao buscar agendamentos do usuário.'
            )
          );
        });
    }
  );

  // Buscar agendamentos por CRAS
  app.get(
    '/private/crasScheduling/:cras',
    async (req: Request, res: Response, next: NextFunction) => {
      Scheduling.getSchedulesByCras(Number(req.params.cras))
        .then(agendamentos => {
          res.json({
            message: 'Agendamentos do CRAS recuperados com sucesso.',
            agendamentos,
          });
        })
        .catch(err => {
          next(
            createError(
              HTTP_ERRORS.VALIDACAO_DE_DADOS,
              err.message || 'Erro ao buscar agendamentos do CRAS.'
            )
          );
        });
    }
  );

  // Criar agendamento
  app.post(
    '/private/registerScheduling',
    body('usuario_id').notEmpty(),
    body('data_hora').notEmpty(),
    body('cras').notEmpty(),
    body('cpf').notEmpty(),
    body('telefone').notEmpty(),
    body('criador_id').notEmpty(),
    async (req: Request, res: Response, next: NextFunction) => {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        const message = errors.array().map(err => err.msg);
        return next(createError(HTTP_ERRORS.BAD_REQUEST, message[0]));
      }

      const agendamento: SchedulingModel = { ...req.body };
      agendamento.data_hora = new Date(req.body.data_hora);

      Scheduling.createSchedule(agendamento)
        .then(result => {
          res.json({ message: 'Agendamento realizado com sucesso!', result });
        })
        .catch(err => {
          console.error(err);
          const errorMsg =
            tratarErro(err) || err.message || 'Erro ao criar agendamento.';
          next(createError(HTTP_ERRORS.ERRO_INTERNO, errorMsg));
        });
    }
  );

  // Atualizar agendamento
  app.put(
    '/private/updateScheduling/',
    async (req: Request, res: Response, next: NextFunction) => {
      const agendamentoId = req.query.id?.toString() ?? '';
      const usuarioParaAlteracao = req.query.usuario_id?.toString() ?? '';

      try {
        const agendamento = await Scheduling.getScheduleById(agendamentoId);
        const usuario = await Usuario.getUserById(usuarioParaAlteracao);

        if (!usuario || !agendamento.id) {
          const erro = usuario ? 'o agendamentoId é' : 'o usuario_id é';
          return next(createError(HTTP_ERRORS.BAD_REQUEST, `${erro} inválido`));
        }

        const usuarioProprietario = usuario.id === agendamento.usuario_id;
        if (
          usuario.tipo_usuario === TipoUsuario.comum &&
          !usuarioProprietario
        ) {
          return next(
            createError(
              HTTP_ERRORS.ACESSO_NAO_AUTORIZADO,
              'Você não tem permissão para alterar este agendamento.'
            )
          );
        }

        const updatedAgendamento = { ...agendamento, ...req.body };
        await Scheduling.updateSchedule(updatedAgendamento);
        res.json({ message: 'Agendamento atualizado com sucesso!' });
      } catch (err: any) {
        const errorMsg =
          tratarErro(err) || err.message || 'Erro ao atualizar agendamento.';
        next(createError(HTTP_ERRORS.ERRO_INTERNO, errorMsg));
      }
    }
  );

  // Deletar agendamento
  app.delete(
    '/private/deleteScheduling/',
    async (req: Request, res: Response, next: NextFunction) => {
      const agendamentoId = req.query.id?.toString() ?? '';
      const adminId = req.query.funcionarioId?.toString() ?? '';

      try {
        const agendamento = await Scheduling.getScheduleById(agendamentoId);
        const superAdmin = await Usuario.getUserById(adminId);

        if (!superAdmin || !agendamento.id) {
          const erro = superAdmin ? 'o agendamentoId é' : 'o usuario_id é';
          return next(createError(HTTP_ERRORS.BAD_REQUEST, `${erro} inválido`));
        }

        if (superAdmin.tipo_usuario !== TipoUsuario.superAdmin) {
          return next(
            createError(
              HTTP_ERRORS.ACESSO_NAO_AUTORIZADO,
              'Você não tem permissão para excluir este agendamento.'
            )
          );
        }

        const result = await Scheduling.deleteSchedule(agendamento.id);
        if (result) {
          res.json({ message: 'O agendamento foi excluído!' });
        } else {
          res
            .status(HTTP_ERRORS.REGISTRO_NAO_ENCONTRADO)
            .json({ message: 'Agendamento não encontrado!' });
        }
      } catch (err: any) {
        const errorMsg =
          tratarErro(err) || err.message || 'Erro ao excluir agendamento.';
        next(createError(HTTP_ERRORS.ERRO_INTERNO, errorMsg));
      }
    }
  );
};
