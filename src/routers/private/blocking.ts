import { BloqueioAgendamentoModel, Cras, TipoUsuario, UserModel } from './../../models/model';
import { Application, NextFunction, Request, Response } from 'express';
import { BloqueioAgendamento } from "../../dataBase/bloqueioAgendamento";
import createError from 'http-errors';
import { HTTP_ERRORS } from '../../models/model';
import { body, validationResult } from 'express-validator';
import { tratarErro } from '../../utils/errors';
import { Usuario } from '../../dataBase/usuario';


export = (app: Application) => {

  app.get(
    '/private/block_scheduling',
    async (req: Request, res: Response, next: NextFunction) => {

      await BloqueioAgendamento.getBloqueiosAgendamento()
      .then(bloqueios => {
        res.json({
          message: 'bloqueios recuperados com sucesso',
          contas: bloqueios,
        });
      })
      .catch(erro => {
        next(createError(HTTP_ERRORS.VALIDACAO_DE_DADOS, erro));
      });
    }
  );

  app.get(
    '/private/block_schedulingById/:id',
    async (req: Request, res: Response, next: NextFunction) => {

      await BloqueioAgendamento.getBloqueioAgendamentoById(req.body.id)
      .then(bloqueio => {
        res.json({
          message: 'bloqueio recuperados com sucesso',
          contas: bloqueio,
        });
      })
      .catch(erro => {
        next(createError(HTTP_ERRORS.VALIDACAO_DE_DADOS, erro));
      });
    }
  );

  app.post(
    "/private/registerBlock",
    body().isArray(),

    async (req: Request, res: Response, next: NextFunction) => {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        const message = errors.array().map( erro => erro.msg);
        next(createError(HTTP_ERRORS.BAD_REQUEST, message[0]));
      }
      
      //A req.body vem como um falso array indexado, sendo necessário transformar em array para então mapear e validar os dados.
      const bloqueiosReq: [] = { ...req.body }
      const bloqueioArray = Object.values(bloqueiosReq); //transforma o objeto indexado (falso array) em um array verdadeiro

      let erroBool: boolean = false;
      let erroMsg: string[] = [];
      let erroMsgUnificado: string = '';
      
      bloqueioArray.forEach( (bloqueio: BloqueioAgendamentoModel) => { //validações unitárias das props de bloqueio
        if (!bloqueio.usuario_id || !bloqueio.data) {
          const prop = bloqueio.usuario_id ? "data" : "usuario_id"; 
          erroMsg.push(`É obrigatório informar a propriedade ${prop}`)
          erroBool = true;
        }
        if (!bloqueio.cras || !bloqueio.tipo_bloqueio) {
          const prop = bloqueio.cras ? "tipo_bloqueio" : "cras";
          erroMsg.push(`É obrigatório informar a propriedade ${prop}`) 
          erroBool = true;
        }
        erroMsgUnificado = erroMsg.join(", ")
      })
      
      if(erroBool) return next(createError(HTTP_ERRORS.BAD_REQUEST, erroMsgUnificado));

      //faz a tipagem do array e converte a data para o tipo necessário
      const bloqueiosMapeados: BloqueioAgendamentoModel[] = bloqueioArray.map((bloqueio: BloqueioAgendamentoModel) => {
        return { ...bloqueio, data: new Date(bloqueio.data)};
      })

      await BloqueioAgendamento.createBloqueioAgendamento(bloqueiosMapeados)
      .then((result) => {
        res.json({ message: "bloqueio(s) criados com sucesso!", result });
      })
      .catch((erro) => {
        console.error(erro);
        next(createError(HTTP_ERRORS.ERRO_INTERNO, tratarErro(erro)));
      }); 
    }
  )

  app.put(
    '/private/updateBlock/',
    async (req: Request, res: Response, next: NextFunction) => {
      let bloqueioId = req.query.id?.toString() ?? "";
      let usuarioParaAlteracao = req.query.usuario_id?.toString() ?? "";

      let bloqueio: BloqueioAgendamentoModel = await BloqueioAgendamento.getBloqueioAgendamentoById(bloqueioId);
      let usuario: UserModel = await Usuario.getUserById(usuarioParaAlteracao);

      if(!usuario || !bloqueio.id){
        const erro = usuario ? "o agendamentoId é" : "o usuario_id é"; 
        return next(
          createError(HTTP_ERRORS.BAD_REQUEST, `${erro} inválido`)
        );
      }

      if(usuario.tipo_usuario != TipoUsuario.superAdmin) 
          return next(createError(HTTP_ERRORS.BAD_REQUEST, "Você não tem permissão para atualizar esse bloqueio!"))

      if(!bloqueio.ativo)
          return next(createError(HTTP_ERRORS.BAD_REQUEST, "Este bloqueio ja foi cancelado!"))

      bloqueio = {...bloqueio, ...req.body}

      await BloqueioAgendamento.updateBloqueioAgendamento(bloqueio)
      .then(() => {
        res.json({ message: "Bloqueio atualizado com sucesso!" });
      })
      .catch((erro) => {
        console.error(erro);
        next(createError(HTTP_ERRORS.ERRO_INTERNO, tratarErro(erro)));
      }); 
    }
  )
}