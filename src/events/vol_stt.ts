//@ts-nocheck
/**
 * TypeScript implementation of ASR WebSocket client
 * Requires: Node.js with ws package
 *
 * npm install ws
 * npm install @types/ws
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as zlib from 'zlib';
import * as url from 'url';
import { WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { BehaviorSubject } from 'rxjs';
import { Readable } from 'stream';
import * as ffmpeg from 'fluent-ffmpeg';
import { path as ffmpegPath } from '@ffmpeg-installer/ffmpeg';
import { isBuffer } from 'util';

enum AudioType {
  LOCAL = 1, // 使用本地音频文件
}

// Protocol constants
const PROTOCOL_VERSION = 0b0001;
const DEFAULT_HEADER_SIZE = 0b0001;

// Message Types
const CLIENT_FULL_REQUEST = 0b0001;
const CLIENT_AUDIO_ONLY_REQUEST = 0b0010;
const SERVER_FULL_RESPONSE = 0b1001;
const SERVER_ACK = 0b1011;
const SERVER_ERROR_RESPONSE = 0b1111;

// Message Type Specific Flags
const NO_SEQUENCE = 0b0000; // no check sequence
const POS_SEQUENCE = 0b0001;
const NEG_SEQUENCE = 0b0010;
const NEG_SEQUENCE_1 = 0b0011;

// Message Serialization
const NO_SERIALIZATION = 0b0000;
const JSON_SERIALIZATION = 0b0001;
const THRIFT = 0b0011;
const CUSTOM_TYPE = 0b1111;

// Message Compression
const NO_COMPRESSION = 0b0000;
const GZIP = 0b0001;
const CUSTOM_COMPRESSION = 0b1111;

interface AsrClientOptions {
  appid: string;
  token: string;
  cluster: string;
  seg_duration?: number;
  nbest?: number;
  ws_url?: string;
  uid?: string;
  workflow?: string;
  show_language?: boolean;
  show_utterances?: boolean;
  result_type?: string;
  format?: string;
  sample_rate?: number;
  language?: string;
  bits?: number;
  channel?: number;
  codec?: string;
  audio_type?: AudioType;
  secret?: string;
  auth_method?: string;
  mp3_seg_size?: number;
}

interface AudioItem {
  id: string | number;
  path: string;
}

interface RequestParams {
  app: {
    appid: string;
    cluster: string;
    token: string;
  };
  user: {
    uid: string;
  };
  request: {
    reqid: string;
    nbest: number;
    workflow: string;
    show_language: boolean;
    show_utterances: boolean;
    result_type: string;
    sequence: number;
  };
  audio: {
    format: string;
    rate: number;
    language: string;
    bits: number;
    channel: number;
    codec: string;
  };
}

export class AsrWsClient {
  private audio_path: string;
  private cluster: string;
  private success_code: number = 1000;
  private seg_duration: number;
  private nbest: number;
  private appid: string;
  private token: string;
  private ws_url: string;
  private uid: string;
  private workflow: string;
  private show_language: boolean;
  private show_utterances: boolean;
  private result_type: string;
  private format: string;
  private rate: number;
  private language: string;
  private bits: number;
  private channel: number;
  private codec: string;
  private audio_type: AudioType;
  private secret: string;
  private auth_method: string;
  private mp3_seg_size: number;
  private ws: WebSocket | null = null;
  observer: BehaviorSubject<any> | null = new BehaviorSubject();
  initPromise: Promise<any>;
  initResolve: (value: any) => void;
  initReject: (reason?: any) => void;
  constructor(cluster: string, options: AsrClientOptions) {
    this.cluster = cluster;
    this.seg_duration = options.seg_duration || 15000;
    this.nbest = options.nbest || 1;
    this.appid = options.appid;
    this.token = options.token;
    this.ws_url = options.ws_url || 'wss://openspeech.bytedance.com/api/v2/asr';
    this.uid = options.uid || 'streaming_asr_demo';
    this.workflow =
      options.workflow ||
      'audio_in,resample,partition,vad,fe,decode,itn,nlu_punctuate';
    this.show_language = options.show_language || false;
    this.show_utterances = options.show_utterances || true;
    this.result_type = options.result_type;
    this.format = options.format || 'wav';
    this.rate = options.sample_rate || 16000;
    this.language = options.language || 'zh-CN';
    this.bits = options.bits || 16;
    this.channel = options.channel || 1;
    this.codec = options.codec || 'raw';
    this.audio_type = options.audio_type || AudioType.LOCAL;
    this.secret = options.secret || 'access_secret';
    this.auth_method = options.auth_method || 'token';
    this.mp3_seg_size = options.mp3_seg_size || 10000;
    this.initPromise = new Promise((resolve, reject) => {
      this.initResolve = resolve;
      this.initReject = reject;
    });
    this.init();
  }

  private constructRequest(reqid: string): RequestParams {
    return {
      app: {
        appid: this.appid,
        cluster: this.cluster,
        token: this.token,
      },
      user: {
        uid: this.uid,
      },
      request: {
        reqid: reqid,
        nbest: this.nbest,
        workflow: this.workflow,
        show_language: this.show_language,
        show_utterances: this.show_utterances,
        result_type: this.result_type,
        sequence: 1,
      },
      audio: {
        format: this.format,
        rate: this.rate,
        language: this.language,
        bits: this.bits,
        channel: this.channel,
        codec: this.codec,
      },
    };
  }

  private static generateHeader(
    version: number = PROTOCOL_VERSION,
    message_type: number = CLIENT_FULL_REQUEST,
    message_type_specific_flags: number = NO_SEQUENCE,
    serial_method: number = JSON_SERIALIZATION,
    compression_type: number = GZIP,
    reserved_data: number = 0x00,
    extension_header: Buffer = Buffer.alloc(0),
  ): Buffer {
    const header = Buffer.alloc(4 + extension_header.length);
    const header_size = Math.floor(extension_header.length / 4) + 1;
    header[0] = (version << 4) | header_size;
    header[1] = (message_type << 4) | message_type_specific_flags;
    header[2] = (serial_method << 4) | compression_type;
    header[3] = reserved_data;
    extension_header.copy(header, 4);
    return header;
  }

  private static generateFullDefaultHeader(): Buffer {
    return AsrWsClient.generateHeader();
  }

  private static generateAudioDefaultHeader(): Buffer {
    return AsrWsClient.generateHeader(
      PROTOCOL_VERSION,
      CLIENT_AUDIO_ONLY_REQUEST,
    );
  }

  private static generateLastAudioDefaultHeader(): Buffer {
    return AsrWsClient.generateHeader(
      PROTOCOL_VERSION,
      CLIENT_AUDIO_ONLY_REQUEST,
      NEG_SEQUENCE,
    );
  }

  private static parseResponse(res: Buffer): {
    code: number;
    payload_msg: AsrResponse;
    payload_size: number;
    seq: number;
  } {
    const protocol_version = res[0] >> 4;
    const header_size = res[0] & 0x0f;
    const message_type = res[1] >> 4;
    const message_type_specific_flags = res[1] & 0x0f;
    const serialization_method = res[2] >> 4;
    const message_compression = res[2] & 0x0f;
    const reserved = res[3];
    const header_extensions = res.slice(4, header_size * 4);
    const payload = res.slice(header_size * 4);

    const result: any = {};
    let payload_msg = null;
    let payload_size = 0;

    if (message_type === SERVER_FULL_RESPONSE) {
      payload_size = payload.readInt32BE(0);
      payload_msg = payload.slice(4);
    } else if (message_type === SERVER_ACK) {
      const seq = payload.readInt32BE(0);
      result['seq'] = seq;
      if (payload.length >= 8) {
        payload_size = payload.readUInt32BE(4);
        payload_msg = payload.slice(8);
      }
    } else if (message_type === SERVER_ERROR_RESPONSE) {
      const code = payload.readUInt32BE(0);
      result['code'] = code;
      payload_size = payload.readUInt32BE(4);
      payload_msg = payload.slice(8);
    }

    if (payload_msg === null) {
      return result;
    }

    if (message_compression === GZIP) {
      payload_msg = zlib.gunzipSync(payload_msg);
    }

    if (serialization_method === JSON_SERIALIZATION) {
      payload_msg = JSON.parse(payload_msg.toString('utf-8'));
    } else if (serialization_method !== NO_SERIALIZATION) {
      payload_msg = payload_msg.toString('utf-8');
    }

    result['payload_msg'] = payload_msg;
    result['payload_size'] = payload_size;
    return result;
  }

  private tokenAuth(): { [key: string]: string } {
    return { Authorization: `Bearer; ${this.token}` };
  }

  private signatureAuth(data: Buffer): { [key: string]: string } {
    const header_dicts: { [key: string]: string } = {
      Custom: 'auth_custom',
    };

    const parsedUrl = new url.URL(this.ws_url);
    let input_str = `GET ${parsedUrl.pathname} HTTP/1.1\n`;
    const auth_headers = 'Custom';

    for (const header of auth_headers.split(',')) {
      input_str += `${header_dicts[header]}\n`;
    }

    const input_data = Buffer.concat([Buffer.from(input_str, 'utf-8'), data]);

    const mac = crypto
      .createHmac('sha256', this.secret)
      .update(input_data)
      .digest('base64url');

    header_dicts['Authorization'] =
      `HMAC256; access_token="${this.token}"; mac="${mac}"; h="${auth_headers}"`;
    return header_dicts;
  }
  private async init(): Promise<any> {
    const reqid = uuidv4();

    // 构建 full client request，并序列化压缩
    const requestParams = this.constructRequest(reqid);
    const payloadStr = JSON.stringify(requestParams);
    const payloadBytes = zlib.gzipSync(Buffer.from(payloadStr, 'utf-8'));

    const fullClientRequest = Buffer.concat([
      AsrWsClient.generateFullDefaultHeader(),
      Buffer.alloc(4), // 为 payload size 预留空间
      payloadBytes,
    ]);

    // 写入 payload size
    fullClientRequest.writeUInt32BE(payloadBytes.length, 4);

    let header: { [key: string]: string } = {};
    if (this.auth_method === 'token') {
      header = this.tokenAuth();
    } else if (this.auth_method === 'signature') {
      header = this.signatureAuth(fullClientRequest);
    }

    const ws = new WebSocket(this.ws_url, { headers: header });
    let result: any = {};
    let dataGenerator: Generator<[Buffer, boolean]> | null = null;
    let currentIterator: IteratorResult<[Buffer, boolean]> | null = null;
    this.ws = ws;
    ws.on('open', () => {
      // 发送 full client request
      ws.send(fullClientRequest);
    });

    ws.on('message', (data: Buffer) => {
      const response = AsrWsClient.parseResponse(data);
      if (response?.payload_msg?.reqid === reqid) {
        this.initResolve(response);
      }
      const result = response?.payload_msg?.result ?? [];
      const utterances = result.map((item) => item.utterances ?? []).flat();
      const messages = utterances.map((u) => {
        return {
          content: u.text,
          startTime: u.start_time,
          definite: u.definite,
        };
      });
      // console.log('messages-----', result[0].text);
      this.observer?.next(messages);
      if (
        'payload_msg' in response &&
        response.payload_msg.code !== this.success_code
      ) {
        ws.close();
        this.observer?.complete();
        return;
      }
    });

    ws.on('close', () => {
      this.observer?.complete();
    });

    ws.on('error', (error) => {
      this.observer?.error(error);
    });
  }
  public async execute(data: Buffer): Promise<any> {
    const compressedChunk = zlib.gzipSync(data);
    let audioOnlyRequest: Buffer;
    const last = false;
    if (last) {
      audioOnlyRequest = Buffer.concat([
        AsrWsClient.generateLastAudioDefaultHeader(),
        Buffer.alloc(4),
        compressedChunk,
      ]);
    } else {
      audioOnlyRequest = Buffer.concat([
        AsrWsClient.generateAudioDefaultHeader(),
        Buffer.alloc(4),
        compressedChunk,
      ]);
    }

    audioOnlyRequest = Buffer.concat([
      AsrWsClient.generateAudioDefaultHeader(),
      Buffer.alloc(4),
      compressedChunk,
    ]);
    // 写入 payload size
    audioOnlyRequest.writeUInt32BE(compressedChunk.length, 4);
    // 发送 audio-only client request
    console.log('audioOnlyRequest----', audioOnlyRequest.length);
    this.ws.send(audioOnlyRequest);
  }
}

interface Utterance {
  text: string;
  start_time: number;
  end_time: number;
  /**是否完成一句 */
  definite: boolean;
}

interface RecognitionResult {
  text: string;
  confidence: number;
  utterances?: Utterance[];
}

interface AsrResponse {
  reqid: string;
  code: number;
  message: string;
  sequence?: number;
  result?: RecognitionResult[];
}

/**
 * 将音频/视频 Buffer 转换为指定格式的 Buffer
 * @param {Buffer} inputBuffer - 输入的音频/视频 Buffer
 * @param {Object} options - 转换选项
 * @param {string} options.inputFormat - 输入格式 (例如 'mp3', 'wav', 'webm')
 * @param {string} options.outputFormat - 输出格式 (例如 'mp3', 'wav', 'aac')
 * @param {Object} [options.ffmpegOptions] - 额外的 FFmpeg 选项
 * @returns {Promise<Buffer>} 转换后的 Buffer
 */
ffmpeg.setFfmpegPath(ffmpegPath);
export async function convertAudioBuffer(inputBuffer, options) {
  return new Promise((resolve, reject) => {
    // 创建可读流从 Buffer
    const inputStream = new Readable();
    inputStream.push(inputBuffer);
    inputStream.push(null); // 表示流结束

    // 存储输出数据的数组
    const outputBuffers = [];

    // 设置 FFmpeg 命令
    const command = ffmpeg({ source: inputStream }).outputFormat(
      options.outputFormat,
    );

    // 应用额外的 FFmpeg 选项
    if (options.ffmpegOptions) {
      for (const [key, value] of Object.entries(options.ffmpegOptions)) {
        command.outputOption(`-${key} ${value}`);
      }
    }
    // 将输出定向到内存而不是文件
    command
      .pipe()
      .on('data', (chunk) => {
        outputBuffers.push(chunk);
      })
      .on('end', () => {
        // 合并所有输出 buffer
        const outputBuffer = Buffer.concat(outputBuffers);
        // writeOrAppendFile('./audio/test.wav', outputBuffer);
        resolve(outputBuffer);
      })
      .on('error', (err) => {
        reject(new Error(`FFmpeg 处理错误: ${err?.message}`));
      });
  });
}

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
