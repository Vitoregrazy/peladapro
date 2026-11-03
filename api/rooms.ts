import type { Request, Response } from 'express';
import {
  buildInitialRoom,
  getActiveStorageType,
  getRoomState,
  saveRoomState,
} from '../src/services/vercelDb';

/**
 * Vercel Serverless Function Handler (/api/rooms & /api/rooms/:code)
 * Persists and synchronizes room state with Vercel Postgres (or memory fallback).
 */
export default async function handler(req: Request, res: Response) {
  // Enable CORS for Android APK (Capacitor) & Web clients
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const queryCode =
      (typeof req.query?.code === 'string' ? req.query.code : '') ||
      (req.params?.code ? String(req.params.code) : '');

    if (req.method === 'GET') {
      const code = (queryCode || 'SOC-10').toUpperCase().trim();
      let room = await getRoomState(code);
      if (!room && code === 'SOC-10') {
        room = await saveRoomState(
          buildInitialRoom('SOC-10', 'Pelada Society de Terça 21h', 'Vitor (Organizador)')
        );
      }
      if (!room) {
        res.status(404).json({ error: 'Sala não encontrada.' });
        return;
      }
      res.status(200).json({
        room,
        storage: getActiveStorageType(),
      });
      return;
    }

    if (req.method === 'POST') {
      const { code: requestedCode, name, hostName, customState } = req.body || {};
      const randomSuffix = Math.floor(100 + Math.random() * 900);
      const code = requestedCode
        ? String(requestedCode).toUpperCase().trim()
        : `FUT-${randomSuffix}`;

      const baseRoom = buildInitialRoom(
        code,
        name || 'Pelada Privada Ao Vivo',
        hostName || 'Organizador'
      );

      if (customState) {
        if (Array.isArray(customState.players)) baseRoom.players = customState.players;
        if (customState.rules) baseRoom.rules = customState.rules;
        if (Array.isArray(customState.drawnTeams)) baseRoom.drawnTeams = customState.drawnTeams;
        if (customState.coinToss) baseRoom.coinToss = customState.coinToss;
        if (customState.liveMatch) baseRoom.liveMatch = customState.liveMatch;
        if (customState.championship !== undefined) {
          baseRoom.championship = customState.championship;
        }
      }

      const saved = await saveRoomState(baseRoom);
      res.status(200).json({
        room: saved,
        storage: isVercelDbConfigured() ? 'vercel_postgres' : 'memory_fallback',
      });
      return;
    }

    if (req.method === 'PUT' || req.method === 'PATCH') {
      const { roomCode, payload, activityText, action, player, playerId, userName, role } =
        req.body || {};
      const targetCode = (queryCode || roomCode || 'SOC-10').toUpperCase().trim();
      let room = await getRoomState(targetCode);

      if (!room) {
        room = buildInitialRoom(targetCode, `Arena ${targetCode}`, userName || 'Organizador');
      }

      if (action === 'join' && userName) {
        const cleanUser = String(userName).trim();
        room.participants = room.participants.filter((p) => p.name !== cleanUser);
        room.participants.push({
          clientId: `http-${Date.now()}`,
          name: cleanUser,
          role: role === 'host' ? 'host' : 'guest',
          joinedAt: Date.now(),
        });
        room.activityFeed = [
          {
            id: `act-${Date.now()}`,
            text: `${cleanUser} conectou-se à sala`,
            timestamp: Date.now(),
          },
          ...room.activityFeed.slice(0, 19),
        ];
      } else if (action === 'add_player' && player && player.id) {
        if (!room.players.some((p) => p.id === player.id)) {
          room.players.push(player);
          room.activityFeed = [
            {
              id: `act-${Date.now()}`,
              text: `${player.name} confirmou presença na lista (${
                player.isGoalkeeper ? 'Goleiro' : 'Linha'
              })`,
              timestamp: Date.now(),
            },
            ...room.activityFeed.slice(0, 19),
          ];
        }
      } else if (action === 'toggle_presence' && playerId) {
        const target = room.players.find((p) => p.id === playerId);
        if (target) {
          target.confirmed = !target.confirmed;
          room.activityFeed = [
            {
              id: `act-${Date.now()}`,
              text: `${target.name} ${
                target.confirmed ? 'confirmou presença' : 'saiu da lista'
              }`,
              timestamp: Date.now(),
            },
            ...room.activityFeed.slice(0, 19),
          ];
        }
      } else if (payload) {
        if (payload.players) room.players = payload.players;
        if (payload.rules) room.rules = payload.rules;
        if (payload.drawnTeams) room.drawnTeams = payload.drawnTeams;
        if (payload.coinToss) room.coinToss = payload.coinToss;
        if (payload.liveMatch) room.liveMatch = payload.liveMatch;
        if (payload.championship !== undefined) {
          room.championship = payload.championship;
        }
      }

      if (activityText) {
        room.activityFeed = [
          {
            id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            text: String(activityText),
            timestamp: Date.now(),
          },
          ...room.activityFeed.slice(0, 19),
        ];
      }

      const saved = await saveRoomState(room);
      res.status(200).json({
        room: saved,
        storage: isVercelDbConfigured() ? 'vercel_postgres' : 'memory_fallback',
      });
      return;
    }

    res.status(405).json({ error: 'Método não permitido.' });
  } catch (err) {
    console.error('Erro na API /api/rooms:', err);
    res.status(500).json({ error: 'Erro interno ao processar sala no banco de dados.' });
  }
}
