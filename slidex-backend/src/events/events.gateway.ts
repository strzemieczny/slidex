// src/events/events.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*', // W środowisku deweloperskim zezwalamy na wszystkie połączenia
  },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    console.log(`🔌 Klient połączony do WebSocket: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`❌ Klient rozłączony: ${client.id}`);
  }

  // Zdarzenie: Aktualizacja stanu toru
  notifyLaneUpdated(laneCode: string, action: 'SCAN_IN' | 'SCAN_OUT') {
    this.server.emit('lane:updated', {
      laneCode,
      action,
      timestamp: new Date(),
    });
  }

  // Zdarzenie: Błąd FIFO (Wycofanie / Alarm na Dashboardzie)
  notifyFifoViolation(data: {
    laneCode: string;
    scanned: string;
    expected: string;
  }) {
    this.server.emit('fifo:violation', { ...data, timestamp: new Date() });
  }
}
