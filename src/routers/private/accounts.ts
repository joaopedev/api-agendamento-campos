import { HTTP_ERRORS, TipoUsuario, UserModel } from '../../models/model';
import createError from 'http-errors';
import { Usuario } from '../../dataBase/usuario';
import { Application, NextFunction, Request, Response } from 'express';
import { encodePassword, comparePasswords } from '../../utils/bcrypFunctions';
import { Scheduling } from '../../dataBase/scheduling';

export = (app: Application) => {
  app.get(
    '/private/account',
    async (req: Request, res: Response, next: NextFunction) => {
      await Usuario.getUsers()
        .then(contas => {
          res.json({
            message: 'Contas recuperadas com sucesso',
            contas: contas,
          });
        })
        .catch(erro => {
          next(createError(HTTP_ERRORS.VALIDACAO_DE_DADOS, erro));
        });
    }
  );

  app.get(
    '/private/accountEmployeer',
    async (req: Request, res: Response, next: NextFunction) => {
      await Usuario.getUsersFuncionarios()
        .then(contas => {
          res.json({
            message: 'Contas recuperadas com sucesso',
            contas: contas,
          });
        })
        .catch(erro => {
          next(createError(HTTP_ERRORS.VALIDACAO_DE_DADOS, erro));
        });
    }
  );

  app.get(
    '/private/accountById/:id',
    async (req: Request, res: Response, next: NextFunction) => {
      let id_usuario = req.params.id;

      await Usuario.getUserById(id_usuario)
        .then(conta => {
          res.json({
            message: 'Conta recuperada com sucesso',
            contas: conta,
          });
        })
        .catch(erro => {
          next(createError(HTTP_ERRORS.VALIDACAO_DE_DADOS, erro));
        });
    }
  );

  app.get(
    '/private/accountByCpf/:cpf',
    async (req: Request, res: Response, next: NextFunction) => {
      let cpf_usuario = req.params.cpf;

      await Usuario.getUserByCpf(cpf_usuario)
        .then(conta => {

          if(!conta) return next(createError(HTTP_ERRORS.VALIDACAO_DE_DADOS, 'Não foi encontrado nenhum usuário com este CPF!'));

          res.json({
            message: 'Conta recuperada com sucesso',
            contas: conta,
          });
        })
        .catch(erro => {
          next(createError(HTTP_ERRORS.VALIDACAO_DE_DADOS, erro));
        });
    }
  );

  app.get(
    '/private/accountByCras/:cras',
    async (req: Request, res: Response, next: NextFunction) => {
      let cras_usuario = req.params.cras;

      await Usuario.getFuncionariosByCras(+cras_usuario)
        .then(conta => {

          if(!conta) return next(createError(HTTP_ERRORS.VALIDACAO_DE_DADOS, 'Não foi encontrado nenhum funcionário deste CRAS!'));

          res.json({
            message: 'Contas recuperadas com sucesso',
            contas: conta,
          });
        })
        .catch(erro => {
          next(createError(HTTP_ERRORS.VALIDACAO_DE_DADOS, erro));
        });
    }
  );

  app.put(
    '/private/updateAccount/:id',
    async (req: Request, res: Response, next: NextFunction) => {
      let usuario: UserModel = await Usuario.getUserById(req.params.id);

      if (!usuario)
        return next(createError(HTTP_ERRORS.BAD_REQUEST, 'Id Invalido!'));

      const propsEnviadas: { [key: string]: any } = req.body;                    //recebe as props da requisição e lê os nomes como key do tipo string

      for (const prop in propsEnviadas) {                                        // for que varre as prop da requisição
        if (Object.hasOwnProperty.call(propsEnviadas, prop)) {                   //validação se a prop do loop se encontra de fato com valor dentro do objeto PAI
          
          if(propsEnviadas[prop] === "") 
            return next(createError(HTTP_ERRORS.ERRO_INTERNO, `A propriedade ${prop} está vazia, por favor insira um valor válido!`));
          
          if (prop == 'password' && (propsEnviadas[prop] && propsEnviadas[prop].length > 0) ) {     // validação de prop para password que confere se possui valor
            if (!comparePasswords(req.body.password, usuario.password)) {
              const hashPassword = encodePassword(req.body.password);
              usuario.password = hashPassword;
            }
          }
          
          if (usuario.hasOwnProperty(prop) && propsEnviadas[prop] && prop != 'password') {             //validação para atribuir valor a todas as prop do usuario que não seja o password.
            usuario[prop] = propsEnviadas[prop];
          }
        }
      }

      await Usuario.updateUser(usuario)
        .then(result => {
          if (result) {
            res.json({ message: 'Dados atualizados com sucesso' });
          } else {
            res.status(404).json({ result });
          }
        })
        .catch(erro => {
          next(createError(HTTP_ERRORS.ERRO_INTERNO, erro));
        });
    }
  );

  app.delete(
    '/private/deleteAccount/',
    async (req: Request, res: Response, next: NextFunction) => {
      let usuarioId = req.query.id?.toString() ?? '';
      let adminId = req.query.funcionarioId?.toString() ?? '';

      let usuarioDelete: UserModel = await Usuario.getUserById(usuarioId);
      let usuarioAdmin: UserModel = await Usuario.getUserById(adminId);

      if (!usuarioDelete.id || !usuarioAdmin)
        return next(
          createError(HTTP_ERRORS.BAD_REQUEST, 'Id para exclusão Invalido!')
        );

      if (usuarioAdmin.tipo_usuario != TipoUsuario.superAdmin)
        return next(
          createError(
            HTTP_ERRORS.BAD_REQUEST,
            'Você não tem permissão para excluir usuarios!'
          )
        );

      const agendamentosDoUsuario = await Scheduling.getScheduleByUserId(
        usuarioDelete.id
      );

      if (agendamentosDoUsuario.length > 0) {
        const deletou = await Scheduling.deleteUserSchedules(usuarioDelete.id);
        if (!deletou)
          return next(
            createError(
              HTTP_ERRORS.ERRO_INTERNO,
              'Ocorreu um erro ao tentar excluir os agendamentos deste usuário!'
            )
          );
      }

      await Usuario.deleteUser(usuarioDelete.id)
        .then(result => {
          if (result) {
            res.json({
              message: 'Usuário e agendamentos deletados com sucesso',
            });
          } else {
            res.status(404).json(result);
          }
        })
        .catch(erro => {
          next(createError(HTTP_ERRORS.ERRO_INTERNO, erro));
        });
    }
  );
};
