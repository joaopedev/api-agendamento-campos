export enum HTTP_ERRORS {
  SUCESSO = 200, // Sucesso na criação do cadastro
  BAD_REQUEST = 400, // Dados inválidos
  ACESSO_NAO_AUTORIZADO = 401, // Não autorizado para criar cadastro
  ROTA_NAO_ENCONTRADA = 404, // Rota não encontrada
  CONFLICT = 409, // conflito interno
  ERRO_INTERNO = 500, // Erro interno do servidor
  ERRO_API_EXTERNA = 403, // Erro ao realizar uma solicitação externa
  DUPLICACAO_DE_DADOS = 409, // Cadastro duplicado
  LIMITE_DE_USO_EXCEDIDO = 429, // Limite de uso excedido
  VALIDACAO_DE_DADOS = 422, // Falha na validação de dados
  REGISTRO_NAO_ENCONTRADO = 404, // Registro não encontrado (caso específico)
  OUTRO_ERRO = 550, // Outro erro não mapeado
}

export interface UserModel {
  id?: string;
  name: string;
  email?: string;
  cpf: string;
  data_nascimento: string;
  password: string;
  telefone: string;
  endereco: Endereco;
  tipo_usuario: TipoUsuario;
  cras: Cras;
  ativo: boolean;
  password_reset_token?: string;
  password_reset_expires?: Date;
  [key: string]: any; //key necessária para atualizar o usuário na requisição de update, utilizando um FOR para leitura das props
}

interface Endereco {
  rua: string;
  numero: number;
  bairro: string;
}

export enum TipoUsuario {
  comum = 1,
  admin,
  superAdmin,
}

export interface SchedulingModel {
  id?: string;
  name: string;
  usuario_id: string;
  servico: TipoServico;
  description: string;
  duracao_atendimento: number;
  data_hora: Date;
  cras: Cras;
  status: Status;
}

export enum Status {
  cancelado = 0,
  realizado,
  pendente,
  ausente,
}

export enum Cras {
  CODIN = 1,
  CUSTODÓPOLIS,
  JARDIM_CARIOCA,
  ESPLANADA,
  CHATUBA,
  MATADOURO,
  PENHA,
  GOITACAZES,
  PARQUE_GUARUS,
  TRAVESSAO,
  MORRO_DO_COCO,
  FAROL,
  JOCKEY,
  URURAÍ,
  PRAÇA_CÉU,
}

export enum TipoServico {
  cadastramento = 1,
  outros,
}

export enum ErrosBDModel {
  UNIQUE_VIOLATION = 23505,
}

export interface BloqueioAgendamentoModel {
  id?: string;
  usuario_id: string;
  cras: number;
  data: Date;
  tipo_bloqueio: 'matutino' | 'vespertino' | 'diario'; // Tipos de bloqueio
  motivo: string;
  ativo: boolean;
}
