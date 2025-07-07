//@ts-nocheck
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AsrWsClient, convertAudioBuffer } from './vol_stt';
import { EventsGateway } from './events.gateway';
import * as fs from 'fs';
import * as path from 'path';
import { BehaviorSubject } from 'rxjs';
import OpenAI from 'openai';
import { isEqual } from 'lodash';

const baseDir = `${process.cwd()}/audio`;

interface SessionData {
  sessionId: string;

  messages: {
    role: string;
    content: string;
    startTime: number;
    definite: boolean;
  }[];
  systemActions: {
    role: string;
    content: any;
    startTime: number;
  }[];
  summaring: boolean;
}

export class Session {
  data: SessionData;
  subs: Map<any, BehaviorSubject<any>> = new Map();
  constructor(sessionId: string) {
    this.data = {
      sessionId,
      messages: [],
      systemActions: [],
      summaring: false,
    };
  }
  updateMessage(messages: { role: string; content: string; startTime: number }[]) {
    const newMessages = messages.filter((m) => m.definite);
    console.log('updateMessage1111-----', this.data.messages, newMessages);
    if (newMessages.length === 0) {
      return;
    }
    console.log('updateMessage2222-----', this.data.messages, newMessages);
    if (isEqual(this.data.messages, newMessages)) {
      return;
    }
    console.log('updateMessage3333-----', this.data.messages, newMessages);
    this.data.messages = newMessages;
    for (const subject of this.subs.values()) {
      subject.next({
        type: 'message',
        sessionId: this.data.sessionId,
        data: newMessages,
      });
    }
  }
  sub(key: any) {
    const subject = new BehaviorSubject<any>(null);
    this.subs.set(key, subject);
    subject.next({
      type: 'session',
      sessionId: this.data.sessionId,
      data: this.data,
    });
    return subject;
  }
}

@Injectable()
export class EventsService {
  constructor(private configService: ConfigService) {}
  private sttClient: Map<string, AsrWsClient> = new Map();
  private sttFirstChunk: Map<string, Buffer> = new Map();
  private sessionDataMap: Map<string, Session> = new Map();
  private chunk: number = 1;
  createSession(sessionId: string) {
    const session = new Session(sessionId);
    this.sessionDataMap.set(sessionId, session);
    return session;
  }
  async bufferToStt(sessionId: string, buffer: Buffer) {
    if (!this.sessionDataMap.has(sessionId)) {
      return;
    }
    if (!this.sttClient.has(sessionId)) {
      const clusterId = this.configService.get<string>('stt_clusterId') ?? '';
      const token = this.configService.get<string>('stt_ak') ?? '';
      const appid = this.configService.get<string>('stt_appId') ?? '';
      const sttClient = new AsrWsClient(clusterId, {
        token,
        appid: appid,
        cluster: clusterId,
        format: 'wav',
      });
      this.sttClient.set(sessionId, sttClient);
      this.sttFirstChunk.set(sessionId, buffer);
      sttClient.observer?.subscribe((data) => {
        console.log('receive data-----', data);
        if ((data ?? []).length > 0) {
          const session = this.sessionDataMap.get(sessionId);
          console.log('session-----', session);
          if (!session) {
            return;
          }
          session?.updateMessage(data ?? []);
        }
      });
      // 第一帧不要
      return;
    }
    const sttClient = this.sttClient.get(sessionId);
    await sttClient?.initPromise;
    const firstChunk = this.sttFirstChunk.get(sessionId) as Buffer;
    const newBuffer = Buffer.concat([firstChunk, buffer]);
    // this.bufferToFile(buffer, `${sessionId}__${this.chunk}.mp4`);
    this.chunk++;
    const wavBuffer = await convertAudioBuffer(newBuffer, {
      inputFormat: 'mp4',
      outputFormat: 'wav',
    });
    sttClient?.execute(wavBuffer);
  }
  subscribeSession(clientId: string, sessionId: string) {
    const session = this.sessionDataMap.get(sessionId);
    console.log('subscribeSession-----', clientId, sessionId, session);

    return session?.sub(clientId);
  }
  bufferToFile(buffer: Buffer, filename: string) {
    writeOrAppendFile(path.join(baseDir, filename), buffer);
  }
}

// 在类外部或文件末尾添加这个函数
export function writeOrAppendFile(
  filePath: string,
  data: Buffer | string,
): void {
  try {
    // 检查目录是否存在，不存在则创建
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // 使用 appendFileSync 方法 - 如果文件不存在会创建，存在则追加
    fs.appendFileSync(filePath, data);

    // console.log(`成功写入/追加到文件: ${filePath}`);
  } catch (error) {
    // console.error(`写入/追加文件失败: ${error?.message}`);
    throw error;
  }
}
