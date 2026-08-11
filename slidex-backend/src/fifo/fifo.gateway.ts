import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class FifoGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  handleConnection(client: Socket) {
    console.log(`🔌 [Socket.io] Podłączono klienta: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`❌ [Socket.io] Rozłączono klienta: ${client.id}`);
  }

  @SubscribeMessage('join:zone')
  handleJoinZone(
    @MessageBody() groupId: string,
    @ConnectedSocket() client: Socket,
  ) {
    if (!groupId) return;

    if (groupId === 'ALL') {
      void client.join('ALL_ZONES');
      console.log(`🌍 TV Board (${client.id}) nasłuchuje CAŁEJ HALI.`);
    } else {
      void client.join(groupId);
      void client.join(groupId.toUpperCase());
      console.log(
        `📺 TV Board (${client.id}) dołączył do pokoju strefy: ${groupId}`,
      );
    }
  }

  notifyLaneUpdated(laneCode: string, action: 'IN' | 'OUT') {
    this.server.emit('lane:updated', {
      laneCode,
      action,
      timestamp: new Date().toISOString(),
    });
  }

  notifyFifoViolation(laneCode: string, scanned: string, expected: string) {
    this.server.emit('fifo:violation', {
      laneCode,
      scanned,
      expected,
      timestamp: new Date().toISOString(),
    });
  }

  @SubscribeMessage('pick:highlight')
  @SubscribeMessage('pick:light')
  handlePickHighlight(
    @MessageBody()
    data: {
      type?: 'IN' | 'OUT';
      groupId?: string;
      rackCode: string;
      partNumber: string;
      targetLaneCode?: string;
    },
    @ConnectedSocket() client: Socket,
  ) {
    console.log(
      `💡 [Highlight Event] Skaner ${client.id} (Typ: ${data?.type || 'ALL'}) w strefie ${data?.groupId || 'GLOBAL'}:`,
      data,
    );

    const payload = {
      type: data?.type || 'IN',
      rackCode: data?.rackCode || '',
      partNumber: data?.partNumber || '',
      targetLaneCode: data?.targetLaneCode || '',
      timestamp: new Date().toISOString(),
    };

    if (data.groupId && data.groupId !== 'ALL') {
      this.server
        .to(data.groupId)
        .to(data.groupId.toUpperCase())
        .to('ALL_ZONES')
        .emit('pick:highlight', payload);
    } else {
      this.server.emit('pick:highlight', payload);
    }

    return { status: 'ok' };
  }
}
