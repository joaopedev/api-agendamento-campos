import { Application, NextFunction, Request, Response } from "express";

export = (app: Application) => {
  /**
   * @api { get } /info Informações da API
   * @apiGroup Info
   *
   * @apiSuccess {String} message API em operação
   *
   * @apiSuccessExample {json} Sucesso
   *
   *    HTTP/1.1 200 OK
   *    {
   *      "message":"API em operação!"
   *    }
   *
   */

  app.get("/info", (req: Request, res: Response, next: NextFunction) => {
    res.json({ message: "API em operação!" });
  });
};
