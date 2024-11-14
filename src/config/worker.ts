import { Scheduling } from '../dataBase/scheduling';
import { Usuario } from '../dataBase/usuario';
import { QueueMessage, SchedulingModel, UserModel } from '../models/model';
import { RabbitMQService } from './rabbitmq';

// Mapeamento dos tipos de mensagens para funções de processamento
// taskHandlers é uma configuração genérica, onde a chave é uma string
// e o valor é uma função que recebe dados e retorna uma Promise.
const taskHandlers: { [key: string]: (data: any) => Promise<void> } = {   //A chave pode ser qualquer string, e os valores serão funções que recebem dados de qualquer tipo
  CREATE_SCHEDULING: handleCreateScheduling,
  UPDATE_USER: handleUpdateUser,
};

// Função principal que processa a mensagem
async function processMessage(message: QueueMessage) {
  console.log('Processando mensagem:');

  const handler = taskHandlers[message.type]; // Recupera o handler com base no tipo da mensagem

  if (handler) {
    console.log('processando o tipo da mensagem: ',message.type);
    await handler(message.data); // Chama a função correspondente
  } else {
    console.error('Tipo de mensagem não reconhecido:', message.type);
  }
}

// Função para processar o agendamento
async function handleCreateScheduling(data: SchedulingModel) {
  try {
    console.log('chegou na criação do agendamento')
    const scheduling = await Scheduling.createSchedule(data);
    
  } catch (error) {
    console.error('Erro ao criar agendamento:', error);
  }
}

// Função para atualizar o usuário
async function handleUpdateUser(data: UserModel) {
  try {
    const user = await Usuario.updateUser(data);
    console.log('Usuário atualizado com sucesso:', user.name);
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
  }
}

// Consumir as mensagens da fila
export async function startWorker() {
  const rabbitMQ = new RabbitMQService();

  try {
    
    await rabbitMQ.connect();
    console.log('Conexão com RabbitMQ estabelecida com sucesso.');

    await rabbitMQ.consumeFromQueue(processMessage);

  } catch (error) {
    console.error('Erro no worker:', error);
  }
}
