import { Application, NextFunction, Request, Response } from "express";
import {  HTTP_ERRORS, SchedulingModel, TipoUsuario, UserModel } from "../../models/model";
import { Usuario } from "../../dataBase/usuario";
import { body, validationResult } from "express-validator";
import createError from "http-errors";
import { Scheduling } from "../../dataBase/scheduling";
import { tratarErro } from "../../utils/errors";

export = (app: Application) => {

  app.get(
    "/private/scheduling",
    async (req: Request, res: Response, next: NextFunction) => {

      await Scheduling.getSchedules()
        .then((agendamentos) => {
          res.json({
            message: "agendamentos recuperados com sucesso",
            agendamentos: agendamentos,
          });
        })
        .catch((erro) => {
          next(createError(HTTP_ERRORS.VALIDACAO_DE_DADOS, erro));
        });
    }
  );

  app.get(
    "/private/scheduling/:id",
    async (req: Request, res: Response, next: NextFunction) => {

      await Scheduling.getScheduleById(req.params.id)
        .then((agendamento) => {
          res.json({
            message: "agendamento recuperado com sucesso",
            agendamentos: agendamento,
          });
        })
        .catch((erro) => {
          next(createError(HTTP_ERRORS.VALIDACAO_DE_DADOS, erro));
        });
    }
  );

  app.get(
    "/private/userScheduling/:userId",
    async (req: Request, res: Response, next: NextFunction) => {

      await Scheduling.getScheduleByUserId(req.params.userId)
        .then((agendamentos) => {
          res.json({
            message: "agendamentos recuperados com sucesso",
            agendamentos: agendamentos,
          });
        })
        .catch((erro) => {
          next(createError(HTTP_ERRORS.VALIDACAO_DE_DADOS, erro));
        });
    }
  );

  app.get(
    "/private/crasScheduling/:cras",
    async (req: Request, res: Response, next: NextFunction) => {

      await Scheduling.getSchedulesByCras(Number(req.params.cras))
        .then((agendamentos) => {
          res.json({
            message: "agendamentos recuperados com sucesso",
            agendamentos: agendamentos,
          });
        })
        .catch((erro) => {
          next(createError(HTTP_ERRORS.VALIDACAO_DE_DADOS, erro));
        });
    }
  );

  app.post(
    "/private/registerScheduling",
    body("usuario_id").notEmpty(),
    body("data_hora").notEmpty(),
    body("cras").notEmpty(),

    async (req: Request, res: Response, next: NextFunction) => {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        const message = errors.array().map( erro => erro.msg);
        next(createError(HTTP_ERRORS.BAD_REQUEST, message[0]));
      }
      
      const agendamento: SchedulingModel = { ...req.body };
      
      agendamento.data_hora = new Date(req.body.data_hora);

      if (!agendamento.usuario_id || !agendamento.data_hora) {
        const erro = agendamento.usuario_id ? "data_hora" : "usuario_id"; 
        return next(
          createError(HTTP_ERRORS.BAD_REQUEST, `É obrigatório informar a propriedade ${erro}`)
        );
      }

      await Scheduling.createSchedule(agendamento)
      .then((result) => {
        res.json({ message: "Agendamento realizado com sucesso!", result });
      })
      .catch((erro) => {
          console.error(erro);
          next(createError(HTTP_ERRORS.ERRO_INTERNO, tratarErro(erro)));
      }); 
    }
  );

  app.put(
    "/private/updateScheduling/",
    async (req: Request, res: Response, next: NextFunction) => {

      let agendamentoId = req.query.id?.toString() ?? "";
      let usuarioParaAlteracao = req.query.usuario_id?.toString() ?? "";

      let agendamento: SchedulingModel = await Scheduling.getScheduleById(agendamentoId);
      let usuario: UserModel = await Usuario.getUserById(usuarioParaAlteracao);

      if(!usuario || !agendamento.id){
        const erro = usuario ? "o agendamentoId é" : "o usuario_id é"; 
        return next(
          createError(HTTP_ERRORS.BAD_REQUEST, `${erro} inválido`)
        );
      }
      
      const usuarioProprietario = usuario.id == agendamento.usuario_id;

      if(usuario.tipo_usuario == TipoUsuario.comum && !usuarioProprietario) 
        return next(createError(HTTP_ERRORS.BAD_REQUEST, "Você não tem permissão para alterar esse agendamento!"));

      agendamento = { ...agendamento ,...req.body };

      await Scheduling.updateSchedule(agendamento)
      .then(() => {
        res.json({ message: "Agendamento atualizado com sucesso!" });
      })
      .catch((erro) => {
          console.error(erro);
          next(createError(HTTP_ERRORS.ERRO_INTERNO, tratarErro(erro)));
      }); 

    }
  );

  app.delete(
    "/private/deleteScheduling/",
    async (req: Request, res: Response, next: NextFunction) => {
      let agendamentoId = req.query.id?.toString() ?? "";
      let adminId = req.query.funcionarioId?.toString() ?? "";

      let agendamentoDelete: SchedulingModel = await Scheduling.getScheduleById(agendamentoId);
      let superAdmin: UserModel = await Usuario.getUserById(adminId);
      
      if(!superAdmin || !agendamentoDelete.id){
        const erro = superAdmin ? "o agendamentoId é" : "o usuario_id é"; 
        return next(
          createError(HTTP_ERRORS.BAD_REQUEST, `${erro} inválido`)
        );
      }

      if(superAdmin.tipo_usuario != TipoUsuario.superAdmin) 
        return next(createError(HTTP_ERRORS.BAD_REQUEST, "Você não tem permissão para excluir esse agendamento!"));

      await Scheduling.deleteSchedule(agendamentoDelete.id)
        .then((result) => {
          if (result) {
            res.json({ message: "O agendamento foi excluído!" });
          } else {
            res.status(404).json(result);
          }
        })
        .catch((erro) => {
          next(createError(HTTP_ERRORS.ERRO_INTERNO, erro));
        });
    }
  );

}
