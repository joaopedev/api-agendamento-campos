import { Application, NextFunction, Request, Response } from "express";
import { HTTP_ERRORS, SchedulingModel, TipoUsuario, UserModel } from "../../models/model";
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
    "/private/userScheduling/:userId",
    async (req: Request, res: Response, next: NextFunction) => {

      await Scheduling.getScheduleByUserId(req.body.userId)
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

      await Scheduling.getSchedulesByCras(req.body.cras)
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
    body("usuarioId").notEmpty(),
    body("data_hora").notEmpty(),
    body("cras").notEmpty(),

    async (req: Request, res: Response, next: NextFunction) => {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return next(createError(HTTP_ERRORS.VALIDACAO_DE_DADOS,
          JSON.stringify(errors.array()))
        );
      }
      
      const agendamento: SchedulingModel = { ...req.body };

      if (!agendamento.usuarioId || !agendamento.data_hora) {
        const erro = agendamento.usuarioId ? "data_hora" : "usuarioId"; 
        return next(
          createError(HTTP_ERRORS.BAD_REQUEST, `${erro} inválido`)
        );
      }

      await Scheduling.createSchedule(agendamento)
      .then(() => {
        res.json({ message: "Agendamento marcado com sucesso!" });
      })
      .catch((erro) => {
          console.error(erro);
          next(createError(HTTP_ERRORS.ERRO_INTERNO, tratarErro(erro)));
      }); 
    }
  );

  app.put(
    "/private/updateScheduling/:id",
    async (req: Request, res: Response, next: NextFunction) => {

      let agendamento: SchedulingModel = await Scheduling.getScheduleById(req.params.id);
      
      if(!agendamento) return next(createError(HTTP_ERRORS.BAD_REQUEST, "Id de agendamento invalido!"));
      
      agendamento = { ...req.body };

      if (!agendamento.usuarioId || !agendamento.data_hora) {
        const erro = agendamento.usuarioId ? "data_hora" : "usuarioId"; 
        return next(
          createError(HTTP_ERRORS.BAD_REQUEST, `${erro} inválido`)
        );
      }

      await Scheduling.updateSchedule(agendamento)
      .then(() => {
        res.json({ message: "Agendamento marcado com sucesso!" });
      })
      .catch((erro) => {
          console.error(erro);
          next(createError(HTTP_ERRORS.ERRO_INTERNO, tratarErro(erro)));
      }); 

    }
  );

  app.delete(
    "/private/deleteScheduling/:id",
    async (req: Request, res: Response, next: NextFunction) => {

      let agendamentoDelete: SchedulingModel = await Scheduling.getScheduleById(req.params.id);
      let usuario: UserModel = await Usuario.getUserById(req.body.usuarioId);
      
      if(!usuario.id || !agendamentoDelete.id){
        const erro = usuario ? "o agendamentoId é" : "o usuarioId é"; 
        return next(
          createError(HTTP_ERRORS.BAD_REQUEST, `${erro} inválido`)
        );
      }
      
      const usuarioProprietario = usuario.id == agendamentoDelete.usuarioId;

      if((usuario.tipoUsuario == TipoUsuario.comum && !usuarioProprietario) || usuario.tipoUsuario != TipoUsuario.comum) 
        return next(createError(HTTP_ERRORS.BAD_REQUEST, "Você não tem permissão para excluir esse agendamento!"));

      await Scheduling.deleteSchedule(agendamentoDelete.id)
        .then((result) => {
          if (result) {
            res.json({ message: "Dados atualizados com sucesso" });
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
