// Install the required packages by executing the command "npm install assemblyai stream node-record-lpcm16"

import { Readable, Transform } from 'stream'
import { AssemblyAI } from 'assemblyai'
import { BehaviorSubject } from 'rxjs';

/**
 * 创建一个切片和节流的Transform stream
 * @param chunkSize 每个切片的大小（字节）
 * @param sendInterval 发送间隔（毫秒）
 * @returns Transform stream
 */
export function createChunkAndThrottleStream(chunkSize: number = 20 * 1024, sendInterval: number = 500) {
  let lastSendTime = 0;
  
  return new Transform({
    transform(chunk: Buffer, encoding, callback) {
      const processChunk = (data: Buffer, offset = 0) => {
        if (offset >= data.length) {
          callback();
          return;
        }
        
        const remainingBytes = data.length - offset;
        const currentChunkSize = Math.min(chunkSize, remainingBytes);
        const slicedChunk = data.subarray(offset, offset + currentChunkSize);
        
        const now = Date.now();
        const timeSinceLastSend = now - lastSendTime;
        
        // 如果距离上次发送时间小于间隔，则延迟发送
        if (timeSinceLastSend < sendInterval) {
          const delay = sendInterval - timeSinceLastSend;
          setTimeout(() => {
            console.log('pushed chunk:', currentChunkSize, 'bytes', `(${offset + currentChunkSize}/${data.length})`);
            this.push(slicedChunk);
            lastSendTime = Date.now();
            processChunk(data, offset + currentChunkSize);
          }, delay);
        } else {
          console.log('pushed chunk:', currentChunkSize, 'bytes', `(${offset + currentChunkSize}/${data.length})`);
          this.push(slicedChunk);
          lastSendTime = now;
          processChunk(data, offset + currentChunkSize);
        }
      };
      
      processChunk(chunk);
    }
  });
}

/**
 * 创建一个简单的切片Transform stream（不包含时间控制）
 * @param chunkSize 每个切片的大小（字节）
 * @returns Transform stream
 */
export function createChunkStream(chunkSize: number = 20 * 1024) {
  return new Transform({
    transform(chunk: Buffer, encoding, callback) {
      const processChunk = (data: Buffer, offset = 0) => {
        if (offset >= data.length) {
          callback();
          return;
        }
        
        const remainingBytes = data.length - offset;
        const currentChunkSize = Math.min(chunkSize, remainingBytes);
        const slicedChunk = data.subarray(offset, offset + currentChunkSize);
        this.push(slicedChunk);
        processChunk(data, offset + currentChunkSize);
      };
      
      processChunk(chunk);
    }
  });
}

/**
 * 创建一个节流Transform stream（控制发送频率）
 * @param sendInterval 发送间隔（毫秒）
 * @returns Transform stream
 */
export function createThrottleStream(sendInterval: number = 500) {
  let lastSendTime = 0;
  
  return new Transform({
    transform(chunk: Buffer, encoding, callback) {
      const now = Date.now();
      const timeSinceLastSend = now - lastSendTime;
      
      if (timeSinceLastSend < sendInterval) {
        const delay = sendInterval - timeSinceLastSend;
        setTimeout(() => {
          console.log('throttled chunk:', chunk.length, 'bytes');
          this.push(chunk);
          lastSendTime = Date.now();
          callback();
        }, delay);
      } else {
        console.log('throttled chunk:', chunk.length, 'bytes');
        this.push(chunk);
        lastSendTime = now;
        callback();
      }
    }
  });
}

/**
 * 创建一个监听Transform stream（记录通过的数据）
 * @param label 日志标签
 * @returns Transform stream
 */
export function createMonitorStream(label: string = 'Monitor') {
  return new Transform({
    transform(chunk: Buffer, encoding, callback) {
      console.log(`📤 ${label}:`, chunk.length, 'bytes');
      this.push(chunk);
      callback();
    }
  });
}


export class AssemblyAIStt {
  private client: AssemblyAI;
  private transcriber: any;
  public observer: BehaviorSubject<string> = new BehaviorSubject<string>('');
  private audioStream: Readable;
  private isConnected: boolean = false;
  
  constructor() {
    this.client = new AssemblyAI({
      apiKey: process.env.ASSEMBLYAI_API_KEY ?? '',   // Replace with your chosen API key, this is the "default" account api key,
    });
    
    // 创建一个内部的Readable Stream来收集Buffer数据
    this.audioStream = new Readable({
      read() {
        // 不需要实现，因为我们会通过push方法主动推送数据
      }
    });
    
    this.initializeTranscriber();
  }
  
  private initializeTranscriber() {
    this.transcriber = this.client.streaming.transcriber({
      sampleRate: 16_000,
      formatTurns: true
    });

    this.transcriber.on("open", ({ id }) => {
      console.log(`Session opened with ID: ${id}`);
      this.isConnected = true;
    });

    this.transcriber.on("error", (error) => {
      console.error("Transcriber Error:", error);
      this.isConnected = false;
    });

    this.transcriber.on("close", (code, reason) => {
      console.log("Session closed:", code, reason);
      this.isConnected = false;
    });

    this.transcriber.on("turn", (turn) => {
      console.log('turn-----', turn);
      if (!turn.transcript) {
        return;
      }
      console.log('turn.transcript-----', turn.transcript);
      this.observer.next(turn.transcript);
    });
  }
  
  // 开始转录，连接到AssemblyAI服务
  async startTranscription() {
    try {
      console.log("Connecting to streaming transcript service");
      await this.transcriber.connect();
      
      // 使用工具方法创建切片和节流的Transform stream
      const chunkAndThrottleStream = createChunkAndThrottleStream(20 * 1024, 500);
      
      // 创建一个监听Transform stream来记录发送到transcriber的数据
      const monitorStream = new Transform({
        transform(chunk: Buffer, encoding, callback) {
          console.log('📤 Sending to transcriber.stream():', chunk.length, 'bytes');
          this.push(chunk);
          callback();
        }
      });
      
      // 将audioStream通过transform stream连接到transcriber
      Readable.toWeb(this.audioStream.pipe(chunkAndThrottleStream)).pipeTo(this.transcriber.stream());
      
      console.log("Transcription started, ready to receive audio data");
    } catch (error) {
      console.error("Failed to start transcription:", error);
    }
  }
  
  // 接收Buffer数据并推送到Stream
  onReceive(data: Buffer) {
    console.log('receive audio data-----', data.length, 'bytes');
    
    if (!this.isConnected) {
      console.warn("Transcriber not connected, dropping audio data");
      return;
    }
    
    // 直接推送到audioStream，切片和时间控制由Transform stream处理
    this.audioStream.push(data);
  }
  
  // 结束音频流
  endAudioStream() {
    this.audioStream.push(null); // 发送EOF信号
  }
  
  // 关闭转录连接
  async close() {
    try {
      this.endAudioStream();
      if (this.transcriber) {
        await this.transcriber.close();
      }
      console.log("Transcription closed");
    } catch (error) {
      console.error("Error closing transcription:", error);
    }
  }
}