import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { v4 } from 'uuid';
import { EventsService } from './events.service';
import { Socket, Server } from 'socket.io';
import { tap } from 'rxjs';

type SessionId = string;

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class EventsGateway implements OnGatewayConnection<Socket> {
  constructor(private eventService: EventsService) {}
  @WebSocketServer()
  server: Server;
  handleConnection(client: Socket) {
    const clientId = client.handshake.query.clientId as string;
    if (clientId) {
      // 将客户端加入以其ID命名的房间
      client.join(clientId);
      console.log(`Client ${clientId} joined its own room`);
    }
  }
  // 向特定客户端发送消息
  sendMessageToClient(clientId: string, event: string, data: any): boolean {
    // 向特定房间发送消息
    this.server.to(clientId).emit(event, data);
    return true;
  }

  @SubscribeMessage('events/session-start')
  async startSession(
    @MessageBody() data: { prefillInfo?: string },
  ): Promise<{ sessionId: SessionId }> {
    const sessionId = v4();
    this.eventService.createSession(sessionId);
    return { sessionId };
  }

  @SubscribeMessage('events/session-finish')
  async finishSession(
    @MessageBody() data: { sessionId: SessionId },
  ): Promise<void> {
    return;
  }

  @SubscribeMessage('events/session-data')
  async handleSessionData(
    @MessageBody() data: { sessionId: SessionId; data: Buffer },
  ): Promise<void> {
    const { sessionId, data: buffer } = data;
    this.eventService.bufferToStt(sessionId, buffer);
    // this.eventService.bufferToFile(buffer, `${sessionId}__${this.chunk}.mp4`);
    return;
  }
  @SubscribeMessage('events/session-subscribes')
  subscribeSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: SessionId },
  ) {
    console.log('subscribeSession-----', client.id, data.sessionId);

    const ob = this.eventService.subscribeSession(client.id, data.sessionId);
    const newOb = ob?.pipe(
      tap((data) => {
        console.log('emit onece-----', client.id, data);
      }),
    );
    newOb?.subscribe((data) => {
      client.emit('events/session-update', data);
    });
  }
}
