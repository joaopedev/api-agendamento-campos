import amqp, { Channel, Connection } from 'amqplib';
import dotenv from 'dotenv';
dotenv.config();

export class RabbitMQService {
  private connection: Connection | null = null;
  private channel: Channel | null = null;
  private readonly queue = 'generic_queue'; // Fila genérica
 
  //configuração da rota do container do rabbitMq local ou em produção
  private readonly isProduction = process.env.NODE_ENV === 'production';
  private readonly amqpUrl = this.isProduction ? String(process.env.CLOUDAMQP_URL) : String(process.env.RABBITLOCAL);

  // Conectar ao RabbitMQ
  async connect() {
    if (this.connection && this.channel) return; // Se já estiver conectado, não faz nada

    this.connection = await amqp.connect(this.amqpUrl);
    this.channel = await this.connection.createChannel();

    // Garantir que a fila exista
    await this.channel.assertQueue(this.queue, { durable: true });

    console.log('Conectado ao RabbitMQ e aguardando mensagens...');
  }

  // Enviar uma mensagem para a fila
  async sendToQueue(message: object) {
    if (!this.channel) {
      await this.connect(); // Conecta ao RabbitMQ se não estiver conectado
      if (!this.channel) throw new Error('Canal não está conectado ao RabbitMQ.');
    }

    this.channel.sendToQueue(this.queue, Buffer.from(JSON.stringify(message)), {
      persistent: true,
    });
    console.log('Mensagem enviada para a fila:', message);
  }

  // Consumir mensagens da fila (usado pelo worker)
  async consumeFromQueue(callback: (msg: any) => void) {
    if (!this.channel) throw new Error('Canal não está conectado ao RabbitMQ.');

    // Configura o número de mensagens a serem pré-buscadas pelo worker
    await this.channel?.prefetch(5);

    console.log('Iniciando o consumo da fila...');
    this.channel.consume(this.queue, (msg) => {
      if (msg) {
        try {

          const content = JSON.parse(msg.content.toString());

          console.log("Mensagem recebida"); // Log de debug para verificar a mensagem
          callback(content);

          this.channel?.ack(msg); // Confirma que a mensagem foi processada

        } catch (error) {
          console.error('Erro ao processar mensagem:', error);
      
          // O nack indica que houve um erro e reprocessa a mensagem
          this.channel?.nack(msg, false, true);  // 'false' não rejeita a mensagem e 'true' coloca na fila novamente
        }
      }
    }, { noAck: false }); // `noAck: false` significa que a mensagem não será removida até que o ack seja enviado
  }

  // Fechar conexão (quando necessário)
  async close() {
    if (this.connection) {
      await this.connection.close();
      console.log('Conexão com RabbitMQ fechada');
    }
  }
}
